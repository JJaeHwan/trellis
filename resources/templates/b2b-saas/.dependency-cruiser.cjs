// dependency-cruiser 규칙: L0..L5 단방향 의존성 검증
//
// b2b-saas 풀바디 계층 구조:
// Layer 0: src/lib/common     (프레임워크 무관 유틸 — 에러, 유틸리티)
// Layer 1: src/lib/config     (설정 로드)
// Layer 2: src/lib/domain     (순수 도메인 모델 — I/O 금지)
// Layer 3: src/lib/external   (I/O 어댑터 — db, 파일 등)
// Layer 4: src/lib/db         (Repository 클래스 — fragment model 생성)
//          src/lib/zod        (Zod 스키마 — fragment model 생성)
//          src/lib/service    (서비스 로직 — fragment service 생성)
// Layer 5: src/app            (Next.js 라우트/페이지/actions)
//          src/components     (공유 UI 컴포넌트)
//
// fragment add 결과물:
//   model:   src/lib/zod/*, src/lib/db/*
//   service: src/lib/service/*
//   form:    src/components/*Form.tsx, src/lib/zod/*-form.ts
//   admin:   src/app/(authed)/admin/*/*
module.exports = {
  forbidden: [
    {
      name: "no-circular",
      severity: "error",
      from: {},
      to: { circular: true },
    },

    // -------------------------------------------------------------------------
    // L0 common — 상위 계층 import 금지
    // -------------------------------------------------------------------------
    {
      name: "L0-no-upper",
      severity: "error",
      from: { path: "^src/lib/common" },
      to: {
        path: "^src/lib/(config|domain|external|db|zod|service)(/|$)|^src/(app|components)(/|$)",
      },
    },

    // -------------------------------------------------------------------------
    // L1 config — L2+ import 금지
    // -------------------------------------------------------------------------
    {
      name: "L1-no-upper",
      severity: "error",
      from: { path: "^src/lib/config" },
      to: {
        path: "^src/lib/(domain|external|db|zod|service)(/|$)|^src/(app|components)(/|$)",
      },
    },

    // -------------------------------------------------------------------------
    // L2 domain — L3+ import 금지
    // -------------------------------------------------------------------------
    {
      name: "L2-no-upper",
      severity: "error",
      from: { path: "^src/lib/domain" },
      to: {
        path: "^src/lib/(external|db|zod|service)(/|$)|^src/(app|components)(/|$)",
      },
    },

    // -------------------------------------------------------------------------
    // L3 external — L4+ import 금지
    // -------------------------------------------------------------------------
    {
      name: "L3-no-upper",
      severity: "error",
      from: { path: "^src/lib/external" },
      to: {
        path: "^src/lib/(db|zod|service)(/|$)|^src/(app|components)(/|$)",
      },
    },

    // -------------------------------------------------------------------------
    // L4 db (repositories) — L5 import 금지
    // -------------------------------------------------------------------------
    {
      name: "L4-db-no-upper",
      severity: "error",
      from: { path: "^src/lib/db" },
      to: { path: "^src/(app|components)(/|$)" },
    },

    // -------------------------------------------------------------------------
    // L4 zod (schemas) — L4 service/db 및 L5 import 금지
    // Zod 스키마는 공유 유틸이므로 같은 L4 사이의 역방향만 차단
    // -------------------------------------------------------------------------
    {
      name: "L4-zod-no-upper",
      severity: "error",
      from: { path: "^src/lib/zod" },
      to: { path: "^src/(app|components)(/|$)" },
    },

    // -------------------------------------------------------------------------
    // L4 service — L5 import 금지
    // -------------------------------------------------------------------------
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
