import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
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
  readFile(path: string): string;
  /** 디렉토리 내 항목 이름 목록 반환 (재귀 X). */
  listDir(path: string): readonly string[];
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
  readFile(path) {
    return readFileSync(path, "utf-8");
  },
  listDir(path) {
    return readdirSync(path);
  },
};
