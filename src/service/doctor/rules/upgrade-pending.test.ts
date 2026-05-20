import { describe, expect, it } from "vitest";
import type { FsAdapter } from "../../../external/fs-adapter.js";
import { checkUpgradePending } from "./upgrade-pending.js";

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
    playbookId: "cli-tool",
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
const CURRENT_VERSION = "0.10.0";

describe("checkUpgradePending — spec.json 없음", () => {
  it("spec.json 없음 → no findings (no-op)", () => {
    const fs = makeFs({});
    const findings = checkUpgradePending(PROJECT_DIR, fs, CURRENT_VERSION);
    expect(findings).toEqual([]);
  });
});

describe("checkUpgradePending — 동일 버전", () => {
  it("spec 0.10.0, current 0.10.0 → no findings (no-op)", () => {
    const fs = makeFs({ [SPEC_PATH]: makeSpec("0.10.0") });
    const findings = checkUpgradePending(PROJECT_DIR, fs, CURRENT_VERSION);
    expect(findings).toEqual([]);
  });
});

describe("checkUpgradePending — minor 낮음 (upgrade 대상)", () => {
  it("spec 0.8.0, current 0.10.0 → 1 finding (info)", () => {
    const fs = makeFs({ [SPEC_PATH]: makeSpec("0.8.0") });
    const findings = checkUpgradePending(PROJECT_DIR, fs, CURRENT_VERSION);
    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({
      ruleId: "upgrade-pending",
      severity: "info",
      message: expect.stringContaining("0.8.0") as string,
      hint: expect.stringContaining("trellis upgrade") as string,
    });
  });

  it("finding message 에 현재 버전 포함", () => {
    const fs = makeFs({ [SPEC_PATH]: makeSpec("0.9.0") });
    const findings = checkUpgradePending(PROJECT_DIR, fs, CURRENT_VERSION);
    expect(findings).toHaveLength(1);
    expect(findings[0]!.message).toContain("0.10.0");
  });
});

describe("checkUpgradePending — minor 높음 (trellis-version-compat 영역)", () => {
  it("spec 0.11.0, current 0.10.0 → no findings (no-op)", () => {
    const fs = makeFs({ [SPEC_PATH]: makeSpec("0.11.0") });
    const findings = checkUpgradePending(PROJECT_DIR, fs, CURRENT_VERSION);
    expect(findings).toEqual([]);
  });
});

describe("checkUpgradePending — major 다름", () => {
  it("spec 1.0.0, current 0.10.0 → no findings (trellis-version-compat 영역)", () => {
    const fs = makeFs({ [SPEC_PATH]: makeSpec("1.0.0") });
    const findings = checkUpgradePending(PROJECT_DIR, fs, CURRENT_VERSION);
    expect(findings).toEqual([]);
  });

  it("spec 0.10.0, current 1.0.0 → no findings", () => {
    const fs = makeFs({ [SPEC_PATH]: makeSpec("0.10.0") });
    const findings = checkUpgradePending(PROJECT_DIR, fs, "1.0.0");
    expect(findings).toEqual([]);
  });
});

describe("checkUpgradePending — malformed trellisVersion", () => {
  it("malformed → no findings (trellis-version-compat 이 처리)", () => {
    const fs = makeFs({ [SPEC_PATH]: makeSpec("not-a-version") });
    const findings = checkUpgradePending(PROJECT_DIR, fs, CURRENT_VERSION);
    expect(findings).toEqual([]);
  });

  it("빈 문자열 → no findings", () => {
    const fs = makeFs({ [SPEC_PATH]: makeSpec("") });
    const findings = checkUpgradePending(PROJECT_DIR, fs, CURRENT_VERSION);
    expect(findings).toEqual([]);
  });
});
