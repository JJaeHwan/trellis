import { resolve } from "node:path";
import { ExitCode, HarnessError } from "../../common/errors/index.js";
import { realFsAdapter, type FsAdapter } from "../../external/fs-adapter.js";
import { loadSpec } from "../../external/spec-loader.js";
import type { AstPatchDecl } from "../fragment/types.js";
import { applyManifest } from "./applier.js";
import { loadManifest } from "./manifest-loader.js";
import { realGitChecker, type GitChecker } from "./git-status.js";

export interface UpgradeOptions {
  readonly dryRun?: boolean;
  readonly json?: boolean;
  readonly force?: boolean;
}

export interface UpgradeResult {
  readonly fromVersion: string;
  readonly toVersion: string;
  readonly steps: readonly { from: string; to: string }[];
  readonly slotsAdded: readonly { file: string; slot: string }[];
  readonly slotsSkipped: readonly { file: string; slot: string }[];
  readonly filesAdded: readonly string[];
  readonly filesSkipped: readonly string[];
  readonly astPatchesApplied: readonly AstPatchDecl[];
  readonly astPatchesSkipped: readonly AstPatchDecl[];
  readonly dryRun: boolean;
}

interface Semver {
  major: number;
  minor: number;
  patch: number;
}

function parseSemver(version: string): Semver | undefined {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(version);
  if (!match) return undefined;
  return {
    major: parseInt(match[1]!, 10),
    minor: parseInt(match[2]!, 10),
    patch: parseInt(match[3]!, 10),
  };
}

/**
 * 프로젝트를 현재 trellis 버전에 맞게 upgrade.
 */
export function runUpgrade(
  projectDir: string,
  currentTrellisVersion: string,
  options: UpgradeOptions = {},
  fs: FsAdapter = realFsAdapter,
  gitChecker: GitChecker = realGitChecker,
): UpgradeResult {
  // 1. spec.json 확인
  const spec = loadSpec(projectDir, fs);
  if (spec === undefined) {
    throw new HarnessError(
      "이 디렉토리는 trellis 프로젝트가 아닙니다 (.trellis/spec.json 없음).",
      ExitCode.UserInputError,
      "trellis new <디렉토리> 로 프로젝트를 먼저 생성하세요.",
    );
  }

  // 2. git working tree clean 검사 (--force / --dry-run 우회)
  if (!options.force && !options.dryRun && !gitChecker(projectDir)) {
    throw new HarnessError(
      "git working tree 가 dirty 합니다. upgrade 전 변경 사항을 커밋하거나 stash 하세요.",
      ExitCode.UserInputError,
      "git stash --include-untracked 또는 git commit 후 다시 시도하세요. --force 로 우회 가능합니다.",
    );
  }

  // 3. 버전 비교
  const specSemver = parseSemver(spec.trellisVersion);
  const curSemver = parseSemver(currentTrellisVersion);
  if (specSemver === undefined || curSemver === undefined) {
    throw new HarnessError(
      `malformed version string: spec="${spec.trellisVersion}", current="${currentTrellisVersion}"`,
      ExitCode.GeneralError,
    );
  }

  if (specSemver.major !== curSemver.major) {
    throw new HarnessError(
      `major version mismatch: spec ${spec.trellisVersion} vs current ${currentTrellisVersion}`,
      ExitCode.UserInputError,
      "major 버전 점프는 자동 마이그레이션을 지원하지 않습니다. 수동 마이그레이션이 필요합니다.",
    );
  }

  if (specSemver.minor === curSemver.minor) {
    // 이미 최신
    return {
      fromVersion: spec.trellisVersion,
      toVersion: currentTrellisVersion,
      steps: [],
      slotsAdded: [],
      slotsSkipped: [],
      filesAdded: [],
      filesSkipped: [],
      astPatchesApplied: [],
      astPatchesSkipped: [],
      dryRun: options.dryRun ?? false,
    };
  }

  if (specSemver.minor > curSemver.minor) {
    throw new HarnessError(
      `프로젝트가 더 새로운 trellis (${spec.trellisVersion}) 로 만들어졌습니다.`,
      ExitCode.UserInputError,
      "trellis 본체를 최신으로 업데이트하세요 (npm i -g @woghks096/trellis).",
    );
  }

  // 4. manifest 순차 적용 (단계적 — spec.minor → cur.minor)
  const steps: { from: string; to: string }[] = [];
  const allSlotsAdded: { file: string; slot: string }[] = [];
  const allSlotsSkipped: { file: string; slot: string }[] = [];
  const allFilesAdded: string[] = [];
  const allFilesSkipped: string[] = [];
  const allAstPatchesApplied: AstPatchDecl[] = [];
  const allAstPatchesSkipped: AstPatchDecl[] = [];

  let cursorMinor = specSemver.minor;
  while (cursorMinor < curSemver.minor) {
    const fromV = `${specSemver.major}.${cursorMinor}.0`;
    const toV = `${specSemver.major}.${cursorMinor + 1}.0`;
    const manifest = loadManifest(fromV, toV, fs);
    steps.push({ from: fromV, to: toV });

    const result = applyManifest(
      manifest,
      spec.playbookId,
      projectDir,
      fs,
      options.dryRun ?? false,
    );
    allSlotsAdded.push(...result.slotsAdded);
    allSlotsSkipped.push(...result.slotsSkipped);
    allFilesAdded.push(...result.filesAdded);
    allFilesSkipped.push(...result.filesSkipped);
    allAstPatchesApplied.push(...result.astPatchesApplied);
    allAstPatchesSkipped.push(...result.astPatchesSkipped);

    cursorMinor++;
  }

  // 5. spec.json 갱신 (dry-run 이 아닐 때만)
  if (!(options.dryRun ?? false)) {
    const newSpec = { ...spec, trellisVersion: currentTrellisVersion };
    fs.writeFile(resolve(projectDir, ".trellis/spec.json"), JSON.stringify(newSpec, null, 2));
  }

  return {
    fromVersion: spec.trellisVersion,
    toVersion: currentTrellisVersion,
    steps,
    slotsAdded: allSlotsAdded,
    slotsSkipped: allSlotsSkipped,
    filesAdded: allFilesAdded,
    filesSkipped: allFilesSkipped,
    astPatchesApplied: allAstPatchesApplied,
    astPatchesSkipped: allAstPatchesSkipped,
    dryRun: options.dryRun ?? false,
  };
}

export { loadManifest, listManifests } from "./manifest-loader.js";
export type {
  MigrationManifest,
  PlaybookMigration,
  AddSlotAction,
  AddFileAction,
} from "./types.js";
