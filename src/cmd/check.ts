import type { Command } from "commander";
import { ExitCode } from "../common/errors/index.js";
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
    .option("--json", "Emit JSON to stdout instead of human-readable text")
    .action(async (targetDir: string | undefined, options: CheckOptions) => {
      const dir = targetDir ?? process.cwd();
      const report = await validateProject(dir);

      if (options.json) {
        process.stdout.write(JSON.stringify(report, null, 2) + "\n");
      } else {
        printReport(report);
      }

      if (report.violations.length > 0) {
        process.exit(ExitCode.ValidationFailure);
      }
    });
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
