import { describe, expect, it } from "vitest";
import type { FsAdapter } from "../../../external/fs-adapter.js";
import { checkTrellisVersionCompat } from "./trellis-version-compat.js";

/**
 * in-memory FsAdapter 팩토리.
 * files: { [absPath]: content } 맵을 받아 FsAdapter 를 반환한다.
 */
function makeFs(files: Record<string, string>): FsAdapter {
  return {
    exists(path) {
      return Object.prototype.hasOwnProperty.call(files, path);
    },
    isDirectory(_path) {
      return false;
    },
    isEmptyDirectory(_path) {
      return false;
    },
    ensureDir(_path) {
      // no-op
    },
    writeFile(_path, _content) {
      // no-op
    },
    readFile(path) {
      const content = files[path];
      if (content === undefined) {
        throw new Error(`ENOENT: no such file: ${path}`);
      }
      return content;
    },
    listDir(_path) {
      return [];
    },
  };
}

/** spec.json 내용을 JSON 문자열로 만드는 헬퍼 */
function makeSpec(trellisVersion: string): string {
  return JSON.stringify({
    projectName: "test-project",
    rootPath: "/tmp/test-project",
    playbookId: "b2b-saas",
    matchMode: "Exact",
    matchScore: 1,
    answers: [],
    placeholders: {},
    generatedAt: "2026-01-01T00:00:00.000Z",
    trellisVersion,
  });
}

const PROJECT_DIR = "/test/project";
const SPEC_PATH = `${PROJECT_DIR}/.trellis/spec.json`;

describe("checkTrellisVersionCompat — 정상 케이스 (통과)", () => {
  it("spec.json 없음 → no findings (다른 규칙이 처리)", () => {
    const fs = makeFs({});
    const findings = checkTrellisVersionCompat(PROJECT_DIR, fs, "0.7.0");
    expect(findings).toEqual([]);
  });

  it("trellisVersion === currentVersion → no findings", () => {
    const fs = makeFs({ [SPEC_PATH]: makeSpec("0.7.0") });
    const findings = checkTrellisVersionCompat(PROJECT_DIR, fs, "0.7.0");
    expect(findings).toEqual([]);
  });

  it("spec.minor < current.minor (spec=0.6.0, current=0.7.0) → no findings (0.x 하위 호환)", () => {
    const fs = makeFs({ [SPEC_PATH]: makeSpec("0.6.0") });
    const findings = checkTrellisVersionCompat(PROJECT_DIR, fs, "0.7.0");
    expect(findings).toEqual([]);
  });

  it("spec.minor === current.minor (patch 만 다름: spec=0.7.1, current=0.7.0) → no findings", () => {
    const fs = makeFs({ [SPEC_PATH]: makeSpec("0.7.1") });
    const findings = checkTrellisVersionCompat(PROJECT_DIR, fs, "0.7.0");
    // minor 동일, patch 무관 → 통과
    expect(findings).toEqual([]);
  });
});

describe("checkTrellisVersionCompat — warning 케이스", () => {
  it("spec.minor > current.minor (spec=0.8.0, current=0.7.0) → warn", () => {
    const fs = makeFs({ [SPEC_PATH]: makeSpec("0.8.0") });
    const findings = checkTrellisVersionCompat(PROJECT_DIR, fs, "0.7.0");
    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({
      ruleId: "trellis-version-compat",
      severity: "warn",
      message: expect.stringContaining("0.8.0") as string,
    });
  });
});

describe("checkTrellisVersionCompat — error 케이스", () => {
  it("major 불일치 (spec=1.0.0, current=0.7.0) → error", () => {
    const fs = makeFs({ [SPEC_PATH]: makeSpec("1.0.0") });
    const findings = checkTrellisVersionCompat(PROJECT_DIR, fs, "0.7.0");
    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({
      ruleId: "trellis-version-compat",
      severity: "error",
      message: expect.stringContaining("major 버전 불일치") as string,
    });
  });

  it("major 불일치 반대 방향 (spec=0.7.0, current=1.0.0) → error", () => {
    const fs = makeFs({ [SPEC_PATH]: makeSpec("0.7.0") });
    const findings = checkTrellisVersionCompat(PROJECT_DIR, fs, "1.0.0");
    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({
      ruleId: "trellis-version-compat",
      severity: "error",
      message: expect.stringContaining("major 버전 불일치") as string,
    });
  });

  it("trellisVersion 형식 잘못됨 (\"invalid\") → error (malformed)", () => {
    const fs = makeFs({ [SPEC_PATH]: makeSpec("invalid") });
    const findings = checkTrellisVersionCompat(PROJECT_DIR, fs, "0.7.0");
    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({
      ruleId: "trellis-version-compat",
      severity: "error",
      message: expect.stringContaining("malformed trellisVersion") as string,
    });
  });

  it("trellisVersion 빈 문자열 → error (malformed)", () => {
    const fs = makeFs({ [SPEC_PATH]: makeSpec("") });
    const findings = checkTrellisVersionCompat(PROJECT_DIR, fs, "0.7.0");
    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({
      ruleId: "trellis-version-compat",
      severity: "error",
      message: expect.stringContaining("malformed trellisVersion") as string,
    });
  });
});
