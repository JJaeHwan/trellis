# P8 — 풀바디 네비게이션 보완

> P6 에서 b2b-saas / ai-rag-platform 풀바디를 만들 때
> **사이드바/메뉴 컴포넌트가 누락**되어 있다.
> `npm run dev` 로 실행해도 메뉴가 없어 직접 URL 입력으로만 페이지 이동 가능 —
> "실제 SaaS 같다" 는 사용감이 결여돼 있다.
>
> 또한 P9 (fragment patches) 의 대표 유스케이스 — `trellis add page reports`
> 가 자동으로 사이드바 메뉴에 등록하는 것 — 의 **patch 대상 파일**이 없다.
>
> P8 은 풀바디에 사이드바 + 메뉴 구조를 추가한다.
> 향후 P9 의 marker 주입 대상이 될 안정적인 토양 마련.

---

## 1. 목표

P8 종료 시점:

- b2b-saas 풀바디: `(authed)` 라우트 그룹에 사이드바 + 메뉴 + 컴포넌트 분리
- ai-rag-platform 풀바디: 사이드바 + 메뉴 (인증 없으므로 root layout 통합)
- 두 플레이북 공통: `Sidebar.tsx` + `nav-items.ts` 파일 분리 (P9 marker 부착 가능 구조)
- 풀바디 골든 스냅샷 갱신
- 풀바디 E2E (tsc/lint/build) 통과
- v0.6.0 npm 배포

---

## 2. 배경 / 문제

### P6 의 잔여 결함
P6 에서 b2b-saas/ai-rag 풀바디를 만들 때 다음 패턴만 채웠다:
- 인증 흐름 (b2b-saas)
- RLS 데이터 모델 (b2b-saas)
- RAG 파이프라인 (ai-rag)
- 개별 페이지 (`dashboard/`, `admin/`, `chat/`, `documents/`)

빠뜨린 것:
- **사이드바/네비게이션** — 각 페이지로 가는 메뉴 UI

결과: 풀바디 결과물에 `dashboard/page.tsx` 가 있지만 사용자가 그 URL 을 직접 쳐야만 접근 가능. 실제 사용 경험에서 "비어있다" 는 인상.

### P9 의존성
P9 (fragment patches) 가 `trellis add page reports` 시 자동으로 사이드바에 메뉴를 추가하려면, **사이드바 컴포넌트가 풀바디에 미리 존재**해야 한다. P8 이 그 기반.

---

## 3. 결정 사항

| # | 결정 | 왜 (대안 대비) |
|---|------|---------------|
| 1 | **컴포넌트 분리** — `src/components/Sidebar.tsx` + `src/lib/nav-items.ts` 별도 파일 | layout 인라인은 가독성 낮고 P9 patch 가 어려움. 분리하면 marker 주입 대상이 명확. |
| 2 | **b2b-saas: `(authed)/layout.tsx` 신설** | 로그인 페이지(`(auth)/login`)에는 사이드바 불필요. authed 그룹만 사이드바 보이게. |
| 3 | **ai-rag-platform: root layout 에 직접 통합** | 인증 라우트가 없으므로 별도 그룹 불필요. 단순화. |
| 4 | **디자인은 최소 — Tailwind 기본 + 좌측 고정 사이드바** | 다지인 시스템 도입은 본 플랜 범위 외. 단순한 좌측 메뉴면 충분. |
| 5 | **메뉴 데이터는 TypeScript 객체 배열** — `{ label, href, icon? }[]` | JSON 도 가능하지만 TS 가 import 후 타입 안전. P9 marker 도 TS 배열 안에 자연스럽게 들어감. |
| 6 | **아이콘은 미포함 (선택적 필드)** — 사용자가 lucide-react 등 자유 선택 | 아이콘 라이브러리 강요는 풀바디 무거워짐. |

### 핵심 결정 (2026-05-19 사용자 승인 완료)

> **Q-A. 기본 메뉴 항목으로 무엇을 넣을까?**
> ✅ **결정: 풀바디에 이미 존재하는 페이지를 자동 등록**.
> - b2b-saas: Dashboard (`/dashboard`), Admin (`/admin`)
> - ai-rag-platform: Chat (`/chat`), Documents (`/documents`)
> 이유: 빈 메뉴는 첫인상 약함, 더미 메뉴는 404 유발 → 실제 페이지 자동 등록이 즉시 작동.
>
> **Q-B. 사이드바 토글(접기/펴기) 기능을 포함할까?**
> ✅ **결정: 미포함 — 정적 사이드바**.
> 이유: 토글은 클라이언트 상태(useState/context) 필요 → 복잡도 ↑. 풀바디 단순성 우선. 필요 시 P9 patch 또는 사용자가 직접 추가.
>
> **Q-C. 사이드바와 함께 헤더(상단 바)도 추가할까?**
> ✅ **결정: 헤더 미포함 — 사이드바만**.
> 이유: 헤더(로그아웃, 사용자 이름) 는 인증 상태 노출 + 클라이언트 컴포넌트 의존 → 풀바디 범위 초과. P10+ 또는 사용자가 P9 patch 로 추가.

---

## 4. 비범위 (Out of Scope)

- **사이드바 토글/접기** — Q-B 권장안. 추후 사용자가 추가.
- **헤더(상단 바)** — Q-C 권장안. P10+.
- **아이콘 라이브러리** — lucide-react 등 강요 X.
- **반응형(모바일) 햄버거 메뉴** — 데스크탑만. 모바일 패턴은 P10+.
- **다크 모드 토글** — 풀바디는 prefers-color-scheme 만 따름.
- **P9 marker 주입** — 본 플랜은 컴포넌트 추가까지만. marker 는 P9 첫 단계.
- **cli-tool 풀바디 변경** — cli-tool 에는 적용 안 됨 (사이드바 개념 없음).

---

## 5. Phase

| Phase | 작업 | 완료 조건 |
|-------|------|----------|
| P8.0 | 본 문서 + Q-A/B/C 결정 | § 3 미결정 마감 |
| P8.1 | b2b-saas: `src/components/Sidebar.tsx.hbs` + `src/lib/nav-items.ts.hbs` 신설 | 컴포넌트 파일 작성 |
| P8.2 | b2b-saas: `src/app/(authed)/layout.tsx.hbs` 신설 — Sidebar 임포트 + 레이아웃 | layout 통합 |
| P8.3 | b2b-saas: 기존 `dashboard/`, `admin/` 디렉토리를 `(authed)/` 그룹 안으로 이동 | 디렉토리 구조 정리 |
| P8.4 | ai-rag-platform: `src/components/Sidebar.tsx.hbs` + `src/lib/nav-items.ts.hbs` 신설 | 컴포넌트 파일 작성 |
| P8.5 | ai-rag-platform: `src/app/layout.tsx.hbs` 에 Sidebar 통합 | root layout 갱신 |
| P8.6 | b2b-saas `_fragments/page/` 의 page.tsx 출력 위치 조정 (이미 `(authed)/` 안) | fragment 변경 확인 (없을 가능성 큼) |
| P8.7 | 풀바디 골든 스냅샷 갱신 (`tests/golden/b2b-saas-tree.test.ts`, `ai-rag-platform-tree.test.ts`) | 갱신 |
| P8.8 | 풀바디 E2E 갱신 (`tests/e2e/scaffold-b2b-saas.e2e.test.ts`, `scaffold-ai-rag.e2e.test.ts`) | 통과 |
| P8.9 | `trellis check .` / `doctor .` 자기 검증 + 문서 갱신 (`architecture.md` 풀바디 섹션, `README.md`) | 통과 |
| P8.10 | release-please v0.6.0 PR 머지 → npm 배포 | npm 0.6.0 노출 |
| P8.11 | 본 파일을 `docs/plans/completed/` 로 이동 | 완료 |

---

## 6. 영향 범위

| 대상 | 변경 | 비고 |
|------|------|------|
| `resources/templates/b2b-saas/src/components/Sidebar.tsx.hbs` | 신규 | 사이드바 컴포넌트 |
| `resources/templates/b2b-saas/src/lib/nav-items.ts.hbs` | 신규 | 메뉴 데이터 |
| `resources/templates/b2b-saas/src/app/(authed)/layout.tsx.hbs` | 신규 | authed 그룹 레이아웃 |
| `resources/templates/b2b-saas/src/app/dashboard/` → `(authed)/dashboard/` | 이동 | 디렉토리 재구성 |
| `resources/templates/b2b-saas/src/app/admin/` → `(authed)/admin/` | 이동 | 디렉토리 재구성 |
| `resources/templates/b2b-saas/middleware.ts.hbs` | 가능성 (수정) | authed 경로 감지 로직 조정 (있다면) |
| `resources/templates/ai-rag-platform/src/components/Sidebar.tsx.hbs` | 신규 | 사이드바 컴포넌트 |
| `resources/templates/ai-rag-platform/src/lib/nav-items.ts.hbs` | 신규 | 메뉴 데이터 |
| `resources/templates/ai-rag-platform/src/app/layout.tsx.hbs` | 수정 | Sidebar 통합 |
| `tests/golden/b2b-saas-tree.test.ts` | 스냅샷 갱신 | 파일 트리 변경됨 |
| `tests/golden/ai-rag-platform-tree.test.ts` | 스냅샷 갱신 | 동일 |
| `tests/e2e/scaffold-b2b-saas.e2e.test.ts` | 확장 | sidebar/nav-items 파일 존재 검증 |
| `tests/e2e/scaffold-ai-rag.e2e.test.ts` | 확장 | 동일 |
| `tests/e2e/add-fragments.e2e.test.ts` | 영향 가능 | b2b-saas page fragment 가 `(authed)/` 경로면 변경 없음 (이미 `(authed)` 사용) |
| `docs/architecture.md` | 수정 | 풀바디 섹션에 사이드바 구조 명시 |
| `README.md` | 가능성 (수정) | 풀바디 미리보기 스크린샷이 있다면 갱신 |

---

## 7. 검증 계획

### 자동
- `npm run typecheck && npm run lint && npm run test` — 골든/E2E 모두 통과
- `npm run dep:check` — 위반 없음
- `node dist/cmd/index.js check .` — 자기 검증
- `node dist/cmd/index.js doctor .` — 자기 검증

### 수동
- 새 디렉토리에서 `trellis new` → b2b-saas 선택 → `npm install` → `npm run dev`
- 로그인 후 좌측 사이드바에 Dashboard / Admin 메뉴 보임
- 메뉴 클릭 시 해당 페이지로 이동
- ai-rag-platform 도 같은 흐름으로 Chat / Documents 메뉴 확인

---

## 8. 완료 기준 (Definition of Done)

- [ ] § 3 의 미결정 3개(Q-A/B/C) 사용자 승인
- [ ] b2b-saas 풀바디: Sidebar.tsx + nav-items.ts + (authed)/layout.tsx
- [ ] b2b-saas: dashboard, admin 가 (authed) 그룹 안으로 이동
- [ ] ai-rag-platform 풀바디: Sidebar.tsx + nav-items.ts + root layout 통합
- [ ] 풀바디 골든 스냅샷 갱신
- [ ] 풀바디 E2E 통과 (`scaffold-b2b-saas`, `scaffold-ai-rag`)
- [ ] add-fragments E2E 회귀 없음
- [ ] `trellis check .` / `doctor .` 통과
- [ ] release-please v0.6.0 머지 → npm 배포
- [ ] 본 파일을 `docs/plans/completed/08-fullbody-navigation.md` 로 이동
