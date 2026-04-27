# P4 — Doctor (`trellis doctor`)

> 문서(CLAUDE.md / architecture.md) ↔ 코드 / 디렉토리 구조 일관성 검사.

---

## 1. 목표

이 플랜이 끝나면:

- `trellis doctor [dir]` 가 다음 불일치를 탐지한다:
  1. CLAUDE.md 에 선언된 스택과 실제 의존성 (예: "프론트엔드: Next.js" 인데 frontend/ 없음)
  2. architecture.md 의 계층 목록과 실제 src/ 하위 폴더명 불일치
  3. `docs/plans/` 디렉토리 누락
  4. **플레이북 sourceMd 해시 불일치** — 메서돌로지 MD 가 변경됐는데 JSON spec 안 갱신
- 위반 0건 → exit 0, 1건+ → exit 1
- `--json` 플래그 지원

---

## 2. 배경

`trellis check` 는 코드 내부의 **계층 규칙** 위반만 본다. 하지만 시간이 지나면서
**문서와 실제 구조가 어긋나는** 또 다른 종류의 엔트로피가 발생한다. 예:
- README/CLAUDE.md 에 적힌 의존성과 package.json 의 실제 의존성이 다름
- architecture.md 의 디렉토리 다이어그램이 옛 구조 그대로
- 플레이북 MD 가 수정됐는데 JSON spec (sourceMdHash) 미갱신

P4 는 이를 자동 탐지한다.

---

## 3. 결정 사항 (P4.1 에서 확정)

| # | 결정 | 비고 |
|---|------|------|
| 1 | 검사 룰: 4 종류 (스택 ↔ 의존성, 계층 ↔ 폴더, plans/ 존재, sourceMdHash) | 더 추가는 추후 |
| 2 | 플레이북 sourceMdHash 검사: 모든 트렐리스 자체에서만 (자기 자신 dogfooding) | 일반 프로젝트에는 무의미 |
| 3 | CLAUDE.md 파싱: 가벼운 정규식 + 헤더 기반 (full markdown parse 아님) | 안정성보다 단순함 우선 |

---

## 4. 비범위

- 의존성 보안 검사 (CVE) — npm audit 의 영역, 별도
- 라이선스 호환 검사 — 별도
- 자동 수정 (`fix` 명령) — 추후

---

## 5. Phase

| Phase | 작업 |
|-------|------|
| P4.1 | 룰 1: CLAUDE.md 스택 선언 ↔ package.json 의존성 |
| P4.2 | 룰 2: architecture.md 계층 목록 ↔ src/ 하위 폴더명 |
| P4.3 | 룰 3: docs/plans/ 디렉토리 존재 + 형식 |
| P4.4 | 룰 4: 플레이북 sourceMdHash ↔ harness-engineering MD 의 실제 해시 |
| P4.5 | `cmd/doctor.ts` + `--json` + dogfooding |

---

## 6. 영향 범위

| 대상 | 변경 |
|------|------|
| `src/service/doctor/` | 신규 |
| `src/cmd/doctor.ts` | 신규 |
| `src/cmd/index.ts` | `registerDoctorCommand` 추가 |

---

## 7. 검증 계획

- [ ] fixture 프로젝트 (clean / 4 종류 위반) 에서 정확한 룰 트리거
- [ ] `trellis doctor .` (자기 자신) 통과
- [ ] `--json` 출력 유효한 JSON

---

## 8. 완료 기준 (Definition of Done)

- [ ] 위 모든 체크박스
- [ ] `README.md` 상태 → `Phase 5 (Release)`
- [ ] `docs/plans/05-release.md` 초안 생성
- [ ] 이 파일을 `docs/plans/completed/04-doctor.md` 로 이동
