import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { applyAstPatches } from "../../src/service/fragment/ast-patcher.js";
import { removeAstPatches } from "../../src/service/fragment/ast-un-patcher.js";
import { realFsAdapter } from "../../src/external/fs-adapter.js";
import type { AstPatchDecl } from "../../src/service/fragment/types.js";

// ---------------------------------------------------------------------------
// 헬퍼
// ---------------------------------------------------------------------------

function ensureFileSync(filePath: string, content: string): void {
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, content, "utf-8");
}

// ---------------------------------------------------------------------------
// 공유 임시 디렉토리
// ---------------------------------------------------------------------------

let workDir: string;

beforeAll(() => {
  workDir = mkdtempSync(join(tmpdir(), "trellis-ast-roundtrip-e2e-"));
});

afterAll(() => {
  rmSync(workDir, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// Case 1: arrayPush 라운드트립
// ---------------------------------------------------------------------------

describe(
  "Round-trip: arrayPush — navItems 배열에 요소 추가 후 제거 → 원본 복원",
  { timeout: 15_000 },
  () => {
    // ts-morph 는 마지막 요소의 trailing comma 를 제거한다.
    // 라운드트립 정확성 검증을 위해 fixture 를 ts-morph canonical 포맷으로 작성한다.
    const FIXTURE = `export const navItems = [
  { label: 'Dashboard', href: '/dashboard' }
];\n`;

    const PATCH: AstPatchDecl = {
      file: "src/lib/nav-items.ts",
      selector: { type: "arrayPush", target: "navItems" },
      entryKey: "/reports",
      content: "{ label: 'Reports', href: '/reports' }",
    };

    let projectDir: string;
    let originalText: string;
    let afterApplyText: string;
    let afterRemoveText: string;

    beforeAll(() => {
      projectDir = join(workDir, "arrayPush-roundtrip");
      const absFile = join(projectDir, PATCH.file);
      ensureFileSync(absFile, FIXTURE);
      originalText = readFileSync(absFile, "utf-8");

      // apply
      applyAstPatches(projectDir, [PATCH], realFsAdapter);
      afterApplyText = readFileSync(absFile, "utf-8");

      // remove
      removeAstPatches(projectDir, [PATCH], realFsAdapter);
      afterRemoveText = readFileSync(absFile, "utf-8");
    });

    it("apply 후 /reports 가 포함된다", () => {
      expect(afterApplyText).toContain("/reports");
      expect(afterApplyText).toContain("Reports");
    });

    it("remove 후 /reports 가 사라진다", () => {
      expect(afterRemoveText).not.toContain("/reports");
    });

    it("remove 후 Dashboard 는 여전히 존재한다", () => {
      expect(afterRemoveText).toContain("Dashboard");
    });

    it("remove 후 텍스트가 원본과 정확히 일치한다 (라운드트립)", () => {
      expect(afterRemoveText).toBe(originalText);
    });
  },
);

// ---------------------------------------------------------------------------
// Case 2: objectKey 라운드트립
// ---------------------------------------------------------------------------

describe(
  "Round-trip: objectKey — breadcrumbMap 객체에 key 추가 후 제거 → 원본 복원",
  { timeout: 15_000 },
  () => {
    // ts-morph 는 마지막 property 의 trailing comma 를 제거한다.
    // fixture 를 ts-morph canonical 포맷으로 작성한다.
    const FIXTURE = `export const breadcrumbMap: Readonly<Record<string, string>> = {
  '/dashboard': 'Dashboard'
};\n`;

    const PATCH: AstPatchDecl = {
      file: "src/lib/breadcrumb-map.ts",
      selector: { type: "objectKey", target: "breadcrumbMap", key: "/reports" },
      entryKey: "/reports",
      content: "'Reports'",
    };

    let projectDir: string;
    let originalText: string;
    let afterApplyText: string;
    let afterRemoveText: string;

    beforeAll(() => {
      projectDir = join(workDir, "objectKey-roundtrip");
      const absFile = join(projectDir, PATCH.file);
      ensureFileSync(absFile, FIXTURE);
      originalText = readFileSync(absFile, "utf-8");

      applyAstPatches(projectDir, [PATCH], realFsAdapter);
      afterApplyText = readFileSync(absFile, "utf-8");

      removeAstPatches(projectDir, [PATCH], realFsAdapter);
      afterRemoveText = readFileSync(absFile, "utf-8");
    });

    it("apply 후 /reports key 가 포함된다", () => {
      expect(afterApplyText).toContain("/reports");
      expect(afterApplyText).toContain("Reports");
    });

    it("remove 후 /reports key 가 사라진다", () => {
      expect(afterRemoveText).not.toContain("/reports");
    });

    it("remove 후 Dashboard 는 여전히 존재한다", () => {
      expect(afterRemoveText).toContain("Dashboard");
    });

    it("remove 후 텍스트가 원본과 정확히 일치한다 (라운드트립)", () => {
      expect(afterRemoveText).toBe(originalText);
    });
  },
);

// ---------------------------------------------------------------------------
// Case 3: importAdd 라운드트립
// ---------------------------------------------------------------------------

describe(
  "Round-trip: importAdd — import 선언 추가 후 제거 → 원본 복원",
  { timeout: 15_000 },
  () => {
    // ts-morph 는 import 제거 후 import 블록과 이후 코드 사이의 빈 줄을 제거한다.
    // fixture 를 ts-morph canonical 포맷으로 작성한다 (빈 줄 없음).
    const FIXTURE = `import { foo } from './foo.js';
export const x = 1;\n`;

    const PATCH: AstPatchDecl = {
      file: "src/cmd/index.ts",
      selector: { type: "importAdd", from: "./reports.js" },
      entryKey: "reports",
      content: "import { reports } from './reports.js';",
    };

    let projectDir: string;
    let originalText: string;
    let afterApplyText: string;
    let afterRemoveText: string;

    beforeAll(() => {
      projectDir = join(workDir, "importAdd-roundtrip");
      const absFile = join(projectDir, PATCH.file);
      ensureFileSync(absFile, FIXTURE);
      originalText = readFileSync(absFile, "utf-8");

      applyAstPatches(projectDir, [PATCH], realFsAdapter);
      afterApplyText = readFileSync(absFile, "utf-8");

      removeAstPatches(projectDir, [PATCH], realFsAdapter);
      afterRemoveText = readFileSync(absFile, "utf-8");
    });

    it("apply 후 ./reports.js import 가 포함된다", () => {
      expect(afterApplyText).toContain("./reports.js");
      expect(afterApplyText).toContain("reports");
    });

    it("remove 후 ./reports.js import 가 사라진다", () => {
      expect(afterRemoveText).not.toContain("./reports.js");
    });

    it("remove 후 기존 ./foo.js import 는 여전히 존재한다", () => {
      expect(afterRemoveText).toContain("./foo.js");
    });

    it("remove 후 텍스트가 원본과 정확히 일치한다 (라운드트립)", () => {
      expect(afterRemoveText).toBe(originalText);
    });
  },
);

// ---------------------------------------------------------------------------
// Case 4: 멀티 patch (3종 selector 동시) 라운드트립
// ---------------------------------------------------------------------------

describe(
  "Round-trip: 멀티 patch — 한 파일에 3종 selector 동시 적용 → 전부 제거 → 원본 복원",
  { timeout: 15_000 },
  () => {
    // 세 종류의 selector 를 각각 다른 파일에 동시 적용
    const ARRAY_FILE = "src/lib/nav-items.ts";
    // ts-morph canonical 포맷: trailing comma 없음
    const ARRAY_CONTENT = `export const navItems = [
  { label: 'Dashboard', href: '/dashboard' }
];\n`;

    const OBJECT_FILE = "src/lib/breadcrumb-map.ts";
    const OBJECT_CONTENT = `export const breadcrumbMap = {
  '/dashboard': 'Dashboard'
};\n`;

    const IMPORT_FILE = "src/cmd/index.ts";
    const IMPORT_CONTENT = `export const y = 2;\n`;

    const PATCHES: AstPatchDecl[] = [
      {
        file: ARRAY_FILE,
        selector: { type: "arrayPush", target: "navItems" },
        entryKey: "/settings",
        content: "{ label: 'Settings', href: '/settings' }",
      },
      {
        file: OBJECT_FILE,
        selector: { type: "objectKey", target: "breadcrumbMap", key: "/settings" },
        entryKey: "/settings",
        content: "'Settings'",
      },
      {
        file: IMPORT_FILE,
        selector: { type: "importAdd", from: "./settings.js" },
        entryKey: "settings",
        content: "import { settings } from './settings.js';",
      },
    ];

    let projectDir: string;
    let originals: Record<string, string>;
    let afterRemoves: Record<string, string>;

    beforeAll(() => {
      projectDir = join(workDir, "multi-patch-roundtrip");

      ensureFileSync(join(projectDir, ARRAY_FILE), ARRAY_CONTENT);
      ensureFileSync(join(projectDir, OBJECT_FILE), OBJECT_CONTENT);
      ensureFileSync(join(projectDir, IMPORT_FILE), IMPORT_CONTENT);

      originals = {
        [ARRAY_FILE]: readFileSync(join(projectDir, ARRAY_FILE), "utf-8"),
        [OBJECT_FILE]: readFileSync(join(projectDir, OBJECT_FILE), "utf-8"),
        [IMPORT_FILE]: readFileSync(join(projectDir, IMPORT_FILE), "utf-8"),
      };

      // 3종 동시 적용
      const applyResult = applyAstPatches(projectDir, PATCHES, realFsAdapter);
      expect(applyResult.applied).toHaveLength(3);

      // 전부 제거
      const removeResult = removeAstPatches(projectDir, PATCHES, realFsAdapter);
      expect(removeResult.removed).toHaveLength(3);

      afterRemoves = {
        [ARRAY_FILE]: readFileSync(join(projectDir, ARRAY_FILE), "utf-8"),
        [OBJECT_FILE]: readFileSync(join(projectDir, OBJECT_FILE), "utf-8"),
        [IMPORT_FILE]: readFileSync(join(projectDir, IMPORT_FILE), "utf-8"),
      };
    });

    it("arrayPush 파일이 원본과 정확히 일치한다", () => {
      expect(afterRemoves[ARRAY_FILE]).toBe(originals[ARRAY_FILE]);
    });

    it("objectKey 파일이 원본과 정확히 일치한다", () => {
      expect(afterRemoves[OBJECT_FILE]).toBe(originals[OBJECT_FILE]);
    });

    it("importAdd 파일이 원본과 정확히 일치한다", () => {
      expect(afterRemoves[IMPORT_FILE]).toBe(originals[IMPORT_FILE]);
    });
  },
);

// ---------------------------------------------------------------------------
// Case 5: 멱등성 — applyAstPatches 두 번 → 두 번째 skip → removeAstPatches 한 번이면 원본 복원
// ---------------------------------------------------------------------------

describe(
  "멱등성: applyAstPatches 두 번 호출 → 두 번째 skip → remove 한 번으로 원본 복원",
  { timeout: 15_000 },
  () => {
    // ts-morph canonical 포맷: trailing comma 없음
    const FIXTURE = `export const navItems = [
  { label: 'Home', href: '/' }
];\n`;

    const PATCH: AstPatchDecl = {
      file: "src/lib/nav-items.ts",
      selector: { type: "arrayPush", target: "navItems" },
      entryKey: "/profile",
      content: "{ label: 'Profile', href: '/profile' }",
    };

    let projectDir: string;
    let originalText: string;
    let firstApplyResult: ReturnType<typeof applyAstPatches>;
    let secondApplyResult: ReturnType<typeof applyAstPatches>;
    let afterRemoveText: string;

    beforeAll(() => {
      projectDir = join(workDir, "idempotent-roundtrip");
      const absFile = join(projectDir, PATCH.file);
      ensureFileSync(absFile, FIXTURE);
      originalText = readFileSync(absFile, "utf-8");

      firstApplyResult = applyAstPatches(projectDir, [PATCH], realFsAdapter);
      secondApplyResult = applyAstPatches(projectDir, [PATCH], realFsAdapter);

      removeAstPatches(projectDir, [PATCH], realFsAdapter);
      afterRemoveText = readFileSync(absFile, "utf-8");
    });

    it("첫 번째 apply 는 applied=1, skipped=0", () => {
      expect(firstApplyResult.applied).toHaveLength(1);
      expect(firstApplyResult.skipped).toHaveLength(0);
    });

    it("두 번째 apply 는 applied=0, skipped=1 (멱등 skip)", () => {
      expect(secondApplyResult.applied).toHaveLength(0);
      expect(secondApplyResult.skipped).toHaveLength(1);
    });

    it("remove 한 번 후 /profile 이 사라진다", () => {
      expect(afterRemoveText).not.toContain("/profile");
    });

    it("remove 후 텍스트가 원본과 정확히 일치한다 (라운드트립)", () => {
      expect(afterRemoveText).toBe(originalText);
    });
  },
);
