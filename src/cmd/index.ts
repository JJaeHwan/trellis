import { Command } from "commander";
import { HarnessError, ExitCode } from "../common/errors/index.js";
import { logger } from "../common/logger/index.js";
import { registerCheckCommand } from "./check.js";
import { registerDoctorCommand } from "./doctor.js";
import { registerHelloCommand } from "./hello.js";
import { registerNewCommand } from "./new.js";

const VERSION = "0.0.0";

async function main(argv: string[]): Promise<void> {
  const program = new Command();

  program
    .name("trellis")
    .description("Trellis — Harness Engineering CLI scaffolder and validator.")
    .version(VERSION);

  registerHelloCommand(program);
  registerNewCommand(program);
  registerCheckCommand(program);
  registerDoctorCommand(program);

  await program.parseAsync(argv);
}

main(process.argv).catch((error: unknown) => {
  if (error instanceof HarnessError) {
    process.stderr.write(`${error.message}\n`);
    process.exit(error.exitCode);
  }
  logger.error({ err: error }, "unhandled-error");
  process.stderr.write(
    "Unexpected error. Re-run with HARNESS_DEBUG=1 for details.\n",
  );
  process.exit(ExitCode.GeneralError);
});
