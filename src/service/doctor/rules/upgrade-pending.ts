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
 * release-please 가 `// x-release-please-version` 마커로 자동 갱신한다
 * (release-please-config.json 의 extra-files 참조).
 */
const CURRENT_TRELLIS_VERSION = "0.14.0"; // x-release-please-version

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
 * doctor 규칙: upgrade-pending
 *
 * `.trellis/spec.json` 의 trellisVersion 이 현재 trellis 본체보다 minor 낮으면
 * info finding 으로 `trellis upgrade` 사용을 안내한다.
 *
 * - spec.json 없음 → no-op (다른 규칙이 처리)
 * - trellisVersion 파싱 실패 → no-op (trellis-version-compat 이 처리)
 * - major 다름 → no-op (trellis-version-compat 이 fatal 로 처리)
 * - spec.minor >= current.minor → no-op (호환 또는 trellis-version-compat 영역)
 * - spec.minor < current.minor → info finding
 */
export function checkUpgradePending(
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

  const specSemver = parseSemver(spec.trellisVersion);
  const currentSemver = parseSemver(currentVersion);

  // 파싱 실패 — trellis-version-compat 이 처리하므로 no-op
  if (specSemver === undefined || currentSemver === undefined) return findings;

  // major 불일치 — trellis-version-compat 이 fatal 로 처리하므로 no-op
  if (specSemver.major !== currentSemver.major) return findings;

  // minor 가 같거나 더 높은 경우 — no-op
  if (specSemver.minor >= currentSemver.minor) return findings;

  findings.push({
    ruleId: "upgrade-pending",
    severity: "info",
    message: `프로젝트는 trellis v${spec.trellisVersion} 로 생성됨. 최신 v${currentVersion} 로 마이그레이션 가능.`,
    hint: `trellis upgrade --dry-run 으로 변경 사항을 먼저 확인한 뒤, 문제 없으면 trellis upgrade 를 실행하세요.`,
  });

  return findings;
}
