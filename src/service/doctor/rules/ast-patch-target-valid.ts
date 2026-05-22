import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { Node } from "ts-morph";
import {
  findExportedVariable,
  parseSourceFile,
} from "../../fragment/ast-parser.js";
import type { AstPatchSelector } from "../../fragment/types.js";
import type { Finding } from "../types.js";

interface AstPatchDeclShape {
  readonly file: string;
  readonly selector: AstPatchSelector;
  readonly entryKey: string;
  readonly content: string;
}

interface FragmentMetaShape {
  readonly description: string;
  readonly astPatches?: readonly AstPatchDeclShape[];
}

function getTemplatesRoot(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  return resolve(here, "../../../../resources/templates");
}

/**
 * 풀바디 템플릿 트리에서 patch 가 가리키는 파일(.hbs 확장자 포함) 을 찾아 반환한다.
 * 파일이 없으면 undefined.
 */
function findFullBodyFile(
  playbookDir: string,
  relPath: string,
): string | undefined {
  const hbsPath = resolve(playbookDir, `${relPath}.hbs`);
  if (existsSync(hbsPath)) return hbsPath;
  const directPath = resolve(playbookDir, relPath);
  if (existsSync(directPath)) return directPath;
  return undefined;
}

function parseSelector(raw: unknown): AstPatchSelector | undefined {
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) return undefined;
  const obj = raw as Record<string, unknown>;
  const t = obj["type"];
  if (t === "arrayPush" && typeof obj["target"] === "string") {
    return { type: "arrayPush", target: obj["target"] };
  }
  if (
    t === "objectKey" &&
    typeof obj["target"] === "string" &&
    typeof obj["key"] === "string"
  ) {
    return { type: "objectKey", target: obj["target"], key: obj["key"] };
  }
  if (t === "importAdd" && typeof obj["from"] === "string") {
    return { type: "importAdd", from: obj["from"] };
  }
  return undefined;
}

function collectFragmentMetas(
  playbookDir: string,
): Array<{ playbookId: string; type: string; meta: FragmentMetaShape }> {
  const results: Array<{
    playbookId: string;
    type: string;
    meta: FragmentMetaShape;
  }> = [];

  const playbookId = playbookDir.split("/").pop() ?? playbookDir;
  const fragmentsDir = resolve(playbookDir, "_fragments");
  if (!existsSync(fragmentsDir)) return results;

  let fragmentTypes: string[];
  try {
    fragmentTypes = readdirSync(fragmentsDir).filter((entry) =>
      statSync(resolve(fragmentsDir, entry)).isDirectory(),
    );
  } catch {
    return results;
  }

  for (const type of fragmentTypes) {
    const metaPath = resolve(fragmentsDir, type, "meta.json");
    if (!existsSync(metaPath)) continue;

    let raw: unknown;
    try {
      raw = JSON.parse(readFileSync(metaPath, "utf-8")) as unknown;
    } catch {
      continue;
    }
    if (raw === null || typeof raw !== "object" || Array.isArray(raw)) continue;
    const obj = raw as Record<string, unknown>;
    if (typeof obj["description"] !== "string") continue;

    let astPatches: readonly AstPatchDeclShape[] | undefined;
    if (Array.isArray(obj["astPatches"])) {
      const parsed: AstPatchDeclShape[] = [];
      let valid = true;
      for (const item of obj["astPatches"]) {
        if (
          item === null ||
          typeof item !== "object" ||
          typeof (item as Record<string, unknown>)["file"] !== "string"
        ) {
          valid = false;
          break;
        }
        const p = item as Record<string, unknown>;
        const sel = parseSelector(p["selector"]);
        if (sel === undefined) {
          valid = false;
          break;
        }
        parsed.push({
          file: p["file"] as string,
          selector: sel,
          entryKey: typeof p["entryKey"] === "string" ? p["entryKey"] : "",
          content: typeof p["content"] === "string" ? p["content"] : "",
        });
      }
      if (valid) astPatches = parsed;
    }

    results.push({
      playbookId,
      type,
      meta: { description: obj["description"], astPatches },
    });
  }

  return results;
}

/**
 * doctor 규칙: ast-patch-target-valid
 *
 * 각 fragment 의 astPatches[].selector 가 풀바디에서 유효한 타겟을 가리키는지 검증.
 *
 * - 파일 존재 여부 (모든 selector type 공통)
 * - arrayPush.target: export 된 배열 변수인지
 * - objectKey.target: export 된 객체 변수인지
 * - importAdd: file 존재만 확인 (from 은 신규 import 라 검증 불가)
 */
export function checkAstPatchTargetValid(): Finding[] {
  const findings: Finding[] = [];
  const templatesRoot = getTemplatesRoot();

  let playbookDirs: string[];
  try {
    playbookDirs = readdirSync(templatesRoot)
      .filter((entry) => statSync(resolve(templatesRoot, entry)).isDirectory())
      .map((entry) => resolve(templatesRoot, entry));
  } catch {
    return findings;
  }

  for (const playbookDir of playbookDirs) {
    const fragmentMetas = collectFragmentMetas(playbookDir);
    const playbookId = playbookDir.split("/").pop() ?? playbookDir;

    for (const { type, meta } of fragmentMetas) {
      if (!meta.astPatches || meta.astPatches.length === 0) continue;

      for (const patch of meta.astPatches) {
        const fullBodyFile = findFullBodyFile(playbookDir, patch.file);
        if (fullBodyFile === undefined) {
          findings.push({
            ruleId: "ast-patch-target-valid",
            severity: "error",
            message: `${playbookId}/${type}: ${patch.file} (파일 자체 누락)`,
            hint: `resources/templates/${playbookId}/${patch.file}.hbs 를 생성하세요.`,
          });
          continue;
        }

        const sel = patch.selector;
        if (sel.type === "importAdd") {
          // 파일 존재만 확인 — from 은 신규 import 라 검증 불가
          continue;
        }

        // arrayPush / objectKey: 풀바디를 AST 로 파싱해 target 검증
        let content: string;
        try {
          content = readFileSync(fullBodyFile, "utf-8");
        } catch {
          findings.push({
            ruleId: "ast-patch-target-valid",
            severity: "error",
            message: `${playbookId}/${type}: ${patch.file} 읽기 실패`,
          });
          continue;
        }

        let sf;
        try {
          sf = parseSourceFile(content, patch.file);
        } catch {
          findings.push({
            ruleId: "ast-patch-target-valid",
            severity: "error",
            message: `${playbookId}/${type}: ${patch.file} AST 파싱 실패`,
            hint: "풀바디 파일이 유효한 TS/JS 인지 확인하세요.",
          });
          continue;
        }

        const decl = findExportedVariable(sf, sel.target);
        if (decl === undefined) {
          findings.push({
            ruleId: "ast-patch-target-valid",
            severity: "error",
            message: `${playbookId}/${type}: ${patch.file} 에 export 된 변수 '${sel.target}' 없음`,
            hint: `→ ${patch.file} 의 '${sel.target}' 식별자가 export 되는지 확인하세요.`,
          });
          continue;
        }

        const init = decl.getInitializer();
        if (sel.type === "arrayPush") {
          if (init === undefined || !Node.isArrayLiteralExpression(init)) {
            findings.push({
              ruleId: "ast-patch-target-valid",
              severity: "error",
              message: `${playbookId}/${type}: ${patch.file} 의 '${sel.target}' 가 배열 리터럴이 아닙니다`,
              hint: `→ '${sel.target}' 를 배열 리터럴 (\`[...]\`) 형태로 export 하세요.`,
            });
          }
        } else if (sel.type === "objectKey") {
          if (init === undefined || !Node.isObjectLiteralExpression(init)) {
            findings.push({
              ruleId: "ast-patch-target-valid",
              severity: "error",
              message: `${playbookId}/${type}: ${patch.file} 의 '${sel.target}' 가 객체 리터럴이 아닙니다`,
              hint: `→ '${sel.target}' 를 객체 리터럴 (\`{...}\`) 형태로 export 하세요.`,
            });
          }
        }
      }
    }
  }

  return findings;
}
