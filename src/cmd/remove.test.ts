import { afterEach, describe, expect, it, vi } from "vitest";
import { HarnessError } from "../common/errors/index.js";
import type { FsAdapter } from "../external/fs-adapter.js";
import type { GitChecker } from "../service/upgrader/git-status.js";
import { runRemove } from "./remove.js";

// ---------------------------------------------------------------------------
// Fake FsAdapter (동일 패턴 — add.test.ts 참조)
// ---------------------------------------------------------------------------

type FakeFiles = Record<string, string>;

function makeFakeAdapter(files: FakeFiles): FsAdapter & { store: FakeFiles } {
  const store = { ...files };
  return {
    store,
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
 * add.test.ts 의 makeFakeFs 와 동일한 구조.
 * fragment 파일 시스템을 시뮬레이션한다.
 */
function makeFakeFs(opts: {
  projectDir: string;
  playbookId?: string;
  specMissing?: boolean;
  fragmentType?: string;
  fragmentTemplates?: Record<string, string>;
  existingFiles?: Record<string, string>; // path → content
  patches?: Array<{ file: string; slot: string; entryKey: string; content: string }>;
  patchTargetFiles?: Record<string, string>;
}): FsAdapter & { store: FakeFiles } {
  const {
    projectDir,
    playbookId = "b2b-saas",
    specMissing = false,
    fragmentType = "api",
    fragmentTemplates = {
      "app/api/{{nameKebab}}/route.ts.hbs": 'export const route = "{{name}}";',
    },
    existingFiles = {},
    patches,
    patchTargetFiles = {},
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
  const metaMeta: Record<string, unknown> = { description: "test fragment" };
  if (patches !== undefined) {
    metaMeta["patches"] = patches;
  }
  const metaJson = JSON.stringify(metaMeta);

  const staticFiles: FakeFiles = {};
  if (!specMissing) {
    staticFiles[specPath] = spec;
  }
  // existing files with their contents (relative → absolute)
  for (const [rel, content] of Object.entries(existingFiles)) {
    staticFiles[`${projectDir}/${rel}`] = content;
  }
  // patch target files
  for (const [rel, content] of Object.entries(patchTargetFiles)) {
    staticFiles[`${projectDir}/${rel}`] = content;
  }

  const base = makeFakeAdapter(staticFiles);

  return {
    get store() {
      return base.store;
    },
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
      const fragmentsParent = `resources/templates/${playbookId}/_fragments`;
      if (path.endsWith(fragmentsParent)) {
        return [fragmentType];
      }
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
    deleteFile(path: string): void {
      base.deleteFile(path);
    },
  };
}

/** Rendered content of the default fragment template for name "users" */
const RENDERED_ROUTE_CONTENT = 'export const route = "users";';
const RENDERED_ROUTE_PATH = "app/api/users/route.ts";

/** git always clean */
const cleanGit: GitChecker = () => true;
/** git always dirty */
const dirtyGit: GitChecker = () => false;

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("runRemove", () => {
  const PROJECT_DIR = "/tmp/test-remove-project";

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // -------------------------------------------------------------------------
  // spec.json 없음 → HarnessError
  // -------------------------------------------------------------------------

  it("runRemove_noSpec_throwsHarnessError", async () => {
    const fs = makeFakeFs({ projectDir: PROJECT_DIR, specMissing: true });

    await expect(
      runRemove("api", "users", {}, fs, PROJECT_DIR, cleanGit),
    ).rejects.toThrow(HarnessError);
  });

  it("runRemove_noSpec_exitCode2", async () => {
    const fs = makeFakeFs({ projectDir: PROJECT_DIR, specMissing: true });

    await expect(
      runRemove("api", "users", {}, fs, PROJECT_DIR, cleanGit),
    ).rejects.toMatchObject({ exitCode: 2 });
  });

  // -------------------------------------------------------------------------
  // git dirty + force=false → HarnessError
  // -------------------------------------------------------------------------

  it("runRemove_gitDirty_noForce_throwsHarnessError", async () => {
    const fs = makeFakeFs({ projectDir: PROJECT_DIR });

    await expect(
      runRemove("api", "users", {}, fs, PROJECT_DIR, dirtyGit),
    ).rejects.toThrow(HarnessError);
  });

  it("runRemove_gitDirty_noForce_exitCode3", async () => {
    const fs = makeFakeFs({ projectDir: PROJECT_DIR });

    await expect(
      runRemove("api", "users", {}, fs, PROJECT_DIR, dirtyGit),
    ).rejects.toMatchObject({ exitCode: 3 });
  });

  it("runRemove_gitDirty_forceTrue_doesNotThrow", async () => {
    vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    // File must exist with matching content for removal to succeed
    const fs = makeFakeFs({
      projectDir: PROJECT_DIR,
      existingFiles: { [RENDERED_ROUTE_PATH]: RENDERED_ROUTE_CONTENT },
    });

    await expect(
      runRemove("api", "users", { force: true }, fs, PROJECT_DIR, dirtyGit),
    ).resolves.not.toThrow();
  });

  // -------------------------------------------------------------------------
  // 정상 remove: 파일 제거
  // -------------------------------------------------------------------------

  it("runRemove_fileExists_matchingContent_fileRemoved", async () => {
    vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    const fs = makeFakeFs({
      projectDir: PROJECT_DIR,
      existingFiles: { [RENDERED_ROUTE_PATH]: RENDERED_ROUTE_CONTENT },
    });

    await runRemove("api", "users", {}, fs, PROJECT_DIR, cleanGit);

    const absPath = `${PROJECT_DIR}/${RENDERED_ROUTE_PATH}`;
    expect(absPath in fs.store).toBe(false);
  });

  // -------------------------------------------------------------------------
  // 사용자 수정 파일 → userModified, --force 로 강제 삭제
  // -------------------------------------------------------------------------

  it("runRemove_userModifiedFile_noForce_filePreserved", async () => {
    vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    const absPath = `${PROJECT_DIR}/${RENDERED_ROUTE_PATH}`;
    const fs = makeFakeFs({
      projectDir: PROJECT_DIR,
      existingFiles: {
        [RENDERED_ROUTE_PATH]: 'export const route = "users"; // user edit',
      },
    });

    await runRemove("api", "users", {}, fs, PROJECT_DIR, cleanGit);

    // 파일 보존됨
    expect(absPath in fs.store).toBe(true);
  });

  it("runRemove_userModifiedFile_force_fileRemoved", async () => {
    vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    const absPath = `${PROJECT_DIR}/${RENDERED_ROUTE_PATH}`;
    const fs = makeFakeFs({
      projectDir: PROJECT_DIR,
      existingFiles: {
        [RENDERED_ROUTE_PATH]: 'export const route = "users"; // user edit',
      },
    });

    await runRemove("api", "users", { force: true }, fs, PROJECT_DIR, cleanGit);

    // 파일 삭제됨
    expect(absPath in fs.store).toBe(false);
  });

  // -------------------------------------------------------------------------
  // 이미 없는 fragment remove → notFound 만 보고 (성공)
  // -------------------------------------------------------------------------

  it("runRemove_fragmentAlreadyGone_noError_notFoundReported", async () => {
    const stdoutChunks: string[] = [];
    vi.spyOn(process.stdout, "write").mockImplementation((chunk) => {
      stdoutChunks.push(chunk as string);
      return true;
    });
    // fragment 파일 없는 상태
    const fs = makeFakeFs({ projectDir: PROJECT_DIR });

    await expect(
      runRemove("api", "users", {}, fs, PROJECT_DIR, cleanGit),
    ).resolves.not.toThrow();

    const output = stdoutChunks.join("");
    expect(output).toContain("Nothing to remove");
  });

  // -------------------------------------------------------------------------
  // dry-run: 실제 변경 0, 결과만 보고
  // -------------------------------------------------------------------------

  it("runRemove_dryRun_noFilesDeleted", async () => {
    const stdoutChunks: string[] = [];
    vi.spyOn(process.stdout, "write").mockImplementation((chunk) => {
      stdoutChunks.push(chunk as string);
      return true;
    });
    const absPath = `${PROJECT_DIR}/${RENDERED_ROUTE_PATH}`;
    const fs = makeFakeFs({
      projectDir: PROJECT_DIR,
      existingFiles: { [RENDERED_ROUTE_PATH]: RENDERED_ROUTE_CONTENT },
    });

    await runRemove("api", "users", { dryRun: true }, fs, PROJECT_DIR, cleanGit);

    // 파일 여전히 존재
    expect(absPath in fs.store).toBe(true);
    // dry-run 메시지 출력
    const output = stdoutChunks.join("");
    expect(output).toContain("Dry-run");
  });

  it("runRemove_dryRun_skipsGitCheck", async () => {
    vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    const fs = makeFakeFs({ projectDir: PROJECT_DIR });

    // dirty git 이지만 dryRun 이므로 오류 없어야 함
    await expect(
      runRemove("api", "users", { dryRun: true }, fs, PROJECT_DIR, dirtyGit),
    ).resolves.not.toThrow();
  });

  // -------------------------------------------------------------------------
  // JSON 모드 출력 스키마 검증
  // -------------------------------------------------------------------------

  it("runRemove_json_success_parseable", async () => {
    const stdoutChunks: string[] = [];
    vi.spyOn(process.stdout, "write").mockImplementation((chunk) => {
      stdoutChunks.push(chunk as string);
      return true;
    });
    const fs = makeFakeFs({
      projectDir: PROJECT_DIR,
      existingFiles: { [RENDERED_ROUTE_PATH]: RENDERED_ROUTE_CONTENT },
    });

    await runRemove("api", "users", { json: true }, fs, PROJECT_DIR, cleanGit);

    expect(() => JSON.parse(stdoutChunks.join(""))).not.toThrow();
  });

  it("runRemove_json_success_schema", async () => {
    const stdoutChunks: string[] = [];
    vi.spyOn(process.stdout, "write").mockImplementation((chunk) => {
      stdoutChunks.push(chunk as string);
      return true;
    });
    const fs = makeFakeFs({
      projectDir: PROJECT_DIR,
      existingFiles: { [RENDERED_ROUTE_PATH]: RENDERED_ROUTE_CONTENT },
    });

    await runRemove("api", "users", { json: true }, fs, PROJECT_DIR, cleanGit);

    const result = JSON.parse(stdoutChunks.join("")) as {
      ok: boolean;
      command: string;
      playbookId: string;
      fragmentType: string;
      name: string;
      removed: { files: string[]; patches: unknown[] };
      notFound: { files: string[]; patches: unknown[] };
      userModified: string[];
      dryRun: boolean;
    };
    expect(result.ok).toBe(true);
    expect(result.command).toBe("remove");
    expect(result.playbookId).toBe("b2b-saas");
    expect(result.fragmentType).toBe("api");
    expect(result.name).toBe("users");
    expect(Array.isArray(result.removed.files)).toBe(true);
    expect(Array.isArray(result.removed.patches)).toBe(true);
    expect(Array.isArray(result.notFound.files)).toBe(true);
    expect(Array.isArray(result.notFound.patches)).toBe(true);
    expect(Array.isArray(result.userModified)).toBe(true);
    expect(result.dryRun).toBe(false);
  });

  it("runRemove_json_singleLine", async () => {
    const stdoutChunks: string[] = [];
    vi.spyOn(process.stdout, "write").mockImplementation((chunk) => {
      stdoutChunks.push(chunk as string);
      return true;
    });
    const fs = makeFakeFs({ projectDir: PROJECT_DIR });

    await runRemove("api", "users", { json: true }, fs, PROJECT_DIR, cleanGit);

    const lines = stdoutChunks.join("").trim().split("\n");
    expect(lines.length).toBe(1);
    expect(() => JSON.parse(lines[0] as string)).not.toThrow();
  });

  it("runRemove_json_noSpec_errorJsonOkFalse", async () => {
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

    await runRemove("api", "users", { json: true }, fs, PROJECT_DIR, cleanGit).catch(() => {});

    exitSpy.mockRestore();

    const result = JSON.parse(stdoutChunks.join("")) as { ok: boolean; error: { code: number } };
    expect(result.ok).toBe(false);
    expect(result.error.code).toBe(2);
  });

  it("runRemove_json_gitDirty_errorJsonOkFalse", async () => {
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

    await runRemove("api", "users", { json: true }, fs, PROJECT_DIR, dirtyGit).catch(() => {});

    exitSpy.mockRestore();

    const result = JSON.parse(stdoutChunks.join("")) as { ok: boolean; error: { code: number } };
    expect(result.ok).toBe(false);
    expect(result.error.code).toBe(3);
  });

  it("runRemove_json_dryRun_dryRunTrue", async () => {
    const stdoutChunks: string[] = [];
    vi.spyOn(process.stdout, "write").mockImplementation((chunk) => {
      stdoutChunks.push(chunk as string);
      return true;
    });
    const fs = makeFakeFs({
      projectDir: PROJECT_DIR,
      existingFiles: { [RENDERED_ROUTE_PATH]: RENDERED_ROUTE_CONTENT },
    });

    await runRemove("api", "users", { json: true, dryRun: true }, fs, PROJECT_DIR, cleanGit);

    const result = JSON.parse(stdoutChunks.join("")) as { dryRun: boolean };
    expect(result.dryRun).toBe(true);
  });

  // -------------------------------------------------------------------------
  // patches 제거 통합
  // -------------------------------------------------------------------------

  it("runRemove_withPatches_patchRemoved", async () => {
    vi.spyOn(process.stdout, "write").mockImplementation(() => true);

    const SLOT_FILE = "src/lib/nav-items.ts";
    const SLOT_CONTENT = [
      "// trellis:slot:nav-items:start",
      '{ label: "Users", href: "/users" },',
      "// trellis:slot:nav-items:end",
    ].join("\n");

    const fs = makeFakeFs({
      projectDir: PROJECT_DIR,
      existingFiles: {
        [RENDERED_ROUTE_PATH]: RENDERED_ROUTE_CONTENT,
        [SLOT_FILE]: SLOT_CONTENT,
      },
      patches: [
        {
          file: SLOT_FILE,
          slot: "nav-items",
          entryKey: "users",
          content: '{ label: "Users", href: "/users" },',
        },
      ],
      patchTargetFiles: {},
    });

    await runRemove("api", "users", {}, fs, PROJECT_DIR, cleanGit);

    const slotFileAbs = `${PROJECT_DIR}/${SLOT_FILE}`;
    const updated = fs.store[slotFileAbs] as string;
    expect(updated).not.toContain('{ label: "Users"');
    expect(updated).toContain("// trellis:slot:nav-items:start");
    expect(updated).toContain("// trellis:slot:nav-items:end");
  });
});
