import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { ProjectSpec } from "../../src/domain/index.js";
import { scaffold } from "../../src/service/scaffolder/index.js";
import { runUpgrade } from "../../src/service/upgrader/index.js";
import { realFsAdapter } from "../../src/external/fs-adapter.js";
import { HarnessError } from "../../src/common/errors/index.js";
import type { GitChecker } from "../../src/service/upgrader/git-status.js";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const cliSpec: ProjectSpec = {
  projectName: "e2e-upgrade-cli",
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
  trellisVersion: "0.10.0",
};

/** mock gitChecker — always reports clean */
const mockGitClean: GitChecker = () => true;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Scaffold a fresh cli-tool project and revert src/cmd/index.ts to the
 * v0.9.0 state (slot markers removed, anchor lines still present).
 */
function scaffoldV090(projectDir: string, trellisVersion = "0.9.0"): void {
  scaffold({ ...cliSpec, rootPath: projectDir });

  // Rewrite spec.json to target version
  const specPath = join(projectDir, ".trellis/spec.json");
  const spec = JSON.parse(readFileSync(specPath, "utf-8")) as Record<string, unknown>;
  spec["trellisVersion"] = trellisVersion;
  writeFileSync(specPath, JSON.stringify(spec, null, 2), "utf-8");

  // Remove slot markers from src/cmd/index.ts to simulate v0.9.0 full-body.
  // The scaffold writes v0.10.0 which already has the markers; strip them back.
  const indexPath = join(projectDir, "src/cmd/index.ts");
  let content = readFileSync(indexPath, "utf-8");
  content = content
    .replace(/\n\/\/ trellis:slot:imports:start\n\/\/ trellis:slot:imports:end/g, "")
    .replace(/\n {2}\/\/ trellis:slot:commands:start\n {2}\/\/ trellis:slot:commands:end/g, "");
  writeFileSync(indexPath, content, "utf-8");
}

// ---------------------------------------------------------------------------
// Shared temp dir
// ---------------------------------------------------------------------------

let workDir: string;

beforeAll(() => {
  workDir = mkdtempSync(join(tmpdir(), "trellis-upgrade-e2e-"));
});

afterAll(() => {
  rmSync(workDir, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// Case 1: 0.9.0 → 0.10.0 — main upgrade scenario
// ---------------------------------------------------------------------------

describe("Case 1: 0.9.0 → 0.10.0 — slots added, spec updated", { timeout: 30_000 }, () => {
  let projectDir: string;
  let result: ReturnType<typeof runUpgrade>;

  beforeAll(() => {
    projectDir = join(workDir, "case1-main");
    scaffoldV090(projectDir);
    result = runUpgrade(projectDir, "0.10.0", {}, realFsAdapter, mockGitClean);
  });

  it("fromVersion is 0.9.0", () => {
    expect(result.fromVersion).toBe("0.9.0");
  });

  it("toVersion is 0.10.0", () => {
    expect(result.toVersion).toBe("0.10.0");
  });

  it("steps has length 1 ({from: 0.9.0, to: 0.10.0})", () => {
    expect(result.steps).toHaveLength(1);
    expect(result.steps[0]).toEqual({ from: "0.9.0", to: "0.10.0" });
  });

  it("slotsAdded has length 2 (imports + commands)", () => {
    expect(result.slotsAdded).toHaveLength(2);
  });

  it("slotsAdded contains imports slot", () => {
    expect(result.slotsAdded.some((s) => s.slot === "imports")).toBe(true);
  });

  it("slotsAdded contains commands slot", () => {
    expect(result.slotsAdded.some((s) => s.slot === "commands")).toBe(true);
  });

  it("slotsSkipped is empty", () => {
    expect(result.slotsSkipped).toHaveLength(0);
  });

  it("src/cmd/index.ts has // trellis:slot:imports:start", () => {
    const content = readFileSync(join(projectDir, "src/cmd/index.ts"), "utf-8");
    expect(content).toContain("// trellis:slot:imports:start");
  });

  it("src/cmd/index.ts has // trellis:slot:imports:end", () => {
    const content = readFileSync(join(projectDir, "src/cmd/index.ts"), "utf-8");
    expect(content).toContain("// trellis:slot:imports:end");
  });

  it("src/cmd/index.ts has // trellis:slot:commands:start", () => {
    const content = readFileSync(join(projectDir, "src/cmd/index.ts"), "utf-8");
    expect(content).toContain("// trellis:slot:commands:start");
  });

  it("src/cmd/index.ts has // trellis:slot:commands:end", () => {
    const content = readFileSync(join(projectDir, "src/cmd/index.ts"), "utf-8");
    expect(content).toContain("// trellis:slot:commands:end");
  });

  it("spec.json trellisVersion updated to 0.10.0", () => {
    const spec = JSON.parse(
      readFileSync(join(projectDir, ".trellis/spec.json"), "utf-8"),
    ) as { trellisVersion: string };
    expect(spec.trellisVersion).toBe("0.10.0");
  });
});

// ---------------------------------------------------------------------------
// Case 2: Idempotency — second upgrade call is a no-op (spec already 0.10.0)
// ---------------------------------------------------------------------------

describe("Case 2: idempotency — second upgrade is no-op after spec updated", { timeout: 30_000 }, () => {
  let projectDir: string;

  beforeAll(() => {
    projectDir = join(workDir, "case2-idempotent");
    scaffoldV090(projectDir);
    runUpgrade(projectDir, "0.10.0", {}, realFsAdapter, mockGitClean);
  });

  it("second runUpgrade returns steps=0 (spec already at 0.10.0)", () => {
    const result = runUpgrade(projectDir, "0.10.0", {}, realFsAdapter, mockGitClean);
    expect(result.steps).toHaveLength(0);
    expect(result.slotsAdded).toHaveLength(0);
    expect(result.slotsSkipped).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Case 2b: Slot-level idempotency — markers already present → slotsSkipped=2
// ---------------------------------------------------------------------------

describe("Case 2b: slot idempotency — markers present → slotsSkipped=2", { timeout: 30_000 }, () => {
  let projectDir: string;

  beforeAll(() => {
    // Scaffold with markers already in place (v0.10.0), then set spec to 0.9.0
    projectDir = join(workDir, "case2b-slot-idempotent");
    scaffold({ ...cliSpec, rootPath: projectDir });
    const specPath = join(projectDir, ".trellis/spec.json");
    const spec = JSON.parse(readFileSync(specPath, "utf-8")) as Record<string, unknown>;
    spec["trellisVersion"] = "0.9.0";
    writeFileSync(specPath, JSON.stringify(spec, null, 2), "utf-8");
    // Markers are already present — do NOT strip them
  });

  it("slotsAdded is 0 and slotsSkipped is 2", () => {
    const result = runUpgrade(projectDir, "0.10.0", {}, realFsAdapter, mockGitClean);
    expect(result.slotsAdded).toHaveLength(0);
    expect(result.slotsSkipped).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// Case 3: dry-run — no file changes, result still populated
// ---------------------------------------------------------------------------

describe("Case 3: dry-run — no files written", { timeout: 30_000 }, () => {
  let projectDir: string;

  beforeAll(() => {
    projectDir = join(workDir, "case3-dryrun");
    scaffoldV090(projectDir);
  });

  it("dryRun flag is true in result", () => {
    const result = runUpgrade(
      projectDir,
      "0.10.0",
      { dryRun: true },
      realFsAdapter,
      mockGitClean,
    );
    expect(result.dryRun).toBe(true);
  });

  it("slotsAdded reports 2 even in dry-run", () => {
    const result = runUpgrade(
      projectDir,
      "0.10.0",
      { dryRun: true },
      realFsAdapter,
      mockGitClean,
    );
    expect(result.slotsAdded).toHaveLength(2);
  });

  it("src/cmd/index.ts still lacks markers after dry-run", () => {
    runUpgrade(projectDir, "0.10.0", { dryRun: true }, realFsAdapter, mockGitClean);
    const content = readFileSync(join(projectDir, "src/cmd/index.ts"), "utf-8");
    expect(content).not.toContain("// trellis:slot:imports:start");
  });

  it("spec.json trellisVersion unchanged after dry-run", () => {
    runUpgrade(projectDir, "0.10.0", { dryRun: true }, realFsAdapter, mockGitClean);
    const spec = JSON.parse(
      readFileSync(join(projectDir, ".trellis/spec.json"), "utf-8"),
    ) as { trellisVersion: string };
    expect(spec.trellisVersion).toBe("0.9.0");
  });
});

// ---------------------------------------------------------------------------
// Case 4: same version — no-op
// ---------------------------------------------------------------------------

describe("Case 4: same version — no-op", { timeout: 30_000 }, () => {
  let projectDir: string;

  beforeAll(() => {
    projectDir = join(workDir, "case4-same-version");
    scaffold({ ...cliSpec, rootPath: projectDir });
    // spec has trellisVersion = "0.10.0" from cliSpec (default scaffold)
  });

  it("steps is empty", () => {
    const result = runUpgrade(projectDir, "0.10.0", {}, realFsAdapter, mockGitClean);
    expect(result.steps).toHaveLength(0);
  });

  it("slotsAdded is empty", () => {
    const result = runUpgrade(projectDir, "0.10.0", {}, realFsAdapter, mockGitClean);
    expect(result.slotsAdded).toHaveLength(0);
  });

  it("fromVersion equals toVersion (0.10.0)", () => {
    const result = runUpgrade(projectDir, "0.10.0", {}, realFsAdapter, mockGitClean);
    expect(result.fromVersion).toBe("0.10.0");
    expect(result.toVersion).toBe("0.10.0");
  });
});

// ---------------------------------------------------------------------------
// Case 5: major version mismatch → HarnessError
// ---------------------------------------------------------------------------

describe("Case 5: major mismatch → HarnessError", { timeout: 30_000 }, () => {
  let projectDir: string;

  beforeAll(() => {
    projectDir = join(workDir, "case5-major-mismatch");
    scaffoldV090(projectDir, "1.0.0");
  });

  it("throws HarnessError", () => {
    expect(() =>
      runUpgrade(projectDir, "0.10.0", {}, realFsAdapter, mockGitClean),
    ).toThrow(HarnessError);
  });

  it("error message mentions major version mismatch", () => {
    try {
      runUpgrade(projectDir, "0.10.0", {}, realFsAdapter, mockGitClean);
      expect.fail("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(HarnessError);
      expect((err as HarnessError).message).toMatch(/major/);
    }
  });

  it("error has a hint", () => {
    try {
      runUpgrade(projectDir, "0.10.0", {}, realFsAdapter, mockGitClean);
      expect.fail("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(HarnessError);
      expect((err as HarnessError).hint).toBeDefined();
    }
  });
});

// ---------------------------------------------------------------------------
// Case 6: spec.json missing → HarnessError
// ---------------------------------------------------------------------------

describe("Case 6: missing spec.json → HarnessError", { timeout: 30_000 }, () => {
  let projectDir: string;

  beforeAll(() => {
    projectDir = join(workDir, "case6-no-spec");
    scaffold({ ...cliSpec, rootPath: projectDir });
    rmSync(join(projectDir, ".trellis/spec.json"), { force: true });
  });

  it("throws HarnessError", () => {
    expect(() =>
      runUpgrade(projectDir, "0.10.0", {}, realFsAdapter, mockGitClean),
    ).toThrow(HarnessError);
  });

  it("error message mentions spec.json or trellis project", () => {
    try {
      runUpgrade(projectDir, "0.10.0", {}, realFsAdapter, mockGitClean);
      expect.fail("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(HarnessError);
      expect((err as HarnessError).message).toMatch(/spec\.json|trellis 프로젝트/);
    }
  });

  it("error has a hint", () => {
    try {
      runUpgrade(projectDir, "0.10.0", {}, realFsAdapter, mockGitClean);
      expect.fail("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(HarnessError);
      expect((err as HarnessError).hint).toBeDefined();
    }
  });
});

// ---------------------------------------------------------------------------
// Case 7: manifest missing (0.8.0 → 0.9.0 step) → HarnessError
// ---------------------------------------------------------------------------

describe("Case 7: no manifest for 0.8.0 → 0.9.0 → HarnessError", { timeout: 30_000 }, () => {
  let projectDir: string;

  beforeAll(() => {
    projectDir = join(workDir, "case7-no-manifest");
    scaffoldV090(projectDir, "0.8.0");
  });

  it("throws HarnessError", () => {
    expect(() =>
      runUpgrade(projectDir, "0.10.0", {}, realFsAdapter, mockGitClean),
    ).toThrow(HarnessError);
  });

  it("error has a hint", () => {
    try {
      runUpgrade(projectDir, "0.10.0", {}, realFsAdapter, mockGitClean);
      expect.fail("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(HarnessError);
      expect((err as HarnessError).hint).toBeDefined();
    }
  });
});
