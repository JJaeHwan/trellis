import { rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Prompter } from "../service/interview/index.js";
import { runNew } from "./new.js";

// ---------------------------------------------------------------------------
// Fake Prompter — always selects option A / confirms true
// ---------------------------------------------------------------------------

function makeFakePrompter(opts: {
  confirmResult?: boolean;
  optionId?: string;
} = {}): Prompter {
  const { confirmResult = true, optionId = "A" } = opts;
  return {
    async selectOption(_question, _recommendation) {
      return { optionId };
    },
    async confirm(_message, _defaultValue) {
      return confirmResult;
    },
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function captureStdout(): { chunks: string[]; restore: () => void } {
  const chunks: string[] = [];
  const spy = vi.spyOn(process.stdout, "write").mockImplementation((chunk) => {
    chunks.push(chunk as string);
    return true;
  });
  return {
    chunks,
    restore: () => spy.mockRestore(),
  };
}

/** Patch process.stdin.isTTY for an async fn, restoring after. */
async function withTTY<T>(fn: () => Promise<T>): Promise<T> {
  const original = (process.stdin as { isTTY?: boolean }).isTTY;
  Object.defineProperty(process.stdin, "isTTY", { value: true, configurable: true, writable: true });
  try {
    return await fn();
  } finally {
    Object.defineProperty(process.stdin, "isTTY", { value: original, configurable: true, writable: true });
  }
}

/** Patch process.stdin.isTTY to false for an async fn, restoring after. */
async function withoutTTY<T>(fn: () => Promise<T>): Promise<T> {
  const original = (process.stdin as { isTTY?: boolean }).isTTY;
  Object.defineProperty(process.stdin, "isTTY", { value: false, configurable: true, writable: true });
  try {
    return await fn();
  } finally {
    Object.defineProperty(process.stdin, "isTTY", { value: original, configurable: true, writable: true });
  }
}

/** Unique project name to avoid directory collision between parallel tests. */
let testCounter = 0;
function uniqueProjectName(): string {
  testCounter += 1;
  return `trellis-new-test-${process.pid}-${testCounter}`;
}

// ---------------------------------------------------------------------------
// Tests: validateProjectName
// ---------------------------------------------------------------------------

describe("runNew — validateProjectName", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("runNew_invalidName_space_throwsHarnessErrorExitCode2", async () => {
    const prompter = makeFakePrompter();

    await expect(
      runNew("my project", prompter, {}),
    ).rejects.toMatchObject({ exitCode: 2 });
  });

  it("runNew_invalidName_slash_throwsHarnessErrorExitCode2", async () => {
    const prompter = makeFakePrompter();

    await expect(
      runNew("my/project", prompter, {}),
    ).rejects.toMatchObject({ exitCode: 2 });
  });

  it("runNew_invalidName_json_writesOkFalseToStdout", async () => {
    const exitSpy = vi.spyOn(process, "exit").mockImplementation((_code) => {
      throw new Error("process.exit called");
    });
    const stdout = captureStdout();
    vi.spyOn(process.stderr, "write").mockImplementation(() => true);

    const prompter = makeFakePrompter();

    await runNew("my project", prompter, { json: true }).catch(() => {});

    exitSpy.mockRestore();
    stdout.restore();

    const output = stdout.chunks.join("");
    expect(output.length).toBeGreaterThan(0);
    const result = JSON.parse(output) as { ok: boolean; command: string };
    expect(result.ok).toBe(false);
    expect(result.command).toBe("new");
  });

  it("runNew_invalidName_json_errorContainsCode2", async () => {
    const exitSpy = vi.spyOn(process, "exit").mockImplementation((_code) => {
      throw new Error("process.exit called");
    });
    const stdout = captureStdout();
    vi.spyOn(process.stderr, "write").mockImplementation(() => true);

    const prompter = makeFakePrompter();

    await runNew("my project", prompter, { json: true }).catch(() => {});

    exitSpy.mockRestore();
    stdout.restore();

    const result = JSON.parse(stdout.chunks.join("")) as {
      error: { code: number };
    };
    expect(result.error.code).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// Tests: non-TTY guard
// ---------------------------------------------------------------------------

describe("runNew — non-TTY guard", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("runNew_nonTTY_throwsHarnessErrorExitCode2", async () => {
    const prompter = makeFakePrompter();

    await withoutTTY(async () => {
      await expect(
        runNew("myproject", prompter, {}),
      ).rejects.toMatchObject({ exitCode: 2 });
    });
  });

  it("runNew_nonTTY_json_writesOkFalseWithError", async () => {
    const exitSpy = vi.spyOn(process, "exit").mockImplementation((_code) => {
      throw new Error("process.exit called");
    });
    const stdout = captureStdout();
    vi.spyOn(process.stderr, "write").mockImplementation(() => true);

    const prompter = makeFakePrompter();

    await withoutTTY(async () => {
      await runNew("myproject", prompter, { json: true }).catch(() => {});
    });

    exitSpy.mockRestore();
    stdout.restore();

    const output = stdout.chunks.join("");
    expect(output.length).toBeGreaterThan(0);
    const result = JSON.parse(output) as { ok: boolean; error: { code: number; hint?: string } };
    expect(result.ok).toBe(false);
    expect(result.error.code).toBe(2);
    expect(result.error.hint).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Tests: --json success output (TTY)
// ---------------------------------------------------------------------------

describe("runNew — --json mode (TTY)", () => {
  let projectDir: string;

  beforeEach(() => {
    // Use tmpdir so scaffold writes to a real temp path, not cwd
    projectDir = join(tmpdir(), uniqueProjectName());
  });

  afterEach(() => {
    vi.restoreAllMocks();
    // Clean up scaffolded directory if it exists
    try {
      rmSync(projectDir, { recursive: true, force: true });
    } catch {
      // ignore cleanup errors
    }
  });

  /** Run runNew with TTY + cwd patched to tmpdir so scaffold lands in temp dir. */
  async function runNewInTmp(
    projectName: string,
    opts: { json?: boolean; confirmResult?: boolean } = {},
  ): Promise<{ stdout: string }> {
    const { json = true, confirmResult = true } = opts;

    const exitSpy = vi.spyOn(process, "exit").mockImplementation((_code) => {
      throw new Error(`process.exit called with ${String(_code)}`);
    });

    const stdoutChunks: string[] = [];
    vi.spyOn(process.stdout, "write").mockImplementation((chunk) => {
      stdoutChunks.push(chunk as string);
      return true;
    });
    vi.spyOn(process.stderr, "write").mockImplementation(() => true);

    const originalCwd = process.cwd();
    const tmpDir = tmpdir();
    const cwdSpy = vi.spyOn(process, "cwd").mockReturnValue(tmpDir);

    const prompter = makeFakePrompter({ confirmResult });

    try {
      await withTTY(async () => {
        await runNew(projectName, prompter, { json });
      });
    } finally {
      exitSpy.mockRestore();
      cwdSpy.mockRestore();
      // Clean up scaffolded dir in tmpdir
      try {
        rmSync(join(tmpDir, projectName), { recursive: true, force: true });
      } catch {
        // ignore
      }
      void originalCwd; // suppress unused warning
    }

    return { stdout: stdoutChunks.join("") };
  }

  it("runNew_json_success_stdoutIsParseable", async () => {
    const { stdout } = await runNewInTmp("proj-parseable");
    expect(() => JSON.parse(stdout)).not.toThrow();
  });

  it("runNew_json_success_okTrue", async () => {
    const { stdout } = await runNewInTmp("proj-oktrue");
    const result = JSON.parse(stdout) as { ok: boolean };
    expect(result.ok).toBe(true);
  });

  it("runNew_json_success_commandIsNew", async () => {
    const { stdout } = await runNewInTmp("proj-cmd");
    const result = JSON.parse(stdout) as { command: string };
    expect(result.command).toBe("new");
  });

  it("runNew_json_success_projectNameMatches", async () => {
    const { stdout } = await runNewInTmp("my-saas-proj");
    const result = JSON.parse(stdout) as { projectName: string };
    expect(result.projectName).toBe("my-saas-proj");
  });

  it("runNew_json_success_playbookIdDefined", async () => {
    const { stdout } = await runNewInTmp("proj-playbook");
    const result = JSON.parse(stdout) as { playbookId: string };
    expect(typeof result.playbookId).toBe("string");
    expect(result.playbookId.length).toBeGreaterThan(0);
  });

  it("runNew_json_success_matchModeDefined", async () => {
    const { stdout } = await runNewInTmp("proj-matchmode");
    const result = JSON.parse(stdout) as { matchMode: string };
    expect(typeof result.matchMode).toBe("string");
  });

  it("runNew_json_success_createdIsNonEmptyArray", async () => {
    const { stdout } = await runNewInTmp("proj-created");
    const result = JSON.parse(stdout) as { created: string[] };
    expect(Array.isArray(result.created)).toBe(true);
    expect(result.created.length).toBeGreaterThan(0);
  });

  it("runNew_json_success_trellisVersionDefined", async () => {
    const { stdout } = await runNewInTmp("proj-version");
    const result = JSON.parse(stdout) as { trellisVersion: string };
    expect(typeof result.trellisVersion).toBe("string");
  });

  it("runNew_json_success_noHumanTextOnStdout", async () => {
    const { stdout } = await runNewInTmp("proj-nohuman");
    // stdout must be exactly one JSON line
    const lines = stdout.trim().split("\n");
    expect(lines.length).toBe(1);
    expect(() => JSON.parse(lines[0] as string)).not.toThrow();
  });

  it("runNew_json_userCancels_okFalse", async () => {
    const exitSpy = vi.spyOn(process, "exit").mockImplementation((_code) => {
      throw new Error("process.exit called");
    });
    const stdoutChunks: string[] = [];
    vi.spyOn(process.stdout, "write").mockImplementation((chunk) => {
      stdoutChunks.push(chunk as string);
      return true;
    });
    vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    const cwdSpy = vi.spyOn(process, "cwd").mockReturnValue(tmpdir());

    const prompter = makeFakePrompter({ confirmResult: false });

    await withTTY(async () => {
      await runNew("proj-cancel", prompter, { json: true }).catch(() => {});
    });

    exitSpy.mockRestore();
    cwdSpy.mockRestore();

    const output = stdoutChunks.join("");
    expect(output.length).toBeGreaterThan(0);
    const result = JSON.parse(output) as { ok: boolean; command: string };
    expect(result.ok).toBe(false);
    expect(result.command).toBe("new");
  });

  it("runNew_nonJson_success_writesToStderr", async () => {
    const stdoutChunks: string[] = [];
    vi.spyOn(process.stdout, "write").mockImplementation((chunk) => {
      stdoutChunks.push(chunk as string);
      return true;
    });
    const stderrChunks: string[] = [];
    vi.spyOn(process.stderr, "write").mockImplementation((chunk) => {
      stderrChunks.push(chunk as string);
      return true;
    });
    const cwdSpy = vi.spyOn(process, "cwd").mockReturnValue(tmpdir());

    const prompter = makeFakePrompter({ confirmResult: true });

    await withTTY(async () => {
      await runNew("proj-nojson", prompter, {});
    });

    cwdSpy.mockRestore();

    // In non-json mode, success message goes to stderr
    const stderrOutput = stderrChunks.join("");
    expect(stderrOutput).toContain("파일 생성 완료");

    // stdout should be empty in non-json mode
    const stdoutOutput = stdoutChunks.join("");
    expect(stdoutOutput).toBe("");

    // Clean up the scaffolded dir
    try {
      rmSync(join(tmpdir(), "proj-nojson"), { recursive: true, force: true });
    } catch {
      // ignore
    }
  });
});
