import { describe, expect, it } from "vitest";
import type { FsAdapter } from "../../../external/fs-adapter.js";
import { checkPlaybookStillSupported } from "./playbook-still-supported.js";

/**
 * in-memory FsAdapter 팩토리.
 * files: { [absPath]: content } 맵을 받아 FsAdapter 를 반환한다.
 */
function makeFs(
  files: Record<string, string>,
  dirs: readonly string[] = [],
): FsAdapter {
  return {
    exists(path) {
      return (
        Object.prototype.hasOwnProperty.call(files, path) ||
        dirs.includes(path)
      );
    },
    isDirectory(path) {
      return dirs.includes(path);
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
      return ["cli-tool", "b2b-saas", "ai-rag-platform"];
    },
  };
}

/** spec.json 내용을 JSON 문자열로 만드는 헬퍼 */
function makeSpec(playbookId: string): string {
  return JSON.stringify({
    projectName: "test-project",
    rootPath: "/tmp/test-project",
    playbookId,
    matchMode: "Exact",
    matchScore: 1,
    answers: [],
    placeholders: {},
    generatedAt: "2026-01-01T00:00:00.000Z",
    trellisVersion: "0.7.0",
  });
}

const PROJECT_DIR = "/test/project";
const SPEC_PATH = `${PROJECT_DIR}/.trellis/spec.json`;

describe("checkPlaybookStillSupported — spec.json 없음", () => {
  it("spec.json 없음 → no findings (no-op)", () => {
    const fs = makeFs({});
    const findings = checkPlaybookStillSupported(PROJECT_DIR, fs);
    expect(findings).toEqual([]);
  });
});

describe("checkPlaybookStillSupported — 지원 playbook", () => {
  it("cli-tool → no findings", () => {
    const fs = makeFs({ [SPEC_PATH]: makeSpec("cli-tool") });
    const findings = checkPlaybookStillSupported(PROJECT_DIR, fs);
    expect(findings).toEqual([]);
  });

  it("b2b-saas → no findings", () => {
    const fs = makeFs({ [SPEC_PATH]: makeSpec("b2b-saas") });
    const findings = checkPlaybookStillSupported(PROJECT_DIR, fs);
    expect(findings).toEqual([]);
  });

  it("ai-rag-platform → no findings", () => {
    const fs = makeFs({ [SPEC_PATH]: makeSpec("ai-rag-platform") });
    const findings = checkPlaybookStillSupported(PROJECT_DIR, fs);
    expect(findings).toEqual([]);
  });
});

describe("checkPlaybookStillSupported — 알 수 없는 playbookId", () => {
  it("legacy-playbook → 1 finding (error)", () => {
    const fs = makeFs({ [SPEC_PATH]: makeSpec("legacy-playbook") });
    const findings = checkPlaybookStillSupported(PROJECT_DIR, fs);
    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({
      ruleId: "playbook-still-supported",
      severity: "error",
      message: expect.stringContaining("legacy-playbook") as string,
      hint: expect.stringContaining("cli-tool") as string,
    });
  });

  it("unknown-id → finding message 에 playbookId 포함", () => {
    const fs = makeFs({ [SPEC_PATH]: makeSpec("unknown-id") });
    const findings = checkPlaybookStillSupported(PROJECT_DIR, fs);
    expect(findings).toHaveLength(1);
    expect(findings[0]!.message).toContain("unknown-id");
  });
});
