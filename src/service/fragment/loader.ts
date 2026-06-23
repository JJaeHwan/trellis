import { resolve, sep as pathSep } from "node:path";
import { ExitCode, HarnessError } from "../../common/errors/index.js";
import { resolveResourcesDir } from "../../external/resources-root.js";
import type { Template } from "../../domain/index.js";
import { realFsAdapter, type FsAdapter } from "../../external/fs-adapter.js";
import type {
  AstPatchDecl,
  AstPatchSelector,
  Fragment,
  FragmentMeta,
  PatchDecl,
} from "./types.js";

const META_FILENAME = "meta.json";

function getFragmentsRoot(): string {
  return resolveResourcesDir("templates");
}

function fragmentDir(root: string, playbookId: string, type: string): string {
  return resolve(root, playbookId, "_fragments", type);
}

/**
 * resources/templates/<playbookId>/_fragments/<type>/ 를 읽어 Fragment 를 반환.
 *
 * @throws HarnessError — 디렉토리 없음 / meta.json 없음 / meta.json 파싱 실패
 */
export function loadFragment(
  playbookId: string,
  type: string,
  fs: FsAdapter = realFsAdapter,
): Fragment {
  const root = getFragmentsRoot();
  const dir = fragmentDir(root, playbookId, type);

  if (!fs.exists(dir) || !fs.isDirectory(dir)) {
    throw new HarnessError(
      `unknown fragment: ${playbookId}/${type}`,
      ExitCode.UserInputError,
      `trellis list 로 사용 가능한 fragment 타입을 확인하세요.`,
    );
  }

  // meta.json 읽기
  const metaPath = resolve(dir, META_FILENAME);
  if (!fs.exists(metaPath)) {
    throw new HarnessError(
      `unknown fragment: ${playbookId}/${type}`,
      ExitCode.UserInputError,
      `trellis list 로 사용 가능한 fragment 타입을 확인하세요.`,
    );
  }

  let meta: FragmentMeta;
  try {
    const raw: unknown = JSON.parse(fs.readFile(metaPath));
    meta = parseFragmentMeta(raw, playbookId, type);
  } catch (err) {
    if (err instanceof HarnessError) throw err;
    throw new HarnessError(
      `fragment meta.json invalid: ${playbookId}/${type}`,
      ExitCode.GeneralError,
    );
  }

  // 템플릿 파일 수집 (meta.json 제외)
  const templates = collectTemplates(dir, dir, fs);
  templates.sort((a, b) => a.sourcePath.localeCompare(b.sourcePath));

  return { playbookId, type, meta, templates };
}

function collectTemplates(
  rootDir: string,
  currentDir: string,
  fs: FsAdapter,
): Template[] {
  const result: Template[] = [];
  const entries = fs.listDir(currentDir);
  for (const entry of entries) {
    const fullPath = resolve(currentDir, entry);
    if (fs.isDirectory(fullPath)) {
      result.push(...collectTemplates(rootDir, fullPath, fs));
    } else {
      const rel = fullPath.slice(rootDir.length + 1);
      const sourcePath = pathSep === "/" ? rel : rel.split(pathSep).join("/");
      if (sourcePath === META_FILENAME) continue;
      const content = fs.readFile(fullPath);
      result.push({ sourcePath, content });
    }
  }
  return result;
}

function parseFragmentMeta(raw: unknown, playbookId: string, type: string): FragmentMeta {
  if (
    raw === null ||
    typeof raw !== "object" ||
    Array.isArray(raw)
  ) {
    throw new HarnessError("fragment meta.json invalid: not an object", ExitCode.GeneralError);
  }

  const obj = raw as Record<string, unknown>;

  if (typeof obj["description"] !== "string") {
    throw new HarnessError(
      "fragment meta.json invalid: missing or non-string 'description'",
      ExitCode.GeneralError,
    );
  }

  const dependencies = parseOptionalStringRecord(obj["dependencies"], "dependencies");
  const devDependencies = parseOptionalStringRecord(obj["devDependencies"], "devDependencies");
  const patches = parsePatches(obj["patches"], playbookId, type);
  const astPatches = parseAstPatches(obj["astPatches"], playbookId, type);

  return {
    description: obj["description"],
    ...(dependencies !== undefined && { dependencies }),
    ...(devDependencies !== undefined && { devDependencies }),
    ...(patches !== undefined && { patches }),
    ...(astPatches !== undefined && { astPatches }),
  };
}

function parseOptionalStringRecord(
  value: unknown,
  fieldName: string,
): Readonly<Record<string, string>> | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "object" || Array.isArray(value)) {
    throw new HarnessError(
      `fragment meta.json invalid: '${fieldName}' must be a string record`,
      ExitCode.GeneralError,
    );
  }
  const obj = value as Record<string, unknown>;
  for (const [k, v] of Object.entries(obj)) {
    if (typeof v !== "string") {
      throw new HarnessError(
        `fragment meta.json invalid: '${fieldName}.${k}' must be a string`,
        ExitCode.GeneralError,
      );
    }
  }
  return obj as Record<string, string>;
}

function parsePatches(
  value: unknown,
  playbookId: string,
  type: string,
): readonly PatchDecl[] | undefined {
  if (value === undefined || value === null) return undefined;
  if (!Array.isArray(value)) {
    throw new HarnessError(
      `invalid patch declaration in ${playbookId}/${type}/meta.json: 'patches' must be an array`,
      ExitCode.GeneralError,
    );
  }
  return value.map((item, index) => parsePatchDecl(item, playbookId, type, index));
}

function parsePatchDecl(
  item: unknown,
  playbookId: string,
  type: string,
  index: number,
): PatchDecl {
  const context = `${playbookId}/${type}/meta.json`;

  if (item === null || typeof item !== "object" || Array.isArray(item)) {
    throw new HarnessError(
      `invalid patch declaration in ${context}: item[${index}] must be an object`,
      ExitCode.GeneralError,
    );
  }

  const obj = item as Record<string, unknown>;

  // validate file
  if (typeof obj["file"] !== "string" || obj["file"].length === 0) {
    throw new HarnessError(
      `invalid patch declaration in ${context}: file`,
      ExitCode.GeneralError,
    );
  }
  if (obj["file"].startsWith("/")) {
    throw new HarnessError(
      `invalid patch declaration in ${context}: file`,
      ExitCode.GeneralError,
    );
  }

  // validate slot
  if (typeof obj["slot"] !== "string" || obj["slot"].length === 0) {
    throw new HarnessError(
      `invalid patch declaration in ${context}: slot`,
      ExitCode.GeneralError,
    );
  }

  // validate entryKey
  if (typeof obj["entryKey"] !== "string" || obj["entryKey"].length === 0) {
    throw new HarnessError(
      `invalid patch declaration in ${context}: entryKey`,
      ExitCode.GeneralError,
    );
  }

  // validate content — empty string is allowed but meaningless
  if (typeof obj["content"] !== "string") {
    throw new HarnessError(
      `invalid patch declaration in ${context}: content`,
      ExitCode.GeneralError,
    );
  }

  return {
    file: obj["file"],
    slot: obj["slot"],
    entryKey: obj["entryKey"],
    content: obj["content"],
  };
}

function parseAstPatches(
  value: unknown,
  playbookId: string,
  type: string,
): readonly AstPatchDecl[] | undefined {
  if (value === undefined || value === null) return undefined;
  if (!Array.isArray(value)) {
    throw new HarnessError(
      `invalid astPatch declaration in ${playbookId}/${type}/meta.json: 'astPatches' must be an array`,
      ExitCode.GeneralError,
    );
  }
  return value.map((item, index) =>
    parseAstPatchDecl(item, playbookId, type, index),
  );
}

function parseAstPatchDecl(
  item: unknown,
  playbookId: string,
  type: string,
  index: number,
): AstPatchDecl {
  const context = `${playbookId}/${type}/meta.json`;

  if (item === null || typeof item !== "object" || Array.isArray(item)) {
    throw new HarnessError(
      `invalid astPatch declaration in ${context}: item[${index}] must be an object`,
      ExitCode.GeneralError,
    );
  }

  const obj = item as Record<string, unknown>;

  // file
  if (typeof obj["file"] !== "string" || obj["file"].length === 0) {
    throw new HarnessError(
      `invalid astPatch declaration in ${context}: file`,
      ExitCode.GeneralError,
    );
  }
  if (obj["file"].startsWith("/")) {
    throw new HarnessError(
      `invalid astPatch declaration in ${context}: file`,
      ExitCode.GeneralError,
    );
  }

  // entryKey
  if (typeof obj["entryKey"] !== "string" || obj["entryKey"].length === 0) {
    throw new HarnessError(
      `invalid astPatch declaration in ${context}: entryKey`,
      ExitCode.GeneralError,
    );
  }

  // content (empty allowed but meaningless — keep parity with marker patches)
  if (typeof obj["content"] !== "string") {
    throw new HarnessError(
      `invalid astPatch declaration in ${context}: content`,
      ExitCode.GeneralError,
    );
  }

  // selector
  const selector = parseAstPatchSelector(obj["selector"], context, index);

  return {
    file: obj["file"],
    selector,
    entryKey: obj["entryKey"],
    content: obj["content"],
  };
}

function parseAstPatchSelector(
  value: unknown,
  context: string,
  index: number,
): AstPatchSelector {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new HarnessError(
      `invalid astPatch declaration in ${context}: item[${index}].selector must be an object`,
      ExitCode.GeneralError,
    );
  }

  const obj = value as Record<string, unknown>;
  const selType = obj["type"];

  if (selType === "arrayPush") {
    if (typeof obj["target"] !== "string" || obj["target"].length === 0) {
      throw new HarnessError(
        `invalid astPatch declaration in ${context}: item[${index}].selector.target must be a non-empty string`,
        ExitCode.GeneralError,
      );
    }
    return { type: "arrayPush", target: obj["target"] };
  }

  if (selType === "objectKey") {
    if (typeof obj["target"] !== "string" || obj["target"].length === 0) {
      throw new HarnessError(
        `invalid astPatch declaration in ${context}: item[${index}].selector.target must be a non-empty string`,
        ExitCode.GeneralError,
      );
    }
    if (typeof obj["key"] !== "string" || obj["key"].length === 0) {
      throw new HarnessError(
        `invalid astPatch declaration in ${context}: item[${index}].selector.key must be a non-empty string`,
        ExitCode.GeneralError,
      );
    }
    return { type: "objectKey", target: obj["target"], key: obj["key"] };
  }

  if (selType === "importAdd") {
    if (typeof obj["from"] !== "string" || obj["from"].length === 0) {
      throw new HarnessError(
        `invalid astPatch declaration in ${context}: item[${index}].selector.from must be a non-empty string`,
        ExitCode.GeneralError,
      );
    }
    return { type: "importAdd", from: obj["from"] };
  }

  throw new HarnessError(
    `invalid astPatch declaration in ${context}: item[${index}].selector.type must be one of "arrayPush" | "objectKey" | "importAdd"`,
    ExitCode.GeneralError,
  );
}
