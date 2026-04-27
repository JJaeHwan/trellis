/**
 * dependency-cruiser 규칙: L0..L5 단방향 의존성 검증
 *
 * Layer 0: common     (프레임워크 무관 유틸)
 * Layer 1: config     (설정 로드)
 * Layer 2: domain     (순수 도메인 모델)
 * Layer 3: external   (I/O 어댑터)
 * Layer 4: service    (핵심 로직)
 * Layer 5: cmd        (서브커맨드 엔트리)
 *
 * 규칙: 하위 계층은 상위 계층을 import 할 수 없다.
 */
module.exports = {
  forbidden: [
    {
      name: "no-circular",
      severity: "error",
      comment: "순환 의존 금지",
      from: {},
      to: { circular: true },
    },
    {
      name: "L0-no-upper",
      severity: "error",
      comment: "common(L0)은 상위 계층을 참조할 수 없다",
      from: { path: "^src/common" },
      to: { path: "^src/(config|domain|external|service|cmd)(/|$)" },
    },
    {
      name: "L1-no-upper",
      severity: "error",
      comment: "config(L1)은 L2+ 를 참조할 수 없다",
      from: { path: "^src/config" },
      to: { path: "^src/(domain|external|service|cmd)(/|$)" },
    },
    {
      name: "L2-no-upper",
      severity: "error",
      comment: "domain(L2)은 L3+ 를 참조할 수 없다",
      from: { path: "^src/domain" },
      to: { path: "^src/(external|service|cmd)(/|$)" },
    },
    {
      name: "L3-no-upper",
      severity: "error",
      comment: "external(L3)은 L4+ 를 참조할 수 없다",
      from: { path: "^src/external" },
      to: { path: "^src/(service|cmd)(/|$)" },
    },
    {
      name: "L4-no-upper",
      severity: "error",
      comment: "service(L4)는 cmd(L5) 를 참조할 수 없다",
      from: { path: "^src/service" },
      to: { path: "^src/cmd(/|$)" },
    },
    {
      name: "common-no-framework",
      severity: "error",
      comment: "common(L0)은 프레임워크 의존 금지 (Node 표준 + 최소 인프라만)",
      from: { path: "^src/common" },
      to: {
        path: "^(commander|@inquirer/prompts|handlebars|tsup|vitest)",
      },
    },
  ],
  options: {
    doNotFollow: {
      path: "node_modules",
    },
    tsConfig: {
      fileName: "tsconfig.json",
    },
    tsPreCompilationDeps: true,
    reporterOptions: {
      text: {
        highlightFocused: true,
      },
    },
  },
};
