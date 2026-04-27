import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { runDoctor } from "./index.js";

const here = dirname(fileURLToPath(import.meta.url));
const trellisRoot = resolve(here, "../../..");

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "trellis-doctor-"));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

function seedMinimalProject(root: string): void {
  writeFileSync(join(root, "package.json"), "{}");
  writeFileSync(join(root, "README.md"), "# x");
  writeFileSync(join(root, "CLAUDE.md"), "x");
  mkdirSync(join(root, "docs/plans"), { recursive: true });
  writeFileSync(join(root, "docs/architecture.md"), "x");
}

describe("runDoctor — required-files rule", () => {
  it("flags missing package.json as error", () => {
    const report = runDoctor(dir);
    const pkg = report.findings.find(
      (f) => f.ruleId === "required-files" && f.message.includes("package.json"),
    );
    expect(pkg?.severity).toBe("error");
  });

  it("flags missing README/CLAUDE/docs as warn", () => {
    writeFileSync(join(dir, "package.json"), "{}");
    const report = runDoctor(dir);
    const reqFindings = report.findings.filter(
      (f) => f.ruleId === "required-files",
    );
    expect(reqFindings.length).toBeGreaterThan(0);
    expect(reqFindings.every((f) => f.severity === "warn")).toBe(true);
  });

  it("passes when all required files exist", () => {
    seedMinimalProject(dir);
    const report = runDoctor(dir);
    const reqFindings = report.findings.filter(
      (f) => f.ruleId === "required-files",
    );
    expect(reqFindings).toEqual([]);
  });
});

describe("runDoctor — playbook-sync rule", () => {
  it("does not run when resources/playbooks is absent", () => {
    seedMinimalProject(dir);
    const report = runDoctor(dir);
    const playbookFindings = report.findings.filter(
      (f) => f.ruleId === "playbook-sync",
    );
    expect(playbookFindings).toEqual([]);
  });
});

describe("runDoctor — dogfooding", () => {
  it("reports zero error-severity findings against trellis itself", () => {
    const report = runDoctor(trellisRoot);
    const errors = report.findings.filter((f) => f.severity === "error");
    expect(errors).toEqual([]);
  });

  it("playbook-sync passes for all 3 trellis playbooks (cli-tool, b2b-saas, ai-rag-platform)", () => {
    const report = runDoctor(trellisRoot);
    const playbookSyncErrors = report.findings.filter(
      (f) => f.ruleId === "playbook-sync" && f.severity === "error",
    );
    expect(playbookSyncErrors).toEqual([]);
  });
});
