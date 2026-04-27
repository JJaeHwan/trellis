import type { Command } from "commander";

export function registerHelloCommand(program: Command): void {
  program
    .command("hello")
    .description("Sanity check — prints a greeting.")
    .action(() => {
      process.stdout.write("Hello from trellis\n");
    });
}
