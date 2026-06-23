/**
 * trellis 의 현재 버전 — 단일 소스 (single source of truth).
 *
 * release-please 가 `// x-release-please-version` 마커로 이 파일만 자동 갱신하고
 * (release-please-config.json 의 extra-files), 나머지 모듈(cmd/doctor)은 여기서
 * import 한다. package.json 을 런타임에 읽으면 번들 후 경로가 달라질 수 있어 상수로 둔다.
 */
export const TRELLIS_VERSION = "0.14.0"; // x-release-please-version
