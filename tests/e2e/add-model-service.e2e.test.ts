import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import type { ProjectSpec } from "../../src/domain/index.js";
import { HarnessError } from "../../src/common/errors/index.js";
import { scaffold } from "../../src/service/scaffolder/index.js";
import { runAdd } from "../../src/cmd/add.js";
import { realFsAdapter } from "../../src/external/fs-adapter.js";

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

const saasSpec: ProjectSpec = {
  projectName: "e2e-model-svc-saas",
  rootPath: "",
  playbookId: "b2b-saas",
  matchMode: "exact",
  matchScore: 1,
  answers: [
    { questionId: "1", selectedOptionId: "A" },
    { questionId: "2", selectedOptionId: "B" },
    { questionId: "3", selectedOptionId: "B" },
    { questionId: "4", selectedOptionId: "C" },
    { questionId: "5", selectedOptionId: "B" },
    { questionId: "6", selectedOptionId: "B" },
    { questionId: "7", selectedOptionId: "B" },
    { questionId: "8", selectedOptionId: "B" },
    { questionId: "9", selectedOptionId: "B" },
  ],
  placeholders: {},
  generatedAt: "2026-04-27T00:00:00.000Z",
  trellisVersion: "0.0.0-e2e",
};

// ---------------------------------------------------------------------------
// Shared temp dir
// ---------------------------------------------------------------------------

let workDir: string;

beforeAll(() => {
  workDir = mkdtempSync(join(tmpdir(), "trellis-model-svc-e2e-"));
});

afterAll(() => {
  rmSync(workDir, { recursive: true, force: true });
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Case 1: b2b-saas + add model Invoice (multi-slot patch 검증)
// ---------------------------------------------------------------------------

describe("Case 1: b2b-saas add model Invoice — multi-slot patch", { timeout: 30_000 }, () => {
  let projectDir: string;

  beforeAll(async () => {
    projectDir = join(workDir, "case1-model-invoice");
    scaffold({ ...saasSpec, rootPath: projectDir, projectName: "e2e-model-invoice" });
    // suppress stdout
    vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    await runAdd("model", "Invoice", { force: false }, realFsAdapter, projectDir);
    vi.restoreAllMocks();
  });

  it("creates src/lib/zod/invoice.ts", () => {
    expect(existsSync(join(projectDir, "src/lib/zod/invoice.ts"))).toBe(true);
  });

  it("zod file contains invoiceSchema export", () => {
    const content = readFileSync(join(projectDir, "src/lib/zod/invoice.ts"), "utf-8");
    expect(content).toContain("invoiceSchema");
  });

  it("zod file contains Invoice type export", () => {
    const content = readFileSync(join(projectDir, "src/lib/zod/invoice.ts"), "utf-8");
    expect(content).toContain("Invoice");
    expect(content).toMatch(/export type Invoice/);
  });

  it("creates src/lib/db/invoice-repository.ts", () => {
    expect(existsSync(join(projectDir, "src/lib/db/invoice-repository.ts"))).toBe(true);
  });

  it("repository file contains InvoiceRepository class", () => {
    const content = readFileSync(join(projectDir, "src/lib/db/invoice-repository.ts"), "utf-8");
    expect(content).toContain("InvoiceRepository");
    expect(content).toMatch(/export class InvoiceRepository/);
  });

  it("repository has 5 methods: findById, list, create, update, delete", () => {
    const content = readFileSync(join(projectDir, "src/lib/db/invoice-repository.ts"), "utf-8");
    expect(content).toContain("findById");
    expect(content).toContain("list");
    expect(content).toContain("create");
    expect(content).toContain("update");
    expect(content).toContain("delete");
  });

  it("creates src/lib/db/invoice-repository.test.ts", () => {
    expect(existsSync(join(projectDir, "src/lib/db/invoice-repository.test.ts"))).toBe(true);
  });

  it("prisma/schema.prisma contains model Invoice { (prisma-models slot patch)", () => {
    const schema = readFileSync(join(projectDir, "prisma/schema.prisma"), "utf-8");
    expect(schema).toContain("model Invoice {");
  });

  it("src/lib/services.ts contains InvoiceRepository export (services slot patch)", () => {
    const services = readFileSync(join(projectDir, "src/lib/services.ts"), "utf-8");
    expect(services).toContain("InvoiceRepository");
  });

  it("prisma-models slot markers are preserved after patch", () => {
    const schema = readFileSync(join(projectDir, "prisma/schema.prisma"), "utf-8");
    expect(schema).toContain("// trellis:slot:prisma-models:start");
    expect(schema).toContain("// trellis:slot:prisma-models:end");
  });

  it("services slot markers are preserved after patch", () => {
    const services = readFileSync(join(projectDir, "src/lib/services.ts"), "utf-8");
    expect(services).toContain("// trellis:slot:services:start");
    expect(services).toContain("// trellis:slot:services:end");
  });
});

// ---------------------------------------------------------------------------
// Case 2: 멱등성 — model 두 번 add
// ---------------------------------------------------------------------------

describe("Case 2: idempotency — model Invoice added twice", { timeout: 30_000 }, () => {
  let projectDir: string;

  beforeAll(async () => {
    projectDir = join(workDir, "case2-idempotent");
    scaffold({ ...saasSpec, rootPath: projectDir, projectName: "e2e-idem-invoice" });

    // First add
    vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    await runAdd("model", "Invoice", { force: false }, realFsAdapter, projectDir);
    vi.restoreAllMocks();
  });

  it("second add (force: true) does not throw", async () => {
    vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    vi.spyOn(process.stderr, "write").mockImplementation(() => true);

    await expect(
      runAdd("model", "Invoice", { force: true }, realFsAdapter, projectDir),
    ).resolves.toBeUndefined();
  });

  it("model Invoice appears exactly once in schema.prisma", () => {
    const schema = readFileSync(join(projectDir, "prisma/schema.prisma"), "utf-8");
    const occurrences = schema.split("model Invoice {").length - 1;
    expect(occurrences).toBe(1);
  });

  it("InvoiceRepository export appears exactly once in services.ts", () => {
    const services = readFileSync(join(projectDir, "src/lib/services.ts"), "utf-8");
    const occurrences = services.split("InvoiceRepository").length - 1;
    expect(occurrences).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Case 3: model + service 순차 add — 풀 시나리오
// ---------------------------------------------------------------------------

describe("Case 3: full scenario — add model Invoice then add service InvoiceService", { timeout: 30_000 }, () => {
  let projectDir: string;

  beforeAll(async () => {
    projectDir = join(workDir, "case3-full-scenario");
    scaffold({ ...saasSpec, rootPath: projectDir, projectName: "e2e-full-scenario" });

    vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    vi.spyOn(process.stderr, "write").mockImplementation(() => true);

    await runAdd("model", "Invoice", { force: false }, realFsAdapter, projectDir);
    await runAdd("service", "InvoiceService", { force: false }, realFsAdapter, projectDir);

    vi.restoreAllMocks();
  });

  it("schema.prisma contains model Invoice exactly once", () => {
    const schema = readFileSync(join(projectDir, "prisma/schema.prisma"), "utf-8");
    const occurrences = schema.split("model Invoice {").length - 1;
    expect(occurrences).toBe(1);
  });

  it("services.ts contains InvoiceRepository export", () => {
    const services = readFileSync(join(projectDir, "src/lib/services.ts"), "utf-8");
    expect(services).toContain("InvoiceRepository");
  });

  it("services.ts contains InvoiceService export", () => {
    const services = readFileSync(join(projectDir, "src/lib/services.ts"), "utf-8");
    expect(services).toContain("InvoiceService");
  });

  it("both InvoiceRepository and InvoiceService are in services.ts", () => {
    const services = readFileSync(join(projectDir, "src/lib/services.ts"), "utf-8");
    expect(services).toContain("InvoiceRepository");
    expect(services).toContain("InvoiceService");
  });

  it("creates src/lib/service/invoice-service.ts", () => {
    expect(existsSync(join(projectDir, "src/lib/service/invoice-service.ts"))).toBe(true);
  });

  it("service file contains InvoiceService class", () => {
    const content = readFileSync(join(projectDir, "src/lib/service/invoice-service.ts"), "utf-8");
    expect(content).toContain("InvoiceService");
    expect(content).toMatch(/export class InvoiceService/);
  });
});

// ---------------------------------------------------------------------------
// Case 4: --json 출력 검증
// ---------------------------------------------------------------------------

describe("Case 4: --json output validation", { timeout: 30_000 }, () => {
  let projectDir: string;
  let parsedResult: Record<string, unknown>;

  beforeAll(async () => {
    projectDir = join(workDir, "case4-json");
    scaffold({ ...saasSpec, rootPath: projectDir, projectName: "e2e-json-invoice" });

    const stdoutChunks: string[] = [];
    vi.spyOn(process.stdout, "write").mockImplementation((chunk) => {
      stdoutChunks.push(chunk as string);
      return true;
    });
    vi.spyOn(process.stderr, "write").mockImplementation(() => true);

    await runAdd("model", "Invoice", { json: true }, realFsAdapter, projectDir);

    vi.restoreAllMocks();

    const stdout = stdoutChunks.join("");
    parsedResult = JSON.parse(stdout) as Record<string, unknown>;
  });

  it("stdout is valid JSON", () => {
    expect(parsedResult).toBeDefined();
  });

  it("ok is true", () => {
    expect(parsedResult["ok"]).toBe(true);
  });

  it('command is "add"', () => {
    expect(parsedResult["command"]).toBe("add");
  });

  it('playbookId is "b2b-saas"', () => {
    expect(parsedResult["playbookId"]).toBe("b2b-saas");
  });

  it('fragmentType is "model"', () => {
    expect(parsedResult["fragmentType"]).toBe("model");
  });

  it('name is "Invoice"', () => {
    expect(parsedResult["name"]).toBe("Invoice");
  });

  it("created array contains 3 new files (zod, repository, repository test)", () => {
    const created = parsedResult["created"] as string[];
    expect(Array.isArray(created)).toBe(true);
    expect(created.length).toBe(3);
    // zod schema
    expect(created.some((f) => f.includes("zod") && f.includes("invoice"))).toBe(true);
    // repository
    expect(created.some((f) => f.includes("invoice-repository.ts") && !f.includes("test"))).toBe(true);
    // repository test
    expect(created.some((f) => f.includes("invoice-repository.test.ts"))).toBe(true);
  });

  it("patches.applied contains 2 entries (prisma-models + services)", () => {
    const patches = parsedResult["patches"] as {
      applied: { file: string; slot: string; entryKey: string }[];
    };
    expect(Array.isArray(patches.applied)).toBe(true);
    expect(patches.applied.length).toBe(2);
  });

  it("patches.applied[0] is prisma-models slot patch", () => {
    const patches = parsedResult["patches"] as {
      applied: { file: string; slot: string; entryKey: string }[];
    };
    const prismaEntry = patches.applied.find((p) => p.slot === "prisma-models");
    expect(prismaEntry).toBeDefined();
    expect(prismaEntry?.file).toContain("schema.prisma");
    expect(prismaEntry?.entryKey).toContain("Invoice");
  });

  it("patches.applied[1] is services slot patch", () => {
    const patches = parsedResult["patches"] as {
      applied: { file: string; slot: string; entryKey: string }[];
    };
    const servicesEntry = patches.applied.find((p) => p.slot === "services");
    expect(servicesEntry).toBeDefined();
    expect(servicesEntry?.file).toContain("services.ts");
    expect(servicesEntry?.entryKey).toContain("InvoiceRepository");
  });

  it("dependencies object is present (zod already in package.json → skipped)", () => {
    const deps = parsedResult["dependencies"] as {
      added: string[];
      skipped: string[];
      conflicts: unknown[];
    } | undefined;
    // dependencies key should exist since package.json is present in b2b-saas scaffold
    expect(deps).toBeDefined();
    // zod is in the full-body already, so it may be skipped or added
    if (deps !== undefined) {
      expect(Array.isArray(deps.added) || Array.isArray(deps.skipped)).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// Case 5: actionable error — spec.json 없는 디렉토리에서 add
// ---------------------------------------------------------------------------

describe("Case 5: actionable error — no spec.json in directory", { timeout: 30_000 }, () => {
  let emptyDir: string;

  beforeAll(() => {
    emptyDir = join(workDir, "case5-no-spec");
    // mkdtempSync already created workDir; just create a subdir without scaffolding
    import("node:fs").then(({ mkdirSync }) => {
      mkdirSync(emptyDir, { recursive: true });
    });
  });

  it("throws HarnessError when spec.json is missing", async () => {
    // Ensure dir exists
    const { mkdirSync } = await import("node:fs");
    mkdirSync(emptyDir, { recursive: true });

    await expect(
      runAdd("model", "Invoice", { force: false }, realFsAdapter, emptyDir),
    ).rejects.toSatisfy((err: unknown) => {
      return err instanceof HarnessError;
    });
  });

  it("HarnessError has exitCode === 2 (UserInputError)", async () => {
    await expect(
      runAdd("model", "Invoice", { force: false }, realFsAdapter, emptyDir),
    ).rejects.toSatisfy((err: unknown) => {
      return err instanceof HarnessError && err.exitCode === 2;
    });
  });

  it('error.hint contains "trellis new"', async () => {
    await expect(
      runAdd("model", "Invoice", { force: false }, realFsAdapter, emptyDir),
    ).rejects.toSatisfy((err: unknown) => {
      if (!(err instanceof HarnessError)) return false;
      return err.hint !== undefined && err.hint.toLowerCase().includes("trellis new");
    });
  });
});
