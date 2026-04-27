# Agent Instructions — trellis

> 이 파일은 Claude Code / Codex / 기타 에이전트 진입점이다.
> **전체 규칙은 [`CLAUDE.md`](CLAUDE.md) 에 있다.** 먼저 그것을 읽어라.

---

## 필수 읽기 순서

1. [`CLAUDE.md`](CLAUDE.md) — 이 프로젝트의 규칙 (스택, 계층, 컨벤션, 금지사항)
2. [`docs/architecture.md`](docs/architecture.md) — 모듈 설계와 의존 방향
3. [`docs/plans/`](docs/plans/) — 진행 중/완료된 플랜 확인 (작업 맥락)
4. 상위 방법론: [`../harness-engineering/AGENTS.md`](../harness-engineering/AGENTS.md) — 메타 규칙

---

## 당신의 역할

이 저장소에서 작업할 때 **다음 원칙**을 지킨다:

1. **코드보다 하네스부터** — 비자명한 변경은 `docs/plans/NN-*.md` 먼저 작성
2. **계층 역방향 의존 금지** — L5 → L4 → L3 → L2 → L1 → L0 (상위가 하위를 참조)
3. **네트워크/외부 API 사용 금지** (MVP 오프라인 원칙)
4. **dogfooding 원칙** — 이 CLI가 스스로의 규칙을 통과해야 한다
5. **Boring Tech** — 새 의존성 추가는 타당한 이유가 있을 때만

---

## 현재 상태

- **Phase**: P0 — 스켈레톤 준비 중 (문서만 존재, 코드 미생성)
- **다음 마일스톤**: `docs/plans/00-initial-skeleton.md` 의 체크리스트 실행
