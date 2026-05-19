import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { ProjectSpec } from "../../src/domain/index.js";
import { scaffold } from "../../src/service/scaffolder/index.js";
import { runAdd } from "../../src/cmd/add.js";
import { realFsAdapter } from "../../src/external/fs-adapter.js";
import type { AddJsonResult } from "../../src/cmd/add.js";

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

const saasSpec: ProjectSpec = {
  projectName: "e2e-form-admin-saas",
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
  workDir = mkdtempSync(join(tmpdir(), "trellis-form-admin-e2e-"));
});

afterAll(() => {
  rmSync(workDir, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// Case 1: form fragment 단독
// ---------------------------------------------------------------------------

describe("Case 1: form fragment — Invoice", { timeout: 30_000 }, () => {
  let projectDir: string;

  beforeAll(async () => {
    projectDir = join(workDir, "case1-form-invoice");
    scaffold({ ...saasSpec, rootPath: projectDir, projectName: "e2e-form-invoice" });

    vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    await runAdd("form", "Invoice", { force: false }, realFsAdapter, projectDir);
    vi.restoreAllMocks();
  });

  it("creates src/components/InvoiceForm.tsx", () => {
    expect(existsSync(join(projectDir, "src/components/InvoiceForm.tsx"))).toBe(true);
  });

  it("creates src/lib/zod/invoice-form.ts", () => {
    expect(existsSync(join(projectDir, "src/lib/zod/invoice-form.ts"))).toBe(true);
  });

  it("zod file contains invoiceFormSchema", () => {
    const content = readFileSync(join(projectDir, "src/lib/zod/invoice-form.ts"), "utf-8");
    expect(content).toContain("invoiceFormSchema");
  });

  it("zod file contains InvoiceFormInput type", () => {
    const content = readFileSync(join(projectDir, "src/lib/zod/invoice-form.ts"), "utf-8");
    expect(content).toContain("InvoiceFormInput");
  });

  it("creates src/components/InvoiceForm.test.tsx", () => {
    expect(existsSync(join(projectDir, "src/components/InvoiceForm.test.tsx"))).toBe(true);
  });

  it("nav-items.ts adminItems does NOT contain invoice (no admin patch)", () => {
    const nav = readFileSync(join(projectDir, "src/lib/nav-items.ts"), "utf-8");
    expect(nav).not.toContain("/admin/invoice");
  });

  it("breadcrumb-map.ts does NOT contain /admin/invoice (no admin patch)", () => {
    const breadcrumb = readFileSync(join(projectDir, "src/lib/breadcrumb-map.ts"), "utf-8");
    expect(breadcrumb).not.toContain("/admin/invoice");
  });
});

// ---------------------------------------------------------------------------
// Case 2: admin fragment + multi-slot patch
// ---------------------------------------------------------------------------

describe("Case 2: admin fragment — Invoice multi-slot patch", { timeout: 30_000 }, () => {
  let projectDir: string;

  beforeAll(async () => {
    projectDir = join(workDir, "case2-admin-invoice");
    scaffold({ ...saasSpec, rootPath: projectDir, projectName: "e2e-admin-invoice" });

    vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    await runAdd("admin", "Invoice", { force: false }, realFsAdapter, projectDir);
    vi.restoreAllMocks();
  });

  it("creates src/app/(authed)/admin/invoice/page.tsx", () => {
    expect(
      existsSync(join(projectDir, "src/app/(authed)/admin/invoice/page.tsx")),
    ).toBe(true);
  });

  it("creates src/app/(authed)/admin/invoice/InvoiceTable.tsx", () => {
    expect(
      existsSync(join(projectDir, "src/app/(authed)/admin/invoice/InvoiceTable.tsx")),
    ).toBe(true);
  });

  it("creates src/app/(authed)/admin/invoice/InvoiceFilter.tsx", () => {
    expect(
      existsSync(join(projectDir, "src/app/(authed)/admin/invoice/InvoiceFilter.tsx")),
    ).toBe(true);
  });

  it("creates src/app/(authed)/admin/invoice/actions.ts", () => {
    expect(
      existsSync(join(projectDir, "src/app/(authed)/admin/invoice/actions.ts")),
    ).toBe(true);
  });

  it("nav-items.ts adminItems contains Invoice label + /admin/invoice href (admin-items slot patch)", () => {
    const nav = readFileSync(join(projectDir, "src/lib/nav-items.ts"), "utf-8");
    expect(nav).toContain('label: "Invoice"');
    expect(nav).toContain('href: "/admin/invoice"');
  });

  it("breadcrumb-map.ts contains /admin/invoice: Invoice (breadcrumb slot patch)", () => {
    const breadcrumb = readFileSync(join(projectDir, "src/lib/breadcrumb-map.ts"), "utf-8");
    expect(breadcrumb).toContain('"/admin/invoice": "Invoice"');
  });

  it("admin-items slot markers are preserved after patch", () => {
    const nav = readFileSync(join(projectDir, "src/lib/nav-items.ts"), "utf-8");
    expect(nav).toContain("// trellis:slot:admin-items:start");
    expect(nav).toContain("// trellis:slot:admin-items:end");
  });

  it("breadcrumb slot markers are preserved after patch", () => {
    const breadcrumb = readFileSync(join(projectDir, "src/lib/breadcrumb-map.ts"), "utf-8");
    expect(breadcrumb).toContain("// trellis:slot:breadcrumb:start");
    expect(breadcrumb).toContain("// trellis:slot:breadcrumb:end");
  });
});

// ---------------------------------------------------------------------------
// Case 3: admin 멱등성
// ---------------------------------------------------------------------------

describe("Case 3: admin idempotency — Invoice added twice", { timeout: 30_000 }, () => {
  let projectDir: string;

  beforeAll(async () => {
    projectDir = join(workDir, "case3-admin-idempotent");
    scaffold({ ...saasSpec, rootPath: projectDir, projectName: "e2e-admin-idem" });

    vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    await runAdd("admin", "Invoice", { force: false }, realFsAdapter, projectDir);
    vi.restoreAllMocks();
  });

  it("second add (force: true) does not throw", async () => {
    vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    vi.spyOn(process.stderr, "write").mockImplementation(() => true);

    await expect(
      runAdd("admin", "Invoice", { force: true }, realFsAdapter, projectDir),
    ).resolves.toBeUndefined();

    vi.restoreAllMocks();
  });

  it("/admin/invoice appears exactly once in nav-items.ts after two adds", () => {
    const nav = readFileSync(join(projectDir, "src/lib/nav-items.ts"), "utf-8");
    const occurrences = nav.split('"/admin/invoice"').length - 1;
    expect(occurrences).toBe(1);
  });

  it("/admin/invoice appears exactly once in breadcrumb-map.ts after two adds", () => {
    const breadcrumb = readFileSync(join(projectDir, "src/lib/breadcrumb-map.ts"), "utf-8");
    const occurrences = breadcrumb.split("/admin/invoice").length - 1;
    expect(occurrences).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Case 4: 통합 시나리오 — model → service → form → admin
// ---------------------------------------------------------------------------

describe("Case 4: integration — model → service → form → admin", { timeout: 30_000 }, () => {
  let projectDir: string;

  beforeAll(async () => {
    projectDir = join(workDir, "case4-integration");
    scaffold({ ...saasSpec, rootPath: projectDir, projectName: "e2e-integration" });

    vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    vi.spyOn(process.stderr, "write").mockImplementation(() => true);

    await runAdd("model", "Invoice", { force: false }, realFsAdapter, projectDir);
    await runAdd("service", "InvoiceService", { force: false }, realFsAdapter, projectDir);
    // form uses force:true in case zod dirs overlap with any scaffold files
    await runAdd("form", "Invoice", { force: true }, realFsAdapter, projectDir);
    await runAdd("admin", "Invoice", { force: false }, realFsAdapter, projectDir);

    vi.restoreAllMocks();
  });

  // model files (3)
  it("model: creates src/lib/zod/invoice.ts", () => {
    expect(existsSync(join(projectDir, "src/lib/zod/invoice.ts"))).toBe(true);
  });

  it("model: creates src/lib/db/invoice-repository.ts", () => {
    expect(existsSync(join(projectDir, "src/lib/db/invoice-repository.ts"))).toBe(true);
  });

  it("model: creates src/lib/db/invoice-repository.test.ts", () => {
    expect(existsSync(join(projectDir, "src/lib/db/invoice-repository.test.ts"))).toBe(true);
  });

  // service files (2)
  it("service: creates src/lib/service/invoice-service.ts", () => {
    expect(existsSync(join(projectDir, "src/lib/service/invoice-service.ts"))).toBe(true);
  });

  it("service: creates src/lib/service/invoice-service.test.ts", () => {
    expect(existsSync(join(projectDir, "src/lib/service/invoice-service.test.ts"))).toBe(true);
  });

  // form files (3)
  it("form: creates src/components/InvoiceForm.tsx", () => {
    expect(existsSync(join(projectDir, "src/components/InvoiceForm.tsx"))).toBe(true);
  });

  it("form: creates src/lib/zod/invoice-form.ts", () => {
    expect(existsSync(join(projectDir, "src/lib/zod/invoice-form.ts"))).toBe(true);
  });

  it("form: creates src/components/InvoiceForm.test.tsx", () => {
    expect(existsSync(join(projectDir, "src/components/InvoiceForm.test.tsx"))).toBe(true);
  });

  // admin files (4)
  it("admin: creates src/app/(authed)/admin/invoice/page.tsx", () => {
    expect(
      existsSync(join(projectDir, "src/app/(authed)/admin/invoice/page.tsx")),
    ).toBe(true);
  });

  it("admin: creates src/app/(authed)/admin/invoice/InvoiceTable.tsx", () => {
    expect(
      existsSync(join(projectDir, "src/app/(authed)/admin/invoice/InvoiceTable.tsx")),
    ).toBe(true);
  });

  it("admin: creates src/app/(authed)/admin/invoice/InvoiceFilter.tsx", () => {
    expect(
      existsSync(join(projectDir, "src/app/(authed)/admin/invoice/InvoiceFilter.tsx")),
    ).toBe(true);
  });

  it("admin: creates src/app/(authed)/admin/invoice/actions.ts", () => {
    expect(
      existsSync(join(projectDir, "src/app/(authed)/admin/invoice/actions.ts")),
    ).toBe(true);
  });

  // patch checks
  it("prisma/schema.prisma contains model Invoice { exactly once", () => {
    const schema = readFileSync(join(projectDir, "prisma/schema.prisma"), "utf-8");
    const occurrences = schema.split("model Invoice {").length - 1;
    expect(occurrences).toBe(1);
  });

  it("services.ts contains both InvoiceRepository and InvoiceService", () => {
    const services = readFileSync(join(projectDir, "src/lib/services.ts"), "utf-8");
    expect(services).toContain("InvoiceRepository");
    expect(services).toContain("InvoiceService");
  });

  it("nav-items.ts adminItems contains Invoice exactly once", () => {
    const nav = readFileSync(join(projectDir, "src/lib/nav-items.ts"), "utf-8");
    const occurrences = nav.split('"/admin/invoice"').length - 1;
    expect(occurrences).toBe(1);
  });

  it("breadcrumb-map.ts contains /admin/invoice exactly once", () => {
    const breadcrumb = readFileSync(join(projectDir, "src/lib/breadcrumb-map.ts"), "utf-8");
    const occurrences = breadcrumb.split("/admin/invoice").length - 1;
    expect(occurrences).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Case 5: --json 출력 + admin patch result
// ---------------------------------------------------------------------------

describe("Case 5: --json output — admin patches", { timeout: 30_000 }, () => {
  let projectDir: string;
  let parsedResult: AddJsonResult;

  beforeAll(async () => {
    projectDir = join(workDir, "case5-json-admin");
    scaffold({ ...saasSpec, rootPath: projectDir, projectName: "e2e-json-admin" });

    const stdoutChunks: string[] = [];
    vi.spyOn(process.stdout, "write").mockImplementation((chunk) => {
      stdoutChunks.push(chunk as string);
      return true;
    });
    vi.spyOn(process.stderr, "write").mockImplementation(() => true);

    await runAdd("admin", "Invoice", { json: true }, realFsAdapter, projectDir);

    vi.restoreAllMocks();

    const stdout = stdoutChunks.join("");
    parsedResult = JSON.parse(stdout) as AddJsonResult;
  });

  it("stdout is valid JSON with ok: true", () => {
    expect(parsedResult).toBeDefined();
    expect(parsedResult.ok).toBe(true);
  });

  it('command is "add"', () => {
    expect(parsedResult.command).toBe("add");
  });

  it('fragmentType is "admin"', () => {
    expect(parsedResult.fragmentType).toBe("admin");
  });

  it('name is "Invoice"', () => {
    expect(parsedResult.name).toBe("Invoice");
  });

  it("created array contains 4 files", () => {
    const created = parsedResult.created ?? [];
    expect(Array.isArray(created)).toBe(true);
    expect(created.length).toBe(4);
  });

  it("created array includes page.tsx", () => {
    const created = parsedResult.created ?? [];
    expect(created.some((f) => f.includes("page.tsx") && f.includes("invoice"))).toBe(true);
  });

  it("created array includes InvoiceTable.tsx", () => {
    const created = parsedResult.created ?? [];
    expect(created.some((f) => f.includes("InvoiceTable.tsx"))).toBe(true);
  });

  it("created array includes InvoiceFilter.tsx", () => {
    const created = parsedResult.created ?? [];
    expect(created.some((f) => f.includes("InvoiceFilter.tsx"))).toBe(true);
  });

  it("created array includes actions.ts", () => {
    const created = parsedResult.created ?? [];
    expect(created.some((f) => f.includes("actions.ts"))).toBe(true);
  });

  it("patches.applied contains 2 entries (admin-items + breadcrumb)", () => {
    const patches = parsedResult.patches;
    expect(patches).toBeDefined();
    expect(Array.isArray(patches?.applied)).toBe(true);
    expect(patches?.applied.length).toBe(2);
  });

  it("patches.applied includes admin-items slot patch", () => {
    const applied = parsedResult.patches?.applied ?? [];
    const entry = applied.find((p) => p.slot === "admin-items");
    expect(entry).toBeDefined();
    expect(entry?.file).toContain("nav-items.ts");
    expect(entry?.entryKey).toContain("/admin/invoice");
  });

  it("patches.applied includes breadcrumb slot patch", () => {
    const applied = parsedResult.patches?.applied ?? [];
    const entry = applied.find((p) => p.slot === "breadcrumb");
    expect(entry).toBeDefined();
    expect(entry?.file).toContain("breadcrumb-map.ts");
    expect(entry?.entryKey).toContain("/admin/invoice");
  });
});
