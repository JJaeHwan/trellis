import { execSync } from "node:child_process";

/**
 * git working tree 가 clean 인지 검사.
 * - git 저장소가 아니면 true (검사 우회)
 * - dirty 면 false
 */
export function isGitWorkingTreeClean(projectDir: string): boolean {
  try {
    execSync("git rev-parse --is-inside-work-tree", { cwd: projectDir, stdio: "ignore" });
  } catch {
    return true; // git 저장소가 아니면 검사 통과
  }

  try {
    const result = execSync("git status --porcelain", { cwd: projectDir, encoding: "utf8" });
    return result.trim().length === 0;
  } catch {
    return true; // git 실행 실패 시 통과 (edge case)
  }
}

export type GitChecker = (projectDir: string) => boolean;
export const realGitChecker: GitChecker = isGitWorkingTreeClean;
