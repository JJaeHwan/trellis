import { resolve } from "node:path";
import { realFsAdapter, type FsAdapter } from "../../external/fs-adapter.js";
import type { VirtualTree } from "../../domain/index.js";

/**
 * removeFiles 의 결과.
 *
 * - removed: 실제 삭제된 파일 경로 목록
 * - notFound: 프로젝트에 존재하지 않아 skip 된 파일 경로 목록
 * - userModified: 사용자가 수정한 것으로 감지되어 삭제 보류된 파일 경로 목록
 */
export interface UnWriteResult {
  readonly removed: readonly string[];
  readonly notFound: readonly string[];
  readonly userModified: readonly string[];
}

/**
 * VirtualTree 에 선언된 파일들을 프로젝트 디렉토리에서 삭제한다.
 *
 * 알고리즘:
 * 1. 각 file 마다 절대 경로 = resolve(projectDir, file.path)
 * 2. 존재 안 함 → notFound push, continue
 * 3. 존재 + fs.readFile(absPath) === file.content → fs.deleteFile, removed push
 * 4. 존재 + 내용 다름:
 *    - options.force === true → fs.deleteFile, removed push
 *    - 아니면 → userModified push (삭제 안 함)
 */
export function removeFiles(
  projectDir: string,
  tree: VirtualTree,
  fs: FsAdapter = realFsAdapter,
  options: { force?: boolean } = {},
): UnWriteResult {
  const removed: string[] = [];
  const notFound: string[] = [];
  const userModified: string[] = [];

  for (const file of tree) {
    const absPath = resolve(projectDir, file.path);

    if (!fs.exists(absPath)) {
      notFound.push(file.path);
      continue;
    }

    const currentContent = fs.readFile(absPath);
    if (currentContent === file.content) {
      fs.deleteFile(absPath);
      removed.push(file.path);
    } else if (options.force === true) {
      fs.deleteFile(absPath);
      removed.push(file.path);
    } else {
      userModified.push(file.path);
    }
  }

  return { removed, notFound, userModified };
}
