# P12 — `trellis list` + cli-tool fragment (UX + 자기 적용 완성)

> L4 졸업을 위한 마무리. 사용자가 어떤 fragment 가 있는지 미리 알 수 있도록 `trellis list` 추가하고,
> cli-tool 풀바디 (= trellis 본체) 에도 fragment 를 두어 dogfooding 을 완전한 자기 적용 단계로 끌어올림.
> 또한 모든 명령에 `--json` 옵션이 들어가 자동화/AI 통합 친화 (F 마무리).

---

## 1. 목표

P12 종료 시점:

- **`trellis list`** 명령: 현재 프로젝트의 가능한 fragment type 카탈로그 출력
  - `trellis list` — type 목록
  - `trellis list <type>` — 해당 fragment 의 상세 (파일/patch/dependencies)
- **cli-tool fragment** 첫 도입:
  - `_fragments/command/` — 새 서브커맨드 보일러 (`cmd/<name>.ts` + 등록 + 테스트)
  - `_fragments/service-module/` — service/ 하위 새 서브패키지 (loader/types/index/test)
- 모든 명령에 `--json` 출력 일관성 (F 마무리)
- doctor `playbook-still-supported` 규칙 (I 마무리)
- actionable error suggestions 종합 정리 (E 마무리)
- v0.10.0 npm 배포

이 플랜이 끝나면 **L4 (매일 쓰는 도구) 완전 졸업**.

---

## 2. 배경 / 문제

L4 의 마지막 통증 3가지:

1. **발견성 부재** — 사용자가 어떤 fragment 가 있는지 모름. 인터랙티브 모드에서만 발견 가능. 문서 의존도 높음.
2. **trellis 자기 적용 불가** — trellis 본체가 자기 자신에게 `trellis add command verify` 같은 명령을 못 함. dogfooding 의 마지막 빈 공간.
3. **자동화 친화성 부족** — check/doctor/list 의 출력이 사람용 텍스트만. CI/스크립트/AI 에이전트 호출 시 파싱 어려움.

이 셋을 한 플랜에서 해결하면 L4 마무리.

---

## 3. 결정 사항

| # | 결정 | 왜 |
|---|------|----|
| 1 | **`trellis list`**: cwd 의 `.trellis/spec.json` 로드 → 해당 플레이북의 fragment 목록 출력 | 컨텍스트 인식 |
| 2 | **`trellis list <type>`**: 해당 fragment 의 meta + 생성 파일 트리 + patches 요약 | 사용자가 미리 효과 파악 |
| 3 | **모든 명령의 `--json`**: stdout 에 JSON 단일 객체, stderr 에 진행상황. 이미 P10/P11 에서 add/new 는 완료, P12 에서 check/doctor/list 추가 | 일관성 |
| 4 | **cli-tool fragment 카탈로그**: command, service-module 두 종부터 시작 | 가장 자주 필요한 두 패턴 |
| 5 | **cli-tool 풀바디에 slot 추가**: `src/cmd/index.ts` 에 commander 등록 slot, `src/service/index.ts` (있다면) 에 service barrel slot | command/service-module fragment 의 대상 |
| 6 | **doctor `playbook-still-supported`**: spec.json 의 playbookId 가 현재 trellis 의 지원 목록에 있음 — 사라진 플레이북 사용 중인 프로젝트 감지 | 미래 호환성 |

### 핵심 미결정 (사용자 승인 필요)

> **Q-A. `trellis list` 의 기본 출력 형식?**
> 권장: **컬러 텍스트 (TTY) / plain 텍스트 (파이프)** — 기존 check/doctor 와 일관. `--json` 으로 구조화 출력.
>
> **Q-B. cli-tool 의 `src/cmd/index.ts` slot 위치?**
> 권장: commander 등록 부분 끝에 `// trellis:slot:commands:start/end` — `program.command(...)` 호출이 모이는 곳.
>
> **Q-C. service-module fragment 가 만드는 파일 구성?**
> 권장: `src/service/<name>/{index.ts, types.ts, <name>.ts, <name>.test.ts}` — 기존 interview/matcher 패턴.

---

## 4. 비범위

- 외부 fragment 카탈로그 (npm 패키지 형태) — L6, 영구 비범위 가능성
- AST 기반 patch — P13+ (필요 시)
- `trellis remove` — P13 (L5 진입)
- `trellis upgrade` — P14 (L5)
- ai-rag-platform 의 cli-tool fragment 등 — 의미 없음 (cli-tool 만 cmd 가짐)

---

## 5. Phase

| Phase | 작업 | 완료 조건 |
|-------|------|----------|
| P12.0 | 본 문서 + Q-A/B/C 결정 | § 3 마감 |
| P12.1 | **`cmd/list.ts`** 신설 — commander 진입점 + listFragmentTypes 활용 (P7 의 external/fragment-types-loader 재사용) | 텍스트 출력 |
| P12.2 | `trellis list <type>` 상세 모드 — meta.json + 템플릿 트리 + patches 요약 출력 | 상세 출력 |
| P12.3 | `cmd/list --json` + `cmd/check --json` + `cmd/doctor --json` (F 마무리) | 모든 명령 일관 |
| P12.4 | cli-tool 풀바디에 `_fragments/` 디렉토리 신설 + `src/cmd/index.ts` 에 commands slot 주입 | 인프라 |
| P12.5 | **cli-tool command fragment** 신설 — `cmd/<name>.ts` + index.ts patch + 테스트 | 첫 cli-tool fragment |
| P12.6 | cli-tool service-module fragment 신설 — `src/service/<name>/` 서브패키지 | 두 번째 |
| P12.7 | 자기 적용 E2E — trellis 본체에서 `trellis add command verify` 시뮬레이션 (test 환경) | 자기 적용 |
| P12.8 | doctor `playbook-still-supported` 규칙 신설 (I 마무리) | 단위 테스트 |
| P12.9 | actionable error suggestions 종합 감사 + 정리 (E 마무리) — 모든 HarnessError 경로 점검 | 메시지 일관 |
| P12.10 | 자기 검증 + 문서 갱신 (architecture/CLAUDE/README) | 통과 |
| P12.11 | release-please v0.10.0 머지 → npm 배포 | npm 0.10.0 |
| P12.12 | plan 이동 | 완료 |

---

## 6. 영향 범위

| 대상 | 변경 |
|------|------|
| `src/cmd/list.ts` | 신규 — list 명령 |
| `src/cmd/list.test.ts` | 신규 |
| `src/cmd/index.ts` | 수정 — list 등록 |
| `src/cmd/check.ts` | 수정 — `--json` |
| `src/cmd/doctor.ts` | 수정 — `--json` |
| `src/common/errors/` | 수정 — actionable suggestion 헬퍼 표준화 |
| `src/service/doctor/rules/playbook-still-supported.ts` | 신규 |
| `src/service/doctor/rules/playbook-still-supported.test.ts` | 신규 |
| `resources/templates/cli-tool/src/cmd/index.ts.hbs` (또는 유사) | 수정 — commands slot |
| `resources/templates/cli-tool/_fragments/command/` | 신규 |
| `resources/templates/cli-tool/_fragments/service-module/` | 신규 |
| `tests/golden/cli-tool-tree.test.ts` | 스냅샷 갱신 |
| `tests/e2e/add-cli-tool.e2e.test.ts` | 신규 — 자기 적용 시나리오 |
| `docs/architecture.md`, `CLAUDE.md`, `README.md` | 수정 |

---

## 7. 검증 계획

### 자동
- `npm run typecheck && npm run lint && npm run test`
- `trellis list` / `list <type>` 모두 통과 — 단위 + E2E
- 모든 `--json` 출력이 `JSON.parse` 통과
- cli-tool fragment add → 결과가 trellis 본체 구조 (`cli-tool.md` 플레이북) 따름
- doctor `playbook-still-supported`: 가짜 unknown playbook 으로 fail-fast 검증

### 수동
- `trellis list` 출력이 사람 읽기 좋음 + `--json` 출력 파싱 가능
- 임시 디렉토리에서 trellis 본체 복제 (cli-tool 플레이북) 후 `trellis add command verify` → src/cmd/verify.ts 생성 + index.ts 등록 + 테스트 추가 + tsc 통과

---

## 8. 완료 기준

- [ ] § 3 Q-A/B/C 사용자 승인
- [ ] `trellis list` / `list <type>` 동작
- [ ] check/doctor/list 의 `--json` 옵션 모두 동작
- [ ] cli-tool 풀바디에 _fragments/ 카탈로그 (command + service-module)
- [ ] trellis 본체에 자기 적용 가능 (E2E 검증)
- [ ] doctor `playbook-still-supported` 규칙 통과
- [ ] actionable error message 종합 정리 완료
- [ ] 자기 검증 (check/doctor) 통과
- [ ] release-please v0.10.0 머지 → npm 배포
- [ ] 본 파일을 `docs/plans/completed/12-list-and-cli-tool-fragments.md` 로 이동
- [ ] **L4 졸업** — trellis 가 매일 쓰는 도구로 완성

---

## 9. L4 졸업 후 다음 단계 (참고)

P12 종료 시점에 L4 졸업 → L5 진입 시점에 결정:
- **P13: `trellis remove`** — add 의 역연산
- **P14: `trellis upgrade`** — 풀바디 버전 업 시 사용자 프로젝트 마이그레이션
- 또는 L4 사용 중 발견되는 즉시 패치 작업
