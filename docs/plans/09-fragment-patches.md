# P8 — fragment 의 기존 파일 수정 (patches)

> P7 `trellis add` 는 insert-only — 새 파일만 생성한다.
> 결과적으로 사용자가 fragment 를 add 한 후, **사이드바에 메뉴 항목 추가**나
> **라우터에 새 핸들러 등록** 같은 부수 작업을 손으로 해야 한다.
> P8 은 fragment 가 기존 파일을 안전·멱등하게 수정할 수 있도록 한다.

---

## 1. 목표

P8 종료 시점:

- fragment 가 기존 파일에 **명시된 위치** 에서 텍스트를 삽입할 수 있다
- 동일 이름으로 두 번 add 해도 파일 내용이 **중복되지 않는다** (멱등)
- 동일 fragment 가 두 종류의 patch (예: 사이드바 메뉴 + 라우터 등록)를 묶을 수 있다
- 충돌(슬롯 없음/이미 동일 이름 존재) 시 친절한 에러 + `--force` 옵션
- b2b-saas `page` fragment 는 add 시 사이드바 메뉴 자동 등록
- 골든 + E2E 로 회귀 차단

---

## 2. 배경 / 문제

P7 의 dogfooding 결과:

```
trellis add page reports   # ✅ src/app/(authed)/reports/page.tsx 생성
                            # ❌ src/components/Sidebar.tsx 는 손으로 수정해야 함
                            # ❌ src/lib/nav-items.ts 도 손으로 수정
```

매번 같은 3~4 줄을 손으로 추가하는 부담 + **추가 누락으로 메뉴가 안 보이는 버그** 빈발.

해결책: fragment 의 `meta.json` 에 patch 선언을 추가해서, add 시 자동 적용.

---

## 3. 결정 사항

| # | 결정 | 왜 (대안 대비) |
|---|------|---------------|
| 1 | **patch 방식은 marker 기반** — 풀바디 템플릿이 미리 슬롯 주석을 심어둠 (`// trellis:slot:sidebar-items`) | AST(B) 는 TS 전용이고 next.js/prisma 버전 의존성 큼. 정규식(C) 은 깨지기 쉬움. marker 는 명시적·언어무관·예측가능. |
| 2 | **patch 선언은 fragment 의 `meta.json` 에 `patches` 배열** | 별도 파일은 카탈로그 분산. meta 안에 두면 fragment 단위로 self-contained. |
| 3 | **각 patch 의 `entryKey` 가 멱등 보증** — 동일 entryKey 가 이미 슬롯에 있으면 no-op | identifier-free 비교는 false positive 위험. entryKey 명시는 사용자가 통제. |
| 4 | **슬롯 누락 시 fail-fast, `--force` 무관** | patch 가 없는 게 아니라 풀바디 템플릿 자체의 버그. `--force` 는 의미가 다름. |
| 5 | **slot 위치는 한 파일 내 여러 개 허용**, 같은 slot 이름이 동일 파일에 두 번 있으면 첫 번째에 삽입 | 단순화 우선. 두 번째 슬롯이 필요한 케이스는 P9 로. |
| 6 | **patch 는 insert-only — replace/delete 없음** | 기존 코드 삭제는 사용자 의도 침범 위험. 필요해지면 P9 로 분리. |
| 7 | **rollback 없음** — 실패 시 부분 적용 상태가 남을 수 있음 | git 이 있으므로 rollback 은 `git restore` 로 충분. trellis 안의 rollback 은 과한 복잡성. |

### 핵심 결정 (2026-05-19 사용자 승인 완료)

> **Q-A. marker 주석 문법은?**
> ✅ **결정: Block-style** — `// trellis:slot:<name>:start` ... `// trellis:slot:<name>:end`
> 이유: ① 자동생성 영역 시각적 명확성 (사용자가 손대지 말아야 할 곳임이 분명), ② 멱등 검사 알고리즘 단순화 (start..end 사이만 스캔), ③ P9 의 `trellis remove` 도입 시 entry 식별 자명.
>
> **Q-B. 같은 entryKey 가 이미 있을 때 정확한 동작은?**
> ✅ **결정: 조용히 skip (silent)** — 정상 케이스에서는 출력 없이 exit 0. `--verbose` / `--json` 출력에는 표시.
> 이유: ① 멱등성의 본질("두 번 실행해도 같은 상태")에 부합, ② CI/CD 재시도 안전, ③ 디버깅 가시성은 `--verbose` 로 보장.
>
> **Q-C. patches 가 있는 fragment 를 `--force` 로 add 했을 때, 이미 같은 entryKey 가 있으면?**
> ✅ **결정: 여전히 skip (force 는 파일 충돌 한정)** — `--force` 는 멱등성 우회용이 아니다.
> 이유: ① `--force` 시멘틱 단일 책임 유지 (파일 레벨만), ② entry 중복 = UI 데이터 손상 (메뉴 두 번 표시) — 실수가 아니라 의도일 가능성 거의 없음, ③ 정말 두 개 원하면 `name` 자체를 다르게 줘야 함, ④ P7 `--force` 와 시멘틱 일관성.

---

## 4. 비범위 (Out of Scope)

- **AST 기반 patch** — P10+ 로 보류. marker 가 한계에 부딪힐 때 검토.
- **patch 의 replace/delete** — 위험. P9+ 후보.
- **multi-file 단일 patch** (하나의 patch 가 여러 파일을 동시 수정) — 첫 케이스에서 안 보임. P9+.
- **자동 marker 주입** — 기존 trellis 프로젝트 (P7 이전 생성) 에 marker 가 없으면 `trellis migrate` 같은 도구 필요. P10+.
- **patch 의 변환 함수** (`{{name | uppercase}}` 같은 인라인 헬퍼) — Handlebars 가 이미 처리. 추가 DSL 금지.

---

## 5. Phase

| Phase | 작업 | 완료 조건 |
|-------|------|----------|
| P8.0 | 본 문서 + 사용자 합의 (Q-A/B/C 결정) | 본 문서 § 3 의 미결정 3개 마감 |
| P8.1 | `FragmentMeta.patches` 타입 정의 + 로더 확장 | 단위 테스트 |
| P8.2 | b2b-saas 풀바디에 marker 주입 (`Sidebar.tsx`, `nav-items.ts`) | 풀바디 골든 갱신 |
| P8.3 | ai-rag-platform 풀바디에 marker 주입 (해당 위치 식별 후) | 풀바디 골든 갱신 |
| P8.4 | `service/fragment/patcher.ts` — 파일 읽기 → slot 찾기 → entryKey 멱등 검사 → 삽입 | 단위 테스트 |
| P8.5 | `cmd/add.ts` 에 patch 단계 통합 (writeTree → patchFiles → patchPackageJson 순서) | 통합 |
| P8.6 | b2b-saas `_fragments/page/meta.json` 에 sidebar patch 선언 | 단위 + E2E |
| P8.7 | ai-rag-platform fragment 의 적절한 patch 추가 (해당 시) | E2E |
| P8.8 | E2E: 동일 add 두 번 → 멱등 확인 (메뉴 중복 X) | 통과 |
| P8.9 | E2E: slot 누락 시 fail-fast + 친절한 메시지 | 통과 |
| P8.10 | doctor 규칙 신설: 풀바디 템플릿이 marker 를 잃지 않았는지 검사 | 통과 |
| P8.11 | `trellis check .` / `doctor .` 자기 검증 통과 + `architecture.md` / `CLAUDE.md` / README 갱신 | 통과 |
| P8.12 | release-please v0.6.0 PR 머지 → npm 배포 | npm 0.6.0 노출 |
| P8.13 | 본 파일을 `docs/plans/completed/` 로 이동 | 완료 |

---

## 6. 영향 범위

| 대상 | 변경 | 비고 |
|------|------|------|
| `src/service/fragment/types.ts` | 수정 | `FragmentMeta.patches?: PatchDecl[]` 추가 |
| `src/service/fragment/loader.ts` | 수정 | `patches` 필드 파싱/검증 |
| `src/service/fragment/patcher.ts` | 신규 | 파일 단위 patch 적용 (slot 찾기 + 멱등 검사 + 삽입) |
| `src/service/fragment/patcher.test.ts` | 신규 | 단위 테스트 |
| `src/service/fragment/index.ts` | 수정 | export |
| `src/cmd/add.ts` | 수정 | runAdd 흐름에 patch 단계 추가 |
| `src/cmd/add.test.ts` | 수정 | patch 케이스 추가 |
| `resources/templates/b2b-saas/**/Sidebar.tsx.hbs` | 수정 | marker 주석 주입 |
| `resources/templates/b2b-saas/**/nav-items.ts.hbs` | 수정 (또는 신규) | marker 주입 |
| `resources/templates/b2b-saas/_fragments/page/meta.json` | 수정 | `patches` 선언 |
| `resources/templates/b2b-saas/_fragments/page/...` | 수정 (entry content 템플릿 추가) | patch entry 본문 |
| `resources/templates/ai-rag-platform/**/<slot file>.hbs` | 수정 | (적용 가능 시) marker 주입 |
| `tests/golden/b2b-saas-tree.test.ts` | 스냅샷 갱신 | 풀바디에 marker 추가됨 |
| `tests/golden/ai-rag-platform-tree.test.ts` | 스냅샷 갱신 | (변경 시) |
| `tests/e2e/add-fragments.e2e.test.ts` | 케이스 추가 | patch 적용 + 멱등 검증 |
| `src/service/doctor/...` | 수정 | marker presence 규칙 추가 |
| `docs/architecture.md` | 수정 | § 3.2 trellis add 흐름에 patch 단계 추가 |
| `CLAUDE.md` | 수정 | § 4 add 설명 보강 (patches 동작) |

---

## 7. 검증 계획

### 자동
- `npm run typecheck && npm run lint && npm run test`
- `tests/e2e/add-fragments.e2e.test.ts` — patch 케이스
- 멱등 케이스: 같은 fragment 두 번 add → 슬롯 entry 정확히 1개
- slot 누락 케이스: 풀바디에 marker 가 없는 상태로 fragment add → fail-fast

### 수동
- 새 디렉토리에서 `trellis new` → b2b-saas 선택 → `trellis add page reports`
  → `npm run dev` → 좌측 사이드바에 "Reports" 메뉴 자동 등장
- 같은 명령 두 번 → 메뉴가 두 번 안 들어옴 확인

---

## 8. 완료 기준 (Definition of Done)

- [ ] § 3 의 미결정 3개(Q-A/B/C) 사용자 승인
- [ ] `FragmentMeta.patches` 도입 + 로더 파싱
- [ ] 풀바디 템플릿에 marker 주입 (b2b-saas 우선)
- [ ] `patcher.ts` — slot 찾기 + 멱등 + 삽입 동작
- [ ] b2b-saas `page` fragment add 시 사이드바 메뉴 자동 등록
- [ ] 멱등 (동일 add 두 번 → 단 1회 반영)
- [ ] doctor 의 marker presence 규칙 통과
- [ ] 자동/수동 검증 모두 통과
- [ ] release-please v0.6.0 머지 → npm 배포
- [ ] 본 파일을 `docs/plans/completed/08-fragment-patches.md` 로 이동
