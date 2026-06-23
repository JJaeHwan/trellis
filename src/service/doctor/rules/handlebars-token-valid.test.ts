import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  checkHandlebarsTokenValid,
  extractTokens,
  rootContextKey,
} from "./handlebars-token-valid.js";

// ---------------------------------------------------------------------------
// extractTokens unit tests
// ---------------------------------------------------------------------------

describe("extractTokens — 단순 변수", () => {
  it("단순 변수 {{projectName}} 추출", () => {
    const tokens = extractTokens("Hello {{projectName}}!");
    expect(tokens).toHaveLength(1);
    expect(tokens[0]).toMatchObject({ name: "projectName", line: 1, isHelper: false });
  });

  it("triple-stash {{{projectName}}} 추출", () => {
    const tokens = extractTokens("{{{projectName}}}");
    expect(tokens).toHaveLength(1);
    expect(tokens[0]).toMatchObject({ name: "projectName", isHelper: false });
  });

  it("여러 줄 — 줄 번호 정확", () => {
    const tokens = extractTokens("line1\n{{namePascal}}\nline3");
    expect(tokens).toHaveLength(1);
    expect(tokens[0]).toMatchObject({ name: "namePascal", line: 2 });
  });
});

describe("extractTokens — 헬퍼 호출", () => {
  it("{{snake name}} → isHelper=true, name=snake, helperArg=name", () => {
    const tokens = extractTokens("{{snake name}}");
    expect(tokens).toHaveLength(1);
    expect(tokens[0]).toMatchObject({ name: "snake", isHelper: true, helperArg: "name" });
  });
});

describe("extractTokens — 블록 헬퍼 / 제어 흐름", () => {
  it("{{#if condition}} → 제어 흐름이므로 추출 X", () => {
    expect(extractTokens("{{#if condition}}yes{{/if}}")).toHaveLength(0);
  });

  it("{{#each items}} → items 는 컨텍스트 변수로 추출", () => {
    const tokens = extractTokens("{{#each items}}{{/each}}");
    expect(tokens.find((t) => t.name === "items")).toBeDefined();
  });

  it("{{! comment }} / {{!-- block --}} 무시", () => {
    expect(extractTokens("{{! c }}{{!-- b --}}")).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// rootContextKey — normalization (the false-positive fix)
// ---------------------------------------------------------------------------

describe("rootContextKey", () => {
  it("dottedPath → root segment", () => {
    expect(rootContextKey("answers.useDocker")).toBe("answers");
  });
  it("this / dot → skip", () => {
    expect(rootContextKey("this")).toBeUndefined();
    expect(rootContextKey(".")).toBeUndefined();
  });
  it("@data variables → skip", () => {
    expect(rootContextKey("@index")).toBeUndefined();
    expect(rootContextKey("@key")).toBeUndefined();
  });
  it("parent path ../x → root after stripping", () => {
    expect(rootContextKey("../projectName")).toBe("projectName");
  });
  it("plain key → itself", () => {
    expect(rootContextKey("projectName")).toBe("projectName");
  });
});

// ---------------------------------------------------------------------------
// checkHandlebarsTokenValid integration (real fn with a tmp root override)
// ---------------------------------------------------------------------------

let tmpRoot: string;

beforeEach(() => {
  tmpRoot = mkdtempSync(join(tmpdir(), "trellis-htv-"));
});

afterEach(() => {
  rmSync(tmpRoot, { recursive: true, force: true });
});

function writeHbs(root: string, relPath: string, content: string): void {
  const fullPath = join(root, relPath);
  mkdirSync(join(root, relPath.split("/").slice(0, -1).join("/")), { recursive: true });
  writeFileSync(fullPath, content);
}

describe("checkHandlebarsTokenValid — 정상 케이스", () => {
  it("{{projectName}} 풀바디 → 통과", () => {
    writeHbs(tmpRoot, "b2b-saas/README.md.hbs", "# {{projectName}}");
    expect(checkHandlebarsTokenValid(tmpRoot)).toEqual([]);
  });

  it("fragment {{nameCamel}} → 통과", () => {
    writeHbs(tmpRoot, "b2b-saas/_fragments/model/x.ts.hbs", "const {{nameCamel}} = 1;");
    expect(checkHandlebarsTokenValid(tmpRoot)).toEqual([]);
  });
});

describe("checkHandlebarsTokenValid — false-positive 회귀 (수정 후 통과)", () => {
  it("dotted access {{answers.useDocker}} → 통과 (root 'answers' 허용)", () => {
    writeHbs(tmpRoot, "b2b-saas/x.md.hbs", "{{answers.useDocker}}");
    expect(checkHandlebarsTokenValid(tmpRoot)).toEqual([]);
  });

  it("{{this}} / {{@index}} (#each 내부) → 통과", () => {
    writeHbs(
      tmpRoot,
      "b2b-saas/x.md.hbs",
      "{{#each answers}}{{this}} {{@index}}{{/each}}",
    );
    expect(checkHandlebarsTokenValid(tmpRoot)).toEqual([]);
  });

  it("parent path {{../projectName}} → 통과", () => {
    writeHbs(tmpRoot, "b2b-saas/x.md.hbs", "{{#each answers}}{{../projectName}}{{/each}}");
    expect(checkHandlebarsTokenValid(tmpRoot)).toEqual([]);
  });
});

describe("checkHandlebarsTokenValid — 위반 케이스 (여전히 검출)", () => {
  it("{{nonExistent}} → violation", () => {
    writeHbs(tmpRoot, "b2b-saas/README.md.hbs", "# {{nonExistent}}");
    const findings = checkHandlebarsTokenValid(tmpRoot);
    expect(findings).toHaveLength(1);
    expect(findings[0]?.message).toContain("nonExistent");
  });

  it("dotted unknown root {{bogus.field}} → violation", () => {
    writeHbs(tmpRoot, "b2b-saas/README.md.hbs", "{{bogus.field}}");
    const findings = checkHandlebarsTokenValid(tmpRoot);
    expect(findings).toHaveLength(1);
    expect(findings[0]?.message).toContain("bogus");
  });

  it("풀바디에 fragment 전용 키 {{namePascal}} → violation", () => {
    writeHbs(tmpRoot, "b2b-saas/src/page.tsx.hbs", "{{namePascal}}");
    const findings = checkHandlebarsTokenValid(tmpRoot);
    expect(findings).toHaveLength(1);
    expect(findings[0]?.message).toContain("namePascal");
  });

  it("{{#each unknownList}} → violation", () => {
    writeHbs(tmpRoot, "b2b-saas/_fragments/model/x.tsx.hbs", "{{#each unknownList}}{{/each}}");
    const findings = checkHandlebarsTokenValid(tmpRoot);
    expect(findings.some((f) => f.message.includes("unknownList"))).toBe(true);
  });

  it("{{unknownHelper name}} → violation", () => {
    writeHbs(tmpRoot, "b2b-saas/_fragments/model/x.ts.hbs", "{{unknownHelper name}}");
    const findings = checkHandlebarsTokenValid(tmpRoot);
    expect(findings.some((f) => f.message.includes("unknownHelper"))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 자기 검증 (dogfooding) — 실제 번들된 templates 에서 violations 없음
// ---------------------------------------------------------------------------

describe("checkHandlebarsTokenValid — 자기 검증 (dogfooding)", () => {
  it("번들된 실제 templates 에서 violations 없음", () => {
    expect(checkHandlebarsTokenValid()).toEqual([]);
  });
});
