import type { Command } from "commander";
import { ExitCode, HarnessError } from "../common/errors/index.js";
import { runUpgrade, type UpgradeOptions, type UpgradeResult } from "../service/upgrader/index.js";
import { realFsAdapter, type FsAdapter } from "../external/fs-adapter.js";

// 현재 trellis 버전 — release-please extra-files 로 자동 동기화
const TRELLIS_VERSION = "0.12.1"; // x-release-please-version

interface CliOptions {
  dryRun?: boolean;
  json?: boolean;
  force?: boolean;
}

export type UpgradeJsonResult = {
  readonly ok: boolean;
  readonly command: "upgrade";
  readonly fromVersion?: string;
  readonly toVersion?: string;
  readonly steps?: readonly { from: string; to: string }[];
  readonly slotsAdded?: readonly { file: string; slot: string }[];
  readonly slotsSkipped?: readonly { file: string; slot: string }[];
  readonly filesAdded?: readonly string[];
  readonly filesSkipped?: readonly string[];
  readonly dryRun?: boolean;
  readonly error?: { code: number; message: string; hint?: string };
};

export function registerUpgradeCommand(program: Command): void {
  program
    .command("upgrade [targetDir]")
    .description(
      "현재 프로젝트를 최신 trellis 버전에 맞게 마이그레이션 (신규 slot 삽입 + spec.trellisVersion 갱신)",
    )
    .option("--dry-run", "변경 사항만 출력하고 실제 쓰기는 하지 않음")
    .option("--json", "출력을 JSON 객체로 표준 출력")
    .option("--force", "git working tree dirty 검사를 우회")
    .action(async (targetDir: string | undefined, options: CliOptions) => {
      await runUpgradeCmd(targetDir, options);
    });
}

export async function runUpgradeCmd(
  targetDir: string | undefined,
  options: CliOptions,
  fs: FsAdapter = realFsAdapter,
  currentVersion: string = TRELLIS_VERSION,
): Promise<void> {
  const dir = targetDir ?? process.cwd();
  const jsonMode = options.json === true;

  try {
    const upgradeOptions: UpgradeOptions = {
      dryRun: options.dryRun,
      json: options.json,
      force: options.force,
    };
    const result = runUpgrade(dir, currentVersion, upgradeOptions, fs);
    printResult(result, jsonMode);
  } catch (err) {
    if (err instanceof HarnessError) {
      if (jsonMode) {
        const output: UpgradeJsonResult = {
          ok: false,
          command: "upgrade",
          error: {
            code: err.exitCode,
            message: err.message,
            ...(err.hint !== undefined ? { hint: err.hint } : {}),
          },
        };
        process.stdout.write(JSON.stringify(output) + "\n");
        process.stderr.write(`${err.message}\n`);
        if (err.hint !== undefined) {
          process.stderr.write(`→ ${err.hint}\n`);
        }
        process.exit(err.exitCode);
      }
      throw err;
    }
    throw err;
  }
}

function printResult(result: UpgradeResult, jsonMode: boolean): void {
  if (jsonMode) {
    const output: UpgradeJsonResult = {
      ok: true,
      command: "upgrade",
      fromVersion: result.fromVersion,
      toVersion: result.toVersion,
      steps: result.steps,
      slotsAdded: result.slotsAdded,
      slotsSkipped: result.slotsSkipped,
      filesAdded: result.filesAdded,
      filesSkipped: result.filesSkipped,
      dryRun: result.dryRun,
    };
    process.stdout.write(JSON.stringify(output) + "\n");
  } else {
    if (result.dryRun) {
      process.stdout.write("Dry-run preview — no changes written.\n");
    }
    const prefix = result.dryRun ? "[dry-run] " : "";
    process.stdout.write(
      `${prefix}upgrade: ${result.fromVersion} → ${result.toVersion}\n`,
    );
    if (result.slotsAdded.length > 0) {
      process.stdout.write("Slots added:\n");
      for (const s of result.slotsAdded) {
        process.stdout.write(`  ${s.file} (slot: ${s.slot})\n`);
      }
    }
    if (result.filesAdded.length > 0) {
      process.stdout.write("Files added:\n");
      for (const f of result.filesAdded) {
        process.stdout.write(`  ${f}\n`);
      }
    }
    if (result.slotsSkipped.length > 0) {
      process.stdout.write("Slots already present (skipped):\n");
      for (const s of result.slotsSkipped) {
        process.stdout.write(`  ${s.file} (slot: ${s.slot})\n`);
      }
    }
    if (result.filesSkipped.length > 0) {
      process.stdout.write("Files already exist (skipped):\n");
      for (const f of result.filesSkipped) {
        process.stdout.write(`  ${f}\n`);
      }
    }
    if (
      result.slotsAdded.length === 0 &&
      result.filesAdded.length === 0 &&
      result.slotsSkipped.length === 0 &&
      result.filesSkipped.length === 0
    ) {
      process.stdout.write("Already up to date.\n");
    }
  }
}

export { ExitCode };
