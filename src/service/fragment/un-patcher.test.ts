import { describe, expect, it } from "vitest";
import type { FsAdapter } from "../../external/fs-adapter.js";
import type { PatchDecl } from "./types.js";
import { applyPatches } from "./patcher.js";
import { removePatches } from "./un-patcher.js";

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

function makePatch(overrides: Partial<PatchDecl> = {}): PatchDecl {
  return {
    file: "src/lib/nav-items.ts",
    slot: "nav-items",
    entryKey: "reports",
    content: '{ label: "Reports", href: "/reports" },',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("removePatches", () => {
  // 1. 단일 patch 정상 제거 + 들여쓰기 보존
  it("removePatches_singlePatch_removedWithIndentPreserved", () => {
    const filePath = `${PROJECT_DIR}/src/lib/nav-items.ts`;
    const original = [
      "export const navItems = [",
      "  // trellis:slot:nav-items:start",
      '  { label: "Reports", href: "/reports" },',
      "  // trellis:slot:nav-items:end",
      "];",
    ].join("\n");

    const fs = makeMemFs({ [filePath]: original });
    const patch = makePatch();

    const result = removePatches(PROJECT_DIR, [patch], fs);

    expect(result.removed).toHaveLength(1);
    expect(result.notFound).toHaveLength(0);

    const written = fs.store[filePath] as string;
    expect(written).not.toContain('{ label: "Reports"');
    // slot markers 는 남아있어야 함
    expect(written).toContain("// trellis:slot:nav-items:start");
    expect(written).toContain("// trellis:slot:nav-items:end");
  });

  // 2. 멱등 — 이미 없음 → notFound, 파일 미변경
  it("removePatches_contentAlreadyAbsent_notFound_fileUnchanged", () => {
    const filePath = `${PROJECT_DIR}/src/lib/nav-items.ts`;
    const original = [
      "export const navItems = [",
      "  // trellis:slot:nav-items:start",
      "  // trellis:slot:nav-items:end",
      "];",
    ].join("\n");

    const fs = makeMemFs({ [filePath]: original });
    const patch = makePatch();

    const result = removePatches(PROJECT_DIR, [patch], fs);

    expect(result.removed).toHaveLength(0);
    expect(result.notFound).toHaveLength(1);
    // 파일 미변경
    expect(fs.store[filePath]).toBe(original);
  });

  // 3. slot 없음 → notFound (throw 하지 않음)
  it("removePatches_missingSlot_notFound_noThrow", () => {
    const filePath = `${PROJECT_DIR}/src/lib/nav-items.ts`;
    const original = "export const navItems = [];\n";

    const fs = makeMemFs({ [filePath]: original });
    const patch = makePatch();

    expect(() => removePatches(PROJECT_DIR, [patch], fs)).not.toThrow();

    const result = removePatches(PROJECT_DIR, [patch], fs);
    expect(result.removed).toHaveLength(0);
    expect(result.notFound).toHaveLength(1);
  });

  // 4. 대상 파일 없음 → notFound
  it("removePatches_fileNotFound_notFound", () => {
    const fs = makeMemFs();
    const patch = makePatch();

    const result = removePatches(PROJECT_DIR, [patch], fs);

    expect(result.removed).toHaveLength(0);
    expect(result.notFound).toHaveLength(1);
    expect(result.notFound[0]).toBe(patch);
  });

  // 5. 같은 파일/slot 의 두 patch 중 하나만 매칭 → removed 1 / notFound 1
  it("removePatches_twoPatchesOneMatch_removed1_notFound1", () => {
    const filePath = `${PROJECT_DIR}/src/lib/nav-items.ts`;
    const original = [
      "export const navItems = [",
      "  // trellis:slot:nav-items:start",
      '  { label: "Reports", href: "/reports" },',
      "  // trellis:slot:nav-items:end",
      "];",
    ].join("\n");

    const fs = makeMemFs({ [filePath]: original });
    const patch1 = makePatch({ entryKey: "reports", content: '{ label: "Reports", href: "/reports" },' });
    const patch2 = makePatch({ entryKey: "settings", content: '{ label: "Settings", href: "/settings" },' });

    const result = removePatches(PROJECT_DIR, [patch1, patch2], fs);

    expect(result.removed).toHaveLength(1);
    expect(result.notFound).toHaveLength(1);
    expect(result.removed[0]).toBe(patch1);
    expect(result.notFound[0]).toBe(patch2);
  });

  // 6. applyPatches → removePatches 라운드트립 → 원본과 동일
  it("removePatches_roundtrip_restoredToOriginal", () => {
    const filePath = `${PROJECT_DIR}/src/lib/nav-items.ts`;
    const original = [
      "export const navItems = [",
      "  { label: 'Dashboard', href: '/dashboard' },",
      "  // trellis:slot:nav-items:start",
      "  // trellis:slot:nav-items:end",
      "];",
    ].join("\n");

    const fs = makeMemFs({ [filePath]: original });
    const patch = makePatch();

    // apply 후
    const applyResult = applyPatches(PROJECT_DIR, [patch], fs);
    expect(applyResult.applied).toHaveLength(1);

    // remove 후
    const removeResult = removePatches(PROJECT_DIR, [patch], fs);
    expect(removeResult.removed).toHaveLength(1);
    expect(removeResult.notFound).toHaveLength(0);

    // 원본과 동일해야 함
    expect(fs.store[filePath]).toBe(original);
  });

  // 7. 멀티라인 content 정상 제거
  it("removePatches_multilineContent_removedCorrectly", () => {
    const filePath = `${PROJECT_DIR}/src/lib/nav-items.ts`;
    const original = [
      "export const navItems = [",
      "  // trellis:slot:nav-items:start",
      "  line1,",
      "  line2,",
      "  line3,",
      "  // trellis:slot:nav-items:end",
      "];",
    ].join("\n");

    const fs = makeMemFs({ [filePath]: original });
    const patch = makePatch({ content: "line1,\nline2,\nline3," });

    const result = removePatches(PROJECT_DIR, [patch], fs);

    expect(result.removed).toHaveLength(1);
    const written = fs.store[filePath] as string;
    expect(written).not.toContain("line1,");
    expect(written).not.toContain("line2,");
    expect(written).not.toContain("line3,");
    expect(written).toContain("// trellis:slot:nav-items:start");
    expect(written).toContain("// trellis:slot:nav-items:end");
  });

  // 8. patch 없음 → 빈 결과, 파일 미변경
  it("removePatches_noPatches_noOp", () => {
    const filePath = `${PROJECT_DIR}/src/lib/nav-items.ts`;
    const original = "// empty file";
    const fs = makeMemFs({ [filePath]: original });

    const result = removePatches(PROJECT_DIR, [], fs);

    expect(result.removed).toHaveLength(0);
    expect(result.notFound).toHaveLength(0);
    expect(fs.store[filePath]).toBe(original);
  });

  // 9. 멱등 연속 remove — 두 번째 remove 는 notFound
  it("removePatches_idempotent_secondCallNotFound", () => {
    const filePath = `${PROJECT_DIR}/src/lib/nav-items.ts`;
    const original = [
      "  // trellis:slot:nav-items:start",
      '  { label: "Reports", href: "/reports" },',
      "  // trellis:slot:nav-items:end",
    ].join("\n");

    const fs = makeMemFs({ [filePath]: original });
    const patch = makePatch();

    const result1 = removePatches(PROJECT_DIR, [patch], fs);
    expect(result1.removed).toHaveLength(1);

    const result2 = removePatches(PROJECT_DIR, [patch], fs);
    expect(result2.removed).toHaveLength(0);
    expect(result2.notFound).toHaveLength(1);
  });
});
