import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";
import { runCheck } from "./check.js";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "../..");
const violationFixture = resolve(repoRoot, "fixtures/check/violation");

function captureStdout(): string[] {
  const out: string[] = [];
  vi.spyOn(process.stdout, "write").mockImplementation((chunk) => {
    out.push(chunk as string);
    return true;
  });
  vi.spyOn(process.stderr, "write").mockImplementation(() => true);
  return out;
}

describe("runCheck --json", () => {
  afterEach(() => vi.restoreAllMocks());

  it("runCheck_json_cleanRepo_singleLineOkTrue", async () => {
    const out = captureStdout();
    await runCheck(repoRoot, true);
    const lines = out.join("").trim().split("\n");
    expect(lines.length).toBe(1); // single-line contract
    const res = JSON.parse(lines[0]!) as {
      ok: boolean;
      command: string;
      violations: unknown[];
    };
    expect(res.ok).toBe(true);
    expect(res.command).toBe("check");
    expect(Array.isArray(res.violations)).toBe(true);
  });

  it("runCheck_json_violationFixture_okTrue_violationsReported", async () => {
    const out = captureStdout();
    const exitSpy = vi.spyOn(process, "exit").mockImplementation((_code) => {
      throw new Error("process.exit called");
    });
    await runCheck(violationFixture, true).catch(() => {});
    exitSpy.mockRestore();
    const res = JSON.parse(out.join("").trim()) as {
      ok: boolean;
      violations: unknown[];
    };
    expect(res.ok).toBe(true);
    expect(res.violations.length).toBeGreaterThan(0);
  });

  it("runCheck_json_unknownLanguage_okFalseEnvelopeCode2", async () => {
    const out = captureStdout();
    const exitSpy = vi.spyOn(process, "exit").mockImplementation((_code) => {
      throw new Error("process.exit called");
    });
    const dir = mkdtempSync(join(tmpdir(), "trellis-check-nolang-"));
    try {
      await runCheck(dir, true).catch(() => {});
      const res = JSON.parse(out.join("").trim()) as {
        ok: boolean;
        command: string;
        error: { code: number };
      };
      expect(res.ok).toBe(false);
      expect(res.command).toBe("check");
      expect(res.error.code).toBe(2);
    } finally {
      exitSpy.mockRestore();
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
