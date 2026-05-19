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
      `TypeScript 또는 JavaScript 프로젝트 디렉토리에서 trellis check <dir> 을 실행하세요.`,
    );
  }

  const configPath = resolve(absDir, ".dependency-cruiser.cjs");
  if (!existsSync(configPath)) {
    throw new HarnessError(
      `${configPath} 가 없습니다. trellis cli-tool 템플릿이 기본으로 포함합니다.`,
      ExitCode.UserInputError,
      `trellis new <디렉토리> 로 생성된 프로젝트에서 실행하거나, .dependency-cruiser.cjs 파일을 직접 추가하세요.`,
    );
  }

  return runDepCruise(absDir, configPath);
}
