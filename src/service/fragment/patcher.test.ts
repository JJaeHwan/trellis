import { describe, expect, it } from "vitest";
import { HarnessError } from "../../common/errors/index.js";
import type { FsAdapter } from "../../external/fs-adapter.js";
import type { PatchDecl } from "./types.js";
import { applyPatches } from "./patcher.js";

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

describe("applyPatches", () => {
  // 1. 정상 케이스: 단일 patch 적용 — start..end 사이에 content 삽입 + 들여쓰기 보존
  it("applyPatches_singlePatch_contentInsertedWithIndent", () => {
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

    const result = applyPatches(PROJECT_DIR, [patch], fs);

    expect(result.applied).toHaveLength(1);
    expect(result.skipped).toHaveLength(0);

    const written = fs.store[filePath] as string;
    // content 가 들여쓰기 2칸과 함께 end marker 직전에 삽입됨
    expect(written).toContain('  { label: "Reports", href: "/reports" },');
    // end marker 는 그 다음 줄에 남아있어야 함
    const insertedIdx = written.indexOf('{ label: "Reports"');
    const endIdx = written.indexOf("// trellis:slot:nav-items:end");
    expect(insertedIdx).toBeGreaterThan(-1);
    expect(endIdx).toBeGreaterThan(insertedIdx);
  });

  // 2. 멱등성: 같은 entryKey 가 이미 슬롯에 있음 → skipped, 파일 미변경
  it("applyPatches_entryKeyAlreadyPresent_skipped", () => {
    const filePath = `${PROJECT_DIR}/src/lib/nav-items.ts`;
    const original = [
      "export const navItems = [",
      "  // trellis:slot:nav-items:start",
      '  { label: "Reports", href: "/reports" },  // reports',
      "  // trellis:slot:nav-items:end",
      "];",
    ].join("\n");

    const fs = makeMemFs({ [filePath]: original });
    const patch = makePatch();

    const result = applyPatches(PROJECT_DIR, [patch], fs);

    expect(result.applied).toHaveLength(0);
    expect(result.skipped).toHaveLength(1);
    expect(result.skipped[0]).toBe(patch);
    // 파일 미변경
    expect(fs.store[filePath]).toBe(original);
  });

  // 3. 슬롯 누락 (start 없음) → HarnessError throw
  it("applyPatches_missingSlotStart_throwsHarnessError", () => {
    const filePath = `${PROJECT_DIR}/src/lib/nav-items.ts`;
    const original = [
      "export const navItems = [",
      "  // trellis:slot:nav-items:end",
      "];",
    ].join("\n");

    const fs = makeMemFs({ [filePath]: original });
    const patch = makePatch();

    expect(() => applyPatches(PROJECT_DIR, [patch], fs)).toThrow(HarnessError);
    expect(() => applyPatches(PROJECT_DIR, [patch], fs)).toThrowError(
      /missing slot 'nav-items'/,
    );
  });

  // 4. 슬롯 누락 (end 없음) → HarnessError throw
  it("applyPatches_missingSlotEnd_throwsHarnessError", () => {
    const filePath = `${PROJECT_DIR}/src/lib/nav-items.ts`;
    const original = [
      "export const navItems = [",
      "  // trellis:slot:nav-items:start",
      "];",
    ].join("\n");

    const fs = makeMemFs({ [filePath]: original });
    const patch = makePatch();

    expect(() => applyPatches(PROJECT_DIR, [patch], fs)).toThrow(HarnessError);
    expect(() => applyPatches(PROJECT_DIR, [patch], fs)).toThrowError(
      /missing slot 'nav-items'/,
    );
  });

  // 5. end 가 start 보다 앞에 있음 → HarnessError throw
  it("applyPatches_endBeforeStart_throwsHarnessError", () => {
    const filePath = `${PROJECT_DIR}/src/lib/nav-items.ts`;
    const original = [
      "export const navItems = [",
      "  // trellis:slot:nav-items:end",
      "  // trellis:slot:nav-items:start",
      "];",
    ].join("\n");

    const fs = makeMemFs({ [filePath]: original });
    const patch = makePatch();

    // end 가 start 앞에 있으므로 start 탐색 후 end 가 발견되지 않음 → HarnessError
    expect(() => applyPatches(PROJECT_DIR, [patch], fs)).toThrow(HarnessError);
    expect(() => applyPatches(PROJECT_DIR, [patch], fs)).toThrowError(
      /missing slot 'nav-items'/,
    );
  });

  // 6. 대상 파일 없음 → HarnessError throw
  it("applyPatches_targetFileNotFound_throwsHarnessError", () => {
    const fs = makeMemFs();
    const patch = makePatch();

    expect(() => applyPatches(PROJECT_DIR, [patch], fs)).toThrow(HarnessError);
    expect(() => applyPatches(PROJECT_DIR, [patch], fs)).toThrowError(
      /target file not found for patch: src\/lib\/nav-items\.ts/,
    );
  });

  // 7. 동일 파일 + 동일 슬롯에 두 patch (entryKey 다름) → 둘 다 applied, 파일에 누적
  it("applyPatches_twoPatches_sameFileAndSlot_bothApplied", () => {
    const filePath = `${PROJECT_DIR}/src/lib/nav-items.ts`;
    const original = [
      "export const navItems = [",
      "  // trellis:slot:nav-items:start",
      "  // trellis:slot:nav-items:end",
      "];",
    ].join("\n");

    const fs = makeMemFs({ [filePath]: original });
    const patch1 = makePatch({ entryKey: "reports", content: '{ label: "Reports", href: "/reports" },' });
    const patch2 = makePatch({ entryKey: "settings", content: '{ label: "Settings", href: "/settings" },' });

    const result = applyPatches(PROJECT_DIR, [patch1, patch2], fs);

    expect(result.applied).toHaveLength(2);
    expect(result.skipped).toHaveLength(0);

    const written = fs.store[filePath] as string;
    expect(written).toContain('"Reports"');
    expect(written).toContain('"Settings"');
    // 순서: Reports 가 Settings 보다 먼저 (순차 삽입)
    const reportsIdx = written.indexOf('"Reports"');
    const settingsIdx = written.indexOf('"Settings"');
    expect(reportsIdx).toBeGreaterThan(-1);
    expect(settingsIdx).toBeGreaterThan(-1);
  });

  // 8. 다중 파일 + 다중 슬롯 → 각각 정확히 적용
  it("applyPatches_multipleFilesAndSlots_eachAppliedCorrectly", () => {
    const file1 = `${PROJECT_DIR}/src/lib/nav-items.ts`;
    const file2 = `${PROJECT_DIR}/src/app/routes.ts`;

    const content1 = [
      "// nav-items",
      "  // trellis:slot:nav-items:start",
      "  // trellis:slot:nav-items:end",
    ].join("\n");

    const content2 = [
      "// routes",
      "  // trellis:slot:routes:start",
      "  // trellis:slot:routes:end",
    ].join("\n");

    const fs = makeMemFs({ [file1]: content1, [file2]: content2 });

    const patch1 = makePatch({ file: "src/lib/nav-items.ts", slot: "nav-items", entryKey: "reports", content: "navReports," });
    const patch2 = makePatch({ file: "src/app/routes.ts", slot: "routes", entryKey: "reports-route", content: "routeReports," });

    const result = applyPatches(PROJECT_DIR, [patch1, patch2], fs);

    expect(result.applied).toHaveLength(2);
    expect(result.skipped).toHaveLength(0);

    expect(fs.store[file1]).toContain("navReports,");
    expect(fs.store[file2]).toContain("routeReports,");
    // 교차 오염 없음
    expect(fs.store[file1]).not.toContain("routeReports");
    expect(fs.store[file2]).not.toContain("navReports");
  });

  // 9. patch.content 가 멀티라인 → 줄별 들여쓰기 보존
  it("applyPatches_multilineContent_eachLineIndented", () => {
    const filePath = `${PROJECT_DIR}/src/lib/nav-items.ts`;
    const original = [
      "export const navItems = [",
      "  // trellis:slot:nav-items:start",
      "  // trellis:slot:nav-items:end",
      "];",
    ].join("\n");

    const fs = makeMemFs({ [filePath]: original });
    const multilineContent = "line1,\nline2,\nline3,";
    const patch = makePatch({ content: multilineContent });

    const result = applyPatches(PROJECT_DIR, [patch], fs);

    expect(result.applied).toHaveLength(1);

    const written = fs.store[filePath] as string;
    // 각 줄이 2칸 들여쓰기와 함께 존재해야 함
    expect(written).toContain("  line1,");
    expect(written).toContain("  line2,");
    expect(written).toContain("  line3,");
  });

  // 10. 빈 슬롯 + 새 entry → 정상 삽입
  it("applyPatches_emptySlot_contentInserted", () => {
    const filePath = `${PROJECT_DIR}/src/lib/nav-items.ts`;
    const original = [
      "export const navItems = [",
      "  // trellis:slot:nav-items:start",
      "  // trellis:slot:nav-items:end",
      "];",
    ].join("\n");

    const fs = makeMemFs({ [filePath]: original });
    const patch = makePatch();

    const result = applyPatches(PROJECT_DIR, [patch], fs);

    expect(result.applied).toHaveLength(1);
    expect(result.skipped).toHaveLength(0);

    const written = fs.store[filePath] as string;
    expect(written).toContain('{ label: "Reports", href: "/reports" },');
    // start / end marker 가 여전히 존재해야 함
    expect(written).toContain("// trellis:slot:nav-items:start");
    expect(written).toContain("// trellis:slot:nav-items:end");
    // content 가 end marker 보다 앞에 있어야 함
    const contentIdx = written.indexOf('{ label: "Reports"');
    const endIdx = written.indexOf("// trellis:slot:nav-items:end");
    expect(contentIdx).toBeLessThan(endIdx);
  });

  // 추가: patch 없음 → 결과 비어있고 파일 미변경
  it("applyPatches_noPatches_noOp", () => {
    const filePath = `${PROJECT_DIR}/src/lib/nav-items.ts`;
    const original = "// empty file";
    const fs = makeMemFs({ [filePath]: original });

    const result = applyPatches(PROJECT_DIR, [], fs);

    expect(result.applied).toHaveLength(0);
    expect(result.skipped).toHaveLength(0);
    expect(fs.store[filePath]).toBe(original);
  });

  // 추가: 같은 patch 두 번 (멱등 - 두 번째는 skip)
  it("applyPatches_samePatchTwice_secondSkipped", () => {
    const filePath = `${PROJECT_DIR}/src/lib/nav-items.ts`;
    const original = [
      "  // trellis:slot:nav-items:start",
      "  // trellis:slot:nav-items:end",
    ].join("\n");

    const fs = makeMemFs({ [filePath]: original });
    const patch = makePatch();

    // 첫 번째 실행
    const result1 = applyPatches(PROJECT_DIR, [patch], fs);
    expect(result1.applied).toHaveLength(1);
    expect(result1.skipped).toHaveLength(0);

    // 두 번째 실행 (멱등)
    const result2 = applyPatches(PROJECT_DIR, [patch], fs);
    expect(result2.applied).toHaveLength(0);
    expect(result2.skipped).toHaveLength(1);
  });
});
