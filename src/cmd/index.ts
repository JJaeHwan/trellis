import { Command } from "commander";
import { HarnessError, ExitCode } from "../common/errors/index.js";
import { logger } from "../common/logger/index.js";
import { registerHelloCommand } from "./hello.js";

const VERSION = "0.0.0";

function main(argv: string[]): void {
  const program = new Command();

  program
    .name("trellis")
    .description("Trellis — Harness Engineering CLI scaffolder and validator.")
    .version(VERSION);

  registerHelloCommand(program);

  program.parse(argv);
}

try {
  main(process.argv);
} catch (error) {
  if (error instanceof HarnessError) {
    process.stderr.write(`${error.message}\n`);
    process.exit(error.exitCode);
  }
  logger.error({ err: error }, "unhandled-error");
  process.stderr.write("Unexpected error. Re-run with HARNESS_DEBUG=1 for details.\n");
  process.exit(ExitCode.GeneralError);
}
