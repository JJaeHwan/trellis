/**
 * P15.10: b2b-saas page fragment — marker patches + astPatches 공존 검증
 *
 * 시나리오 A:
 *   - marker patch: nav-items.ts 의 nav-items 슬롯에 메뉴 항목 삽입
 *   - astPatch:     breadcrumb-map.ts 의 breadcrumbMap 객체에 key 추가 (objectKey)
 *   같은 fragment 가 두 방식을 동시에 수행함을 검증한다.
 */
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { ProjectSpec } from "../../src/domain/index.js";
import { scaffold } from "../../src/service/scaffolder/index.js";
import { runAdd } from "../../src/cmd/add.js";
import { realFsAdapter } from "../../src/external/fs-adapter.js";

const spec: ProjectSpec = {
  projectName: "e2e-ast-coexist",
  rootPath: "",
  playbookId: "b2b-saas",
  matchMode: "exact",
  matchScore: 1,
  answers: [
    { questionId: "1", selectedOptionId: "A" },
    { questionId: "2", selectedOptionId: "B" },
    { questionId: "3", selectedOptionId: "B" },
    { questionId: "4", selectedOptionId: "C" },
    { questionId: "5", selectedOptionId: "B" },
    { questionId: "6", selectedOptionId: "B" },
    { questionId: "7", selectedOptionId: "B" },
    { questionId: "8", selectedOptionId: "B" },
    { questionId: "9", selectedOptionId: "B" },
  ],
  placeholders: {},
  generatedAt: "2026-05-21T00:00:00.000Z",
  trellisVersion: "0.0.0-e2e",
};

let workDir: string;
let projectDir: string;

beforeAll(() => {
  workDir = mkdtempSync(join(tmpdir(), "trellis-ast-coexist-e2e-"));
  projectDir = join(workDir, "e2e-ast-coexist");
  scaffold({ ...spec, rootPath: projectDir });
});

afterAll(() => {
  rmSync(workDir, { recursive: true, force: true });
});

describe("P15.10: marker patch + astPatch 공존 (b2b-saas page fragment)", () => {
  // -------------------------------------------------------------------------
  // trellis add page analytics
  // -------------------------------------------------------------------------
  describe("add page analytics", () => {
    it("runAdd resolves without error", async () => {
      await expect(
        runAdd("page", "analytics", { force: false }, realFsAdapter, projectDir),
      ).resolves.toBeUndefined();
    });

    it("marker patch: nav-items.ts 에 Analytics 항목이 추가됨", () => {
      const nav = readFileSync(join(projectDir, "src/lib/nav-items.ts"), "utf-8");
      expect(nav).toContain('label: "Analytics"');
      expect(nav).toContain('href: "/analytics"');
    });

    it("marker patch: nav-items 슬롯 marker 가 보존됨", () => {
      const nav = readFileSync(join(projectDir, "src/lib/nav-items.ts"), "utf-8");
      expect(nav).toContain("// trellis:slot:nav-items:start");
      expect(nav).toContain("// trellis:slot:nav-items:end");
    });

    it("astPatch: breadcrumb-map.ts 에 /analytics 키가 추가됨", () => {
      const bc = readFileSync(join(projectDir, "src/lib/breadcrumb-map.ts"), "utf-8");
      expect(bc).toContain('"/analytics"');
      expect(bc).toContain('"Analytics"');
    });

    it("astPatch: breadcrumb-map.ts 기존 항목 (/dashboard, /admin) 이 보존됨", () => {
      const bc = readFileSync(join(projectDir, "src/lib/breadcrumb-map.ts"), "utf-8");
      expect(bc).toContain('"/dashboard"');
      expect(bc).toContain('"Dashboard"');
      expect(bc).toContain('"/admin"');
      expect(bc).toContain('"Admin"');
    });

    it("astPatch: breadcrumb-map.ts 의 breadcrumb 슬롯 marker 가 보존됨", () => {
      const bc = readFileSync(join(projectDir, "src/lib/breadcrumb-map.ts"), "utf-8");
      expect(bc).toContain("// trellis:slot:breadcrumb:start");
      expect(bc).toContain("// trellis:slot:breadcrumb:end");
    });
  });

  // -------------------------------------------------------------------------
  // 멱등성: 같은 fragment 를 두 번 add 해도 중복 없음
  // -------------------------------------------------------------------------
  describe("멱등성 — 두 번째 add (force:true) 후 중복 없음", () => {
    it("두 번째 runAdd (force:true) 가 오류 없이 완료됨", async () => {
      await expect(
        runAdd("page", "analytics", { force: true }, realFsAdapter, projectDir),
      ).resolves.toBeUndefined();
    });

    it('nav-items.ts 에 "/analytics" 가 정확히 1회만 등장함', () => {
      const nav = readFileSync(join(projectDir, "src/lib/nav-items.ts"), "utf-8");
      const count = nav.split('"/analytics"').length - 1;
      expect(count).toBe(1);
    });

    it('breadcrumb-map.ts 에 "/analytics" 키가 정확히 1회만 등장함', () => {
      const bc = readFileSync(join(projectDir, "src/lib/breadcrumb-map.ts"), "utf-8");
      const count = bc.split('"/analytics"').length - 1;
      expect(count).toBe(1);
    });
  });

  // -------------------------------------------------------------------------
  // 두 번째 page 추가: marker + AST 모두 독립적으로 동작
  // -------------------------------------------------------------------------
  describe("두 번째 page (billing) 추가 — 두 방식 독립 동작 확인", () => {
    it("runAdd page billing resolves without error", async () => {
      await expect(
        runAdd("page", "billing", { force: false }, realFsAdapter, projectDir),
      ).resolves.toBeUndefined();
    });

    it("nav-items.ts 에 Billing 항목이 추가되고 Analytics 도 유지됨", () => {
      const nav = readFileSync(join(projectDir, "src/lib/nav-items.ts"), "utf-8");
      expect(nav).toContain('label: "Billing"');
      expect(nav).toContain('href: "/billing"');
      expect(nav).toContain('label: "Analytics"');
    });

    it("breadcrumb-map.ts 에 /billing 과 /analytics 가 모두 존재함", () => {
      const bc = readFileSync(join(projectDir, "src/lib/breadcrumb-map.ts"), "utf-8");
      expect(bc).toContain('"/billing"');
      expect(bc).toContain('"Billing"');
      expect(bc).toContain('"/analytics"');
      expect(bc).toContain('"Analytics"');
    });
  });
}, { timeout: 30_000 });
