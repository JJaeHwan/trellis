import { join } from "node:path";
import { ExitCode, HarnessError } from "../common/errors/index.js";
import type { ProjectSpec } from "../domain/index.js";
import { realFsAdapter, type FsAdapter } from "./fs-adapter.js";

const SPEC_RELATIVE_PATH = ".trellis/spec.json";

/**
 * ProjectSpec 의 최소 필수 필드를 검증하는 타입 가드.
 *
 * unknown 값에서 ProjectSpec 으로 좁힌다.
 * 비즈니스 판단은 없음 — 스키마 형태만 확인한다.
 */
function isProjectSpec(value: unknown): value is ProjectSpec {
  if (typeof value !== "object" || value === null) return false;
  const obj = value as Record<string, unknown>;
  if (typeof obj["projectName"] !== "string") return false;
  if (typeof obj["playbookId"] !== "string") return false;
  if (!Array.isArray(obj["answers"])) return false;
  return true;
}

/**
 * 기존 trellis 프로젝트의 `.trellis/spec.json` 을 읽어 ProjectSpec 으로 반환한다.
 *
 * - 파일이 없으면 `undefined` 반환 (throw 하지 않음).
 * - 파일이 있지만 JSON 파싱 실패 → HarnessError("malformed .trellis/spec.json").
 * - 파싱은 성공했지만 필수 필드 누락/타입 불일치 → HarnessError.
 */
export function loadSpec(
  projectDir: string,
  fs: FsAdapter = realFsAdapter,
): ProjectSpec | undefined {
  const specPath = join(projectDir, SPEC_RELATIVE_PATH);

  if (!fs.exists(specPath)) {
    return undefined;
  }

  let raw: string;
  try {
    raw = fs.readFile(specPath);
  } catch {
    throw new HarnessError(
      `malformed .trellis/spec.json: 파일을 읽을 수 없습니다 (${specPath})`,
      ExitCode.GeneralError,
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new HarnessError(
      `malformed .trellis/spec.json: JSON 파싱 실패 (${specPath})`,
      ExitCode.GeneralError,
    );
  }

  if (!isProjectSpec(parsed)) {
    throw new HarnessError(
      `malformed .trellis/spec.json: 필수 필드(projectName, playbookId, answers)가 없거나 타입이 잘못됐습니다 (${specPath})`,
      ExitCode.GeneralError,
    );
  }

  return parsed;
}
