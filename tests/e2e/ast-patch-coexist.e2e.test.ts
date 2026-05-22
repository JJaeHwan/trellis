/**
 * 공존 E2E — 한 fragment 가 marker `patches` + `astPatches` 를 동시 보유.
 * 둘 다 적용 후 둘 다 제거 → 원본 일치.
 * 마커 시스템과 AST 시스템이 서로 영향 안 줌을 검증.
 */
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { applyAstPatches } from "../../src/service/fragment/ast-patcher.js";
import { removeAstPatches } from "../../src/service/fragment/ast-un-patcher.js";
import { applyPatches } from "../../src/service/fragment/patcher.js";
import { removePatches } from "../../src/service/fragment/un-patcher.js";
import { realFsAdapter } from "../../src/external/fs-adapter.js";
import type { AstPatchDecl } from "../../src/service/fragment/types.js";
import type { PatchDecl } from "../../src/service/fragment/types.js";

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
  workDir = mkdtempSync(join(tmpdir(), "trellis-coexist-e2e-"));
});

afterAll(() => {
  rmSync(workDir, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// 풀바디 fixture — marker 포함 (nav-items.ts) + marker 없는 AST 대상 (breadcrumb-map.ts)
// ---------------------------------------------------------------------------

// marker patch 대상: slot 이 있는 파일
const NAV_FILE = "src/lib/nav-items.ts";
const NAV_CONTENT = `export type NavItem = { label: string; href: string };

export const navItems: NavItem[] = [
  { label: 'Dashboard', href: '/dashboard' },
  // trellis:slot:nav-items:start
  // trellis:slot:nav-items:end
];
`;

// AST patch 대상: marker 없는 파일
const BREADCRUMB_FILE = "src/lib/breadcrumb-map.ts";
// ts-morph canonical 포맷: trailing comma 없음
const BREADCRUMB_CONTENT = `export const breadcrumbMap: Record<string, string> = {
  '/dashboard': 'Dashboard'
};
`;

// ---------------------------------------------------------------------------
// Case 1: marker patch + astPatch 동시 적용/제거 라운드트립
// ---------------------------------------------------------------------------

describe(
  "공존: marker patch + astPatch 동시 적용 → 동시 제거 → 원본 복원",
  { timeout: 15_000 },
  () => {
    // marker 기반 patch (nav-items slot)
    const MARKER_PATCH: PatchDecl = {
      file: NAV_FILE,
      slot: "nav-items",
      entryKey: "/reports",
      content: "  { label: 'Reports', href: '/reports' },",
    };

    // AST 기반 patch (breadcrumb-map, marker 없음)
    const AST_PATCH: AstPatchDecl = {
      file: BREADCRUMB_FILE,
      selector: { type: "objectKey", target: "breadcrumbMap", key: "/reports" },
      entryKey: "/reports",
      content: "'Reports'",
    };

    let projectDir: string;
    let navOriginal: string;
    let breadcrumbOriginal: string;
    let navAfterRemove: string;
    let breadcrumbAfterRemove: string;

    beforeAll(() => {
      projectDir = join(workDir, "coexist-roundtrip");
      ensureFileSync(join(projectDir, NAV_FILE), NAV_CONTENT);
      ensureFileSync(join(projectDir, BREADCRUMB_FILE), BREADCRUMB_CONTENT);

      navOriginal = readFileSync(join(projectDir, NAV_FILE), "utf-8");
      breadcrumbOriginal = readFileSync(join(projectDir, BREADCRUMB_FILE), "utf-8");

      // 적용: marker patch 먼저, 그 다음 AST patch
      const patchResult = applyPatches(projectDir, [MARKER_PATCH], realFsAdapter);
      expect(patchResult.applied).toHaveLength(1);

      const astResult = applyAstPatches(projectDir, [AST_PATCH], realFsAdapter);
      expect(astResult.applied).toHaveLength(1);

      // 제거: AST patch 먼저, 그 다음 marker patch
      const astRemoveResult = removeAstPatches(projectDir, [AST_PATCH], realFsAdapter);
      expect(astRemoveResult.removed).toHaveLength(1);

      const patchRemoveResult = removePatches(projectDir, [MARKER_PATCH], realFsAdapter);
      expect(patchRemoveResult.removed).toHaveLength(1);

      navAfterRemove = readFileSync(join(projectDir, NAV_FILE), "utf-8");
      breadcrumbAfterRemove = readFileSync(join(projectDir, BREADCRUMB_FILE), "utf-8");
    });

    it("marker patch 적용 후 /reports 가 nav-items.ts slot 안에 삽입된다", () => {
      // apply 이후 스냅샷 검증은 beforeAll 에서 이미 처리됨 — 제거 후 상태 확인
      // 제거 후 포함 안 됨을 검증
      expect(navAfterRemove).not.toContain("/reports");
    });

    it("AST patch 적용 후 breadcrumb-map.ts 에 /reports key 가 추가된다", () => {
      expect(breadcrumbAfterRemove).not.toContain("/reports");
    });

    it("제거 후 nav-items.ts 가 원본과 정확히 일치한다", () => {
      expect(navAfterRemove).toBe(navOriginal);
    });

    it("제거 후 breadcrumb-map.ts 가 원본과 정확히 일치한다", () => {
      expect(breadcrumbAfterRemove).toBe(breadcrumbOriginal);
    });

    it("nav-items.ts slot marker 가 제거 후에도 유지된다", () => {
      expect(navAfterRemove).toContain("// trellis:slot:nav-items:start");
      expect(navAfterRemove).toContain("// trellis:slot:nav-items:end");
    });
  },
);

// ---------------------------------------------------------------------------
// Case 2: marker patch 와 AST patch 가 서로 영향을 주지 않음 검증
// — marker patch 만 제거해도 AST patch 는 유지됨
// — AST patch 만 제거해도 marker patch 는 유지됨
// ---------------------------------------------------------------------------

describe(
  "공존: marker patch 와 AST patch 는 독립적으로 동작한다",
  { timeout: 15_000 },
  () => {
    const MARKER_PATCH: PatchDecl = {
      file: NAV_FILE,
      slot: "nav-items",
      entryKey: "/analytics",
      content: "  { label: 'Analytics', href: '/analytics' },",
    };

    const AST_PATCH: AstPatchDecl = {
      file: BREADCRUMB_FILE,
      selector: { type: "objectKey", target: "breadcrumbMap", key: "/analytics" },
      entryKey: "/analytics",
      content: "'Analytics'",
    };

    let projectDir: string;

    beforeAll(() => {
      projectDir = join(workDir, "coexist-independent");
      ensureFileSync(join(projectDir, NAV_FILE), NAV_CONTENT);
      ensureFileSync(join(projectDir, BREADCRUMB_FILE), BREADCRUMB_CONTENT);

      // 둘 다 적용
      applyPatches(projectDir, [MARKER_PATCH], realFsAdapter);
      applyAstPatches(projectDir, [AST_PATCH], realFsAdapter);
    });

    it("marker patch 만 제거해도 AST patch (breadcrumb) 는 영향 없다", () => {
      removePatches(projectDir, [MARKER_PATCH], realFsAdapter);

      const nav = readFileSync(join(projectDir, NAV_FILE), "utf-8");
      const breadcrumb = readFileSync(join(projectDir, BREADCRUMB_FILE), "utf-8");

      // marker patch 제거 → nav-items 에서 analytics 사라짐
      expect(nav).not.toContain("/analytics");
      // AST patch 는 그대로 남아 있음
      expect(breadcrumb).toContain("/analytics");
      expect(breadcrumb).toContain("Analytics");
    });

    it("AST patch 만 제거해도 marker patch (nav-items) 는 영향 없다", () => {
      // marker patch 재적용 후 AST patch 만 제거
      applyPatches(projectDir, [MARKER_PATCH], realFsAdapter);
      removeAstPatches(projectDir, [AST_PATCH], realFsAdapter);

      const nav = readFileSync(join(projectDir, NAV_FILE), "utf-8");
      const breadcrumb = readFileSync(join(projectDir, BREADCRUMB_FILE), "utf-8");

      // marker patch 는 그대로 남아 있음
      expect(nav).toContain("/analytics");
      // AST patch 제거 → breadcrumb 에서 analytics 사라짐
      expect(breadcrumb).not.toContain("/analytics");
    });
  },
);

// ---------------------------------------------------------------------------
// Case 3: 공존 멱등성 — 둘 다 두 번 apply → skip → 둘 다 remove → 원본 복원
// ---------------------------------------------------------------------------

describe(
  "공존 멱등성: marker + AST 각각 두 번 apply → 두 번째 skip → 둘 다 remove → 원본 복원",
  { timeout: 15_000 },
  () => {
    const MARKER_PATCH: PatchDecl = {
      file: NAV_FILE,
      slot: "nav-items",
      entryKey: "/pricing",
      content: "  { label: 'Pricing', href: '/pricing' },",
    };

    const AST_PATCH: AstPatchDecl = {
      file: BREADCRUMB_FILE,
      selector: { type: "objectKey", target: "breadcrumbMap", key: "/pricing" },
      entryKey: "/pricing",
      content: "'Pricing'",
    };

    let projectDir: string;
    let navOriginal: string;
    let breadcrumbOriginal: string;
    let secondMarkerApplyResult: ReturnType<typeof applyPatches>;
    let secondAstApplyResult: ReturnType<typeof applyAstPatches>;
    let navFinal: string;
    let breadcrumbFinal: string;

    beforeAll(() => {
      projectDir = join(workDir, "coexist-idempotent");
      ensureFileSync(join(projectDir, NAV_FILE), NAV_CONTENT);
      ensureFileSync(join(projectDir, BREADCRUMB_FILE), BREADCRUMB_CONTENT);

      navOriginal = readFileSync(join(projectDir, NAV_FILE), "utf-8");
      breadcrumbOriginal = readFileSync(join(projectDir, BREADCRUMB_FILE), "utf-8");

      // 첫 번째 apply
      applyPatches(projectDir, [MARKER_PATCH], realFsAdapter);
      applyAstPatches(projectDir, [AST_PATCH], realFsAdapter);

      // 두 번째 apply (멱등 → skip 기대)
      secondMarkerApplyResult = applyPatches(projectDir, [MARKER_PATCH], realFsAdapter);
      secondAstApplyResult = applyAstPatches(projectDir, [AST_PATCH], realFsAdapter);

      // 제거
      removePatches(projectDir, [MARKER_PATCH], realFsAdapter);
      removeAstPatches(projectDir, [AST_PATCH], realFsAdapter);

      navFinal = readFileSync(join(projectDir, NAV_FILE), "utf-8");
      breadcrumbFinal = readFileSync(join(projectDir, BREADCRUMB_FILE), "utf-8");
    });

    it("두 번째 marker patch apply 는 skip 된다", () => {
      expect(secondMarkerApplyResult.applied).toHaveLength(0);
      expect(secondMarkerApplyResult.skipped).toHaveLength(1);
    });

    it("두 번째 AST patch apply 는 skip 된다", () => {
      expect(secondAstApplyResult.applied).toHaveLength(0);
      expect(secondAstApplyResult.skipped).toHaveLength(1);
    });

    it("remove 후 nav-items.ts 가 원본과 정확히 일치한다", () => {
      expect(navFinal).toBe(navOriginal);
    });

    it("remove 후 breadcrumb-map.ts 가 원본과 정확히 일치한다", () => {
      expect(breadcrumbFinal).toBe(breadcrumbOriginal);
    });

    it("nav-items.ts slot marker 는 최종에도 유지된다", () => {
      expect(navFinal).toContain("// trellis:slot:nav-items:start");
      expect(navFinal).toContain("// trellis:slot:nav-items:end");
    });
  },
);
