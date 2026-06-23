// dependency-cruiser 규칙: ai-rag-platform 풀바디 계층 단방향 의존성 검증
//
// 계층 구조 (src/lib):
// Layer 0: src/lib/common     (프레임워크 무관 유틸 — 에러, 유틸리티)
// Layer 1: src/lib/config     (설정 로드)
// Layer 2: src/lib/domain     (순수 도메인 모델 — I/O 금지)
// Layer 3: src/lib/external   (I/O 어댑터 — DB, 임베더, LLM 등)
// Layer 4: src/lib/service    (RAG / 업로드 / 채팅 서비스 로직)
// Layer 5: src/app            (Next.js 라우트/페이지/route handlers)
//          src/components     (공유 UI 컴포넌트)
//
// fragment add 결과물:
//   api:   src/app/api/*/route.ts
//   page:  src/app/*/page.tsx
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
      from: { path: "^src/lib/common" },
      to: {
        path: "^src/lib/(config|domain|external|service)(/|$)|^src/(app|components)(/|$)",
      },
    },
    {
      name: "L1-no-upper",
      severity: "error",
      from: { path: "^src/lib/config" },
      to: {
        path: "^src/lib/(domain|external|service)(/|$)|^src/(app|components)(/|$)",
      },
    },
    {
      name: "L2-no-upper",
      severity: "error",
      from: { path: "^src/lib/domain" },
      to: {
        path: "^src/lib/(external|service)(/|$)|^src/(app|components)(/|$)",
      },
    },
    {
      name: "L3-no-upper",
      severity: "error",
      from: { path: "^src/lib/external" },
      to: { path: "^src/lib/service(/|$)|^src/(app|components)(/|$)" },
    },
    {
      name: "L4-service-no-upper",
      severity: "error",
      from: { path: "^src/lib/service" },
      to: { path: "^src/(app|components)(/|$)" },
    },
  ],
  options: {
    doNotFollow: { path: "node_modules" },
    tsConfig: { fileName: "tsconfig.json" },
    tsPreCompilationDeps: true,
  },
};
