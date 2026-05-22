# P14 — `trellis remove` (`trellis add` 의 역연산)

> L5 단계의 도구 완성도 마무리. `add` ↔ `remove` 사이클 라운드트립 보장.
> 외부 사용자가 fragment 를 안전하게 시도/철회할 수 있어야 카탈로그(L6) 가 의미를 가진다.

---

## 1. 목표

P14 종료 시점:

- **`trellis remove [type] [name]`** 명령: `trellis add [type] [name]` 의 정확한 역연산
  - fragment 가 생성한 파일 삭제 (사용자 수정 파일은 fail-fast 또는 `--force`)
  - patches 가 삽입한 slot entry 제거 (block marker 안에서 entryKey 단위, 멱등)
  - `package.json` 의 dependencies 정리 (다른 fragment 참조 없을 때만)
- `--dry-run` / `--json` / `--force` 옵션 완비 (`add`/`upgrade` 와 동형)
- git working tree clean 검사 — dirty 면 fail-fast (`--force` 우회)
- 라운드트립 E2E: `add → remove` 후 파일 트리/`package.json`/slot 내용이 add 이전과 동일
- L5 도구 완성도 마무리 — 외부 사용자가 자신감 있게 시도 가능

---

## 2. 배경 / 문제

현재 fragment 라이프사이클은 단방향이다:

```
trellis add api users  →  파일 + patch + deps 추가
trellis add api users  →  (멱등 skip, 변화 없음)
trellis add api users --force  →  파일 덮어쓰기 (patch/deps 는 멱등)
```

제거하려면 사용자가:
1. fragment 가 만든 파일을 손으로 추적해 삭제
2. block marker 안의 entry 를 손으로 잘라냄
3. `package.json` 에서 dep 가 다른 곳에 쓰이는지 직접 grep

→ **외부 채택의 마지막 마찰**. add 가 멱등이므로 remove 도 멱등이어야 일관된다.

또한 P15 의 AST patch 시스템이 도입되면 marker 가 점진 폐지되는데, 그 전에 marker 기반 정확한 remove 가 검증되어야 한다.

---

## 3. 결정 사항 (사용자 승인 대기 — 2026-05-21)

> 아래 모든 Q-A~G 에 대해 권장안(번호 1) 채택 여부를 알려주세요.
> P13 처럼 모두 권장 채택이면 "권장 전부 OK" 한 줄로 충분합니다.

> **Q-A. 제거 대상 식별 메커니즘 — 가장 큰 결정**
> **권장 (A1)**: **결정론적 재추론** — `spec.json.playbookId` + 사용자 입력 `(type, name)` 으로 fragment 를 다시 로드/렌더하여 "원래 만들어졌을 파일·patch·dep" 집합을 산출. 그 집합을 현재 프로젝트에서 제거.
> - 장점: ① spec.json 스키마 변경 0 — 기존 사용자 마이그레이션 불필요, ② add 와 같은 코드 경로 (loader/renderer) 재사용 — 일관성 자명, ③ 멱등 자연스러움 (없으면 skip), ④ P13 의 H1 (manifest 기반 결정론) 과 일관된 철학
> - 단점: fragment 정의가 add 시점과 달라졌으면(특히 P13 upgrade 후) 식별 누락 가능 → Q-G 로 처리
> - 대안: A2 spec.json 에 `fragments: [{type, name, files, patches, deps}]` 이력 저장 (정확하지만 마이그레이션 필요, 사용자가 직접 spec.json 편집 시 깨짐), A3 사용자가 파일 인자 직접 지정 (UX 나쁨)

> **Q-B. fragment 가 만든 파일을 사용자가 편집한 경우**
> **권장 (B1)**: **diff 감지 후 fail-fast + `--force` 로 강제 삭제**. add 시점 렌더 결과와 현재 파일 내용을 hash 비교 (Handlebars 컨텍스트 = 입력 name) — 다르면 사용자 수정으로 간주, 명시적 의사 표현 요구.
> - 장점: 의도치 않은 사용자 수정 보존, `--force` 가 안전 우회 채널
> - 대안: B2 무조건 삭제 (위험, P13 의 B1 정신 위반), B3 사용자 수정 파일은 skip (안전하지만 부분 제거 → 라운드트립 깨짐)

> **Q-C. `package.json` dependencies 제거 정책**
> **권장 (C1)**: **참조 카운팅 없이 보존 (no-op)** — `remove` 는 deps 를 절대 건드리지 않음. 사용자가 `npm prune` / 수동으로 처리.
> - 장점: ① 다른 fragment 가 같은 dep 를 쓰는 경우 자동 추적 불가능 (fragment 정의 전수 스캔 비용 + 정확성 보장 어려움), ② 사용자 코드도 그 dep 를 직접 import 할 수 있음, ③ 보수적 — 의존성 손상이 가장 디버깅 어려운 회귀
> - 대안: C2 참조 카운팅 (fragment 정의 전수 스캔 + 다른 fragment 에 같은 dep 있으면 보존) — 사용자 코드 import 는 여전히 놓침, C3 무조건 제거 (위험)
> - 보완: `--prune-deps` 플래그로 명시적 opt-in 으로 C2 동작 (P14 비범위, P15+ 검토)

> **Q-D. patch 제거 알고리즘**
> **권장 (D1)**: **block marker 안에서 entryKey 정확 매칭 라인 블록 삭제, 멱등** — applier 의 역연산. fragment.meta.patches 의 content 를 다시 렌더해 block 안에서 동일 텍스트 위치 탐지 → 삭제. 매칭 실패 시 silent skip (이미 제거됐다고 간주).
> - 장점: ① add 의 indent 보존 로직과 대칭, ② 이미 사용자가 손으로 지웠어도 멱등, ③ entryKey 가 unique 라는 add 시점 가정 재사용
> - 대안: D2 entryKey 만 grep 으로 라인 단위 삭제 (multi-line patch 깨짐), D3 block 전체 비우기 (다른 add 도 함께 사라짐 — 치명적)

> **Q-E. dry-run / json / force / 인터랙티브**
> **권장 (E1)**: `add` 와 동형 — `--dry-run` (변경 미리보기), `--json` (stdout 단일 라인 JSON / stderr 사람용), `--force` (사용자 수정 파일 + git dirty 우회), 인자 없으면 인터랙티브 (`select` 로 type / `input` 으로 name).
> - 추가: 인터랙티브 type 선택은 `trellis list` 와 동일 소스 (`listFragmentTypes`)
> - 대안: 없음 (관성 우선)

> **Q-F. git working tree clean 검사**
> **권장 (F1)**: **기본 ON, `--force` 우회** — P13 upgrade 와 동일 패턴 (`12-list-and-cli-tool-fragments.md` 의 E1 재사용 가능하면 재사용). dirty 면 `git restore .` 안내.
> - 대안: F2 비활성화 (위험), F3 새 백업 디렉토리 자동 생성 (불필요한 복잡성, P13 의 E1 과 불일치)

> **Q-G. fragment 정의가 add 이후 변경됐을 때 (P13 upgrade 후 케이스)**
> **권장 (G1)**: **현재 fragment 정의 기준 재추론 + 누락 보고** — 현재 fragment 의 파일/patch 집합으로 제거를 시도. 실제 프로젝트에 없는 파일/patch 는 `notFound` 로 분리 보고. `--json` 의 `removed` / `notFound` / `userModified` 3 구역으로 구조화.
> - 장점: ① 추가적 manifest 불필요 (오프라인 원칙), ② 사용자가 무엇이 누락됐는지 명시적으로 봄, ③ 99% 케이스에서 fragment 정의는 안정적 (이름·구조 변경은 드뭄)
> - 대안: G2 add 시점의 fragment 스냅샷을 spec 에 저장 (A2 와 동형 비용), G3 fragment 변경 감지 시 fail-fast (UX 나쁨)

---

## 4. 비범위

- **`--prune-deps`** — 참조 카운팅 기반 dep 제거. C1 보완안, P15+
- **AST 기반 제거** — block marker 폐지 시점. L5 후반 또는 L6
- **여러 fragment 한 번에 제거** (`trellis remove --all` 등) — UX 위험, 비범위
- **`trellis add --record`** — 이력 저장 별도 옵션. A1 채택 시 비범위
- **풀바디 자체 제거** — 그건 `rm -rf` 영역, trellis 책임 아님

---

## 5. Phase

| Phase | 작업 | 완료 조건 |
|-------|------|----------|
| P14.0 | 본 문서 + Q-A~G 사용자 승인 | § 3 마감 |
| P14.1 | `cmd/remove.ts` 신설 + commander 등록 + 인터랙티브 fallback | 명령 진입점 동작 |
| P14.2 | `service/fragment/un-patcher.ts` — patcher 의 역연산 (D1) | 단위 테스트 (멱등 케이스 포함) |
| P14.3 | `service/fragment/un-writer.ts` — 파일 제거 + 사용자 수정 감지 (B1) | hash 비교 단위 테스트 |
| P14.4 | `service/fragment/remove-orchestrator.ts` (또는 `remove.ts`) — 재추론 + 3 단계 (file/patch/dep) 오케스트레이션 | 단위 테스트 |
| P14.5 | `--dry-run` / `--json` / `--force` 옵션 + git clean 검사 (P13 의 git util 재사용) | 옵션 매트릭스 테스트 |
| P14.6 | JSON 출력 스키마 (`{ ok, command: "remove", removed, notFound, userModified, depsTouched: false }`) | 골든 스냅샷 |
| P14.7 | E2E **라운드트립 테스트** — cli-tool / b2b-saas 에서 `add api users → remove api users` 후 트리 일치 검증 (deps 는 add 후 상태 유지) | E2E 통과 |
| P14.8 | E2E 다중 fragment — `add api a → add api b → remove api a` 후 b 가 영향 없음 검증 | E2E 통과 |
| P14.9 | doctor 신규 규칙: `remove-target-stale` — 사용자가 fragment 정의 변경 후 remove 시도 시 안내 (optional, 여유 시) | 단위 테스트 |
| P14.10 | 문서 갱신 (`architecture.md` / `CLAUDE.md` / `README.md` / `AGENTS.md` 의 Phase + 다음 마일스톤) | 갱신 완료 |
| P14.11 | release-please vN.M.0 머지 → npm 배포 + plan 이동 | npm 배포 |

---

## 6. 영향 범위

| 대상 | 변경 |
|------|------|
| `src/cmd/remove.ts` | 신규 — remove 명령 진입점 |
| `src/cmd/remove.test.ts` | 신규 |
| `src/cmd/index.ts` | 수정 — remove 등록 |
| `src/service/fragment/un-patcher.ts` | 신규 — patch 역연산 (block 안 entry 삭제) |
| `src/service/fragment/un-patcher.test.ts` | 신규 |
| `src/service/fragment/un-writer.ts` | 신규 — 파일 삭제 + 사용자 수정 감지 |
| `src/service/fragment/un-writer.test.ts` | 신규 |
| `src/service/fragment/index.ts` | 수정 — un-patcher / un-writer export |
| `src/external/fs-adapter.ts` | 필요 시 수정 — `deleteFile`, `hashFile` 추가 (현재 미존재 시) |
| `src/service/doctor/rules/remove-target-stale.ts` | 신규 (P14.9, optional) |
| `tests/e2e/remove-roundtrip-cli-tool.e2e.test.ts` | 신규 |
| `tests/e2e/remove-roundtrip-b2b-saas.e2e.test.ts` | 신규 |
| `tests/e2e/remove-multi-fragment.e2e.test.ts` | 신규 |
| `docs/architecture.md` / `CLAUDE.md` / `README.md` / `AGENTS.md` | 수정 |

---

## 7. 검증 계획

### 자동
- `npm run typecheck && npm run lint && npm run test && npm run dep:check`
- 단위: un-patcher 멱등성 (이미 없는 entry remove → no-op), un-writer hash 비교, 인터랙티브 fallback
- 골든: `--json` 출력 스키마 (`removed` / `notFound` / `userModified` 분기별)
- E2E 라운드트립: cli-tool / b2b-saas 에서 add → remove 후 `git diff --stat` 가 빈 결과 (`package.json` 의 deps 제외)
- E2E 다중: 두 번 add 후 한 번 remove → 다른 fragment 영향 0
- 사용자 수정 케이스: 파일 수정 후 remove → fail-fast → `--force` 로 우회 확인

### 수동
- `--dry-run` 출력 가독성 — 삭제될 파일/patch 리스트가 사람이 읽기 좋음
- 인터랙티브 — 인자 없이 `trellis remove` → type/name 선택 동작
- 충돌 메시지 actionable (`→ <파일> 수정사항을 보존하려면 --force 없이 다시 실행 후 수동 확인>`)

---

## 8. 완료 기준

- [ ] § 3 Q-A~G 사용자 승인
- [ ] `trellis remove` 동작 (file/patch 제거, dep 보존)
- [ ] `--dry-run` / `--json` / `--force` 옵션 모두 동작
- [ ] git working tree clean 검사 통과
- [ ] 라운드트립 E2E 통과 (cli-tool + b2b-saas)
- [ ] 다중 fragment E2E 통과
- [ ] 사용자 수정 감지 + `--force` 우회 검증
- [ ] 자동/수동 검증 모두 통과
- [ ] 문서 갱신 완료 (AGENTS.md 의 Phase 갱신, 다음 마일스톤은 P15 AST patch 후보로 갱신)
- [ ] release-please vN.M.0 머지 → npm 배포
- [ ] 본 파일을 `docs/plans/completed/14-trellis-remove.md` 로 이동

---

## 9. 다음 단계 (참고)

P14 종료 후:
- **P15: AST 기반 patch 시스템** — block marker 의존도 감소 (L5 후반 또는 L6 진입 게이트)
- **외부 fragment 카탈로그** (npm 패키지 형태) — L6 (영구 비범위 가능성 잔존)
- **`--prune-deps`** — 참조 카운팅 기반 dep 제거 (C1 보완)
- **다언어 풀바디** (Go / Python playbook) — L6
