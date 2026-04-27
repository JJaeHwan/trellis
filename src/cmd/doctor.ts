import type { Command } from "commander";
import { ExitCode } from "../common/errors/index.js";
import { runDoctor } from "../service/doctor/index.js";
import type { DoctorReport, Finding } from "../service/doctor/index.js";

interface DoctorOptions {
  json?: boolean;
}

export function registerDoctorCommand(program: Command): void {
  program
    .command("doctor [targetDir]")
    .description(
      "Check documentation/code/playbook consistency in the target project.",
    )
    .option("--json", "Emit JSON to stdout instead of human-readable text")
    .action((targetDir: string | undefined, options: DoctorOptions) => {
      const dir = targetDir ?? process.cwd();
      const report = runDoctor(dir);

      if (options.json) {
        process.stdout.write(JSON.stringify(report, null, 2) + "\n");
      } else {
        printReport(report);
      }

      const errorCount = report.findings.filter(
        (f) => f.severity === "error",
      ).length;
      if (errorCount > 0) {
        process.exit(ExitCode.ValidationFailure);
      }
    });
}

function printReport(report: DoctorReport): void {
  if (report.findings.length === 0) {
    process.stderr.write(`✓ doctor: 모든 검사 통과 (${report.targetDir})\n`);
    return;
  }

  const errors = report.findings.filter((f) => f.severity === "error");
  const warns = report.findings.filter((f) => f.severity === "warn");
  const infos = report.findings.filter((f) => f.severity === "info");

  process.stderr.write(`doctor (${report.targetDir}):\n`);
  for (const f of errors) printFinding(f, "✗");
  for (const f of warns) printFinding(f, "⚠");
  for (const f of infos) printFinding(f, "ℹ");
  process.stderr.write(
    `\n총 ${errors.length} 에러, ${warns.length} 경고, ${infos.length} 정보\n`,
  );
}

function printFinding(finding: Finding, marker: string): void {
  process.stderr.write(`  ${marker} [${finding.ruleId}] ${finding.message}\n`);
  if (finding.hint) {
    process.stderr.write(`     → ${finding.hint}\n`);
  }
}
