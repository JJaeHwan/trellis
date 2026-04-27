/**
 * dependency-cruiser 규칙: L0..L5 단방향 의존성 검증
 *
 * Layer 0: common     (프레임워크 무관 유틸)
 * Layer 1: config     (설정 로드)
 * Layer 2: domain     (순수 도메인 모델)
 * Layer 3: external   (I/O 어댑터)
 * Layer 4: service    (핵심 로직)
 * Layer 5: cmd        (서브커맨드 엔트리)
 */
module.exports = {
  forbidden: [
    {
      name: "no-circular",
      severity: "error",
      from: {},
      to: { circular: true },
    },
    {
      name: "L0-no-upper",
      severity: "error",
      from: { path: "^src/common" },
      to: { path: "^src/(config|domain|external|service|cmd)(/|$)" },
    },
    {
      name: "L1-no-upper",
      severity: "error",
      from: { path: "^src/config" },
      to: { path: "^src/(domain|external|service|cmd)(/|$)" },
    },
    {
      name: "L2-no-upper",
      severity: "error",
      from: { path: "^src/domain" },
      to: { path: "^src/(external|service|cmd)(/|$)" },
    },
    {
      name: "L3-no-upper",
      severity: "error",
      from: { path: "^src/external" },
      to: { path: "^src/(service|cmd)(/|$)" },
    },
    {
      name: "L4-no-upper",
      severity: "error",
      from: { path: "^src/service" },
      to: { path: "^src/cmd(/|$)" },
    },
  ],
  options: {
    doNotFollow: { path: "node_modules" },
    tsConfig: { fileName: "tsconfig.json" },
    tsPreCompilationDeps: true,
  },
};
