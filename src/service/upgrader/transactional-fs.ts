import type { FsAdapter } from "../../external/fs-adapter.js";

export interface TransactionalFs extends FsAdapter {
  /** 기록된 모든 쓰기를 원래 상태로 되돌린다 (upgrade 중간 실패 시). */
  rollback(): void;
}

/**
 * writeFile 호출을 기록하는 FsAdapter 래퍼.
 *
 * 각 경로의 "최초 쓰기 직전" 상태(내용 또는 부재)를 백업하고, rollback() 시
 * 원상 복구한다 — 없던 파일은 삭제, 있던 파일은 원래 내용으로 되돌린다.
 * 멀티스텝 upgrade 가 중간 step 에서 throw 해도 부분 적용 상태로 남지 않게 한다.
 *
 * ensureDir 로 생긴 빈 디렉토리는 무해하므로 정리하지 않는다 (파일 내용/존재만 복구).
 */
export function createTransactionalFs(inner: FsAdapter): TransactionalFs {
  const backups = new Map<string, string | null>(); // null = 쓰기 전 파일 없음

  return {
    exists: (p) => inner.exists(p),
    isDirectory: (p) => inner.isDirectory(p),
    isEmptyDirectory: (p) => inner.isEmptyDirectory(p),
    ensureDir: (p) => inner.ensureDir(p),
    readFile: (p) => inner.readFile(p),
    listDir: (p) => inner.listDir(p),
    deleteFile: (p) => inner.deleteFile(p),
    writeFile(path, content) {
      if (!backups.has(path)) {
        backups.set(path, inner.exists(path) ? inner.readFile(path) : null);
      }
      inner.writeFile(path, content);
    },
    rollback() {
      for (const [path, original] of backups) {
        if (original === null) {
          if (inner.exists(path)) inner.deleteFile(path);
        } else {
          inner.writeFile(path, original);
        }
      }
      backups.clear();
    },
  };
}
