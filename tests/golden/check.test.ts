import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { validateProject } from "../../src/service/validator/index.js";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "../..");
const fixtureCleanDir = resolve(repoRoot, "fixtures/check/clean");
const fixtureViolationDir = resolve(repoRoot, "fixtures/check/violation");

describe("validateProject", () => {
  it("returns 0 violations for clean fixture", async () => {
    const report = await validateProject(fixtureCleanDir);
    expect(report.violations).toEqual([]);
    expect(report.language).toBe("ts-js");
    expect(report.moduleCount).toBeGreaterThan(0);
  });

  it("returns at least one L0-no-upper violation for violation fixture", async () => {
    const report = await validateProject(fixtureViolationDir);
    expect(report.violations.length).toBeGreaterThan(0);
    const hasL0Violation = report.violations.some(
      (v) => v.rule === "L0-no-upper",
    );
    expect(hasL0Violation).toBe(true);
  });

  it("dogfooding: trellis itself passes its own check", async () => {
    const report = await validateProject(repoRoot);
    expect(report.violations).toEqual([]);
    expect(report.moduleCount).toBeGreaterThan(0);
  });

  it("rejects unknown languages with a UserInputError exit code", async () => {
    // tmpdir without any manifest = unknown
    const { mkdtempSync, rmSync } = await import("node:fs");
    const { tmpdir } = await import("node:os");
    const { join } = await import("node:path");
    const dir = mkdtempSync(join(tmpdir(), "trellis-no-lang-"));
    try {
      await expect(validateProject(dir)).rejects.toThrow(/지원하지 않습니다/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
