import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { checkHandlebarsTokenValid, extractTokens } from "./handlebars-token-valid.js";

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

  it("{{pascal projectName}} 추출", () => {
    const tokens = extractTokens("{{pascal projectName}}");
    expect(tokens).toHaveLength(1);
    expect(tokens[0]).toMatchObject({ name: "pascal", isHelper: true, helperArg: "projectName" });
  });
});

describe("extractTokens — 블록 헬퍼 / 제어 흐름", () => {
  it("{{#if condition}} → 제어 흐름이므로 추출 X", () => {
    const tokens = extractTokens("{{#if condition}}yes{{/if}}");
    expect(tokens).toHaveLength(0);
  });

  it("{{else}} 무시", () => {
    const tokens = extractTokens("{{else}}");
    expect(tokens).toHaveLength(0);
  });

  it("{{/if}} 무시", () => {
    const tokens = extractTokens("{{/if}}");
    expect(tokens).toHaveLength(0);
  });

  it("{{#each items}} → items 는 컨텍스트 변수로 추출", () => {
    const tokens = extractTokens("{{#each items}}{{/each}}");
    const itemsToken = tokens.find((t) => t.name === "items");
    expect(itemsToken).toBeDefined();
    expect(itemsToken).toMatchObject({ name: "items", isHelper: false });
  });

  it("{{#with obj}} → obj 는 컨텍스트 변수로 추출", () => {
    const tokens = extractTokens("{{#with obj}}{{/with}}");
    const objToken = tokens.find((t) => t.name === "obj");
    expect(objToken).toBeDefined();
  });

  it("{{! comment }} 무시", () => {
    const tokens = extractTokens("{{! this is a comment }}");
    expect(tokens).toHaveLength(0);
  });

  it("{{!-- block comment --}} 무시", () => {
    const tokens = extractTokens("{{!-- block comment --}}");
    expect(tokens).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// checkHandlebarsTokenValid integration tests (in-memory tmp dir)
// ---------------------------------------------------------------------------

/**
 * tmpRoot 기반으로 checkHandlebarsTokenValid 와 동일한 로직을 실행하는 래퍼.
 * checkHandlebarsTokenValid 는 import.meta.url 기준 getTemplatesRoot() 를 사용하므로
 * 테스트에서는 직접 로직을 추출한 runCheckWithRoot 를 사용한다.
 */

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { resolve } from "node:path";

function collectHbsFilesLocal(dir: string): string[] {
  const results: string[] = [];
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return results;
  }
  for (const entry of entries) {
    const fullPath = resolve(dir, entry);
    let st: ReturnType<typeof statSync>;
    try {
      st = statSync(fullPath);
    } catch {
      continue;
    }
    if (st.isDirectory()) {
      results.push(...collectHbsFilesLocal(fullPath));
    } else if (entry.endsWith(".hbs")) {
      results.push(fullPath);
    }
  }
  return results;
}

const FULLBODY_KEYS_LOCAL = new Set([
  "projectName", "projectNameKebab", "projectNamePascal", "projectNameCamel",
  "projectNameSnake", "playbookId", "year", "generatedAt", "trellisVersion", "answers",
]);
const FRAGMENT_KEYS_LOCAL = new Set([
  "name", "namePascal", "nameKebab", "nameCamel", "nameSnake",
  "projectName", "projectNameKebab", "projectNamePascal", "projectNameCamel", "projectNameSnake",
]);
const HELPERS_LOCAL = new Set(["kebab", "pascal", "camel", "snake", "eq"]);
const BUILTIN_HELPERS_LOCAL = new Set(["if", "unless", "each", "with", "lookup", "log", "else"]);

type FindingLocal = {
  ruleId: string;
  severity: "error" | "warn" | "info";
  message: string;
  hint?: string;
};

function runCheckWithRoot(root: string): FindingLocal[] {
  const findings: FindingLocal[] = [];
  if (!existsSync(root)) return findings;

  const hbsFiles = collectHbsFilesLocal(root);

  for (const filePath of hbsFiles) {
    const isFragment = filePath.replace(/\\/g, "/").includes("/_fragments/");
    const allowedKeys = isFragment ? FRAGMENT_KEYS_LOCAL : FULLBODY_KEYS_LOCAL;

    const relPath = filePath.slice(root.length + 1);
    const firstSlash = relPath.indexOf("/");
    const playbookId = firstSlash >= 0 ? relPath.slice(0, firstSlash) : relPath;
    const fileRelToPlaybook = firstSlash >= 0 ? relPath.slice(firstSlash + 1) : relPath;

    let content: string;
    try {
      content = readFileSync(filePath, "utf-8");
    } catch {
      findings.push({ ruleId: "handlebars-token-valid", severity: "error", message: `${playbookId}/${fileRelToPlaybook}: 파일 읽기 실패` });
      continue;
    }

    const tokens = extractTokens(content);
    for (const token of tokens) {
      if (token.isHelper) {
        if (!HELPERS_LOCAL.has(token.name) && !BUILTIN_HELPERS_LOCAL.has(token.name)) {
          findings.push({
            ruleId: "handlebars-token-valid", severity: "error",
            message: `${playbookId}/${fileRelToPlaybook}: 알 수 없는 헬퍼 '{{${token.name} ...}}' (line ${token.line})`,
          });
        }
        if (token.helperArg !== undefined) {
          if (!allowedKeys.has(token.helperArg) && !BUILTIN_HELPERS_LOCAL.has(token.helperArg)) {
            findings.push({
              ruleId: "handlebars-token-valid", severity: "error",
              message: `${playbookId}/${fileRelToPlaybook}: 알 수 없는 토큰 '{{${token.name} ${token.helperArg}}}' 의 인수 '${token.helperArg}' (line ${token.line})`,
            });
          }
        }
      } else {
        if (!allowedKeys.has(token.name) && !BUILTIN_HELPERS_LOCAL.has(token.name)) {
          findings.push({
            ruleId: "handlebars-token-valid", severity: "error",
            message: `${playbookId}/${fileRelToPlaybook}: 알 수 없는 토큰 '{{${token.name}}}' (line ${token.line})`,
          });
        }
      }
    }
  }

  return findings;
}

// ---------------------------------------------------------------------------
// Test setup
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

// ---------------------------------------------------------------------------
// 풀바디 템플릿 케이스
// ---------------------------------------------------------------------------

describe("checkHandlebarsTokenValid — 풀바디 정상 케이스", () => {
  it("{{projectName}} → 통과", () => {
    writeHbs(tmpRoot, "b2b-saas/README.md.hbs", "# {{projectName}}");
    const findings = runCheckWithRoot(tmpRoot);
    expect(findings).toEqual([]);
  });

  it("{{projectNameKebab}} → 통과", () => {
    writeHbs(tmpRoot, "b2b-saas/package.json.hbs", '{ "name": "{{projectNameKebab}}" }');
    const findings = runCheckWithRoot(tmpRoot);
    expect(findings).toEqual([]);
  });

  it("토큰 없는 파일 → 통과", () => {
    writeHbs(tmpRoot, "b2b-saas/static.md.hbs", "No tokens here");
    const findings = runCheckWithRoot(tmpRoot);
    expect(findings).toEqual([]);
  });
});

describe("checkHandlebarsTokenValid — 풀바디 위반 케이스", () => {
  it("{{nonExistent}} → violation", () => {
    writeHbs(tmpRoot, "b2b-saas/README.md.hbs", "# {{nonExistent}}");
    const findings = runCheckWithRoot(tmpRoot);
    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({
      ruleId: "handlebars-token-valid",
      severity: "error",
      message: expect.stringContaining("nonExistent") as string,
    });
  });

  it("풀바디에 fragment 전용 키 {{namePascal}} → violation", () => {
    writeHbs(tmpRoot, "b2b-saas/src/page.tsx.hbs", "export function {{namePascal}}() {}");
    const findings = runCheckWithRoot(tmpRoot);
    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({
      ruleId: "handlebars-token-valid",
      severity: "error",
      message: expect.stringContaining("namePascal") as string,
    });
  });
});

// ---------------------------------------------------------------------------
// fragment 템플릿 케이스
// ---------------------------------------------------------------------------

describe("checkHandlebarsTokenValid — fragment 정상 케이스", () => {
  it("{{nameKebab}} → 통과", () => {
    writeHbs(
      tmpRoot,
      "b2b-saas/_fragments/model/src/lib/zod/file.ts.hbs",
      "export const {{nameCamel}}Schema = {};",
    );
    const findings = runCheckWithRoot(tmpRoot);
    expect(findings).toEqual([]);
  });

  it("{{projectName}} in fragment → 통과 (FragmentContext 가 spec.placeholders 통해 노출)", () => {
    writeHbs(
      tmpRoot,
      "b2b-saas/_fragments/page/src/page.tsx.hbs",
      "// project: {{projectName}}",
    );
    const findings = runCheckWithRoot(tmpRoot);
    expect(findings).toEqual([]);
  });

  it("{{namePascal}}, {{nameCamel}}, {{nameSnake}}, {{nameKebab}}, {{name}} 모두 통과", () => {
    writeHbs(
      tmpRoot,
      "b2b-saas/_fragments/service/src/file.ts.hbs",
      "class {{namePascal}} { get {{nameCamel}}() { return '{{name}}'; } }",
    );
    const findings = runCheckWithRoot(tmpRoot);
    expect(findings).toEqual([]);
  });
});

describe("checkHandlebarsTokenValid — fragment 위반 케이스", () => {
  it("{{wrongToken}} in fragment → violation", () => {
    writeHbs(
      tmpRoot,
      "b2b-saas/_fragments/model/src/file.ts.hbs",
      "export const {{wrongToken}} = {};",
    );
    const findings = runCheckWithRoot(tmpRoot);
    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({
      ruleId: "handlebars-token-valid",
      severity: "error",
      message: expect.stringContaining("wrongToken") as string,
    });
  });
});

// ---------------------------------------------------------------------------
// 블록 헬퍼 / 제어 흐름
// ---------------------------------------------------------------------------

describe("checkHandlebarsTokenValid — 블록 토큰 처리", () => {
  it("{{#if condition}}...{{/if}} — condition 은 컨텍스트 변수지만 제어 흐름이므로 무시", () => {
    writeHbs(
      tmpRoot,
      "b2b-saas/_fragments/model/src/file.tsx.hbs",
      "{{#if condition}}yes{{/if}}",
    );
    // condition 은 허용 키가 아니지만 #if 블록이므로 무시됨
    const findings = runCheckWithRoot(tmpRoot);
    expect(findings).toEqual([]);
  });

  it("{{#each items}}...{{/each}} — items 는 검증 대상", () => {
    writeHbs(
      tmpRoot,
      "b2b-saas/_fragments/model/src/file.tsx.hbs",
      "{{#each unknownList}}{{/each}}",
    );
    // unknownList 는 fragment 허용 키가 아님 → violation
    const findings = runCheckWithRoot(tmpRoot);
    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({
      message: expect.stringContaining("unknownList") as string,
    });
  });
});

// ---------------------------------------------------------------------------
// 헬퍼 호출
// ---------------------------------------------------------------------------

describe("checkHandlebarsTokenValid — 헬퍼 호출", () => {
  it("{{snake name}} in fragment → 통과 (헬퍼 + name 둘 다 OK)", () => {
    writeHbs(
      tmpRoot,
      "b2b-saas/_fragments/model/src/file.ts.hbs",
      "const x = '{{snake name}}';",
    );
    const findings = runCheckWithRoot(tmpRoot);
    expect(findings).toEqual([]);
  });

  it("{{pascal projectName}} in fullbody → 통과", () => {
    writeHbs(
      tmpRoot,
      "b2b-saas/src/file.ts.hbs",
      "const x = '{{pascal projectName}}';",
    );
    const findings = runCheckWithRoot(tmpRoot);
    expect(findings).toEqual([]);
  });

  it("{{unknownHelper name}} → violation (알 수 없는 헬퍼)", () => {
    writeHbs(
      tmpRoot,
      "b2b-saas/_fragments/model/src/file.ts.hbs",
      "const x = '{{unknownHelper name}}';",
    );
    const findings = runCheckWithRoot(tmpRoot);
    expect(findings.some((f) => f.message.includes("unknownHelper"))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 자기 검증 (dogfooding) — 실제 번들된 templates 에서 violations 없음
// ---------------------------------------------------------------------------

describe("checkHandlebarsTokenValid — 자기 검증 (dogfooding)", () => {
  it("번들된 실제 templates 에서 violations 없음", () => {
    const findings = checkHandlebarsTokenValid();
    expect(findings).toEqual([]);
  });
});
