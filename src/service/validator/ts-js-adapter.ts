import { createRequire } from "node:module";
import { cruise } from "dependency-cruiser";
import type { ValidationReport, Violation } from "./types.js";

const require = createRequire(import.meta.url);

interface DepCruiseConfigShape {
  forbidden?: ReadonlyArray<unknown>;
  allowed?: ReadonlyArray<unknown>;
  options?: {
    tsConfig?: { fileName?: string };
    doNotFollow?: { path?: string };
  };
}

interface DepCruiseRule {
  name: string;
  severity?: string;
}

interface DepCruiseViolation {
  from: string;
  to: string;
  rule: DepCruiseRule;
}

interface DepCruiseSummary {
  violations?: ReadonlyArray<DepCruiseViolation>;
  totalCruised?: number;
}

interface DepCruiseOutput {
  summary?: DepCruiseSummary;
}

export async function runDepCruise(
  targetDir: string,
  configPath: string,
): Promise<ValidationReport> {
  const config = require(configPath) as DepCruiseConfigShape;

  // cruise() makes module paths relative to process.cwd() — and the layer rules
  // (e.g. "^src/common") assume that relative shape. Chdir to target so paths
  // resolve as "src/...", not "<long absolute>/src/...".
  const originalCwd = process.cwd();
  let cruiseResult;
  try {
    process.chdir(targetDir);
    cruiseResult = await cruise(
      ["src"],
      {
        validate: true,
        ruleSet: {
          forbidden: config.forbidden,
          allowed: config.allowed,
        } as never,
        tsConfig: { fileName: "tsconfig.json" },
        tsPreCompilationDeps: true,
        doNotFollow: { path: "node_modules" },
      },
    );
  } finally {
    process.chdir(originalCwd);
  }

  const output: DepCruiseOutput =
    typeof cruiseResult.output === "string"
      ? (JSON.parse(cruiseResult.output) as DepCruiseOutput)
      : (cruiseResult.output as unknown as DepCruiseOutput);

  const rawViolations = output.summary?.violations ?? [];
  const violations: Violation[] = rawViolations.map((v) => ({
    from: v.from,
    to: v.to,
    rule: v.rule.name,
    severity: v.rule.severity ?? "error",
  }));

  return {
    targetDir,
    language: "ts-js",
    moduleCount: output.summary?.totalCruised ?? 0,
    violations,
  };
}
