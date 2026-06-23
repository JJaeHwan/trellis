import type { Command } from "commander";

interface HelloOptions {
  json?: boolean;
}

export function registerHelloCommand(program: Command): void {
  program
    .command("hello")
    .description("Sanity check — prints a greeting.")
    .option("--json", "Emit a single-line JSON result to stdout")
    .action((options: HelloOptions) => {
      runHello(options.json === true);
    });
}

export function runHello(jsonMode: boolean): void {
  if (jsonMode) {
    process.stdout.write(
      JSON.stringify({ ok: true, command: "hello", message: "Hello from trellis" }) +
        "\n",
    );
  } else {
    process.stdout.write("Hello from trellis\n");
  }
}
