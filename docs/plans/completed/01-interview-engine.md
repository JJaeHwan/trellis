# P1 — Interview Engine

> `trellis new` 의 9문항 인터뷰 단계를 동작시킨다.
> **이 단계 종료 시점에는 아직 파일을 만들지 않는다** — 인터뷰 결과 (`ProjectSpec`) 를 stdout 에 JSON 으로 찍는 것까지가 P1.
> 실제 파일 생성은 P2 (Generator).

---

## 1. 목표

이 플랜이 끝나면:

- `trellis new my-project` 를 실행하면 9개의 질문이 순차로 제시된다 (@inquirer/prompts).
- 사용자가 답변을 마치면 매처가 1개의 플레이북을 골라 `MatchResult` 를 반환한다.
- 사용자에게 요약을 보여주고 확인을 받는다 (Confirm Gate).
- 확인 결과가 `ProjectSpec` 으로 직렬화되어 stdout 에 출력된다 (`--dry-run` 기본 동작).
- 단위 + 골든 테스트가 매처와 인터뷰 시리얼라이저를 덮는다.

---

## 2. 배경 / 문제

P0 에서 계층 골조와 `hello` 까지 만들었지만 **실제 가치는 0** — 사용자 입력을 받고 의사결정하는 핵심 흐름이 없다. P1 은 인터뷰 → 매칭 → 확인까지 **사용자 대화 한 사이클**을 완성한다.

---

## 3. 결정 사항

| # | 결정 | 왜 (대안 대비) |
|---|------|---------------|
| 1 | 첫 플레이북: **`cli-tool` 만** 지원 | b2b-saas / ai-rag-platform 은 P2 에서. 한 번에 다 하면 매처 디버깅 복잡 |
| 2 | 매칭 알고리즘: **답변→옵션 점수 합산 + 임계치** | LLM/벡터 매칭은 오프라인 원칙 위반 + 결정론 깨짐 |
| 3 | 인터뷰 시리얼라이저 출력은 **JSON (stdout)**, 사람용 요약은 **stderr** | `cli-tool.md` 의 stdout/stderr 분리 원칙 |
| 4 | "기타" 응답은 P1 에서는 **freeform 문자열로 저장만**, 자동 분류 안 함 | A/B/C 편차 판단은 LLM 필요 — 추후 |
| 5 | 플레이북 JSON 스펙 위치: `resources/playbooks/cli-tool.json` | architecture.md 와 일치 |
| 6 | 플레이북 메타: `resources/playbooks/cli-tool.meta.json` (sourceMd, sourceMdHash) | doctor 의 향후 동기화 검사용 |

---

## 4. 비범위 (Out of Scope)

이번 플랜에서 **하지 않는다**:

- 실제 파일/디렉토리 생성 (→ P2 Generator)
- Handlebars 템플릿 렌더링 (→ P2)
- `b2b-saas`, `ai-rag-platform` 플레이북 (→ P2)
- "기타" 응답의 LLM 기반 자동 분류 (→ 추후)
- `trellis check` / `trellis doctor` 구현 (→ P3, P4)
- 인터뷰 답변 캐시/이어가기 기능
- 다국어 (한국어 고정)

---

## 5. Phase

| Phase | 작업 | 완료 조건 |
|-------|------|----------|
| P1.1 | `domain/interview.ts`, `domain/playbook.ts`, `domain/project-spec.ts` 타입 정의 | typecheck 통과 |
| P1.2 | `resources/playbooks/cli-tool.json` + `cli-tool.meta.json` 작성 | JSON 스키마 검증 통과 |
| P1.3 | `service/interview/` — 9문항 정의 로더 + 답변 수집 루프 (@inquirer/prompts) | 단위 테스트 (in-memory prompt mock) 통과 |
| P1.4 | `service/matcher/` — 답변 → MatchResult 점수 기반 | 단위 테스트: cli-tool 답변 → exact, 일부 변형 → close |
| P1.5 | `cmd/new.ts` — 인터뷰 + 매처 + 확인 + ProjectSpec stdout 출력 | `trellis new --dry-run my-x` 가 stdin 없이 실행되면 명확한 에러 |
| P1.6 | 골든 스냅샷 — 고정 답변 fixture → ProjectSpec JSON diff | `tests/golden/cli-tool.spec.json` 생성, 매칭 통과 |
| P1.7 | `cmd/index.ts` 에 `new` 등록, `--help` 갱신 확인 | `trellis --help` 에 `new` 표시 |

---

## 6. 영향 범위

| 대상 | 변경 | 비고 |
|------|------|------|
| `src/domain/*.ts` | 신규 | 모델 정의 |
| `src/service/interview/` | 신규 | runner + 9문항 로더 |
| `src/service/matcher/` | 신규 | 점수 기반 매칭 |
| `src/cmd/new.ts` | 신규 | 새 서브커맨드 |
| `src/cmd/index.ts` | 수정 | `registerNewCommand(program)` 추가 |
| `resources/playbooks/cli-tool.json` | 신규 | 매처 입력 스펙 |
| `resources/playbooks/cli-tool.meta.json` | 신규 | sourceMd, sourceMdHash |
| `tests/golden/cli-tool.spec.json` | 신규 | 골든 ProjectSpec |
| `package.json` | 수정 | `@inquirer/prompts` 의존성 추가 |

---

## 7. 검증 계획

- [ ] `npm run typecheck` — 0건
- [ ] `npm run lint` — 0건
- [ ] `npm run test` — 신규 단위 + 골든 테스트 추가됨, 모두 통과
- [ ] `npm run dep:check` — domain/service/cmd 계층 위반 0건
- [ ] 수동: `trellis new --dry-run my-test` 실행 → 9문항 진행 → ProjectSpec JSON 출력 (stdout)
- [ ] 수동: stderr 에는 사람 읽기 좋은 진행 메시지만, stdout 에는 JSON 만

---

## 8. 완료 기준 (Definition of Done)

- [ ] 위 모든 체크박스 채움
- [ ] `README.md` "상태" 섹션을 `Phase 2 — Generator` 로 갱신
- [ ] 후속 플랜 `docs/plans/02-generator.md` 초안 생성
- [ ] 이 파일을 `docs/plans/completed/01-interview-engine.md` 로 이동
