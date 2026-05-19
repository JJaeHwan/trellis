# P11 — b2b-saas fragments: form + admin (UI + fragment 의존성)

> P10 의 model/service 위에 form 과 admin CRUD 페이지 fragment 를 얹음.
> admin 은 model + service 의 결과를 활용 — **fragment 간 의존성** 첫 등장.
> 또한 사용자 프로젝트의 `.dependency-cruiser.cjs` 가 fragment 결과를 검증하는지 확인 (H 흡수).

---

## 1. 목표

P11 종료 시점:

- **form fragment** (`_fragments/form/`) — 폼 컴포넌트 + Server Action + Zod 한 묶음
- **admin fragment** (`_fragments/admin/`) — CRUD 페이지 (Table + Filter + actions) — model + service 위에 동작
- 풀바디에 새 slot: `admin-items` (Sidebar 의 admin 메뉴), `breadcrumb`
- fragment 간 의존성 명세 (Q-C 결정 기반)
- `trellis new --json` 출력 옵션 (F 흡수)
- 사용자 프로젝트의 `.dependency-cruiser.cjs` 가 fragment 결과를 잡는지 확인 + 보완 (H 흡수)
- doctor `handlebars-token-valid` 규칙 (I 흡수)
- actionable error suggestions 보강 (E 계속)
- v0.9.0 npm 배포

---

## 2. 배경 / 문제

P10 의 model + service 가 데이터 계층을 채우면, 사용자는 그걸 노출할 UI 가 필요. 풀바디는 `(authed)/admin/page.tsx` 가 하나 있을 뿐 — 실제 admin CRUD 는 손으로 만들어야 함.

매일 자주 필요:
- **새 폼** (CreateInvoiceForm, EditUserForm 등) — Server Actions + Zod 검증
- **새 admin 페이지** — 테이블 + 필터 + 생성/수정/삭제 다이얼로그

또한 P10 까지 모든 검증은 trellis 본체에서 진행 — 사용자가 `trellis new` 한 프로젝트에서 `trellis check` 또는 자기 프로젝트의 dep-cruiser 가 fragment 결과를 정말로 검증하는지 확인되지 않았음.

---

## 3. 결정 사항

| # | 결정 | 왜 |
|---|------|----|
| 1 | **form fragment 묶음**: `<Name>Form.tsx` + `actions.ts` + Zod 스키마 + 테스트 | 단일 책임 — 다이얼로그/모달은 admin fragment 가 결합 |
| 2 | **admin fragment 묶음**: page.tsx + `<Name>Table.tsx` + `<Name>Filter.tsx` + actions.ts + 테스트 | 한 admin 페이지의 최소 완결 형태 |
| 3 | **admin 의 model+service 의존**: **권고만** — meta.json description 에 "이전에 model + service add 권장" 명시. 자동 검사 X | requiresFragments 강제는 P10 결정 #2 따라 보류 |
| 4 | **admin-items slot 위치**: `src/lib/nav-items.ts` 에 admin-items 별도 slot — 일반 nav-items 와 분리 | Sidebar UX 분리 |
| 5 | **breadcrumb slot**: `src/lib/breadcrumb-map.ts.hbs` 신설 — 경로 → 표시 이름 매핑 | 단순한 객체 |
| 6 | **`trellis new --json`**: 인터뷰 답변 + 매칭 결과 + 생성 파일 목록 JSON 출력 | 자동화 친화 |
| 7 | **doctor `handlebars-token-valid`**: 풀바디 + fragment 의 모든 .hbs 파일이 사용하는 `{{token}}` 이 generator 의 ProjectSpec / FragmentContext 에 정의됨 | 오탈자 사전 차단 |

### 핵심 결정 (2026-05-19 사용자 승인 완료)

> **Q-A. form fragment 의 다이얼로그/모달 포함 여부?**
> ✅ **결정: 미포함** — form 자체는 폼 컴포넌트 + actions + Zod. 다이얼로그 wrap 은 admin fragment 가 처리.
> 이유: 단일 책임 — form 단독으로 inline 폼 페이지에도 사용 가능. 다이얼로그는 admin 의 UX 결정.
>
> **Q-B. admin fragment 가 만드는 페이지의 의도된 라우트 위치?**
> ✅ **결정: `src/app/(authed)/admin/{{nameKebab}}/`** — 명확한 admin 그룹.
> 이유: 인증 가드 + admin 그룹 분리 — 라우터/권한 일관성.
>
> **Q-C. fragment 간 의존성 — 강제 vs 권고?**
> ✅ **결정: 권고만** (description 에 명시) — `requiresFragments` 강제 메커니즘 도입 X.
> 이유: 강제는 검증/우회 메커니즘이 복잡 (run-time 검사? 빌드 시 검사?). 사용자가 add 순서 알아서. P13+ 에서 재검토.

---

## 4. 비범위

- ai-rag-platform 의 form/admin fragment — P12 또는 별도
- 동적 폼 (필드 자동 추론) — 영구 비범위 (사용자가 직접)
- 권한 기반 admin 메뉴 노출 — 영구 비범위 (사용자 인증 로직 의존)
- `trellis list`, cli-tool fragment — P12

---

## 5. Phase

| Phase | 작업 | 완료 조건 |
|-------|------|----------|
| P11.0 | 본 문서 + Q-A/B/C 결정 | § 3 마감 |
| P11.1 | 풀바디에 admin-items slot 추가 (Sidebar.tsx 또는 nav-items.ts 확장) | marker |
| P11.2 | 풀바디에 `src/lib/breadcrumb-map.ts.hbs` 신설 + breadcrumb slot | 새 파일 |
| P11.3 | 풀바디 골든/E2E 갱신 | 통과 |
| P11.4 | **form fragment** 신설 (`_fragments/form/`) | multi-file + 멀티 slot patch (필요 시) |
| P11.5 | **admin fragment** 신설 (`_fragments/admin/`) | model/service 권장 + multi-slot patch (nav admin + breadcrumb) |
| P11.6 | `cmd/new` 에 `--json` 옵션 추가 (F 흡수 두 번째 단계) | 옵션 + 출력 |
| P11.7 | 사용자 프로젝트의 `.dependency-cruiser.cjs` 가 fragment 결과를 검증하는지 확인 (H 흡수) — 결함 발견 시 풀바디 dep-cruiser config 보완 | 검증 결과 + 패치 |
| P11.8 | doctor `handlebars-token-valid` 규칙 신설 (I 흡수) | 단위 테스트 |
| P11.9 | actionable error 추가 (form/admin 컨텍스트 — E 계속) | 메시지 갱신 |
| P11.10 | E2E: scaffold → add model + service + form + admin 통합 시나리오 | 통과 |
| P11.11 | 자기 검증 + 문서 갱신 | 통과 |
| P11.12 | release-please v0.9.0 머지 → npm 배포 | npm 0.9.0 |
| P11.13 | plan 이동 | 완료 |

---

## 6. 영향 범위

| 대상 | 변경 |
|------|------|
| `resources/templates/b2b-saas/src/components/Sidebar.tsx.hbs` | 수정 — admin-items slot |
| `resources/templates/b2b-saas/src/lib/nav-items.ts.hbs` 또는 별도 admin-nav 파일 | 수정/신규 |
| `resources/templates/b2b-saas/src/lib/breadcrumb-map.ts.hbs` | 신규 — breadcrumb slot |
| `resources/templates/b2b-saas/_fragments/form/` | 신규 (4 파일 + meta) |
| `resources/templates/b2b-saas/_fragments/admin/` | 신규 (5 파일 + meta, multi-slot patch) |
| `resources/templates/b2b-saas/.dependency-cruiser.cjs` (있다면) | 수정 — fragment 코드 계층 규칙 보완 |
| `src/cmd/new.ts` | 수정 — `--json` 옵션 |
| `src/cmd/new.test.ts` | 확장 |
| `src/service/doctor/rules/handlebars-token-valid.ts` | 신규 |
| `src/service/doctor/rules/handlebars-token-valid.test.ts` | 신규 |
| `tests/golden/b2b-saas-tree.test.ts` | 스냅샷 갱신 |
| `tests/e2e/scaffold-b2b-saas.e2e.test.ts` | 확장 — 새 marker |
| `tests/e2e/add-fragments.e2e.test.ts` | 확장 — form + admin |
| `docs/architecture.md`, `CLAUDE.md` | 수정 |

---

## 7. 검증 계획

### 자동
- `npm run typecheck && npm run lint && npm run test`
- E2E 통합: model → service → form → admin 한 시나리오 — 각 단계의 출력이 다음 단계의 입력 (예: admin 이 model 의 Zod 사용)
- `trellis new --json` JSON 파싱 가능
- 사용자 프로젝트에서 `dep:check` (또는 ts-only validator) 실행 시 fragment 결과 통과
- doctor `handlebars-token-valid`: 잘못된 토큰 (`{{nonExistent}}`) 가 있는 fragment 만들어서 violation 검증

### 수동
- `trellis new` → b2b-saas → `trellis add model Invoice` → `trellis add service InvoiceService` → `trellis add form Invoice` → `trellis add admin Invoice` → `npm run dev` → /admin/invoice 페이지 정상 렌더 + CRUD 작동

---

## 8. 완료 기준

- [ ] § 3 Q-A/B/C 사용자 승인
- [ ] 풀바디에 admin-items + breadcrumb slot 주입
- [ ] form / admin fragment 동작 (멱등 + multi-slot)
- [ ] `trellis new --json` 동작
- [ ] 풀바디의 dep-cruiser 가 fragment 결과 검증 OK
- [ ] doctor `handlebars-token-valid` 규칙 통과
- [ ] 통합 E2E (model→service→form→admin) 통과
- [ ] 자기 검증 (check/doctor) 통과
- [ ] release-please v0.9.0 머지 → npm 배포
- [ ] 본 파일을 `docs/plans/completed/` 로 이동
