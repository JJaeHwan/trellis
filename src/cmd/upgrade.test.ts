import { afterEach, describe, expect, it, vi } from "vitest";
import { HarnessError } from "../common/errors/index.js";
import type { FsAdapter } from "../external/fs-adapter.js";
import { runUpgradeCmd } from "./upgrade.js";

// ---------------------------------------------------------------------------
// Fake FsAdapter helpers
// ---------------------------------------------------------------------------

function makeFakeFs(files: Record<string, string>): FsAdapter {
  const store = { ...files };
  return {
    exists(path: string): boolean {
      if (path in store) return true;
      return Object.keys(store).some((k) => k.startsWith(path + "/"));
    },
    isDirectory(path: string): boolean {
      return Object.keys(store).some((k) => k.startsWith(path + "/"));
    },
    isEmptyDirectory(path: string): boolean {
      return Object.keys(store).filter((k) => k.startsWith(path + "/")).length === 0;
    },
    ensureDir(_path: string): void {
      // no-op
    },
    writeFile(path: string, content: string): void {
      store[path] = content;
    },
    readFile(path: string): string {
      const content = store[path];
      if (content === undefined) throw new Error(`ENOENT: ${path}`);
      return content;
    },
    listDir(path: string): readonly string[] {
      const prefix = path + "/";
      const entries = new Set<string>();
      for (const key of Object.keys(store)) {
        if (key.startsWith(prefix)) {
          const rest = key.slice(prefix.length);
          const seg = rest.split("/")[0];
          if (seg !== undefined && seg !== "") entries.add(seg);
        }
      }
      return [...entries];
    },
  };
}

function makeProjectFs(projectDir: string): FsAdapter {
  const specPath = `${projectDir}/.trellis/spec.json`;
  const spec = JSON.stringify({
    projectName: "test-project",
    playbookId: "cli-tool",
    answers: [],
    rootPath: projectDir,
    matchMode: "exact",
    matchScore: 1,
    placeholders: {},
    generatedAt: "2026-05-19T00:00:00.000Z",
    trellisVersion: "0.9.0",
  });
  return makeFakeFs({ [specPath]: spec });
}

function makeNoSpecFs(): FsAdapter {
  return makeFakeFs({});
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

const PROJECT_DIR = "/tmp/test-upgrade-project";

describe("runUpgradeCmd", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  // -------------------------------------------------------------------------
  // spec.json 없음 → HarnessError (UserInputError)
  // -------------------------------------------------------------------------

  describe("spec.json 없음", () => {
    it("runUpgradeCmd_noSpec_throwsHarnessError", async () => {
      const fs = makeNoSpecFs();

      await expect(
        runUpgradeCmd(PROJECT_DIR, {}, fs, "0.10.0"),
      ).rejects.toThrow(HarnessError);
    });

    it("runUpgradeCmd_noSpec_exitCode2", async () => {
      const fs = makeNoSpecFs();

      await expect(
        runUpgradeCmd(PROJECT_DIR, {}, fs, "0.10.0"),
      ).rejects.toMatchObject({ exitCode: 2 });
    });

    it("runUpgradeCmd_noSpec_hintMentionsTrellisNew", async () => {
      const fs = makeNoSpecFs();

      let caught: unknown;
      try {
        await runUpgradeCmd(PROJECT_DIR, {}, fs, "0.10.0");
      } catch (e) {
        caught = e;
      }

      expect(caught).toBeInstanceOf(HarnessError);
      expect((caught as HarnessError).hint).toContain("trellis new");
    });

    it("runUpgradeCmd_noSpec_json_outputsErrorJson", async () => {
      const exitSpy = vi.spyOn(process, "exit").mockImplementation((_code) => {
        throw new Error("process.exit called");
      });
      const stdoutChunks: string[] = [];
      vi.spyOn(process.stdout, "write").mockImplementation((chunk) => {
        stdoutChunks.push(chunk as string);
        return true;
      });
      vi.spyOn(process.stderr, "write").mockImplementation(() => true);

      const fs = makeNoSpecFs();

      await runUpgradeCmd(PROJECT_DIR, { json: true }, fs, "0.10.0").catch(() => {});

      exitSpy.mockRestore();

      const result = JSON.parse(stdoutChunks.join("")) as {
        ok: boolean;
        command: string;
        error: { code: number; hint?: string };
      };
      expect(result.ok).toBe(false);
      expect(result.command).toBe("upgrade");
      expect(result.error.code).toBe(2);
      expect(result.error.hint).toContain("trellis new");
    });

    it("runUpgradeCmd_noSpec_json_singleLine", async () => {
      const exitSpy = vi.spyOn(process, "exit").mockImplementation((_code) => {
        throw new Error("process.exit called");
      });
      const stdoutChunks: string[] = [];
      vi.spyOn(process.stdout, "write").mockImplementation((chunk) => {
        stdoutChunks.push(chunk as string);
        return true;
      });
      vi.spyOn(process.stderr, "write").mockImplementation(() => true);

      const fs = makeNoSpecFs();

      await runUpgradeCmd(PROJECT_DIR, { json: true }, fs, "0.10.0").catch(() => {});

      exitSpy.mockRestore();

      const lines = stdoutChunks.join("").trim().split("\n");
      expect(lines.length).toBe(1);
      expect(() => JSON.parse(lines[0] as string)).not.toThrow();
    });
  });

  // -------------------------------------------------------------------------
  // spec.json 있음 + fake fs 에 manifest 없음 → HarnessError (UserInputError)
  // 실제 manifest 적용 시나리오는 service/upgrader 의 통합/E2E 테스트가 커버.
  // -------------------------------------------------------------------------

  describe("spec.json 있음, manifest 누락", () => {
    it("runUpgradeCmd_withSpec_throwsHarnessError", async () => {
      const fs = makeProjectFs(PROJECT_DIR);

      await expect(
        runUpgradeCmd(PROJECT_DIR, {}, fs, "0.10.0"),
      ).rejects.toThrow(HarnessError);
    });

    it("runUpgradeCmd_withSpec_exitCode2", async () => {
      const fs = makeProjectFs(PROJECT_DIR);

      await expect(
        runUpgradeCmd(PROJECT_DIR, {}, fs, "0.10.0"),
      ).rejects.toMatchObject({ exitCode: 2 });
    });

    it("runUpgradeCmd_withSpec_messageMentionsManifestNotFound", async () => {
      const fs = makeProjectFs(PROJECT_DIR);

      let caught: unknown;
      try {
        await runUpgradeCmd(PROJECT_DIR, {}, fs, "0.10.0");
      } catch (e) {
        caught = e;
      }

      expect(caught).toBeInstanceOf(HarnessError);
      expect((caught as HarnessError).message).toContain("manifest not found");
    });

    it("runUpgradeCmd_withSpec_json_outputsErrorJson", async () => {
      const exitSpy = vi.spyOn(process, "exit").mockImplementation((_code) => {
        throw new Error("process.exit called");
      });
      const stdoutChunks: string[] = [];
      vi.spyOn(process.stdout, "write").mockImplementation((chunk) => {
        stdoutChunks.push(chunk as string);
        return true;
      });
      vi.spyOn(process.stderr, "write").mockImplementation(() => true);

      const fs = makeProjectFs(PROJECT_DIR);

      await runUpgradeCmd(PROJECT_DIR, { json: true }, fs, "0.10.0").catch(() => {});

      exitSpy.mockRestore();

      const result = JSON.parse(stdoutChunks.join("")) as {
        ok: boolean;
        command: string;
        error: { code: number };
      };
      expect(result.ok).toBe(false);
      expect(result.command).toBe("upgrade");
      expect(result.error.code).toBe(2);
    });
  });

  // -------------------------------------------------------------------------
  // targetDir 기본값 — process.cwd() 사용
  // -------------------------------------------------------------------------

  describe("targetDir 기본값", () => {
    it("runUpgradeCmd_noTargetDir_usesCwd", async () => {
      const cwdSpy = vi.spyOn(process, "cwd").mockReturnValue(PROJECT_DIR);
      const fs = makeProjectFs(PROJECT_DIR);

      let caught: unknown;
      try {
        await runUpgradeCmd(undefined, {}, fs, "0.10.0");
      } catch (e) {
        caught = e;
      }

      cwdSpy.mockRestore();

      // Should reach manifest-not-found (exitCode 2 = UserInputError), not the "no spec" error
      expect(caught).toBeInstanceOf(HarnessError);
      expect((caught as HarnessError).exitCode).toBe(2);
      expect((caught as HarnessError).message).toContain("manifest not found");
    });
  });
});
