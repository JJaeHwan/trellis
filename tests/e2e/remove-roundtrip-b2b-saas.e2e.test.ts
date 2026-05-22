import { mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { ProjectSpec } from "../../src/domain/index.js";
import { scaffold } from "../../src/service/scaffolder/index.js";
import { runAdd } from "../../src/cmd/add.js";
import { runRemove } from "../../src/cmd/remove.js";
import { realFsAdapter } from "../../src/external/fs-adapter.js";

// ---------------------------------------------------------------------------
// 파일 트리 스냅샷 헬퍼
// ---------------------------------------------------------------------------

const IGNORED_NAMES = new Set(["node_modules", ".git", "dist", "package-lock.json"]);

/**
 * 디렉토리를 재귀 탐색해 { 상대경로: 파일내용 } 맵을 반환한다.
 * package.json 의 dependencies / devDependencies 키는 제외.
 */
function buildFileTree(dir: string, base = ""): Record<string, string> {
  const result: Record<string, string> = {};
  for (const entry of readdirSync(dir)) {
    if (IGNORED_NAMES.has(entry)) continue;
    const full = join(dir, entry);
    const rel = base !== "" ? `${base}/${entry}` : entry;
    if (statSync(full).isDirectory()) {
      Object.assign(result, buildFileTree(full, rel));
    } else {
      const raw = readFileSync(full, "utf-8");
      if (rel === "package.json") {
        const parsed = JSON.parse(raw) as Record<string, unknown>;
        delete parsed["dependencies"];
        delete parsed["devDependencies"];
        result[rel] = JSON.stringify(parsed);
      } else {
        result[rel] = raw;
      }
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// 테스트 픽스처 — b2b-saas spec
// ---------------------------------------------------------------------------

const saasSpec: ProjectSpec = {
  projectName: "e2e-remove-b2b-saas",
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
  generatedAt: "2026-04-27T00:00:00.000Z",
  trellisVersion: "0.0.0-e2e",
};

// ---------------------------------------------------------------------------
// 공유 임시 디렉토리
// ---------------------------------------------------------------------------

let workDir: string;

beforeAll(() => {
  workDir = mkdtempSync(join(tmpdir(), "trellis-remove-saas-e2e-"));
});

afterAll(() => {
  rmSync(workDir, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// Round-trip: add model Product → remove model Product → 원상복구
// model fragment 는 prisma-models + services 두 슬롯에 patch 함
// ---------------------------------------------------------------------------

describe(
  "Round-trip: b2b-saas add model Product → remove model Product",
  { timeout: 30_000 },
  () => {
    let projectDir: string;
    let preAddTree: Record<string, string>;
    let postAddTree: Record<string, string>;
    let postRemoveTree: Record<string, string>;

    beforeAll(async () => {
      projectDir = join(workDir, "roundtrip-model-product");
      scaffold({ ...saasSpec, rootPath: projectDir, projectName: "e2e-remove-b2b-saas" });

      // add 이전 스냅샷
      preAddTree = buildFileTree(projectDir);

      // add model Product
      vi.spyOn(process.stdout, "write").mockImplementation(() => true);
      vi.spyOn(process.stderr, "write").mockImplementation(() => true);
      await runAdd("model", "Product", { force: false }, realFsAdapter, projectDir);
      vi.restoreAllMocks();

      // add 이후 스냅샷
      postAddTree = buildFileTree(projectDir);

      // remove model Product (--force 로 git dirty 우회)
      vi.spyOn(process.stdout, "write").mockImplementation(() => true);
      vi.spyOn(process.stderr, "write").mockImplementation(() => true);
      await runRemove(
        "model",
        "Product",
        { force: true },
        realFsAdapter,
        projectDir,
        () => false,
      );
      vi.restoreAllMocks();

      // remove 이후 스냅샷
      postRemoveTree = buildFileTree(projectDir);
    });

    it("add 가 실제로 파일을 추가했어야 한다 (preAdd !== postAdd)", () => {
      expect(Object.keys(postAddTree).length).toBeGreaterThan(Object.keys(preAddTree).length);
    });

    it("remove 후 파일 수가 add 이전과 동일하다", () => {
      expect(Object.keys(postRemoveTree).length).toBe(Object.keys(preAddTree).length);
    });

    it("remove 후 모든 파일 경로가 add 이전과 동일하다", () => {
      expect(Object.keys(postRemoveTree).sort()).toEqual(Object.keys(preAddTree).sort());
    });

    it("remove 후 모든 파일 내용이 add 이전과 deep equal 하다 (라운드트립)", () => {
      for (const [path, content] of Object.entries(preAddTree)) {
        expect(postRemoveTree[path]).toBe(content);
      }
    });

    it("postAddTree 에는 product 관련 파일이 존재한다", () => {
      const productFiles = Object.keys(postAddTree).filter((p) =>
        p.toLowerCase().includes("product"),
      );
      expect(productFiles.length).toBeGreaterThan(0);
    });

    it("postRemoveTree 에는 product 관련 파일이 없다", () => {
      const productFiles = Object.keys(postRemoveTree).filter((p) =>
        p.toLowerCase().includes("product"),
      );
      expect(productFiles).toHaveLength(0);
    });

    it("remove 후 prisma/schema.prisma 에 model Product 가 없다", () => {
      const schema = postRemoveTree["prisma/schema.prisma"] ?? "";
      expect(schema).not.toContain("model Product {");
    });

    it("remove 후 src/lib/services.ts 에 ProductRepository 가 없다", () => {
      const services = postRemoveTree["src/lib/services.ts"] ?? "";
      expect(services).not.toContain("ProductRepository");
    });

    it("remove 후 prisma-models slot marker 는 유지된다", () => {
      const schema = postRemoveTree["prisma/schema.prisma"] ?? "";
      expect(schema).toContain("// trellis:slot:prisma-models:start");
      expect(schema).toContain("// trellis:slot:prisma-models:end");
    });

    it("remove 후 services slot marker 는 유지된다", () => {
      const services = postRemoveTree["src/lib/services.ts"] ?? "";
      expect(services).toContain("// trellis:slot:services:start");
      expect(services).toContain("// trellis:slot:services:end");
    });
  },
);
