import { afterEach, describe, expect, it, vi } from "vitest";
import { HarnessError } from "../common/errors/index.js";
import type { FsAdapter } from "../external/fs-adapter.js";
import { runList } from "./list.js";

// ---------------------------------------------------------------------------
// Fake FsAdapter — mirrors the pattern from add.test.ts
// ---------------------------------------------------------------------------

type FakeFiles = Record<string, string>;

function makeFakeAdapter(files: FakeFiles): FsAdapter {
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
      return (
        Object.keys(store).filter((k) => k.startsWith(path + "/")).length === 0
      );
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
    deleteFile(path: string): void {
      delete store[path];
    },
  };
}

/**
 * Builds a fake FsAdapter that simulates:
 *  - .trellis/spec.json at projectDir (unless specMissing)
 *  - fragment directory under resources/templates/<playbookId>/_fragments/<fragmentType>/
 */
function makeFakeFs(opts: {
  projectDir: string;
  playbookId?: string;
  specMissing?: boolean;
  fragmentType?: string;
  fragmentTemplates?: Record<string, string>;
  patches?: Array<{ file: string; slot: string; entryKey: string; content: string }>;
  extraFragmentTypes?: string[];
}): FsAdapter {
  const {
    projectDir,
    playbookId = "b2b-saas",
    specMissing = false,
    fragmentType = "api",
    fragmentTemplates = {
      "route.ts.hbs": 'export const route = "{{name}}";',
    },
    patches,
    extraFragmentTypes = [],
  } = opts;

  const specPath = `${projectDir}/.trellis/spec.json`;
  const spec = JSON.stringify({
    projectName: "test-project",
    playbookId,
    answers: [],
    rootPath: projectDir,
    matchMode: "exact",
    matchScore: 1,
    placeholders: {},
    generatedAt: "2026-05-19T00:00:00.000Z",
    trellisVersion: "0.4.0",
  });

  const fragSuffix = `resources/templates/${playbookId}/_fragments/${fragmentType}`;
  const metaObj: Record<string, unknown> = { description: "test fragment" };
  if (patches !== undefined) {
    metaObj["patches"] = patches;
  }
  const metaJson = JSON.stringify(metaObj);

  const staticFiles: FakeFiles = {};
  if (!specMissing) {
    staticFiles[specPath] = spec;
  }

  const allFragmentTypes = [fragmentType, ...extraFragmentTypes];
  const base = makeFakeAdapter(staticFiles);

  return {
    exists(path: string): boolean {
      if (base.exists(path)) return true;
      // _fragments parent directory
      const fragmentsParent = `resources/templates/${playbookId}/_fragments`;
      if (path.endsWith(fragmentsParent)) return true;
      if (path.endsWith(fragSuffix)) return true;
      if (path.endsWith(`${fragSuffix}/meta.json`)) return true;
      for (const rel of Object.keys(fragmentTemplates)) {
        if (path.endsWith(`${fragSuffix}/${rel}`)) return true;
      }
      // extra fragment types directories
      for (const ft of extraFragmentTypes) {
        const s = `resources/templates/${playbookId}/_fragments/${ft}`;
        if (path.endsWith(s)) return true;
        if (path.endsWith(`${s}/meta.json`)) return true;
      }
      return false;
    },
    isDirectory(path: string): boolean {
      if (base.isDirectory(path)) return true;
      // _fragments parent directory
      const fragmentsParent = `resources/templates/${playbookId}/_fragments`;
      if (path.endsWith(fragmentsParent)) return true;
      if (path.endsWith(fragSuffix)) return true;
      for (const ft of extraFragmentTypes) {
        const s = `resources/templates/${playbookId}/_fragments/${ft}`;
        if (path.endsWith(s)) return true;
      }
      return false;
    },
    isEmptyDirectory(path: string): boolean {
      return base.isEmptyDirectory(path);
    },
    ensureDir(path: string): void {
      base.ensureDir(path);
    },
    writeFile(path: string, content: string): void {
      base.writeFile(path, content);
    },
    readFile(path: string): string {
      if (path.endsWith(`${fragSuffix}/meta.json`)) return metaJson;
      for (const rel of Object.keys(fragmentTemplates)) {
        if (path.endsWith(`${fragSuffix}/${rel}`)) return fragmentTemplates[rel] ?? "";
      }
      // extra fragment types — minimal meta
      for (const ft of extraFragmentTypes) {
        const s = `resources/templates/${playbookId}/_fragments/${ft}`;
        if (path.endsWith(`${s}/meta.json`)) {
          return JSON.stringify({ description: `${ft} fragment` });
        }
      }
      return base.readFile(path);
    },
    listDir(path: string): readonly string[] {
      // _fragments parent — list all types
      const fragmentsParent = `resources/templates/${playbookId}/_fragments`;
      if (path.endsWith(fragmentsParent)) {
        return allFragmentTypes;
      }
      // specific fragment dir
      if (path.endsWith(fragSuffix)) {
        const entries = new Set<string>(["meta.json"]);
        for (const rel of Object.keys(fragmentTemplates)) {
          const seg = rel.split("/")[0];
          if (seg) entries.add(seg);
        }
        return [...entries];
      }
      // extra fragment type dirs
      for (const ft of extraFragmentTypes) {
        const s = `resources/templates/${playbookId}/_fragments/${ft}`;
        if (path.endsWith(s)) {
          return ["meta.json"];
        }
      }
      return base.listDir(path);
    },
    deleteFile(path: string): void {
      base.deleteFile(path);
    },
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("runList", () => {
  const PROJECT_DIR = "/tmp/test-list-project";

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // -------------------------------------------------------------------------
  // 목록 모드 (text)
  // -------------------------------------------------------------------------

  describe("list 목록 모드 (text)", () => {
    it("runList_noType_printsFragmentTypes", async () => {
      const stdoutChunks: string[] = [];
      vi.spyOn(process.stdout, "write").mockImplementation((chunk) => {
        stdoutChunks.push(chunk as string);
        return true;
      });
      const fs = makeFakeFs({ projectDir: PROJECT_DIR, fragmentType: "api" });

      await runList(undefined, {}, fs, PROJECT_DIR);

      const output = stdoutChunks.join("");
      expect(output).toContain("api");
    });

    it("runList_noType_multipleTypes_allListed", async () => {
      const stdoutChunks: string[] = [];
      vi.spyOn(process.stdout, "write").mockImplementation((chunk) => {
        stdoutChunks.push(chunk as string);
        return true;
      });
      const fs = makeFakeFs({
        projectDir: PROJECT_DIR,
        fragmentType: "api",
        extraFragmentTypes: ["page", "model"],
      });

      await runList(undefined, {}, fs, PROJECT_DIR);

      const output = stdoutChunks.join("");
      expect(output).toContain("api");
      expect(output).toContain("page");
      expect(output).toContain("model");
    });
  });

  // -------------------------------------------------------------------------
  // 목록 모드 (--json)
  // -------------------------------------------------------------------------

  describe("list 목록 모드 (--json)", () => {
    it("runList_noType_json_stdoutIsParseable", async () => {
      const stdoutChunks: string[] = [];
      vi.spyOn(process.stdout, "write").mockImplementation((chunk) => {
        stdoutChunks.push(chunk as string);
        return true;
      });
      const fs = makeFakeFs({ projectDir: PROJECT_DIR });

      await runList(undefined, { json: true }, fs, PROJECT_DIR);

      const stdout = stdoutChunks.join("");
      expect(() => JSON.parse(stdout)).not.toThrow();
    });

    it("runList_noType_json_okTrueCommandList", async () => {
      const stdoutChunks: string[] = [];
      vi.spyOn(process.stdout, "write").mockImplementation((chunk) => {
        stdoutChunks.push(chunk as string);
        return true;
      });
      const fs = makeFakeFs({ projectDir: PROJECT_DIR });

      await runList(undefined, { json: true }, fs, PROJECT_DIR);

      const result = JSON.parse(stdoutChunks.join("")) as { ok: boolean; command: string };
      expect(result.ok).toBe(true);
      expect(result.command).toBe("list");
    });

    it("runList_noType_json_containsTypesArray", async () => {
      const stdoutChunks: string[] = [];
      vi.spyOn(process.stdout, "write").mockImplementation((chunk) => {
        stdoutChunks.push(chunk as string);
        return true;
      });
      const fs = makeFakeFs({ projectDir: PROJECT_DIR, fragmentType: "api" });

      await runList(undefined, { json: true }, fs, PROJECT_DIR);

      const result = JSON.parse(stdoutChunks.join("")) as { types: string[] };
      expect(Array.isArray(result.types)).toBe(true);
      expect(result.types).toContain("api");
    });

    it("runList_noType_json_singleLine", async () => {
      const stdoutChunks: string[] = [];
      vi.spyOn(process.stdout, "write").mockImplementation((chunk) => {
        stdoutChunks.push(chunk as string);
        return true;
      });
      const fs = makeFakeFs({ projectDir: PROJECT_DIR });

      await runList(undefined, { json: true }, fs, PROJECT_DIR);

      const lines = stdoutChunks.join("").trim().split("\n");
      expect(lines.length).toBe(1);
      expect(() => JSON.parse(lines[0] as string)).not.toThrow();
    });
  });

  // -------------------------------------------------------------------------
  // 상세 모드 (--json)
  // -------------------------------------------------------------------------

  describe("list <type> 상세 모드 (--json)", () => {
    it("runList_withType_json_okTrueCommandList", async () => {
      const stdoutChunks: string[] = [];
      vi.spyOn(process.stdout, "write").mockImplementation((chunk) => {
        stdoutChunks.push(chunk as string);
        return true;
      });
      const fs = makeFakeFs({ projectDir: PROJECT_DIR });

      await runList("api", { json: true }, fs, PROJECT_DIR);

      const result = JSON.parse(stdoutChunks.join("")) as { ok: boolean; command: string };
      expect(result.ok).toBe(true);
      expect(result.command).toBe("list");
    });

    it("runList_withType_json_containsFragmentFields", async () => {
      const stdoutChunks: string[] = [];
      vi.spyOn(process.stdout, "write").mockImplementation((chunk) => {
        stdoutChunks.push(chunk as string);
        return true;
      });
      const fs = makeFakeFs({
        projectDir: PROJECT_DIR,
        fragmentType: "api",
        fragmentTemplates: { "route.ts.hbs": "export {}" },
      });

      await runList("api", { json: true }, fs, PROJECT_DIR);

      const result = JSON.parse(stdoutChunks.join("")) as {
        fragmentType: string;
        description: string;
        files: string[];
        patches: unknown[];
        dependencies: Record<string, string>;
      };
      expect(result.fragmentType).toBe("api");
      expect(typeof result.description).toBe("string");
      expect(Array.isArray(result.files)).toBe(true);
      expect(Array.isArray(result.patches)).toBe(true);
      expect(typeof result.dependencies).toBe("object");
    });

    it("runList_withType_json_filesContainsTemplate", async () => {
      const stdoutChunks: string[] = [];
      vi.spyOn(process.stdout, "write").mockImplementation((chunk) => {
        stdoutChunks.push(chunk as string);
        return true;
      });
      const fs = makeFakeFs({
        projectDir: PROJECT_DIR,
        fragmentType: "api",
        fragmentTemplates: { "route.ts.hbs": "export {}" },
      });

      await runList("api", { json: true }, fs, PROJECT_DIR);

      const result = JSON.parse(stdoutChunks.join("")) as { files: string[] };
      expect(result.files).toContain("route.ts.hbs");
    });

    it("runList_withType_json_patchesSummary", async () => {
      const stdoutChunks: string[] = [];
      vi.spyOn(process.stdout, "write").mockImplementation((chunk) => {
        stdoutChunks.push(chunk as string);
        return true;
      });
      const fs = makeFakeFs({
        projectDir: PROJECT_DIR,
        patches: [
          { file: "src/lib/nav.ts", slot: "nav-items", entryKey: "api", content: "nav" },
        ],
      });

      await runList("api", { json: true }, fs, PROJECT_DIR);

      const result = JSON.parse(stdoutChunks.join("")) as {
        patches: { file: string; slot: string; entryKey: string }[];
      };
      expect(result.patches.length).toBe(1);
      expect(result.patches[0]?.file).toBe("src/lib/nav.ts");
      expect(result.patches[0]?.slot).toBe("nav-items");
      expect(result.patches[0]?.entryKey).toBe("api");
    });

    it("runList_withType_json_singleLine", async () => {
      const stdoutChunks: string[] = [];
      vi.spyOn(process.stdout, "write").mockImplementation((chunk) => {
        stdoutChunks.push(chunk as string);
        return true;
      });
      const fs = makeFakeFs({ projectDir: PROJECT_DIR });

      await runList("api", { json: true }, fs, PROJECT_DIR);

      const lines = stdoutChunks.join("").trim().split("\n");
      expect(lines.length).toBe(1);
      expect(() => JSON.parse(lines[0] as string)).not.toThrow();
    });
  });

  // -------------------------------------------------------------------------
  // spec.json 없음 → HarnessError + hint
  // -------------------------------------------------------------------------

  describe("spec.json 없음", () => {
    it("runList_noSpec_throwsHarnessError", async () => {
      const fs = makeFakeFs({ projectDir: PROJECT_DIR, specMissing: true });

      await expect(
        runList(undefined, {}, fs, PROJECT_DIR),
      ).rejects.toThrow(HarnessError);
    });

    it("runList_noSpec_exitCode2", async () => {
      const fs = makeFakeFs({ projectDir: PROJECT_DIR, specMissing: true });

      await expect(
        runList(undefined, {}, fs, PROJECT_DIR),
      ).rejects.toMatchObject({ exitCode: 2 });
    });

    it("runList_noSpec_hintMentionsTrellisNew", async () => {
      const fs = makeFakeFs({ projectDir: PROJECT_DIR, specMissing: true });

      const err = await runList(undefined, {}, fs, PROJECT_DIR).catch((e: unknown) => e);

      expect(err).toBeInstanceOf(HarnessError);
      expect((err as HarnessError).hint).toBeDefined();
      expect((err as HarnessError).hint).toContain("trellis new");
    });

    it("runList_noSpec_json_outputsErrorJson", async () => {
      const exitSpy = vi.spyOn(process, "exit").mockImplementation((_code) => {
        throw new Error("process.exit called");
      });
      const stdoutChunks: string[] = [];
      vi.spyOn(process.stdout, "write").mockImplementation((chunk) => {
        stdoutChunks.push(chunk as string);
        return true;
      });
      vi.spyOn(process.stderr, "write").mockImplementation(() => true);

      const fs = makeFakeFs({ projectDir: PROJECT_DIR, specMissing: true });

      await runList(undefined, { json: true }, fs, PROJECT_DIR).catch(() => {});

      exitSpy.mockRestore();

      const result = JSON.parse(stdoutChunks.join("")) as {
        ok: boolean;
        command: string;
        error: { code: number; hint?: string };
      };
      expect(result.ok).toBe(false);
      expect(result.command).toBe("list");
      expect(result.error.code).toBe(2);
      expect(result.error.hint).toContain("trellis new");
    });
  });

  // -------------------------------------------------------------------------
  // unknown fragment type → HarnessError
  // -------------------------------------------------------------------------

  describe("unknown fragment type", () => {
    it("runList_unknownType_throwsHarnessError", async () => {
      const fs = makeFakeFs({ projectDir: PROJECT_DIR });

      await expect(
        runList("nonexistent-type", {}, fs, PROJECT_DIR),
      ).rejects.toThrow(HarnessError);
    });

    it("runList_unknownType_exitCode2", async () => {
      const fs = makeFakeFs({ projectDir: PROJECT_DIR });

      await expect(
        runList("nonexistent-type", {}, fs, PROJECT_DIR),
      ).rejects.toMatchObject({ exitCode: 2 });
    });

    it("runList_unknownType_json_outputsErrorJson", async () => {
      const exitSpy = vi.spyOn(process, "exit").mockImplementation((_code) => {
        throw new Error("process.exit called");
      });
      const stdoutChunks: string[] = [];
      vi.spyOn(process.stdout, "write").mockImplementation((chunk) => {
        stdoutChunks.push(chunk as string);
        return true;
      });
      vi.spyOn(process.stderr, "write").mockImplementation(() => true);

      const fs = makeFakeFs({ projectDir: PROJECT_DIR });

      await runList("nonexistent-type", { json: true }, fs, PROJECT_DIR).catch(() => {});

      exitSpy.mockRestore();

      const result = JSON.parse(stdoutChunks.join("")) as {
        ok: boolean;
        error: { code: number };
      };
      expect(result.ok).toBe(false);
      expect(result.error.code).toBe(2);
    });
  });
});
