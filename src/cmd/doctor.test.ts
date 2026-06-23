import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";
import { runDoctorCmd } from "./doctor.js";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "../..");

describe("runDoctorCmd --json", () => {
  afterEach(() => vi.restoreAllMocks());

  it("runDoctorCmd_json_repo_singleLineOkTrue", () => {
    const out: string[] = [];
    vi.spyOn(process.stdout, "write").mockImplementation((chunk) => {
      out.push(chunk as string);
      return true;
    });
    vi.spyOn(process.stderr, "write").mockImplementation(() => true);

    runDoctorCmd(repoRoot, true);

    const lines = out.join("").trim().split("\n");
    expect(lines.length).toBe(1); // single-line contract
    const res = JSON.parse(lines[0]!) as {
      ok: boolean;
      command: string;
      findings: unknown[];
    };
    expect(res.ok).toBe(true);
    expect(res.command).toBe("doctor");
    expect(Array.isArray(res.findings)).toBe(true);
  });
});
