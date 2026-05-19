# P7 — `trellis add` 부분 스캐폴딩 명령

> 기존 trellis 프로젝트에 플레이북 규칙을 따르는 부분 단위(fragment)를
> 추가하는 명령. dogfooding 시 같은 보일러플레이트를 매번 손으로
> 만드는 부담을 제거.

---

## 1. 목표

P7 종료 시점:

- 기존 trellis 프로젝트에서 `trellis add api users` / `trellis add page dashboard` 가 동작
- 생성 결과는 해당 플레이북의 계층 규칙(`CLAUDE.md` § 2)을 그대로 따름
- 인터랙티브 모드(`trellis add`) 도 지원 — 타입/이름 선택 가능
- b2b-saas + ai-rag-platform 두 플레이북에 대해 **2 가지 fragment 타입** 지원 (`api`, `page`)
- 골든 + E2E 테스트로 회귀 차단

---

## 2. 배경 / 문제

`trellis new` 는 처음 한 번만 쓰고 끝난다. 그 뒤로 사용자가 새 라우트/서비스/모델을 만들 때마다 손으로:

- 디렉토리 위치 결정 (어디에 둘지)
- 보일러플레이트 작성 (`getServerSession`, zod 스키마, RLS 체크 등)
- 테스트 파일 생성

매번 반복된다. 결과적으로 **계층 규칙이 부분적으로 깨지는** 일이 잦음 — 자동화로 일관성을 강제할 수 있다.

또한 dogfooding 사용자(본인)가 `trellis new` 후 빠르게 가치를 더 느끼려면, "1주일에 한 번" 쓰는 명령이 아니라 "매일 쓰는" 명령이 있어야 한다.

---

## 3. 결정 사항

| # | 결정 | 왜 (대안 대비) |
|---|------|---------------|
| 1 | **프로젝트 식별은 `.trellis/spec.json`** (옵션 A) | 휴리스틱(B)은 깨지기 쉽고, 플래그 강제(C)는 UX 나쁨. `trellis new` 가 이미 `ProjectSpec` 을 알고 있으므로 직렬화 1줄 추가로 끝. |
| 2 | **Fragment 정의 위치는 `resources/templates/<playbookId>/_fragments/<type>/`** | 플레이북마다 "api" 의 의미가 다름 (b2b-saas 는 `getServerSession` 가드 포함, ai-rag 는 zod 스키마 포함). 공유 fragment 는 추후 P8 에서 `_shared/` 로 분리. |
| 3 | **충돌 시 기본 skip + 경고, `--force` 로 덮어쓰기** | 안전 우선. `--force` 는 의도적 표현. |
| 4 | **MVP 범위는 b2b-saas + ai-rag 두 플레이북, `api` + `page` 두 타입** | cli-tool 의 fragment(=서브커맨드 추가)는 의미가 다르고 P8 로 분리. 4 가지 조합으로 시작하면 패턴 검증에 충분. |
| 5 | **인자: `trellis add [type] [name]` 둘 다 옵션** | 둘 중 빠진 건 인터뷰. `trellis new` 와 일관. |
| 6 | **Handlebars 컨텍스트는 `{name, namePascal, nameKebab, nameCamel, nameSnake}` 5종 + ProjectSpec 노출** | 케이스 변환은 generator 에 이미 있음 (lang-detector). |

### 핵심 결정 (2026-05-19 사용자 승인 완료)

> **Q-A. fragment 가 기존 파일을 수정해야 할 때(예: 새 페이지를 사이드바에 추가)는?**
> ✅ **결정: MVP 에서는 추가만 (insert-only)**. 기존 파일 수정은 P8 로 분리.
>
> **Q-B. fragment 가 신규 dependency 를 요구할 때(예: `react-pdf`)는?**
> ✅ **결정: 각 fragment 의 `meta.json` 에 `dependencies` 명시 → `add` 가 `package.json` 을 JSON merge 로 patch**.
>
> **Q-C. 인자 검증 — name 이 이미 존재할 때?**
> ✅ **결정: 이미 있으면 `--force` 없을 때 fail-fast**.

---

## 4. 비범위 (Out of Scope)

- **cli-tool 의 fragment** — 별도 의미(서브커맨드)이므로 P8 로 분리
- **fragment 가 기존 파일을 수정하는 케이스** — P8 (예: 사이드바에 메뉴 추가)
- **공유 fragment** — `_shared/` 로 분리하는 작업 P8
- **`trellis remove`** — 추가의 역연산. P9 후보.
- **`trellis upgrade`** — 마이그레이션. P10 후보.

---

## 5. Phase

| Phase | 작업 | 완료 조건 |
|-------|------|----------|
| P7.0 | 본 문서 + 사용자 합의 (Q-A/B/C 결정) | 본 문서 §3 의 미결정 3개 마감 |
| P7.1 | `trellis new` 가 `.trellis/spec.json` 작성 | scaffolder 변경 + golden 갱신 |
| P7.2 | `external/spec-loader.ts` — 기존 프로젝트의 spec 읽기 | 단위 테스트 |
| P7.3 | `service/fragment/` 신설 — 타입 정의 + fragment 로더 | 단위 테스트 |
| P7.4 | b2b-saas `api` + `page` fragment 작성 (`_fragments/api/`, `_fragments/page/`) | fragment 트리 + meta.json |
| P7.5 | ai-rag-platform `api` + `page` fragment 작성 | 동일 |
| P7.6 | `cmd/add.ts` 신설 — commander 진입점 + 인터랙티브 fallback | `trellis add api users` 동작 |
| P7.7 | dependency patch (`add` 가 `package.json` 을 merge) | 단위 테스트 |
| P7.8 | 충돌 처리 + `--force` | 단위 테스트 |
| P7.9 | E2E: scaffold → add api users → tsc/lint/build 통과 | 두 플레이북 모두 |
| P7.10 | doctor + check 자기 검증 통과 + 문서 갱신 (`architecture.md`) | 통과 |
| P7.11 | release-please 가 v0.5.0 PR 생성 → 머지 → npm 배포 | npm 0.5.0 노출 |

---

## 6. 영향 범위

| 대상 | 변경 | 비고 |
|------|------|------|
| `src/cmd/add.ts` | 신규 | commander 서브커맨드 |
| `src/cmd/index.ts` | 수정 | `add` 등록 |
| `src/service/fragment/` | 신규 (loader, renderer, conflict) | service 계층 |
| `src/external/spec-loader.ts` | 신규 | `.trellis/spec.json` 읽기 |
| `src/service/scaffolder/scaffolder.ts` | 수정 | spec 직렬화 후 `.trellis/spec.json` 작성 |
| `resources/templates/b2b-saas/_fragments/api/` | 신규 | fragment 정의 |
| `resources/templates/b2b-saas/_fragments/page/` | 신규 | fragment 정의 |
| `resources/templates/ai-rag-platform/_fragments/...` | 신규 | 동일 |
| `tests/golden/scaffold-spec.test.ts` | 신규 | `.trellis/spec.json` 골든 |
| `tests/e2e/add-*.e2e.test.ts` | 신규 | 두 플레이북 × 두 타입 |
| `docs/architecture.md` | 수정 | `add` 명령 추가 설명 |
| `CLAUDE.md` | 수정 | `add` 가 따르는 규칙 명시 |

---

## 7. 검증 계획

### 자동
- `npm run typecheck && npm run lint && npm run test` (trellis 본체)
- `tests/e2e/add-b2b-saas-api.e2e.test.ts` — 실제 add → tsc/lint/build
- `tests/e2e/add-ai-rag-page.e2e.test.ts` — 동일
- `tests/golden/spec-write.test.ts` — `.trellis/spec.json` 형식 고정

### 수동
- 새 디렉토리에서 `trellis new` → `cd <project>` → `trellis add api users` → `npm run dev` → `/api/users` 호출 동작
- `trellis add page dashboard` → 화면 렌더 확인
- 충돌 시나리오 — 동일 이름으로 두 번 실행 → 두 번째가 fail-fast → `--force` 로 덮어쓰기

---

## 8. 완료 기준 (Definition of Done)

- [ ] §3 의 미결정 3개(Q-A/B/C) 사용자 승인
- [ ] `trellis new` 후 `.trellis/spec.json` 생성
- [ ] `trellis add api users` / `add page dashboard` 가 두 플레이북에서 동작
- [ ] 자동/수동 검증 모두 통과
- [ ] release-please v0.5.0 머지 → npm 배포
- [ ] 본 파일을 `docs/plans/completed/07-trellis-add-command.md` 로 이동
