import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import type { ProjectSpec } from "../../src/domain/index.js";
import { scaffold } from "../../src/service/scaffolder/index.js";
import { runAdd } from "../../src/cmd/add.js";
import { realFsAdapter } from "../../src/external/fs-adapter.js";
import type { AddJsonResult } from "../../src/cmd/add.js";

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

const cliSpec: ProjectSpec = {
  projectName: "e2e-cli-tool-add",
  rootPath: "",
  playbookId: "cli-tool",
  matchMode: "exact",
  matchScore: 1,
  answers: [
    { questionId: "1", selectedOptionId: "B" },
    { questionId: "2", selectedOptionId: "A" },
    { questionId: "3", selectedOptionId: "B" },
    { questionId: "4", selectedOptionId: "C" },
    { questionId: "5", selectedOptionId: "A" },
    { questionId: "6", selectedOptionId: "A" },
    { questionId: "7", selectedOptionId: "A" },
    { questionId: "8", selectedOptionId: "A" },
    { questionId: "9", selectedOptionId: "C" },
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
  workDir = mkdtempSync(join(tmpdir(), "trellis-cli-tool-add-e2e-"));
});

afterAll(() => {
  rmSync(workDir, { recursive: true, force: true });
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Case 1: command fragment — verify
// ---------------------------------------------------------------------------

describe("Case 1: cli-tool add command verify — files + 2-slot patch", { timeout: 30_000 }, () => {
  let projectDir: string;

  beforeAll(async () => {
    projectDir = join(workDir, "case1-command-verify");
    scaffold({ ...cliSpec, rootPath: projectDir, projectName: "e2e-cli-tool-add" });

    vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    await runAdd("command", "verify", { force: false }, realFsAdapter, projectDir);
    vi.restoreAllMocks();
  });

  it("creates src/cmd/verify.ts", () => {
    expect(existsSync(join(projectDir, "src/cmd/verify.ts"))).toBe(true);
  });

  it("creates src/cmd/verify.test.ts", () => {
    expect(existsSync(join(projectDir, "src/cmd/verify.test.ts"))).toBe(true);
  });

  it("src/cmd/index.ts contains import for registerVerifyCommand", () => {
    const content = readFileSync(join(projectDir, "src/cmd/index.ts"), "utf-8");
    expect(content).toContain('import { registerVerifyCommand } from "./verify.js";');
  });

  it("src/cmd/index.ts contains registerVerifyCommand(program) call", () => {
    const content = readFileSync(join(projectDir, "src/cmd/index.ts"), "utf-8");
    expect(content).toContain("registerVerifyCommand(program);");
  });

  it("imports slot markers are preserved after patch", () => {
    const content = readFileSync(join(projectDir, "src/cmd/index.ts"), "utf-8");
    expect(content).toContain("// trellis:slot:imports:start");
    expect(content).toContain("// trellis:slot:imports:end");
  });

  it("commands slot markers are preserved after patch", () => {
    const content = readFileSync(join(projectDir, "src/cmd/index.ts"), "utf-8");
    expect(content).toContain("// trellis:slot:commands:start");
    expect(content).toContain("// trellis:slot:commands:end");
  });
});

// ---------------------------------------------------------------------------
// Case 2: --json output validation for command fragment
// ---------------------------------------------------------------------------

describe("Case 2: --json output — command verify patches.applied = 2", { timeout: 30_000 }, () => {
  let projectDir: string;
  let parsedResult: AddJsonResult;

  beforeAll(async () => {
    projectDir = join(workDir, "case2-json-command");
    scaffold({ ...cliSpec, rootPath: projectDir, projectName: "e2e-cli-json-cmd" });

    const stdoutChunks: string[] = [];
    vi.spyOn(process.stdout, "write").mockImplementation((chunk) => {
      stdoutChunks.push(chunk as string);
      return true;
    });
    vi.spyOn(process.stderr, "write").mockImplementation(() => true);

    await runAdd("command", "verify", { json: true }, realFsAdapter, projectDir);

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

  it('fragmentType is "command"', () => {
    expect(parsedResult.fragmentType).toBe("command");
  });

  it('name is "verify"', () => {
    expect(parsedResult.name).toBe("verify");
  });

  it('playbookId is "cli-tool"', () => {
    expect(parsedResult.playbookId).toBe("cli-tool");
  });

  it("created array contains 2 files (verify.ts + verify.test.ts)", () => {
    const created = parsedResult.created ?? [];
    expect(Array.isArray(created)).toBe(true);
    expect(created.length).toBe(2);
    expect(created.some((f) => f.includes("verify.ts") && !f.includes("test"))).toBe(true);
    expect(created.some((f) => f.includes("verify.test.ts"))).toBe(true);
  });

  it("patches.applied contains 2 entries (imports + commands)", () => {
    const patches = parsedResult.patches;
    expect(patches).toBeDefined();
    expect(Array.isArray(patches?.applied)).toBe(true);
    expect(patches?.applied.length).toBe(2);
  });

  it("patches.applied includes imports slot patch", () => {
    const applied = parsedResult.patches?.applied ?? [];
    const entry = applied.find((p) => p.slot === "imports");
    expect(entry).toBeDefined();
    expect(entry?.file).toContain("index.ts");
    expect(entry?.entryKey).toContain("registerVerifyCommand");
  });

  it("patches.applied includes commands slot patch", () => {
    const applied = parsedResult.patches?.applied ?? [];
    const entry = applied.find((p) => p.slot === "commands");
    expect(entry).toBeDefined();
    expect(entry?.file).toContain("index.ts");
    expect(entry?.entryKey).toContain("registerVerifyCommand");
  });
});

// ---------------------------------------------------------------------------
// Case 3: service-module fragment — foo
// ---------------------------------------------------------------------------

describe("Case 3: cli-tool add service-module foo — 4 files, no patches", { timeout: 30_000 }, () => {
  let projectDir: string;

  beforeAll(async () => {
    projectDir = join(workDir, "case3-service-module-foo");
    scaffold({ ...cliSpec, rootPath: projectDir, projectName: "e2e-cli-svc-foo" });

    vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    await runAdd("service-module", "foo", { force: false }, realFsAdapter, projectDir);
    vi.restoreAllMocks();
  });

  it("creates src/service/foo/index.ts", () => {
    expect(existsSync(join(projectDir, "src/service/foo/index.ts"))).toBe(true);
  });

  it("creates src/service/foo/types.ts", () => {
    expect(existsSync(join(projectDir, "src/service/foo/types.ts"))).toBe(true);
  });

  it("creates src/service/foo/foo.ts", () => {
    expect(existsSync(join(projectDir, "src/service/foo/foo.ts"))).toBe(true);
  });

  it("creates src/service/foo/foo.test.ts", () => {
    expect(existsSync(join(projectDir, "src/service/foo/foo.test.ts"))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Case 4: --json output for service-module (no patches)
// ---------------------------------------------------------------------------

describe("Case 4: --json output — service-module foo patches = none", { timeout: 30_000 }, () => {
  let projectDir: string;
  let parsedResult: AddJsonResult;

  beforeAll(async () => {
    projectDir = join(workDir, "case4-json-service-module");
    scaffold({ ...cliSpec, rootPath: projectDir, projectName: "e2e-cli-json-svc" });

    const stdoutChunks: string[] = [];
    vi.spyOn(process.stdout, "write").mockImplementation((chunk) => {
      stdoutChunks.push(chunk as string);
      return true;
    });
    vi.spyOn(process.stderr, "write").mockImplementation(() => true);

    await runAdd("service-module", "foo", { json: true }, realFsAdapter, projectDir);

    vi.restoreAllMocks();

    const stdout = stdoutChunks.join("");
    parsedResult = JSON.parse(stdout) as AddJsonResult;
  });

  it("stdout is valid JSON with ok: true", () => {
    expect(parsedResult).toBeDefined();
    expect(parsedResult.ok).toBe(true);
  });

  it('fragmentType is "service-module"', () => {
    expect(parsedResult.fragmentType).toBe("service-module");
  });

  it('name is "foo"', () => {
    expect(parsedResult.name).toBe("foo");
  });

  it("created array contains 4 files", () => {
    const created = parsedResult.created ?? [];
    expect(Array.isArray(created)).toBe(true);
    expect(created.length).toBe(4);
  });

  it("patches.applied is empty (no patches for service-module)", () => {
    const patches = parsedResult.patches;
    expect(patches).toBeDefined();
    expect(Array.isArray(patches?.applied)).toBe(true);
    expect(patches?.applied.length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Case 5: idempotency — command verify added twice
// ---------------------------------------------------------------------------

describe("Case 5: idempotency — command verify added twice", { timeout: 30_000 }, () => {
  let projectDir: string;

  beforeAll(async () => {
    projectDir = join(workDir, "case5-idempotent");
    scaffold({ ...cliSpec, rootPath: projectDir, projectName: "e2e-cli-idem" });

    vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    await runAdd("command", "verify", { force: false }, realFsAdapter, projectDir);
    vi.restoreAllMocks();
  });

  it("second add (force: true) does not throw", async () => {
    vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    vi.spyOn(process.stderr, "write").mockImplementation(() => true);

    await expect(
      runAdd("command", "verify", { force: true }, realFsAdapter, projectDir),
    ).resolves.toBeUndefined();

    vi.restoreAllMocks();
  });

  it("registerVerifyCommand import appears exactly once after two adds", () => {
    const content = readFileSync(join(projectDir, "src/cmd/index.ts"), "utf-8");
    const occurrences = content.split("registerVerifyCommand").length - 1;
    // import line + call line = 2 occurrences
    expect(occurrences).toBe(2);
  });

  it("registerVerifyCommand(program) call appears exactly once after two adds", () => {
    const content = readFileSync(join(projectDir, "src/cmd/index.ts"), "utf-8");
    const occurrences = content.split("registerVerifyCommand(program);").length - 1;
    expect(occurrences).toBe(1);
  });
});
