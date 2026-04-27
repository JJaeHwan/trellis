# P2 — Generator (templates → file tree)

> P1 의 ProjectSpec JSON 을 입력으로 받아 실제 파일 트리를 생성한다.
> 추가 플레이북 (b2b-saas, ai-rag-platform) 도 본 단계에서 등록.

---

## 1. 목표

이 플랜이 끝나면:

- `trellis new my-cli` 실행 → 인터뷰 → 매칭 → 확인 → **실제 디렉토리/파일 생성** 까지 완전 동작
- cli-tool / b2b-saas / ai-rag-platform 3개 플레이북 모두 매처 + 템플릿이 준비됨
- Handlebars 기반 템플릿이 `resources/templates/<playbook>/` 에 위치
- 생성된 트리는 typecheck / lint 통과 (E2E 테스트로 검증)
- 골든 스냅샷이 cli-tool / b2b-saas / ai-rag-platform 각 1세트씩

---

## 2. 배경 / 문제

P1 종료 시점에 `trellis new` 는 ProjectSpec JSON 을 stdout 에 찍기만 한다.
실제 가치 (스캐폴딩) 는 **템플릿 렌더링 + 파일 시스템 쓰기** 가 들어와야 발생.

또한 단일 플레이북(cli-tool) 만으로는 매처의 hybrid/close 모드가 의미를 갖지 못한다.
3개 플레이북을 모두 등록해야 매칭 로직이 실제로 검증된다.

---

## 3. 결정 사항 (초안 — P2.1 에서 확정)

| # | 결정 | 비고 |
|---|------|------|
| 1 | 템플릿 엔진: **Handlebars** | CLAUDE.md 명시 — 의존성 추가 시점은 P2.1 |
| 2 | 템플릿 위치: `resources/templates/<playbook>/...` | playbook 별 분리 |
| 3 | 파일 쓰기 전략: **virtual FS → atomic flush** | 부분 실패 시 rollback 가능성 |
| 4 | 기존 디렉토리 비우지 않음 — `--force` 플래그 필수 | 사용자 작업 보호 |
| 5 | 생성 후 자동 `git init`/`npm install` **안 함** | cli-tool.md 의 "사용자 동의 없는 cwd 변경 금지" 일관 |

---

## 4. 비범위 (Out of Scope)

- 신규 플레이북 (Discord 봇, Chrome 확장 등) — 추후 P5+
- LLM 기반 자동 분류 (인터뷰 "기타" 응답 → 옵션) — 추후
- `trellis check` / `doctor` (→ P3, P4)
- 엔트로피 자동 리팩토링 (→ 추후)
- 윈도우 환경 검증

---

## 5. Phase

| Phase | 작업 | 완료 조건 |
|-------|------|----------|
| P2.1 | 템플릿 포맷 설계: Handlebars 헬퍼 셋, 디렉토리 매핑 규약 | `docs/templates.md` 초안 작성 |
| P2.2 | `resources/templates/cli-tool/` — trellis 자기 자신을 다시 생성하는 템플릿 | dogfooding 검증 |
| P2.3 | `service/generator/` — ProjectSpec → virtual file tree (메모리) | 단위 테스트로 트리 형태 검증 |
| P2.4 | `external/fs-writer.ts` — virtual tree → 실제 파일 시스템 (atomic + `--force`) | 단위 테스트 (in-memory) |
| P2.5 | `cmd/new.ts` 통합 — 인터뷰 + 매칭 + 확인 + 생성까지 종단 | 수동: `trellis new test-out` 으로 실제 디렉토리 생성 |
| P2.6 | `resources/playbooks/b2b-saas.json` + 템플릿 + 골든 | 매처가 b2b-saas 답변에 exact 반환 |
| P2.7 | `resources/playbooks/ai-rag-platform.json` + 템플릿 + 골든 | 동일 |
| P2.8 | E2E — 생성된 프로젝트의 `npm install && tsc --noEmit` 자동 실행 | CI 에 추가, 통과 |

---

## 6. 영향 범위

| 대상 | 변경 |
|------|------|
| `src/service/generator/` | 신규 |
| `src/external/fs-writer.ts` | 신규 |
| `src/cmd/new.ts` | generator 호출 추가 |
| `resources/templates/cli-tool/...` | 신규 (다수) |
| `resources/templates/b2b-saas/...` | 신규 |
| `resources/templates/ai-rag-platform/...` | 신규 |
| `resources/playbooks/b2b-saas.json` + meta | 신규 |
| `resources/playbooks/ai-rag-platform.json` + meta | 신규 |
| `tests/golden/{cli-tool,b2b-saas,ai-rag-platform}/` | 신규 (디렉토리별 골든) |
| `tests/e2e/` | 신규 — 자식 프로세스 통합 테스트 |
| `package.json` | `handlebars` 의존성 추가 |
| `.github/workflows/ci.yml` | E2E job 추가 |

---

## 7. 검증 계획 (P2 완료 시)

- [ ] `npm run typecheck / lint / test / dep:check / build` 모두 통과
- [ ] 골든 3건 (cli-tool, b2b-saas, ai-rag-platform) 모두 비교 통과
- [ ] E2E: `trellis new dogfood-cli` 로 생성한 디렉토리에서 `npm install && tsc --noEmit` 통과
- [ ] dogfooding 검증: 생성된 cli-tool 결과물의 구조가 trellis 자기 자신과 동형
- [ ] 매처 라이브 검증: cli-tool 답변 → exact, 일부 변형 → close, b2b-saas 답변 → exact (다른 플레이북)

---

## 8. 완료 기준 (Definition of Done)

- [ ] 위 모든 체크박스 채움
- [ ] `README.md` "상태" 섹션을 `Phase 3 — Validator (check 명령)` 로 갱신
- [ ] 후속 플랜 `docs/plans/03-validator.md` 초안 생성
- [ ] 이 파일을 `docs/plans/completed/02-generator.md` 로 이동
