import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import type { Finding } from "../types.js";

interface PatchDeclShape {
  readonly file: string;
  readonly slot: string;
  readonly entryKey: string;
  readonly content: string;
}

interface FragmentMetaShape {
  readonly description: string;
  readonly patches?: readonly PatchDeclShape[];
}

/**
 * 번들된 resources/templates 루트 경로를 반환한다.
 * (빌드 후 dist/ 에서도 동작하도록 import.meta.url 기준)
 */
function getTemplatesRoot(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  // src/service/doctor/rules/ → resources/templates/
  return resolve(here, "../../../../resources/templates");
}

/**
 * 주어진 파일 내용에서 block-style marker 가 존재하는지 확인한다.
 * marker 형식: // trellis:slot:<slotName>:start  / :end
 */
function hasStartMarker(content: string, slotName: string): boolean {
  return content.includes(`// trellis:slot:${slotName}:start`);
}

function hasEndMarker(content: string, slotName: string): boolean {
  return content.includes(`// trellis:slot:${slotName}:end`);
}

/**
 * 플레이북 디렉토리 아래 _fragments/<type>/meta.json 을 모두 수집한다.
 */
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

  if (!existsSync(fragmentsDir)) {
    return results;
  }

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

    let patches: readonly PatchDeclShape[] | undefined;
    if (Array.isArray(obj["patches"])) {
      const parsed: PatchDeclShape[] = [];
      let valid = true;
      for (const item of obj["patches"]) {
        if (
          item === null ||
          typeof item !== "object" ||
          typeof (item as Record<string, unknown>)["file"] !== "string" ||
          typeof (item as Record<string, unknown>)["slot"] !== "string"
        ) {
          valid = false;
          break;
        }
        const p = item as Record<string, unknown>;
        parsed.push({
          file: p["file"] as string,
          slot: p["slot"] as string,
          entryKey: typeof p["entryKey"] === "string" ? p["entryKey"] : "",
          content: typeof p["content"] === "string" ? p["content"] : "",
        });
      }
      if (valid) patches = parsed;
    }

    results.push({
      playbookId,
      type,
      meta: {
        description: obj["description"],
        patches,
      },
    });
  }

  return results;
}

/**
 * 풀바디 템플릿 트리에서 patch 가 가리키는 파일(.hbs 확장자 포함) 을 찾아 반환한다.
 * 파일이 없으면 undefined.
 */
function findFullBodyFile(
  playbookDir: string,
  relPath: string,
): string | undefined {
  // 풀바디 파일은 .hbs 확장자로 저장됨
  const hbsPath = resolve(playbookDir, `${relPath}.hbs`);
  if (existsSync(hbsPath)) return hbsPath;

  // .hbs 없이 직접 존재하는 경우도 허용
  const directPath = resolve(playbookDir, relPath);
  if (existsSync(directPath)) return directPath;

  return undefined;
}

/**
 * doctor 규칙: patch-marker-presence
 *
 * 각 플레이북의 fragment meta.json 에 선언된 patches 를 검사하여,
 * 풀바디 템플릿에 해당 slot 의 :start / :end marker 가 존재하는지 확인한다.
 */
export function checkPatchMarkerPresence(): Finding[] {
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
      if (!meta.patches || meta.patches.length === 0) continue;

      for (const patch of meta.patches) {
        const fullBodyFile = findFullBodyFile(playbookDir, patch.file);

        if (fullBodyFile === undefined) {
          findings.push({
            ruleId: "patch-marker-presence",
            severity: "error",
            message: `${playbookId}/${type}: ${patch.file} (파일 자체 누락)`,
            hint: `resources/templates/${playbookId}/${patch.file}.hbs 를 생성하고 slot '${patch.slot}' marker 를 추가하세요.`,
          });
          continue;
        }

        let content: string;
        try {
          content = readFileSync(fullBodyFile, "utf-8");
        } catch {
          findings.push({
            ruleId: "patch-marker-presence",
            severity: "error",
            message: `${playbookId}/${type}: ${patch.file} 읽기 실패`,
          });
          continue;
        }

        if (!hasStartMarker(content, patch.slot)) {
          findings.push({
            ruleId: "patch-marker-presence",
            severity: "error",
            message: `${playbookId}/${type}: ${patch.file} 에 slot '${patch.slot}' 의 :start marker 누락`,
            hint: `// trellis:slot:${patch.slot}:start 를 추가하세요.`,
          });
        }

        if (!hasEndMarker(content, patch.slot)) {
          findings.push({
            ruleId: "patch-marker-presence",
            severity: "error",
            message: `${playbookId}/${type}: ${patch.file} 에 slot '${patch.slot}' 의 :end marker 누락`,
            hint: `// trellis:slot:${patch.slot}:end 를 추가하세요.`,
          });
        }
      }
    }
  }

  return findings;
}
