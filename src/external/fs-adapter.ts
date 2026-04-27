import {
  existsSync,
  mkdirSync,
  readdirSync,
  statSync,
  writeFileSync,
} from "node:fs";

/**
 * 파일 시스템 추상화 — 테스트에서 in-memory fake 로 대체 가능.
 */
export interface FsAdapter {
  exists(path: string): boolean;
  isDirectory(path: string): boolean;
  isEmptyDirectory(path: string): boolean;
  ensureDir(path: string): void;
  writeFile(path: string, content: string): void;
}

export const realFsAdapter: FsAdapter = {
  exists(path) {
    return existsSync(path);
  },
  isDirectory(path) {
    return existsSync(path) && statSync(path).isDirectory();
  },
  isEmptyDirectory(path) {
    if (!existsSync(path)) return false;
    if (!statSync(path).isDirectory()) return false;
    return readdirSync(path).length === 0;
  },
  ensureDir(path) {
    mkdirSync(path, { recursive: true });
  },
  writeFile(path, content) {
    writeFileSync(path, content, "utf-8");
  },
};
