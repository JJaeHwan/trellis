import { describe, expect, it } from "vitest";
import type { FsAdapter } from "../../external/fs-adapter.js";
import type { VirtualTree } from "../../domain/index.js";
import { removeFiles } from "./un-writer.js";

// ---------------------------------------------------------------------------
// In-memory FsAdapter
// ---------------------------------------------------------------------------

function makeMemFs(files: Record<string, string> = {}): FsAdapter & {
  store: Record<string, string>;
} {
  const store = { ...files };
  return {
    store,
    exists(path: string): boolean {
      return path in store;
    },
    isDirectory(_path: string): boolean {
      return false;
    },
    isEmptyDirectory(_path: string): boolean {
      return false;
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
    listDir(_path: string): readonly string[] {
      return [];
    },
    deleteFile(path: string): void {
      delete store[path];
    },
  };
}

const PROJECT_DIR = "/tmp/test-project";

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("removeFiles", () => {
  // 1. tree 의 파일이 정확히 매칭 → removed
  it("removeFiles_exactMatch_removed", () => {
    const absPath = `${PROJECT_DIR}/app/api/users/route.ts`;
    const content = 'export const route = "users";';
    const fs = makeMemFs({ [absPath]: content });

    const tree: VirtualTree = [{ path: "app/api/users/route.ts", content }];
    const result = removeFiles(PROJECT_DIR, tree, fs, {});

    expect(result.removed).toHaveLength(1);
    expect(result.removed[0]).toBe("app/api/users/route.ts");
    expect(result.notFound).toHaveLength(0);
    expect(result.userModified).toHaveLength(0);
    // 파일이 실제로 삭제됐는지 확인
    expect(absPath in fs.store).toBe(false);
  });

  // 2. 파일 없음 → notFound
  it("removeFiles_fileNotFound_notFound", () => {
    const fs = makeMemFs();

    const tree: VirtualTree = [{ path: "app/api/users/route.ts", content: "some content" }];
    const result = removeFiles(PROJECT_DIR, tree, fs, {});

    expect(result.removed).toHaveLength(0);
    expect(result.notFound).toHaveLength(1);
    expect(result.notFound[0]).toBe("app/api/users/route.ts");
    expect(result.userModified).toHaveLength(0);
  });

  // 3. 내용 다름 + force=false → userModified, 파일 보존
  it("removeFiles_contentMismatch_forceOff_userModified_filePreserved", () => {
    const absPath = `${PROJECT_DIR}/app/api/users/route.ts`;
    const originalContent = 'export const route = "users";';
    const modifiedContent = 'export const route = "users"; // modified by user';
    const fs = makeMemFs({ [absPath]: modifiedContent });

    const tree: VirtualTree = [{ path: "app/api/users/route.ts", content: originalContent }];
    const result = removeFiles(PROJECT_DIR, tree, fs, { force: false });

    expect(result.removed).toHaveLength(0);
    expect(result.notFound).toHaveLength(0);
    expect(result.userModified).toHaveLength(1);
    expect(result.userModified[0]).toBe("app/api/users/route.ts");
    // 파일 보존됨
    expect(fs.store[absPath]).toBe(modifiedContent);
  });

  // 4. 내용 다름 + force=true → removed
  it("removeFiles_contentMismatch_forceOn_removed", () => {
    const absPath = `${PROJECT_DIR}/app/api/users/route.ts`;
    const originalContent = 'export const route = "users";';
    const modifiedContent = 'export const route = "users"; // modified by user';
    const fs = makeMemFs({ [absPath]: modifiedContent });

    const tree: VirtualTree = [{ path: "app/api/users/route.ts", content: originalContent }];
    const result = removeFiles(PROJECT_DIR, tree, fs, { force: true });

    expect(result.removed).toHaveLength(1);
    expect(result.removed[0]).toBe("app/api/users/route.ts");
    expect(result.userModified).toHaveLength(0);
    // 파일 삭제됨
    expect(absPath in fs.store).toBe(false);
  });

  // 5. 빈 tree → 빈 결과 셋
  it("removeFiles_emptyTree_emptyResults", () => {
    const fs = makeMemFs({ [`${PROJECT_DIR}/some/file.ts`]: "content" });

    const result = removeFiles(PROJECT_DIR, [], fs, {});

    expect(result.removed).toHaveLength(0);
    expect(result.notFound).toHaveLength(0);
    expect(result.userModified).toHaveLength(0);
  });

  // 6. 여러 파일 혼합 — removed / notFound / userModified 모두
  it("removeFiles_mixedResults_allCategories", () => {
    const matchContent = 'export const a = "a";';
    const missingContent = 'export const b = "b";';
    const modifiedOriginal = 'export const c = "c";';
    const modifiedActual = 'export const c = "c_modified";';

    const fs = makeMemFs({
      [`${PROJECT_DIR}/a.ts`]: matchContent,
      [`${PROJECT_DIR}/c.ts`]: modifiedActual,
    });

    const tree: VirtualTree = [
      { path: "a.ts", content: matchContent },
      { path: "b.ts", content: missingContent },
      { path: "c.ts", content: modifiedOriginal },
    ];

    const result = removeFiles(PROJECT_DIR, tree, fs, {});

    expect(result.removed).toEqual(["a.ts"]);
    expect(result.notFound).toEqual(["b.ts"]);
    expect(result.userModified).toEqual(["c.ts"]);
  });

  // 7. force=true + 빈 tree → 결과 비어있음
  it("removeFiles_forceTrue_emptyTree_emptyResults", () => {
    const fs = makeMemFs();

    const result = removeFiles(PROJECT_DIR, [], fs, { force: true });

    expect(result.removed).toHaveLength(0);
    expect(result.notFound).toHaveLength(0);
    expect(result.userModified).toHaveLength(0);
  });
});
