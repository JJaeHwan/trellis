import { resolve } from "node:path";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import type { Finding } from "../types.js";
import { resolveResourcesDir } from "../../../external/resources-root.js";

// ---------------------------------------------------------------------------
// Allowed keys per context type
// ---------------------------------------------------------------------------

/**
 * 풀바디 템플릿에서 허용된 컨텍스트 키.
 * generator.ts buildContext() 의 GeneratorContext 기반.
 */
const FULLBODY_KEYS: ReadonlySet<string> = new Set([
  "projectName",
  "projectNameKebab",
  "projectNamePascal",
  "projectNameCamel",
  "projectNameSnake",
  "playbookId",
  "year",
  "generatedAt",
  "trellisVersion",
  "answers",
]);

/**
 * fragment 템플릿에서 허용된 컨텍스트 키.
 * renderer.ts buildFragmentContext() 의 FragmentContext 기반.
 * extras (spec.placeholders) 는 동적이므로 고정 키만 열거.
 */
const FRAGMENT_KEYS: ReadonlySet<string> = new Set([
  "name",
  "namePascal",
  "nameKebab",
  "nameCamel",
  "nameSnake",
  // spec.placeholders 를 통해 전달되는 공통 키
  "projectName",
  "projectNameKebab",
  "projectNamePascal",
  "projectNameCamel",
  "projectNameSnake",
]);

/**
 * handlebars-helpers.ts 에 등록된 헬퍼 이름.
 */
const HELPERS: ReadonlySet<string> = new Set([
  "kebab",
  "pascal",
  "camel",
  "snake",
  "eq",
]);

/**
 * Handlebars 내장 블록 헬퍼 / 제어 흐름 키워드 — 검증 대상 X.
 */
const BUILTIN_BLOCK_HELPERS: ReadonlySet<string> = new Set([
  "if",
  "unless",
  "each",
  "with",
  "lookup",
  "log",
  "else",
]);

// ---------------------------------------------------------------------------
// Path helpers
// ---------------------------------------------------------------------------

function getTemplatesRoot(): string {
  return resolveResourcesDir("templates");
}

// ---------------------------------------------------------------------------
// Token extraction
// ---------------------------------------------------------------------------

/**
 * .hbs 파일 내용에서 Handlebars 토큰을 추출한다.
 *
 * 처리 규칙:
 * - `{{#helper ...}}`, `{{/helper}}`, `{{else}}` — 블록 헬퍼/제어 흐름, 추출 제외
 * - `{{helper arg}}` — helper 이름 + 첫 번째 arg 추출
 * - `{{variable}}` — 단순 변수 참조, 추출
 * - `{{{variable}}}` (triple-stash) — 동일하게 처리
 * - `{{! comment}}` — 주석, 제외
 * - `{{!-- comment --}}` — 블록 주석, 제외
 *
 * 반환: 토큰 정보 배열 { name, line, isHelper, helperArg }
 */
interface TokenRef {
  readonly name: string;
  readonly line: number;
  /** true 이면 `{{helper arg}}` 패턴 — name 이 helper, helperArg 가 인수 */
  readonly isHelper: boolean;
  readonly helperArg: string | undefined;
}

export function extractTokens(content: string): TokenRef[] {
  const results: TokenRef[] = [];
  const lines = content.split("\n");

  for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
    const line = lines[lineIdx]!;
    const lineNum = lineIdx + 1;

    // Match all {{ ... }} and {{{ ... }}} expressions in this line
    // Use a regex that handles both triple and double stash
    // Pattern: {{{?  content  }}}?
    const TOKEN_RE = /\{\{\{?([\s\S]*?)\}\}\}?/g;
    let match: RegExpExecArray | null;

    while ((match = TOKEN_RE.exec(line)) !== null) {
      const inner = match[1]!.trim();

      // Skip comments: {{! ... }} or {{!-- ... --}}
      if (inner.startsWith("!")) continue;

      // Skip block open: {{#helper}} or {{^helper}}
      if (inner.startsWith("#") || inner.startsWith("^")) {
        // Extract the helper name after #/^
        const blockInner = inner.slice(1).trim();
        const parts = blockInner.split(/\s+/);
        const helperName = parts[0] ?? "";
        if (helperName && !BUILTIN_BLOCK_HELPERS.has(helperName)) {
          // e.g. {{#each items}} — "each" is builtin, "items" would need checking
          // but for block helpers the first token is the helper name
          // We skip built-in helpers; custom block helpers are uncommon
        }
        // For {{#each items}}, the iteration variable "items" is a context key
        if (
          helperName.toLowerCase() === "each" ||
          helperName.toLowerCase() === "with"
        ) {
          const iterVar = parts[1];
          if (iterVar && /^\w+$/.test(iterVar)) {
            results.push({
              name: iterVar,
              line: lineNum,
              isHelper: false,
              helperArg: undefined,
            });
          }
        }
        continue;
      }

      // Skip block close: {{/helper}}
      if (inner.startsWith("/")) continue;

      // Skip "else"
      if (inner === "else") continue;

      // Now parse the remaining expression: could be "variable" or "helper arg [arg2...]"
      const parts = inner.split(/\s+/).filter((p) => p.length > 0);
      if (parts.length === 0) continue;

      const firstName = parts[0]!;

      if (parts.length === 1) {
        // Simple variable reference: {{variable}}
        // Skip if it's a builtin
        if (BUILTIN_BLOCK_HELPERS.has(firstName)) continue;
        results.push({
          name: firstName,
          line: lineNum,
          isHelper: false,
          helperArg: undefined,
        });
      } else {
        // Helper call: {{helper arg [arg2...]}}
        // firstName is the helper, parts[1] is the first argument (context key)
        const firstArg = parts[1]!;
        results.push({
          name: firstName,
          line: lineNum,
          isHelper: true,
          helperArg: /^\w+$/.test(firstArg) ? firstArg : undefined,
        });
      }
    }
  }

  return results;
}

// ---------------------------------------------------------------------------
// File traversal
// ---------------------------------------------------------------------------

/**
 * 디렉토리를 재귀 순회하여 .hbs 파일 경로를 모두 반환한다.
 */
function collectHbsFiles(dir: string): string[] {
  const results: string[] = [];
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return results;
  }
  for (const entry of entries) {
    const fullPath = resolve(dir, entry);
    let stat: ReturnType<typeof statSync>;
    try {
      stat = statSync(fullPath);
    } catch {
      continue;
    }
    if (stat.isDirectory()) {
      results.push(...collectHbsFiles(fullPath));
    } else if (entry.endsWith(".hbs")) {
      results.push(fullPath);
    }
  }
  return results;
}

/**
 * 파일 경로が _fragments/ ディレクトリ配下かを判断する.
 * パス区切り文字に依存しないよう正規化して判断.
 */
function isFragmentFile(filePath: string): boolean {
  // Normalize to forward slashes for consistent matching
  return filePath.replace(/\\/g, "/").includes("/_fragments/");
}

// ---------------------------------------------------------------------------
// Main rule
// ---------------------------------------------------------------------------

/**
 * doctor 규칙: handlebars-token-valid
 *
 * resources/templates/ 하위 모든 .hbs 파일을 순회하여,
 * 파일 내에 사용된 {{token}} 이 해당 컨텍스트에 정의되어 있는지 검사한다.
 *
 * - _fragments/ 안 → FragmentContext 허용 키 검증
 * - 그 외 풀바디 → GeneratorContext 허용 키 검증
 */
export function checkHandlebarsTokenValid(): Finding[] {
  const findings: Finding[] = [];
  const templatesRoot = getTemplatesRoot();

  if (!existsSync(templatesRoot)) {
    return findings;
  }

  // Collect all .hbs files
  const hbsFiles = collectHbsFiles(templatesRoot);

  for (const filePath of hbsFiles) {
    const isFragment = isFragmentFile(filePath);
    const allowedKeys = isFragment ? FRAGMENT_KEYS : FULLBODY_KEYS;

    // Compute relative path for display (relative to templatesRoot)
    const relPath = filePath.slice(templatesRoot.length + 1);
    // Extract playbook id (first path segment)
    const firstSlash = relPath.indexOf("/");
    const playbookId = firstSlash >= 0 ? relPath.slice(0, firstSlash) : relPath;
    const fileRelToPlaybook = firstSlash >= 0 ? relPath.slice(firstSlash + 1) : relPath;

    let content: string;
    try {
      content = readFileSync(filePath, "utf-8");
    } catch {
      findings.push({
        ruleId: "handlebars-token-valid",
        severity: "error",
        message: `${playbookId}/${fileRelToPlaybook}: 파일 읽기 실패`,
      });
      continue;
    }

    const tokens = extractTokens(content);

    for (const token of tokens) {
      if (token.isHelper) {
        // Validate helper name
        if (!HELPERS.has(token.name) && !BUILTIN_BLOCK_HELPERS.has(token.name)) {
          findings.push({
            ruleId: "handlebars-token-valid",
            severity: "error",
            message: `${playbookId}/${fileRelToPlaybook}: 알 수 없는 헬퍼 '{{${token.name} ...}}' (line ${token.line})`,
            hint: `허용된 헬퍼: ${[...HELPERS].join(", ")}`,
          });
        }
        // Validate helper argument (context key)
        if (token.helperArg !== undefined) {
          if (!allowedKeys.has(token.helperArg) && !BUILTIN_BLOCK_HELPERS.has(token.helperArg)) {
            findings.push({
              ruleId: "handlebars-token-valid",
              severity: "error",
              message: `${playbookId}/${fileRelToPlaybook}: 알 수 없는 토큰 '{{${token.name} ${token.helperArg}}}' 의 인수 '${token.helperArg}' (line ${token.line})`,
              hint: `허용된 컨텍스트 키: ${[...allowedKeys].join(", ")}`,
            });
          }
        }
      } else {
        // Simple variable: validate against allowed keys
        if (!allowedKeys.has(token.name) && !BUILTIN_BLOCK_HELPERS.has(token.name)) {
          findings.push({
            ruleId: "handlebars-token-valid",
            severity: "error",
            message: `${playbookId}/${fileRelToPlaybook}: 알 수 없는 토큰 '{{${token.name}}}' (line ${token.line})`,
            hint: `허용된 컨텍스트 키: ${[...allowedKeys].join(", ")}`,
          });
        }
      }
    }
  }

  return findings;
}
