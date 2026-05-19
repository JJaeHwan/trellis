import type { FsAdapter } from "../../../external/fs-adapter.js";
import { realFsAdapter } from "../../../external/fs-adapter.js";
import { loadSpec } from "../../../external/spec-loader.js";
import type { Finding } from "../types.js";

/**
 * 현재 trellis 버전.
 *
 * cmd/new.ts 와 동일한 방식으로 하드코딩한다.
 * package.json 을 런타임에 읽으면 번들 후 경로가 달라질 수 있고,
 * import.meta 로 주입하려면 tsup config 변경이 필요하다.
 * release-please 가 package.json version bump 시 이 값도 함께 갱신해야 한다.
 */
const CURRENT_TRELLIS_VERSION = "0.7.0";

interface SemVer {
  readonly major: number;
  readonly minor: number;
  readonly patch: number;
}

/**
 * "X.Y.Z" 형식의 semver 문자열을 파싱한다.
 * pre-release 태그 등은 무시하고 숫자 3자리만 추출한다.
 * 파싱 실패 시 undefined 반환.
 */
function parseSemver(version: string): SemVer | undefined {
  const match = /^(\d+)\.(\d+)\.(\d+)/.exec(version.trim());
  if (!match) return undefined;
  return {
    major: parseInt(match[1]!, 10),
    minor: parseInt(match[2]!, 10),
    patch: parseInt(match[3]!, 10),
  };
}

/**
 * doctor 규칙: trellis-version-compat
 *
 * `.trellis/spec.json` 의 trellisVersion 이 현재 trellis 버전과
 * semver 호환 여부를 검사한다.
 *
 * - spec.json 없음 → no-op (다른 규칙이 처리)
 * - major 동일 + spec.minor <= current.minor → 통과
 * - major 동일 + spec.minor > current.minor → warning (더 새로운 trellis 로 생성됨)
 * - major 다름 → error (마이그레이션 필요 가능)
 * - trellisVersion 형식 잘못됨 → error (malformed)
 */
export function checkTrellisVersionCompat(
  projectDir: string,
  fs: FsAdapter = realFsAdapter,
  currentVersion: string = CURRENT_TRELLIS_VERSION,
): Finding[] {
  const findings: Finding[] = [];

  let spec: Awaited<ReturnType<typeof loadSpec>>;
  try {
    spec = loadSpec(projectDir, fs);
  } catch {
    // loadSpec 이 throw 하는 경우는 spec.json 이 존재하지만 파싱 실패한 경우.
    // 해당 오류는 이 규칙의 범위 밖이므로 조용히 넘긴다.
    return findings;
  }

  // spec.json 이 없는 프로젝트 — 다른 규칙이 처리하므로 통과
  if (spec === undefined) {
    return findings;
  }

  const specVersion = spec.trellisVersion;

  const specSemver = parseSemver(specVersion);
  if (specSemver === undefined) {
    findings.push({
      ruleId: "trellis-version-compat",
      severity: "error",
      message: `malformed trellisVersion in spec.json: "${specVersion}"`,
      hint: `spec.json 의 trellisVersion 을 올바른 semver 형식(예: "0.7.0")으로 수정하세요.`,
    });
    return findings;
  }

  const currentSemver = parseSemver(currentVersion);
  if (currentSemver === undefined) {
    // 현재 버전 자체가 잘못된 경우 — 이 규칙은 검사를 건너뛴다
    return findings;
  }

  if (specSemver.major !== currentSemver.major) {
    findings.push({
      ruleId: "trellis-version-compat",
      severity: "error",
      message: `spec.json 의 trellisVersion ${specVersion} 이 현재 trellis ${currentVersion} 와 major 버전 불일치 — 마이그레이션 필요 가능`,
      hint: `trellis 를 업데이트하거나 spec.json 의 trellisVersion 을 확인하세요.`,
    });
    return findings;
  }

  // major 동일 — 0.x 에서 minor 차이는 호환 가정 (하위 호환)
  // spec.minor > current.minor 이면 이 프로젝트는 더 새로운 trellis 로 만들어진 것
  if (specSemver.minor > currentSemver.minor) {
    findings.push({
      ruleId: "trellis-version-compat",
      severity: "warn",
      message: `이 프로젝트는 더 새로운 trellis (${specVersion}) 로 만들어졌습니다. 현재 trellis: ${currentVersion}`,
      hint: `trellis 를 최신 버전으로 업데이트하세요.`,
    });
  }

  // major 동일 + spec.minor <= current.minor → 통과
  return findings;
}
