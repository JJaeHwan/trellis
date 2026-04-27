import { dirname, isAbsolute, resolve } from "node:path";
import { ExitCode, HarnessError } from "../common/errors/index.js";
import type { VirtualTree } from "../domain/index.js";
import { realFsAdapter, type FsAdapter } from "./fs-adapter.js";

export interface WriteOptions {
  readonly force?: boolean;
}

/**
 * VirtualTree 를 targetDir 아래에 실제 파일 시스템으로 쓴다.
 *
 * 사용자 작업 보호:
 * - targetDir 가 일반 파일 → 에러
 * - targetDir 가 비어있지 않은 디렉토리 + force=false → 에러
 * - 그 외 정상 생성
 */
export function flush(
  tree: VirtualTree,
  targetDir: string,
  options: WriteOptions = {},
  fs: FsAdapter = realFsAdapter,
): void {
  const absDir = isAbsolute(targetDir)
    ? targetDir
    : resolve(process.cwd(), targetDir);

  if (fs.exists(absDir)) {
    if (!fs.isDirectory(absDir)) {
      throw new HarnessError(
        `대상 경로가 파일입니다: ${absDir}`,
        ExitCode.UserInputError,
      );
    }
    if (!fs.isEmptyDirectory(absDir) && !options.force) {
      throw new HarnessError(
        `디렉토리가 비어있지 않습니다: ${absDir}. --force 로 덮어쓰기를 허용하세요.`,
        ExitCode.UserInputError,
      );
    }
  }

  fs.ensureDir(absDir);

  for (const file of tree) {
    const filePath = resolve(absDir, file.path);
    fs.ensureDir(dirname(filePath));
    fs.writeFile(filePath, file.content);
  }
}
