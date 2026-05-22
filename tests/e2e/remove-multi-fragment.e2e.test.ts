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
      } else if (rel === ".trellis/spec.json") {
        // rootPath 는 절대 경로로 디렉토리마다 다름 → 비교에서 제외
        const parsed = JSON.parse(raw) as Record<string, unknown>;
        delete parsed["rootPath"];
        result[rel] = JSON.stringify(parsed);
      } else {
        result[rel] = raw;
      }
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// 테스트 픽스처 — cli-tool spec
// ---------------------------------------------------------------------------

const cliSpec: ProjectSpec = {
  projectName: "e2e-remove-multi-frag",
  rootPath: "",
  playbookId: "cli-tool",
  matchMode: "exact",
  matchScore: 1,
  answers: [
    { questionId: "1", selectedOptionId: "B" },
    { questionId: "2", selectedOptionId: "A" },
    { questionId: "3", selectedOptionId: "B" },
    { questionId: "4", selectedOptionId: "C" },
    { questionId: "5", selectedOptionId: "A" },
    { questionId: "6", selectedOptionId: "A" },
    { questionId: "7", selectedOptionId: "A" },
    { questionId: "8", selectedOptionId: "A" },
    { questionId: "9", selectedOptionId: "C" },
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
  workDir = mkdtempSync(join(tmpdir(), "trellis-remove-multi-e2e-"));
});

afterAll(() => {
  rmSync(workDir, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// 시나리오: add alpha → add beta → remove alpha
// 결과: beta 만 추가한 상태와 동등해야 함
// ---------------------------------------------------------------------------

describe(
  "Multi-fragment: add alpha + beta, remove alpha → beta 만 남아야 한다",
  { timeout: 30_000 },
  () => {
    let projectDir: string;
    let afterOnlyBetaTree: Record<string, string>;
    let afterTwoAddsTree: Record<string, string>;
    let afterOneRemoveTree: Record<string, string>;

    beforeAll(async () => {
      projectDir = join(workDir, "multi-alpha-beta");
      scaffold({ ...cliSpec, rootPath: projectDir, projectName: "e2e-remove-multi-frag" });

      // --- 레퍼런스: beta 만 추가한 별도 디렉토리 ---
      const betaOnlyDir = join(workDir, "beta-only");
      scaffold({ ...cliSpec, rootPath: betaOnlyDir, projectName: "e2e-remove-multi-frag" });

      vi.spyOn(process.stdout, "write").mockImplementation(() => true);
      vi.spyOn(process.stderr, "write").mockImplementation(() => true);
      await runAdd("command", "beta", { force: false }, realFsAdapter, betaOnlyDir);
      vi.restoreAllMocks();

      afterOnlyBetaTree = buildFileTree(betaOnlyDir);

      // --- 메인 시나리오 ---

      // step 1: add command alpha
      vi.spyOn(process.stdout, "write").mockImplementation(() => true);
      vi.spyOn(process.stderr, "write").mockImplementation(() => true);
      await runAdd("command", "alpha", { force: false }, realFsAdapter, projectDir);
      vi.restoreAllMocks();

      // step 2: add command beta
      vi.spyOn(process.stdout, "write").mockImplementation(() => true);
      vi.spyOn(process.stderr, "write").mockImplementation(() => true);
      await runAdd("command", "beta", { force: false }, realFsAdapter, projectDir);
      vi.restoreAllMocks();

      // snapshot: alpha + beta 모두 추가된 상태
      afterTwoAddsTree = buildFileTree(projectDir);

      // step 3: remove command alpha (--force 로 git dirty 우회)
      vi.spyOn(process.stdout, "write").mockImplementation(() => true);
      vi.spyOn(process.stderr, "write").mockImplementation(() => true);
      await runRemove(
        "command",
        "alpha",
        { force: true },
        realFsAdapter,
        projectDir,
        () => false,
      );
      vi.restoreAllMocks();

      // snapshot: alpha 제거 후 상태
      afterOneRemoveTree = buildFileTree(projectDir);
    });

    // --- alpha + beta 양쪽이 실제로 추가됐는지 확인 ---

    it("afterTwoAdds 에는 alpha 관련 파일이 있다", () => {
      const alphaFiles = Object.keys(afterTwoAddsTree).filter((p) => p.includes("alpha"));
      expect(alphaFiles.length).toBeGreaterThan(0);
    });

    it("afterTwoAdds 에는 beta 관련 파일이 있다", () => {
      const betaFiles = Object.keys(afterTwoAddsTree).filter((p) => p.includes("beta"));
      expect(betaFiles.length).toBeGreaterThan(0);
    });

    // --- alpha 제거 후: alpha 파일 없음, beta 파일 유지 ---

    it("afterOneRemove 에는 alpha 관련 파일이 없다", () => {
      const alphaFiles = Object.keys(afterOneRemoveTree).filter((p) => p.includes("alpha"));
      expect(alphaFiles).toHaveLength(0);
    });

    it("afterOneRemove 에는 beta 관련 파일이 그대로 있다", () => {
      const betaFiles = Object.keys(afterOneRemoveTree).filter((p) => p.includes("beta"));
      expect(betaFiles.length).toBeGreaterThan(0);
    });

    // --- index.ts patch 검증 ---

    it("afterOneRemove 의 index.ts 에 registerAlphaCommand 가 없다", () => {
      const indexContent = afterOneRemoveTree["src/cmd/index.ts"] ?? "";
      expect(indexContent).not.toContain("registerAlphaCommand");
    });

    it("afterOneRemove 의 index.ts 에 registerBetaCommand 가 남아 있다", () => {
      const indexContent = afterOneRemoveTree["src/cmd/index.ts"] ?? "";
      expect(indexContent).toContain("registerBetaCommand");
    });

    it("afterOneRemove 의 index.ts 에 slot marker 가 유지된다", () => {
      const indexContent = afterOneRemoveTree["src/cmd/index.ts"] ?? "";
      expect(indexContent).toContain("// trellis:slot:imports:start");
      expect(indexContent).toContain("// trellis:slot:imports:end");
      expect(indexContent).toContain("// trellis:slot:commands:start");
      expect(indexContent).toContain("// trellis:slot:commands:end");
    });

    // --- 핵심 라운드트립 검증: afterOneRemove === afterOnlyBeta ---

    it("remove alpha 후 파일 경로 목록이 beta-only 와 동일하다", () => {
      expect(Object.keys(afterOneRemoveTree).sort()).toEqual(
        Object.keys(afterOnlyBetaTree).sort(),
      );
    });

    it("remove alpha 후 모든 파일 내용이 beta-only 프로젝트와 deep equal 하다", () => {
      for (const [path, content] of Object.entries(afterOnlyBetaTree)) {
        expect(afterOneRemoveTree[path]).toBe(content);
      }
    });

    // --- 차이는 정확히 alpha 관련 파일/patch 만 ---

    it("afterTwoAdds 와 afterOneRemove 의 차이는 alpha 관련 파일/patch 뿐이다", () => {
      const twoKeys = new Set(Object.keys(afterTwoAddsTree));
      const oneKeys = new Set(Object.keys(afterOneRemoveTree));

      // afterTwoAdds 에만 있는 파일 (alpha 제거된 것들)
      const onlyInTwo = [...twoKeys].filter((k) => !oneKeys.has(k));
      // afterOneRemove 에만 있는 파일 (있어선 안 됨)
      const onlyInOne = [...oneKeys].filter((k) => !twoKeys.has(k));

      // 새로 생긴 파일 없음
      expect(onlyInOne).toHaveLength(0);
      // 제거된 파일은 모두 alpha 관련
      for (const removed of onlyInTwo) {
        expect(removed.toLowerCase()).toContain("alpha");
      }
    });
  },
);
