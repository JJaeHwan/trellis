import type { Command } from "commander";
import { ExitCode, HarnessError } from "../common/errors/index.js";
import { validateProject } from "../service/validator/index.js";
import type { ValidationReport } from "../service/validator/index.js";

interface CheckOptions {
  json?: boolean;
}

export function registerCheckCommand(program: Command): void {
  program
    .command("check [targetDir]")
    .description(
      "Validate that the target project respects layered architecture rules.",
    )
    .option(
      "--json",
      "Emit a single-line JSON result to stdout (human text goes to stderr)",
    )
    .action(async (targetDir: string | undefined, options: CheckOptions) => {
      await runCheck(targetDir ?? process.cwd(), options.json === true);
    });
}

export async function runCheck(dir: string, jsonMode: boolean): Promise<void> {
  let report: ValidationReport;
  try {
    report = await validateProject(dir);
  } catch (err) {
    if (jsonMode && err instanceof HarnessError) {
      emitJsonError(err);
      process.exit(err.exitCode);
    }
    throw err;
  }

  if (jsonMode) {
    process.stdout.write(
      JSON.stringify({ ok: true, command: "check", ...report }) + "\n",
    );
  } else {
    printReport(report);
  }

  if (report.violations.length > 0) {
    process.exit(ExitCode.ValidationFailure);
  }
}

function emitJsonError(err: HarnessError): void {
  process.stdout.write(
    JSON.stringify({
      ok: false,
      command: "check",
      error: {
        code: err.exitCode,
        message: err.message,
        ...(err.hint !== undefined ? { hint: err.hint } : {}),
      },
    }) + "\n",
  );
  process.stderr.write(`${err.message}\n`);
  if (err.hint !== undefined) {
    process.stderr.write(`→ ${err.hint}\n`);
  }
}

function printReport(report: ValidationReport): void {
  if (report.violations.length === 0) {
    process.stderr.write(
      `✓ ${report.moduleCount} 모듈 검사, 위반 0건 (${report.targetDir})\n`,
    );
    return;
  }
  process.stderr.write(
    `✗ ${report.violations.length} 건의 계층 규칙 위반 (${report.targetDir}):\n\n`,
  );
  for (const v of report.violations) {
    process.stderr.write(`  [${v.rule}] ${v.from} → ${v.to}\n`);
  }
  process.stderr.write("\n");
}
