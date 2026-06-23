import type { Command } from "commander";
import { ExitCode, HarnessError } from "../common/errors/index.js";
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
    .option(
      "--json",
      "Emit a single-line JSON result to stdout (human text goes to stderr)",
    )
    .action((targetDir: string | undefined, options: DoctorOptions) => {
      runDoctorCmd(targetDir ?? process.cwd(), options.json === true);
    });
}

export function runDoctorCmd(dir: string, jsonMode: boolean): void {
  let report: DoctorReport;
  try {
    report = runDoctor(dir);
  } catch (err) {
    if (jsonMode && err instanceof HarnessError) {
      emitJsonError(err);
      process.exit(err.exitCode);
    }
    throw err;
  }

  if (jsonMode) {
    process.stdout.write(
      JSON.stringify({ ok: true, command: "doctor", ...report }) + "\n",
    );
  } else {
    printReport(report);
  }

  const errorCount = report.findings.filter(
    (f) => f.severity === "error",
  ).length;
  if (errorCount > 0) {
    process.exit(ExitCode.ValidationFailure);
  }
}

function emitJsonError(err: HarnessError): void {
  process.stdout.write(
    JSON.stringify({
      ok: false,
      command: "doctor",
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
