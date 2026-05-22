/**
 * L6 시뮬레이션 E2E — marker 없는 풀바디에서 astPatches 만으로 fragment 적용 가능함을 증명.
 *
 * 핵심: P15 의 가장 큰 가치 — L6 외부 카탈로그의 enabling tech.
 * 풀바디에 `// trellis:slot:*:start/end` marker 가 전혀 없어도
 * ts-morph 기반 astPatches (arrayPush / objectKey / importAdd) 로
 * 멱등 add + remove 양방향이 완전히 동작한다.
 */
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
  workDir = mkdtempSync(join(tmpdir(), "trellis-no-marker-e2e-"));
});

afterAll(() => {
  rmSync(workDir, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// 풀바디 fixture 정의 — marker 주석 0개
//
// 실제 L6 외부 카탈로그에서 쓸 법한 파일들:
//   src/lib/widgets.ts   — export const widgets: Widget[] = []
//   src/lib/registry.ts  — export const registry = { }
//   src/index.ts         — import 선언만 있는 진입점
// ---------------------------------------------------------------------------

const WIDGETS_FILE = "src/lib/widgets.ts";
const WIDGETS_CONTENT = `export type Widget = {
  readonly id: string;
  readonly label: string;
};

export const widgets: Widget[] = [];
`;

const REGISTRY_FILE = "src/lib/registry.ts";
// ts-morph canonical 포맷: trailing comma 없음
const REGISTRY_CONTENT = `export const registry: Record<string, string> = {
  core: 'core-module'
};
`;

const INDEX_FILE = "src/index.ts";
// importAdd selector 는 import declaration 만 지원하므로 index.ts 도 import 형태로 작성
const INDEX_CONTENT = `import { Widget, widgets } from './lib/widgets.js';
import { registry } from './lib/registry.js';
export { Widget, widgets, registry };
`;

// ---------------------------------------------------------------------------
// Case 1: arrayPush — marker 없는 풀바디 widgets 배열에 요소 추가/제거
// ---------------------------------------------------------------------------

describe(
  "No-marker fullbody: arrayPush — widgets 배열 add/remove 라운드트립",
  { timeout: 15_000 },
  () => {
    const PATCH: AstPatchDecl = {
      file: WIDGETS_FILE,
      selector: { type: "arrayPush", target: "widgets" },
      entryKey: "chart-widget",
      content: "{ id: 'chart-widget', label: 'Chart' }",
    };

    let projectDir: string;
    let originalText: string;
    let afterApplyText: string;
    let afterRemoveText: string;

    beforeAll(() => {
      projectDir = join(workDir, "no-marker-arrayPush");
      ensureFileSync(join(projectDir, WIDGETS_FILE), WIDGETS_CONTENT);
      originalText = readFileSync(join(projectDir, WIDGETS_FILE), "utf-8");

      // 풀바디에 marker 없음을 명시적으로 확인
      expect(originalText).not.toContain("trellis:slot");

      applyAstPatches(projectDir, [PATCH], realFsAdapter);
      afterApplyText = readFileSync(join(projectDir, WIDGETS_FILE), "utf-8");

      removeAstPatches(projectDir, [PATCH], realFsAdapter);
      afterRemoveText = readFileSync(join(projectDir, WIDGETS_FILE), "utf-8");
    });

    it("풀바디에 marker 가 없다 (L6 시뮬레이션 전제)", () => {
      expect(originalText).not.toContain("trellis:slot");
    });

    it("apply 후 chart-widget 이 배열에 추가된다", () => {
      expect(afterApplyText).toContain("chart-widget");
      expect(afterApplyText).toContain("Chart");
    });

    it("remove 후 chart-widget 이 배열에서 사라진다", () => {
      expect(afterRemoveText).not.toContain("chart-widget");
    });

    it("remove 후 원본 빈 배열 구조가 복원된다 (marker 없이 라운드트립)", () => {
      expect(afterRemoveText).toBe(originalText);
    });
  },
);

// ---------------------------------------------------------------------------
// Case 2: objectKey — marker 없는 풀바디 registry 객체에 key 추가/제거
// ---------------------------------------------------------------------------

describe(
  "No-marker fullbody: objectKey — registry 객체 add/remove 라운드트립",
  { timeout: 15_000 },
  () => {
    const PATCH: AstPatchDecl = {
      file: REGISTRY_FILE,
      selector: { type: "objectKey", target: "registry", key: "analytics" },
      entryKey: "analytics",
      content: "'analytics-module'",
    };

    let projectDir: string;
    let originalText: string;
    let afterApplyText: string;
    let afterRemoveText: string;

    beforeAll(() => {
      projectDir = join(workDir, "no-marker-objectKey");
      ensureFileSync(join(projectDir, REGISTRY_FILE), REGISTRY_CONTENT);
      originalText = readFileSync(join(projectDir, REGISTRY_FILE), "utf-8");

      expect(originalText).not.toContain("trellis:slot");

      applyAstPatches(projectDir, [PATCH], realFsAdapter);
      afterApplyText = readFileSync(join(projectDir, REGISTRY_FILE), "utf-8");

      removeAstPatches(projectDir, [PATCH], realFsAdapter);
      afterRemoveText = readFileSync(join(projectDir, REGISTRY_FILE), "utf-8");
    });

    it("풀바디에 marker 가 없다", () => {
      expect(originalText).not.toContain("trellis:slot");
    });

    it("apply 후 analytics key 가 객체에 추가된다", () => {
      expect(afterApplyText).toContain("analytics");
      expect(afterApplyText).toContain("analytics-module");
    });

    it("remove 후 analytics key 가 사라진다", () => {
      expect(afterRemoveText).not.toContain("analytics");
    });

    it("remove 후 core key 는 여전히 존재한다", () => {
      expect(afterRemoveText).toContain("core");
    });

    it("remove 후 원본 텍스트와 정확히 일치한다 (marker 없이 라운드트립)", () => {
      expect(afterRemoveText).toBe(originalText);
    });
  },
);

// ---------------------------------------------------------------------------
// Case 3: importAdd — marker 없는 풀바디 index.ts 에 import 추가/제거
// ---------------------------------------------------------------------------

describe(
  "No-marker fullbody: importAdd — index.ts import 추가/제거 라운드트립",
  { timeout: 15_000 },
  () => {
    const PATCH: AstPatchDecl = {
      file: INDEX_FILE,
      selector: { type: "importAdd", from: "./lib/analytics.js" },
      entryKey: "analytics",
      content: "import { analytics } from './lib/analytics.js';",
    };

    let projectDir: string;
    let originalText: string;
    let afterApplyText: string;
    let afterRemoveText: string;

    beforeAll(() => {
      projectDir = join(workDir, "no-marker-importAdd");
      ensureFileSync(join(projectDir, INDEX_FILE), INDEX_CONTENT);
      originalText = readFileSync(join(projectDir, INDEX_FILE), "utf-8");

      expect(originalText).not.toContain("trellis:slot");

      applyAstPatches(projectDir, [PATCH], realFsAdapter);
      afterApplyText = readFileSync(join(projectDir, INDEX_FILE), "utf-8");

      removeAstPatches(projectDir, [PATCH], realFsAdapter);
      afterRemoveText = readFileSync(join(projectDir, INDEX_FILE), "utf-8");
    });

    it("풀바디에 marker 가 없다", () => {
      expect(originalText).not.toContain("trellis:slot");
    });

    it("apply 후 analytics import 가 추가된다", () => {
      expect(afterApplyText).toContain("./lib/analytics.js");
    });

    it("remove 후 analytics import 가 사라진다", () => {
      expect(afterRemoveText).not.toContain("./lib/analytics.js");
    });

    it("remove 후 기존 widgets / registry export 는 유지된다", () => {
      expect(afterRemoveText).toContain("./lib/widgets.js");
      expect(afterRemoveText).toContain("./lib/registry.js");
    });

    it("remove 후 원본 텍스트와 정확히 일치한다 (marker 없이 라운드트립)", () => {
      expect(afterRemoveText).toBe(originalText);
    });
  },
);

// ---------------------------------------------------------------------------
// Case 4: 멱등성 양방향 — marker 없는 풀바디에서도 멱등 보장
// ---------------------------------------------------------------------------

describe(
  "No-marker fullbody: 멱등 보장 — apply 두 번 / remove 두 번 모두 안전",
  { timeout: 15_000 },
  () => {
    const PATCH: AstPatchDecl = {
      file: WIDGETS_FILE,
      selector: { type: "arrayPush", target: "widgets" },
      entryKey: "table-widget",
      content: "{ id: 'table-widget', label: 'Table' }",
    };

    let projectDir: string;
    let originalText: string;
    let secondApplyResult: ReturnType<typeof applyAstPatches>;
    let firstRemoveResult: ReturnType<typeof removeAstPatches>;
    let secondRemoveResult: ReturnType<typeof removeAstPatches>;
    let finalText: string;

    beforeAll(() => {
      projectDir = join(workDir, "no-marker-idempotent");
      ensureFileSync(join(projectDir, WIDGETS_FILE), WIDGETS_CONTENT);
      originalText = readFileSync(join(projectDir, WIDGETS_FILE), "utf-8");

      // apply 두 번
      applyAstPatches(projectDir, [PATCH], realFsAdapter);
      secondApplyResult = applyAstPatches(projectDir, [PATCH], realFsAdapter);

      // remove 두 번
      firstRemoveResult = removeAstPatches(projectDir, [PATCH], realFsAdapter);
      secondRemoveResult = removeAstPatches(projectDir, [PATCH], realFsAdapter);

      finalText = readFileSync(join(projectDir, WIDGETS_FILE), "utf-8");
    });

    it("두 번째 apply 는 skip 된다 (멱등)", () => {
      expect(secondApplyResult.applied).toHaveLength(0);
      expect(secondApplyResult.skipped).toHaveLength(1);
    });

    it("첫 번째 remove 는 성공한다 (removed=1)", () => {
      expect(firstRemoveResult.removed).toHaveLength(1);
      expect(firstRemoveResult.notFound).toHaveLength(0);
    });

    it("두 번째 remove 는 notFound (이미 없음, 멱등)", () => {
      expect(secondRemoveResult.removed).toHaveLength(0);
      expect(secondRemoveResult.notFound).toHaveLength(1);
    });

    it("최종 텍스트가 원본과 정확히 일치한다", () => {
      expect(finalText).toBe(originalText);
    });
  },
);

// ---------------------------------------------------------------------------
// Case 5: 3종 selector 동시 적용 → 전부 제거 → 원본 복원 (marker 없는 풀바디)
// ---------------------------------------------------------------------------

describe(
  "No-marker fullbody: 멀티 patch 3종 동시 — add/remove 라운드트립",
  { timeout: 15_000 },
  () => {
    const PATCHES: AstPatchDecl[] = [
      {
        file: WIDGETS_FILE,
        selector: { type: "arrayPush", target: "widgets" },
        entryKey: "map-widget",
        content: "{ id: 'map-widget', label: 'Map' }",
      },
      {
        file: REGISTRY_FILE,
        selector: { type: "objectKey", target: "registry", key: "geo" },
        entryKey: "geo",
        content: "'geo-module'",
      },
      {
        file: INDEX_FILE,
        selector: { type: "importAdd", from: "./lib/geo.js" },
        entryKey: "geo",
        content: "import { geo } from './lib/geo.js';",
      },
    ];

    let projectDir: string;
    let originals: Record<string, string>;
    let afterRemoves: Record<string, string>;

    beforeAll(() => {
      projectDir = join(workDir, "no-marker-multi-3");
      ensureFileSync(join(projectDir, WIDGETS_FILE), WIDGETS_CONTENT);
      ensureFileSync(join(projectDir, REGISTRY_FILE), REGISTRY_CONTENT);
      ensureFileSync(join(projectDir, INDEX_FILE), INDEX_CONTENT);

      originals = {
        [WIDGETS_FILE]: readFileSync(join(projectDir, WIDGETS_FILE), "utf-8"),
        [REGISTRY_FILE]: readFileSync(join(projectDir, REGISTRY_FILE), "utf-8"),
        [INDEX_FILE]: readFileSync(join(projectDir, INDEX_FILE), "utf-8"),
      };

      const applyResult = applyAstPatches(projectDir, PATCHES, realFsAdapter);
      expect(applyResult.applied).toHaveLength(3);

      const removeResult = removeAstPatches(projectDir, PATCHES, realFsAdapter);
      expect(removeResult.removed).toHaveLength(3);

      afterRemoves = {
        [WIDGETS_FILE]: readFileSync(join(projectDir, WIDGETS_FILE), "utf-8"),
        [REGISTRY_FILE]: readFileSync(join(projectDir, REGISTRY_FILE), "utf-8"),
        [INDEX_FILE]: readFileSync(join(projectDir, INDEX_FILE), "utf-8"),
      };
    });

    it("marker 없는 widgets.ts 가 원본으로 복원된다", () => {
      expect(afterRemoves[WIDGETS_FILE]).toBe(originals[WIDGETS_FILE]);
    });

    it("marker 없는 registry.ts 가 원본으로 복원된다", () => {
      expect(afterRemoves[REGISTRY_FILE]).toBe(originals[REGISTRY_FILE]);
    });

    it("marker 없는 index.ts 가 원본으로 복원된다", () => {
      expect(afterRemoves[INDEX_FILE]).toBe(originals[INDEX_FILE]);
    });
  },
);
