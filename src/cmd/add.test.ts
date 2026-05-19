import { afterEach, describe, expect, it, vi } from "vitest";
import { HarnessError } from "../common/errors/index.js";
import type { FsAdapter } from "../external/fs-adapter.js";
import { runAdd } from "./add.js";

// ---------------------------------------------------------------------------
// Fake FsAdapter
// ---------------------------------------------------------------------------

type FakeFiles = Record<string, string>; // absolute path → content

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
  };
}

// ---------------------------------------------------------------------------
// Helpers to build fake filesystem for runAdd
// ---------------------------------------------------------------------------

/**
 * Builds a fake fs that simulates:
 *  - .trellis/spec.json at projectDir
 *  - fragment directory at any path ending with resources/templates/<playbookId>/_fragments/<type>/
 */
function makeFakeFs(opts: {
  projectDir: string;
  playbookId?: string;
  specMissing?: boolean;
  fragmentType?: string;
  fragmentTemplates?: Record<string, string>;
  existingFiles?: string[];
}): FsAdapter {
  const {
    projectDir,
    playbookId = "b2b-saas",
    specMissing = false,
    fragmentType = "api",
    fragmentTemplates = {
      "app/api/{{nameKebab}}/route.ts.hbs": 'export const route = "{{name}}";',
    },
    existingFiles = [],
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
  const metaJson = JSON.stringify({ description: "test fragment" });

  // Build fake file map with suffix-based matching via a custom adapter
  const staticFiles: FakeFiles = {};
  if (!specMissing) {
    staticFiles[specPath] = spec;
  }
  for (const path of existingFiles) {
    staticFiles[`${projectDir}/${path}`] = "existing content";
  }

  // We need a custom adapter because fragment paths are resolved via import.meta.url
  // We intercept by matching path suffix patterns.
  const base = makeFakeAdapter(staticFiles);

  return {
    exists(path: string): boolean {
      if (base.exists(path)) return true;
      if (path.endsWith(fragSuffix)) return true;
      if (path.endsWith(`${fragSuffix}/meta.json`)) return true;
      for (const rel of Object.keys(fragmentTemplates)) {
        if (path.endsWith(`${fragSuffix}/${rel}`)) return true;
      }
      return false;
    },
    isDirectory(path: string): boolean {
      if (base.isDirectory(path)) return true;
      if (path.endsWith(fragSuffix)) return true;
      // check sub-dirs inside fragment
      const idx = path.indexOf(fragSuffix);
      if (idx !== -1) {
        const local = path.slice(idx + fragSuffix.length).replace(/^\//, "");
        if (local === "") return true;
        return Object.keys(fragmentTemplates).some((k) => k.startsWith(local + "/"));
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
      for (const [rel, content] of Object.entries(fragmentTemplates)) {
        if (path.endsWith(`${fragSuffix}/${rel}`)) return content;
      }
      return base.readFile(path);
    },
    listDir(path: string): readonly string[] {
      if (path.endsWith(fragSuffix)) {
        const entries = new Set<string>(["meta.json"]);
        for (const rel of Object.keys(fragmentTemplates)) {
          const seg = rel.split("/")[0];
          if (seg) entries.add(seg);
        }
        return [...entries];
      }
      // _fragments dir itself — list fragment types
      const fragmentsParent = `resources/templates/${playbookId}/_fragments`;
      if (path.endsWith(fragmentsParent)) {
        return [fragmentType];
      }
      // handle sub-dirs in fragment
      const idx = path.indexOf(fragSuffix);
      if (idx !== -1) {
        const local = path.slice(idx + fragSuffix.length).replace(/^\//, "");
        const prefix = local ? local + "/" : "";
        const entries = new Set<string>();
        for (const rel of Object.keys(fragmentTemplates)) {
          if (rel.startsWith(prefix)) {
            const rest = rel.slice(prefix.length);
            const seg = rest.split("/")[0];
            if (seg) entries.add(seg);
          }
        }
        return [...entries];
      }
      return base.listDir(path);
    },
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("runAdd", () => {
  const PROJECT_DIR = "/tmp/test-project";

  it("runAdd_noSpec_throwsHarnessErrorExitCode2", async () => {
    const fs = makeFakeFs({ projectDir: PROJECT_DIR, specMissing: true });

    await expect(
      runAdd("api", "users", {}, fs, PROJECT_DIR),
    ).rejects.toThrow(HarnessError);

    await expect(
      runAdd("api", "users", {}, fs, PROJECT_DIR),
    ).rejects.toMatchObject({ exitCode: 2 });
  });

  it("runAdd_noSpec_errorMessageMentionsTrellisNew", async () => {
    const fs = makeFakeFs({ projectDir: PROJECT_DIR, specMissing: true });

    await expect(
      runAdd("api", "users", {}, fs, PROJECT_DIR),
    ).rejects.toThrow(/trellis new/);
  });

  it("runAdd_invalidName_throwsHarnessErrorExitCode2", async () => {
    const fs = makeFakeFs({ projectDir: PROJECT_DIR });

    // Name starting with digit is invalid
    await expect(
      runAdd("api", "123invalid", {}, fs, PROJECT_DIR),
    ).rejects.toThrow(HarnessError);

    await expect(
      runAdd("api", "123invalid", {}, fs, PROJECT_DIR),
    ).rejects.toMatchObject({ exitCode: 2 });
  });

  it("runAdd_nameWithSpace_throwsHarnessErrorExitCode2", async () => {
    const fs = makeFakeFs({ projectDir: PROJECT_DIR });

    await expect(
      runAdd("api", "user name", {}, fs, PROJECT_DIR),
    ).rejects.toThrow(HarnessError);
  });

  it("runAdd_validArgs_writesRenderedFiles", async () => {
    const writtenFiles: Record<string, string> = {};
    const fs = makeFakeFs({ projectDir: PROJECT_DIR });
    const wrappedFs: FsAdapter = {
      ...fs,
      writeFile(path: string, content: string): void {
        writtenFiles[path] = content;
        fs.writeFile(path, content);
      },
    };

    await runAdd("api", "users", {}, wrappedFs, PROJECT_DIR);

    const expectedPath = `${PROJECT_DIR}/app/api/users/route.ts`;
    expect(writtenFiles[expectedPath]).toBe('export const route = "users";');
  });

  it("runAdd_fileAlreadyExists_throwsHarnessErrorExitCode3", async () => {
    const fs = makeFakeFs({
      projectDir: PROJECT_DIR,
      existingFiles: ["app/api/users/route.ts"],
    });

    await expect(
      runAdd("api", "users", {}, fs, PROJECT_DIR),
    ).rejects.toThrow(HarnessError);

    await expect(
      runAdd("api", "users", {}, fs, PROJECT_DIR),
    ).rejects.toMatchObject({ exitCode: 3 });
  });

  it("runAdd_fileExistsWithForce_writesSuccessfully", async () => {
    const writtenFiles: Record<string, string> = {};
    const fs = makeFakeFs({
      projectDir: PROJECT_DIR,
      existingFiles: ["app/api/users/route.ts"],
    });
    const wrappedFs: FsAdapter = {
      ...fs,
      writeFile(path: string, content: string): void {
        writtenFiles[path] = content;
        fs.writeFile(path, content);
      },
    };

    await runAdd("api", "users", { force: true }, wrappedFs, PROJECT_DIR);

    const expectedPath = `${PROJECT_DIR}/app/api/users/route.ts`;
    expect(writtenFiles[expectedPath]).toBe('export const route = "users";');
  });

  it("runAdd_unknownFragmentType_throwsHarnessError", async () => {
    const fs = makeFakeFs({ projectDir: PROJECT_DIR });

    await expect(
      runAdd("nonexistent-type", "users", {}, fs, PROJECT_DIR),
    ).rejects.toThrow(HarnessError);
  });

  it("runAdd_nameKebabInPath_renderedCorrectly", async () => {
    const writtenFiles: Record<string, string> = {};
    const fs = makeFakeFs({
      projectDir: PROJECT_DIR,
      fragmentTemplates: {
        "src/{{namePascal}}/index.ts.hbs": "export class {{namePascal}} {}",
      },
    });
    const wrappedFs: FsAdapter = {
      ...fs,
      writeFile(path: string, content: string): void {
        writtenFiles[path] = content;
        fs.writeFile(path, content);
      },
    };

    await runAdd("api", "user-profile", {}, wrappedFs, PROJECT_DIR);

    const expectedPath = `${PROJECT_DIR}/src/UserProfile/index.ts`;
    expect(writtenFiles[expectedPath]).toBe("export class UserProfile {}");
  });

  // ---------------------------------------------------------------------------
  // P7.8 — Conflict handling + --force
  // ---------------------------------------------------------------------------

  describe("conflict handling", () => {
    afterEach(() => {
      vi.restoreAllMocks();
    });

    it("runAdd_singleConflict_errorContainsPath_exitCode3", async () => {
      const fs = makeFakeFs({
        projectDir: PROJECT_DIR,
        existingFiles: ["app/api/users/route.ts"],
      });

      await expect(
        runAdd("api", "users", {}, fs, PROJECT_DIR),
      ).rejects.toMatchObject({
        exitCode: 3,
        message: expect.stringContaining("app/api/users/route.ts"),
      });
    });

    it("runAdd_singleConflict_errorMessageIsActionable", async () => {
      const fs = makeFakeFs({
        projectDir: PROJECT_DIR,
        existingFiles: ["app/api/users/route.ts"],
      });

      await expect(
        runAdd("api", "users", {}, fs, PROJECT_DIR),
      ).rejects.toThrow(/--force/);
    });

    it("runAdd_multipleConflicts_allPathsInErrorMessage", async () => {
      const fs = makeFakeFs({
        projectDir: PROJECT_DIR,
        fragmentTemplates: {
          "app/api/{{nameKebab}}/route.ts.hbs": 'export const route = "{{name}}";',
          "app/api/{{nameKebab}}/route.test.ts.hbs": 'it("test", () => {});',
        },
        existingFiles: [
          "app/api/users/route.ts",
          "app/api/users/route.test.ts",
        ],
      });

      const err = await runAdd("api", "users", {}, fs, PROJECT_DIR).catch(
        (e: unknown) => e,
      );

      expect(err).toBeInstanceOf(HarnessError);
      const msg = (err as HarnessError).message;
      expect(msg).toContain("app/api/users/route.ts");
      expect(msg).toContain("app/api/users/route.test.ts");
    });

    it("runAdd_multipleConflicts_doesNotStopAtFirst", async () => {
      const fs = makeFakeFs({
        projectDir: PROJECT_DIR,
        fragmentTemplates: {
          "app/api/{{nameKebab}}/route.ts.hbs": 'export const route = "{{name}}";',
          "app/api/{{nameKebab}}/route.test.ts.hbs": 'it("test", () => {});',
        },
        existingFiles: [
          "app/api/users/route.ts",
          "app/api/users/route.test.ts",
        ],
      });

      const err = await runAdd("api", "users", {}, fs, PROJECT_DIR).catch(
        (e: unknown) => e,
      );

      expect(err).toBeInstanceOf(HarnessError);
      // Message must list both files — not just the first one
      const lines = (err as HarnessError).message.split("\n").filter((l) =>
        l.trim().startsWith("-"),
      );
      expect(lines.length).toBe(2);
    });

    it("runAdd_forceWithSingleConflict_writesFileSuccessfully", async () => {
      const writtenFiles: Record<string, string> = {};
      const fs = makeFakeFs({
        projectDir: PROJECT_DIR,
        existingFiles: ["app/api/users/route.ts"],
      });
      const wrappedFs: FsAdapter = {
        ...fs,
        writeFile(path: string, content: string): void {
          writtenFiles[path] = content;
          fs.writeFile(path, content);
        },
      };

      await runAdd("api", "users", { force: true }, wrappedFs, PROJECT_DIR);

      const expectedPath = `${PROJECT_DIR}/app/api/users/route.ts`;
      expect(writtenFiles[expectedPath]).toBe('export const route = "users";');
    });

    it("runAdd_forceWithSingleConflict_emitsWarningToStderr", async () => {
      const stderrSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
      const fs = makeFakeFs({
        projectDir: PROJECT_DIR,
        existingFiles: ["app/api/users/route.ts"],
      });

      await runAdd("api", "users", { force: true }, fs, PROJECT_DIR);

      const stderrOutput = stderrSpy.mock.calls.map((c) => c[0] as string).join("");
      expect(stderrOutput).toContain("Warning");
      expect(stderrOutput).toContain("app/api/users/route.ts");
    });

    it("runAdd_forceWithMultipleConflicts_writesAllFilesSuccessfully", async () => {
      const writtenFiles: Record<string, string> = {};
      const fs = makeFakeFs({
        projectDir: PROJECT_DIR,
        fragmentTemplates: {
          "app/api/{{nameKebab}}/route.ts.hbs": 'export const route = "{{name}}";',
          "app/api/{{nameKebab}}/route.test.ts.hbs": 'it("test", () => {});',
        },
        existingFiles: [
          "app/api/users/route.ts",
          "app/api/users/route.test.ts",
        ],
      });
      const wrappedFs: FsAdapter = {
        ...fs,
        writeFile(path: string, content: string): void {
          writtenFiles[path] = content;
          fs.writeFile(path, content);
        },
      };

      await runAdd("api", "users", { force: true }, wrappedFs, PROJECT_DIR);

      expect(writtenFiles[`${PROJECT_DIR}/app/api/users/route.ts`]).toBeDefined();
      expect(writtenFiles[`${PROJECT_DIR}/app/api/users/route.test.ts`]).toBeDefined();
    });

    it("runAdd_forceWithMultipleConflicts_warningContainsAllPaths", async () => {
      const stderrSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
      const fs = makeFakeFs({
        projectDir: PROJECT_DIR,
        fragmentTemplates: {
          "app/api/{{nameKebab}}/route.ts.hbs": 'export const route = "{{name}}";',
          "app/api/{{nameKebab}}/route.test.ts.hbs": 'it("test", () => {});',
        },
        existingFiles: [
          "app/api/users/route.ts",
          "app/api/users/route.test.ts",
        ],
      });

      await runAdd("api", "users", { force: true }, fs, PROJECT_DIR);

      const stderrOutput = stderrSpy.mock.calls.map((c) => c[0] as string).join("");
      expect(stderrOutput).toContain("app/api/users/route.ts");
      expect(stderrOutput).toContain("app/api/users/route.test.ts");
    });

    it("runAdd_forceWithNoConflicts_noWarningEmitted", async () => {
      const stderrSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
      const fs = makeFakeFs({ projectDir: PROJECT_DIR });

      await runAdd("api", "users", { force: true }, fs, PROJECT_DIR);

      const stderrOutput = stderrSpy.mock.calls.map((c) => c[0] as string).join("");
      expect(stderrOutput).not.toContain("Warning");
    });
  });
});
