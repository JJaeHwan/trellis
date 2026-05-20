# P13 — `trellis upgrade` (외부 채택의 게이트)

> L4 를 졸업하고 공공시스템 진입을 위한 첫 번째 enabling technology.
> 현재 `doctor trellis-version-compat` 는 버전 불일치를 *감지* 만 한다 — 자동 마이그레이션이 없다.
> P13 은 trellis 가 진화할 때 기존 사용자 프로젝트가 그 진화를 **trellis 가 흡수**하도록 한다.
> 외부 사용자가 "지금 깔아도 frozen 되지 않는다" 는 신뢰를 제공하는 것이 핵심.

---

## 1. 목표

P13 종료 시점:

- **`trellis upgrade`** 명령: 현재 프로젝트를 최신 trellis 버전에 맞게 자동 마이그레이션
  - 풀바디에 추가된 새 slot marker 자동 삽입 (insert-only, 멱등)
  - 신규 필수 파일 자동 추가 (사용자 수정 파일은 건드리지 않음)
  - `spec.json.trellisVersion` 자동 갱신
- `--dry-run` / `--json` / `--force` 옵션 완비
- git working tree clean 검사 — dirty 면 fail-fast
- doctor 신규 규칙: `upgrade-pending` (현재 trellisVersion < trellis 최신 시 안내)
- **L5 진입 게이트** — 외부 사용자가 trellis 를 채택할 수 있는 상태

---

## 2. 배경 / 문제

현재 상태:

```
trellis doctor .
  ⚠  trellis-version-compat: 프로젝트가 v0.8.0, 현재 trellis v0.10.0
     → trellis upgrade 로 마이그레이션하세요  (명령이 없음 — 안내만)
```

풀바디가 새 slot marker 를 얻거나 새 필수 파일이 추가될 때 기존 사용자의 선택지는 두 가지뿐이다:

1. **frozen** — 새 fragment 를 쓸 수 없음 (신 slot 이 없으므로)
2. **수동 마이그레이션** — diff 를 찾아 직접 패치

외부 채택을 막는 결정적 원인. `trellis upgrade` 가 풀리면 trellis 의 진화 비용이 **사용자 → trellis** 로 이전된다.

---

## 3. 결정 사항 (사용자 승인 완료 — 2026-05-19)

> 모든 권장안(A1, B1, C1, D1, E1, F1, G1) 및 Q-H 채택. 구현 시작.

> **Q-A. 마이그레이션 범위**
> **권장 (A1)**: 풀바디의 *새 slot marker* + *신규 필수 파일* 만 자동 추가. 사용자가 수정한 파일은 건드리지 않음. `spec.json.trellisVersion` 갱신.
> 대안: A2 풀바디 전체 diff 적용 (사용자 수정 덮어씀 — 위험), A3 새 fragment 까지 자동 add (사용자 의도 추측 — 비범위)

> **Q-B. 사용자 변경과의 충돌 처리**
> **권장 (B1)**: 3-way merge (base: 이전 풀바디, ours: 사용자 현재, theirs: 신 풀바디). 충돌 발생 시 fail-fast + 수동 해결 안내.
> 대안: B2 force overwrite (위험), B3 사용자 수정 파일은 skip (안전하지만 진화 누락 가능)

> **Q-C. dry-run / preview**
> **권장 (C1)**: `--dry-run` 옵션 — 변경 사항 diff 출력만, 실제 쓰기 없음. `--json` 으로 구조화.
> 대안: 없이 바로 적용 (실수 복구 불가 — 위험)

> **Q-D. spec.json 갱신 정책**
> **권장 (D1)**: `trellisVersion` 만 자동 bump. `answers` 는 유지 (재인터뷰 원하면 `--re-interview` 별도 플래그).
> 대안: D2 answers 도 다시 묻기 (마찰 큼, 의도치 않은 플레이북 변경 위험)

> **Q-E. Rollback / 부분 적용 안전성**
> **권장 (E1)**: 시작 전 git working tree clean 검사 (dirty 면 fail-fast, `--force` 로 우회). 실패 시 `git restore .` 안내.
> 대안: E2 자체 rollback 트랜잭션 (구현 비용 큼), E3 백업 디렉토리 자동 생성 (불필요한 복잡성)

> **Q-F. 버전 점프 지원**
> **권장 (F1)**: 인접 minor 만 지원 (예: 0.10 → 0.11). 큰 점프는 단계적 upgrade 권장 + fail-fast + 가이드 출력.
> 대안: F2 모든 점프 한 번에 (누적 마이그레이션 검증 어려움 — 위험)

> **Q-G. 새 fragment 가 도입한 slot 처리**
> **권장 (G1)**: 풀바디에 새 slot marker 가 추가됐다면 해당 위치에 자동 삽입 (insert-only, 멱등). 사용자 코드 영향 없음.
> 대안: G2 사용자 확인 후 삽입 (UX 마찰, 자동화 불친화)

> **Q-H. "이전 버전 풀바디" 참조 방식** (추가 결정 — 가장 큰 설계 결정)
> **권장 (H1)**: **Migration Manifest** — 각 minor release 마다 `resources/migrations/X.Y.Z-to-X.(Y+1).0.json` 을 trellis 번들에 동봉. manifest 가 "이번 버전이 추가한 slot, 신규 필수 파일, 변경된 슬롯 entryKey" 를 선언. upgrade 는 `spec.trellisVersion` 부터 current 까지 manifest 를 순차 적용.
> - 장점: 오프라인 (CLAUDE.md MVP 원칙 준수), 번들 크기 작음 (전체 풀바디 cache X), 인접 minor 만 적용하므로 Q-F 와 일관, 명시적 (어떤 변경이 적용되는지 manifest 가 곧 문서)
> - 대안: H2 번들에 이전 풀바디 전체 cache (번들 크기 폭증), H3 git tag fetch (네트워크 의존, MVP 원칙 위반)

---

## 4. 비범위

- **AST 기반 patch** — L5 후반 또는 L6
- **사용자 코드 자동 수정** (deprecated API 사용처 변경 등) — `trellis upgrade` 책임 아님
- **풀바디 plugin / 외부 fragment 카탈로그** — L6
- **플레이북 변경** (cli-tool → b2b-saas 등) — 별도 명령 필요, P13 범위 아님

---

## 5. Phase

| Phase | 작업 | 완료 조건 |
|-------|------|----------|
| P13.0 | 본 문서 + Q-A~G 사용자 승인 | § 3 마감 |
| P13.1 | `cmd/upgrade.ts` 신설 + commander 등록 | 명령 진입점 동작 |
| P13.2 | `service/upgrader/` 신설 — 버전 diff 산정 + 인접 버전 검사 | 단위 테스트 |
| P13.3 | **Migration manifest 로더** (`resources/migrations/<from>-to-<to>.json` 파싱 + 첫 manifest `0.10.0-to-0.11.0.json` 작성) | manifest 적용 단위 결정 |
| P13.4 | 사용자 코드 변경 감지 (수정된 파일 식별) + 3-way merge or fail-fast | 충돌 케이스 처리 |
| P13.5 | slot marker 자동 삽입 (insert-only, 멱등) + `spec.json` trellisVersion 갱신 | 핵심 로직 |
| P13.6 | git working tree clean 검사 + `--dry-run` / `--json` / `--force` 옵션 | 안전성 + UX |
| P13.7 | doctor 신규 규칙 `upgrade-pending` — trellisVersion 불일치 시 안내 | 단위 테스트 |
| P13.8 | 단위 + 골든 + E2E 테스트 (cli-tool / b2b-saas 실제 upgrade 시나리오) | 테스트 통과 |
| P13.9 | 자기 적용 — trellis 본체가 v(N-1) 상태로부터 upgrade 시뮬레이션 통과 | E2E 통과 |
| P13.10 | 문서 갱신 (architecture.md / CLAUDE.md / README.md) | 갱신 완료 |
| P13.11 | release-please vN.M.0 머지 → npm 배포 + plan 이동 | npm 배포 |

---

## 6. 영향 범위

| 대상 | 변경 |
|------|------|
| `src/cmd/upgrade.ts` | 신규 — upgrade 명령 진입점 |
| `src/cmd/upgrade.test.ts` | 신규 |
| `src/cmd/index.ts` | 수정 — upgrade 등록 |
| `src/service/upgrader/index.ts` | 신규 — 오케스트레이션 |
| `src/service/upgrader/version-diff.ts` | 신규 — 버전 diff 산정 |
| `src/service/upgrader/manifest-loader.ts` | 신규 — migration manifest 파싱 |
| `src/service/upgrader/applier.ts` | 신규 — manifest 의 변경을 프로젝트에 적용 (insert-only + 멱등) |
| `src/service/upgrader/*.test.ts` | 신규 |
| `src/service/doctor/rules/upgrade-pending.ts` | 신규 |
| `src/service/doctor/rules/upgrade-pending.test.ts` | 신규 |
| `resources/migrations/0.10.0-to-0.11.0.json` | 신규 — 첫 migration manifest |
| `resources/migrations/schema.json` | 신규 — manifest JSON schema 문서화 |
| `tests/e2e/upgrade-*.e2e.test.ts` | 신규 — 실제 upgrade 시나리오 |
| `docs/architecture.md` / `CLAUDE.md` / `README.md` | 수정 |

---

## 7. 검증 계획

### 자동
- `npm run typecheck && npm run lint && npm run test && npm run dep:check`
- 단위: 버전 diff 산정, 3-way merge, slot 삽입 멱등성
- 골든: 이전 풀바디 → 현 풀바디 케이스별 기대 출력 스냅샷
- E2E: cli-tool / b2b-saas 프로젝트에서 upgrade 실행 → 변경 사항 검증
- doctor `upgrade-pending`: 구버전 trellisVersion 프로젝트에서 경고 발생 확인

### 수동
- `--dry-run` 출력 가독성 — diff 가 사람이 읽기 좋음
- 충돌 발생 시 에러 메시지 actionable (`→ <파일 열어 conflict 해결 후 다시 실행>`)
- git dirty 상태에서 실행 → fail-fast 메시지 명확

---

## 8. 완료 기준

- [ ] § 3 Q-A~G 사용자 승인
- [ ] `trellis upgrade` 동작 (신규 slot 삽입 + trellisVersion 갱신)
- [ ] `--dry-run` / `--json` / `--force` 옵션 모두 동작
- [ ] git working tree clean 검사 통과
- [ ] doctor `upgrade-pending` 규칙 통과
- [ ] 자기 적용 — trellis 본체 upgrade 시뮬레이션 통과
- [ ] 자동/수동 검증 모두 통과
- [ ] 문서 갱신 완료
- [ ] release-please vN.M.0 머지 → npm 배포
- [ ] 본 파일을 `docs/plans/completed/13-trellis-upgrade.md` 로 이동
- [ ] **L5 진입 게이트** — 공공시스템 채택 가능 상태

---

## 9. 다음 단계 (참고)

P13 종료 후:
- **P14: `trellis remove`** — `trellis add` 의 역연산
- **P15+: AST patch 시스템** — block marker 의존도 감소
- 다언어 풀바디 가능성 검토 (Go / Python playbook)
