import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { realFsAdapter, type FsAdapter } from "./fs-adapter.js";

const FRAGMENTS_DIR = "_fragments";

function getTemplatesRoot(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  return resolve(here, "../../resources/templates");
}

/**
 * `resources/templates/<playbookId>/_fragments/` 아래의 타입 디렉토리 목록을 반환.
 *
 * 해당 플레이북에 _fragments 디렉토리가 없거나 비어있으면 빈 배열 반환.
 */
export function listFragmentTypes(
  playbookId: string,
  fs: FsAdapter = realFsAdapter,
): readonly string[] {
  const root = getTemplatesRoot();
  const fragmentsDir = resolve(root, playbookId, FRAGMENTS_DIR);

  if (!fs.exists(fragmentsDir) || !fs.isDirectory(fragmentsDir)) {
    return [];
  }

  const entries = fs.listDir(fragmentsDir);
  return entries.filter((entry) => {
    const fullPath = resolve(fragmentsDir, entry);
    return fs.isDirectory(fullPath);
  });
}
