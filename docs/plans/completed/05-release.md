# P5 — Release (npm publish + release-please)

> 첫 공개 버전(0.1.0) 을 npm 에 배포하고 자동화한다.

---

## 1. 목표

이 플랜이 끝나면:

- `trellis@0.1.0` 이 npm 레지스트리에 공개돼 있다
- `npm i -g trellis` 로 누구나 설치 가능
- `release-please` 가 main 푸시 시 자동으로 release PR 생성
- CHANGELOG.md 가 Conventional Commits 기반으로 자동 생성됨
- README 에 "Status" 가 "Released" 로 갱신

---

## 2. 결정 사항 (P5.1 에서 확정)

| # | 결정 | 비고 |
|---|------|------|
| 1 | 첫 버전: **0.1.0** | 0.0.x 는 "프리리얼리스" 로 보고 0.1 부터 정식 |
| 2 | 자동화: release-please (Google) | Conventional Commits 친화 |
| 3 | npm publish 권한: **`NPM_TOKEN` GitHub secret** | 본인 계정 기반 |
| 4 | 첫 publish 는 수동 검증 후 | 이후 자동 |

---

## 3. 비범위

- Homebrew tap (P5.5+ 추후)
- 단일 바이너리 (pkg/ncc) — 추후
- 멀티-OS 매트릭스 — npm 단독으로 충분

---

## 4. Phase

| Phase | 작업 |
|-------|------|
| P5.1 | `package.json` 의 `engines`, `files`, `keywords` 등 메타 보강 |
| P5.2 | `.github/workflows/release.yml` — release-please 통합 |
| P5.3 | npm publish 토큰 등록 + 첫 수동 dry-run |
| P5.4 | 0.1.0 첫 publish + 검증 (`npx trellis --version`) |
| P5.5 | README 의 "Install" 섹션 갱신 + "Status: Released" |

---

## 5. 영향 범위

| 대상 | 변경 |
|------|------|
| `package.json` | `keywords`, `homepage`, `bugs`, `publishConfig` 추가 |
| `.github/workflows/release.yml` | 신규 |
| `CHANGELOG.md` | 신규 (release-please 가 생성) |
| `README.md` | "Install" + "Status" 갱신 |

---

## 6. 검증 계획

- [ ] `npm pack --dry-run` → 의도한 파일만 포함됨 (no .test.ts, no fixtures)
- [ ] release-please 액션이 PR 만듦
- [ ] PR 머지 → npm publish 자동 실행
- [ ] `npm view trellis version` → 0.1.0
- [ ] 새 머신에서 `npm i -g trellis && trellis --version` 동작

---

## 7. 완료 기준 (Definition of Done)

- [ ] 위 모든 체크박스
- [ ] 0.1.0 npm 게시
- [ ] README 의 "Status" → "Released v0.1.0"
- [ ] 이 파일을 `docs/plans/completed/05-release.md` 로 이동

---

이후 (P6+): 사용자 피드백 기반 개선, 추가 플레이북 (Discord 봇 / Chrome 확장 등),
ESLint 9 마이그레이션, b2b-saas / ai-rag-platform 풀 템플릿 채우기.
