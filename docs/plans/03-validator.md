# P3 — Validator (`trellis check`)

> 기존 프로젝트가 하네스 계층 규칙을 지키는지 자동 탐지하는 검증기.

---

## 1. 목표

이 플랜이 끝나면:

- `trellis check <dir>` 가 대상 프로젝트의 계층 규칙 위반을 탐지한다
- 위반 0건 → exit 0, 위반 1건 이상 → exit 1
- `--json` 플래그로 구조화 출력 (CI/스크립트 친화)
- 언어 자동 감지 (`package.json` / `pom.xml` / `pyproject.toml` / `go.mod`)
- TypeScript/JavaScript 프로젝트 우선 지원 — dependency-cruiser 래핑

---

## 2. 배경

P2 까지는 **새 프로젝트** 만 다뤘다. 시간이 지나면서 사용자가 직접 작성한 코드가
계층 규칙을 어길 수 있다. dogfooding 의 핵심: trellis 가 **자기 자신을 검사** 해도
통과해야 한다.

---

## 3. 결정 사항 (P3.1 에서 확정)

| # | 결정 | 비고 |
|---|------|------|
| 1 | 첫 지원 언어: **TypeScript / JavaScript** | dependency-cruiser 래핑이 가장 단순 |
| 2 | 언어 감지: 매니페스트 파일 존재로 결정 | `package.json` 우선 |
| 3 | 기본 룰셋: 트렐리스의 `.dependency-cruiser.cjs` 와 동일 (L0..L5) | 사용자 룰 override 가능 |
| 4 | 출력: 사람용 (기본) + `--json` (스크립트용) | cli-tool.md 권장 |

---

## 4. 비범위

- Java (ArchUnit) / Python (import-linter) / Go — 각각 P3.5+ 별도 단계
- 위반 자동 수정 (`fix` 명령) — 추후
- IDE 플러그인 — 추후

---

## 5. Phase

| Phase | 작업 |
|-------|------|
| P3.1 | 언어 감지 (`detectLanguage`) — 매니페스트 파일 스캔 |
| P3.2 | TS/JS 어댑터 — dependency-cruiser CLI 자식 프로세스 호출 + 결과 파싱 |
| P3.3 | `cmd/check.ts` — 통합, `--json` 플래그, exit code 처리 |
| P3.4 | 단위 + 골든 — fixture 디렉토리에서 위반 0건/N건 시나리오 검증 |
| P3.5 | dogfooding — `trellis check .` 자기 자신에게 실행 → 통과 유지 |

---

## 6. 영향 범위

| 대상 | 변경 |
|------|------|
| `src/service/validator/` | 신규 |
| `src/external/lang-detector.ts` | 신규 |
| `src/cmd/check.ts` | 신규 |
| `src/cmd/index.ts` | `registerCheckCommand` 추가 |

---

## 7. 검증 계획

- [ ] `trellis check ./fixtures/clean` → exit 0
- [ ] `trellis check ./fixtures/violation` → exit 1 + 정확한 위반 목록
- [ ] `trellis check . --json` → 유효한 JSON 출력 (stdout)
- [ ] `trellis check .` (자기 자신) → 통과
- [ ] 단위 + 골든 테스트 추가됨

---

## 8. 완료 기준 (Definition of Done)

- [ ] 위 모든 체크박스
- [ ] `README.md` 상태 → `Phase 4 (Doctor)`
- [ ] `docs/plans/04-doctor.md` 초안 생성
- [ ] 이 파일을 `docs/plans/completed/03-validator.md` 로 이동
