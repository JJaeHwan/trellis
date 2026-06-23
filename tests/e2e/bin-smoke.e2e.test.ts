import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// ---------------------------------------------------------------------------
// Real compiled-binary smoke test.
//
// Every other test runs in SOURCE mode (vitest on src/**), where each loader's
// hardcoded `../../..` path happens to resolve correctly. tsup bundles all
// sources into a single dist/cmd/index.js, so in the BINARY every loader's
// import.meta.url is dist/cmd/index.js — depth-3/4 loaders (add/upgrade/doctor)
// previously resolved ABOVE the package root and silently failed:
//   - upgrade: "migration manifest not found" (could not load ANY manifest)
//   - add:     "unknown fragment" (could not find _fragments/)
// This suite builds the real binary and exercises it so that regression is
// caught by the test suite, not by users. See src/external/resources-root.ts.
// ---------------------------------------------------------------------------

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const bin = join(repoRoot, "dist", "cmd", "index.js");

interface RunResult {
  code: number;
  stdout: string;
  stderr: string;
}

function run(args: readonly string[], cwd: string): RunResult {
  try {
    const stdout = execFileSync("node", [bin, ...args], {
      cwd,
      encoding: "utf-8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    return { code: 0, stdout, stderr: "" };
  } catch (err) {
    const e = err as { status?: number; stdout?: string; stderr?: string };
    return { code: e.status ?? 1, stdout: e.stdout ?? "", stderr: e.stderr ?? "" };
  }
}

function makeCliProject(dir: string, trellisVersion: string): void {
  mkdirSync(join(dir, ".trellis"), { recursive: true });
  mkdirSync(join(dir, "src", "cmd"), { recursive: true });
  writeFileSync(
    join(dir, ".trellis", "spec.json"),
    JSON.stringify(
      {
        projectName: "smoke",
        rootPath: "",
        playbookId: "cli-tool",
        matchMode: "exact",
        matchScore: 1,
        answers: [],
        placeholders: {},
        generatedAt: "2026-01-01T00:00:00.000Z",
        trellisVersion,
      },
      null,
      2,
    ),
  );
  writeFileSync(join(dir, "package.json"), JSON.stringify({ name: "smoke", version: "1.0.0" }, null, 2));
  writeFileSync(
    join(dir, "src", "cmd", "index.ts"),
    [
      'import { registerHelloCommand } from "./hello.js";',
      "// trellis:slot:imports:start",
      "// trellis:slot:imports:end",
      "const program = {};",
      "  registerHelloCommand(program);",
      "  // trellis:slot:commands:start",
      "  // trellis:slot:commands:end",
      "",
    ].join("\n"),
  );
}

const currentVersion = (
  JSON.parse(execFileSync("node", ["-p", "JSON.stringify(require('./package.json').version)"], {
    cwd: repoRoot,
    encoding: "utf-8",
  })) as string
).trim();
const curMinor = parseInt(currentVersion.split(".")[1] ?? "0", 10);

let workDir: string;

beforeAll(() => {
  // Build the real binary so this exercises the bundled dist/, not src/.
  execFileSync("npm", ["run", "build"], { cwd: repoRoot, stdio: "ignore" });
  workDir = mkdtempSync(join(tmpdir(), "trellis-bin-smoke-"));
}, 120_000);

afterAll(() => {
  if (workDir) rmSync(workDir, { recursive: true, force: true });
});

describe("real compiled binary resolves bundled resources/", { timeout: 60_000 }, () => {
  it("upgrade --dry-run loads the full migration chain (regression: manifest-not-found)", () => {
    const dir = join(workDir, "upgrade");
    makeCliProject(dir, "0.9.0");
    const { code, stdout } = run(["upgrade", dir, "--dry-run", "--json"], repoRoot);
    expect(code).toBe(0);
    const res = JSON.parse(stdout) as {
      ok: boolean;
      toVersion: string;
      steps: readonly unknown[];
    };
    expect(res.ok).toBe(true);
    expect(res.toVersion).toBe(currentVersion);
    expect(res.steps).toHaveLength(curMinor - 9);
  });

  it("add resolves the cli-tool command fragment (regression: unknown-fragment)", () => {
    const dir = join(workDir, "add");
    makeCliProject(dir, currentVersion);
    const { code, stdout } = run(["add", "command", "greet", "--json"], dir);
    expect(code).toBe(0);
    const res = JSON.parse(stdout) as { ok: boolean; created: readonly string[] };
    expect(res.ok).toBe(true);
    expect(res.created).toContain("src/cmd/greet.ts");
  });

  it("list reports fragment types from the bundled templates", () => {
    const dir = join(workDir, "list");
    makeCliProject(dir, currentVersion);
    const { code, stdout } = run(["list", "--json"], dir);
    expect(code).toBe(0);
    const res = JSON.parse(stdout) as { ok: boolean; types: readonly string[] };
    expect(res.ok).toBe(true);
    expect(res.types).toContain("command");
  });

  it("doctor runs against the bundled templates without crashing", () => {
    const { code } = run(["doctor", repoRoot], repoRoot);
    expect(code).toBe(0);
  });
});
