import { resolve } from "node:path";
import { ExitCode, HarnessError } from "../../common/errors/index.js";
import { realFsAdapter, type FsAdapter } from "../../external/fs-adapter.js";
import type { FragmentMeta } from "./types.js";

/**
 * patchPackageJson 의 결과.
 *
 * - added: 새로 추가된 패키지명 목록
 * - skipped: 이미 같은 버전으로 존재해 skip 된 패키지명 목록
 * - conflicts: 이름은 같지만 버전이 달라 기존 버전을 유지한 항목 목록
 */
export interface PatchResult {
  added: string[];
  skipped: string[];
  conflicts: Array<{ name: string; existing: string; requested: string }>;
}

type PackageJsonDeps = Record<string, string>;

interface PackageJsonLike {
  dependencies?: PackageJsonDeps;
  devDependencies?: PackageJsonDeps;
  [key: string]: unknown;
}

/**
 * 대상 프로젝트의 package.json 에 fragment 의 dependencies/devDependencies 를 merge 한다.
 *
 * 규칙:
 * - 같은 이름이 없으면 추가
 * - 같은 이름 + 같은 버전 → skip (no-op)
 * - 같은 이름 + 다른 버전 → 기존 버전 유지, conflicts 에 기록
 * - dependencies ↔ devDependencies 교차 이동 금지 (각 섹션에서만 처리)
 */
export function patchPackageJson(
  projectDir: string,
  meta: FragmentMeta,
  fs: FsAdapter = realFsAdapter,
): PatchResult {
  const result: PatchResult = { added: [], skipped: [], conflicts: [] };

  // meta 에 deps 없으면 no-op
  if (
    (meta.dependencies === undefined || Object.keys(meta.dependencies).length === 0) &&
    (meta.devDependencies === undefined || Object.keys(meta.devDependencies).length === 0)
  ) {
    return result;
  }

  const pkgPath = resolve(projectDir, "package.json");

  if (!fs.exists(pkgPath)) {
    throw new HarnessError(
      `package.json not found at ${pkgPath}`,
      ExitCode.ValidationFailure,
    );
  }

  let raw: string;
  try {
    raw = fs.readFile(pkgPath);
  } catch {
    throw new HarnessError(
      `package.json not found at ${pkgPath}`,
      ExitCode.ValidationFailure,
    );
  }

  let pkg: PackageJsonLike;
  try {
    pkg = JSON.parse(raw) as PackageJsonLike;
  } catch {
    throw new HarnessError(
      `package.json 파싱 실패: ${pkgPath}`,
      ExitCode.GeneralError,
    );
  }

  if (meta.dependencies !== undefined) {
    if (pkg.dependencies === undefined) {
      pkg.dependencies = {};
    }
    mergeDeps(meta.dependencies, pkg.dependencies, result);
  }

  if (meta.devDependencies !== undefined) {
    if (pkg.devDependencies === undefined) {
      pkg.devDependencies = {};
    }
    mergeDeps(meta.devDependencies, pkg.devDependencies, result);
  }

  fs.writeFile(pkgPath, JSON.stringify(pkg, null, 2) + "\n");

  return result;
}

function mergeDeps(
  source: Readonly<Record<string, string>>,
  target: PackageJsonDeps,
  result: PatchResult,
): void {
  for (const [name, version] of Object.entries(source)) {
    if (!(name in target)) {
      target[name] = version;
      result.added.push(name);
    } else if (target[name] === version) {
      result.skipped.push(name);
    } else {
      result.conflicts.push({
        name,
        existing: target[name] as string,
        requested: version,
      });
    }
  }
}
