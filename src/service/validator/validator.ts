import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { ExitCode, HarnessError } from "../../common/errors/index.js";
import { detectLanguage } from "../../external/index.js";
import { runDepCruise } from "./ts-js-adapter.js";
import type { ValidationReport } from "./types.js";

/**
 * 대상 프로젝트의 계층 규칙 위반을 탐지한다.
 * P3 MVP: TypeScript / JavaScript 만 지원.
 */
export async function validateProject(
  targetDir: string,
): Promise<ValidationReport> {
  const absDir = resolve(targetDir);
  const lang = detectLanguage(absDir);

  if (lang !== "ts-js") {
    throw new HarnessError(
      `'${lang}' 언어는 아직 지원하지 않습니다 (P3 MVP: TypeScript/JavaScript only).`,
      ExitCode.UserInputError,
    );
  }

  const configPath = resolve(absDir, ".dependency-cruiser.cjs");
  if (!existsSync(configPath)) {
    throw new HarnessError(
      `${configPath} 가 없습니다. trellis cli-tool 템플릿이 기본으로 포함합니다.`,
      ExitCode.UserInputError,
    );
  }

  return runDepCruise(absDir, configPath);
}
