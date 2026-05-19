import { dirname, resolve, sep as pathSep } from "node:path";
import { fileURLToPath } from "node:url";
import { ExitCode, HarnessError } from "../../common/errors/index.js";
import type { Template } from "../../domain/index.js";
import { realFsAdapter, type FsAdapter } from "../../external/fs-adapter.js";
import type { Fragment, FragmentMeta } from "./types.js";

const META_FILENAME = "meta.json";

function getFragmentsRoot(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  return resolve(here, "../../../resources/templates");
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
    );
  }

  // meta.json 읽기
  const metaPath = resolve(dir, META_FILENAME);
  if (!fs.exists(metaPath)) {
    throw new HarnessError(
      `unknown fragment: ${playbookId}/${type}`,
      ExitCode.UserInputError,
    );
  }

  let meta: FragmentMeta;
  try {
    const raw: unknown = JSON.parse(fs.readFile(metaPath));
    meta = parseFragmentMeta(raw);
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

function parseFragmentMeta(raw: unknown): FragmentMeta {
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

  return {
    description: obj["description"],
    ...(dependencies !== undefined && { dependencies }),
    ...(devDependencies !== undefined && { devDependencies }),
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
