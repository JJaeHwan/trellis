# P0 — Initial Skeleton

> trellis 저장소에 실행 가능한 `hello` 서브커맨드까지 갖춘 최소 뼈대를 세운다.
> 이 단계가 끝나면 이후 플랜(P1: 인터뷰, P2: 플레이북, P3: 검증기, …)은
> 동일한 구조 위에서 **덧붙이기**로 진행할 수 있다.

---

## 1. 목표

이 플랜이 완료되면:

- `npm install && npm run build` 가 깨끗이 통과한다
- `node dist/cmd/index.js hello` 가 `Hello from trellis` 을 stdout 에 출력한다
- CI (GitHub Actions) 가 타입체크 + 린트 + 단위 테스트 + 계층 검증을 돌린다
- 계층 규칙 위반 0건 (`dependency-cruiser`)
- 이후 플랜은 이 골조 위에 `service/*` 모듈을 채워가기만 하면 된다

---

## 2. 배경 / 문제

`harness-engineering/` 에 방법론 문서는 있지만 **기계화되지 않은 상태**.
사람/AI가 매번 문서를 해석해 프로젝트를 구성한다 → 재현성 없음, dogfooding 불가.

P0 는 아직 인터뷰/매처/제너레이터 **로직은 없다**. 오직 구조(계층 디렉토리) + 실행 가능성(hello) + 자동 검증(CI) 만 확보한다. 기능은 P1 이후에 붙인다.

---

## 3. 결정 사항

| # | 결정 | 왜 (대안 대비) |
|---|------|---------------|
| 1 | 언어: TypeScript (strict) | 훈련셋 풍부 + 번들 유리. JS 만으로는 도메인 모델 검증 취약 |
| 2 | 패키지 매니저: **npm** | Homebrew Node 번들, 전역 설치 불필요. workspace 필요해지면 pnpm 전환 |
| 3 | CLI 프레임워크: commander | Boring Tech — oclif 보다 가볍고 러닝커브 낮음 |
| 4 | 빌드: **tsup** (esbuild 래퍼) | 단일 엔트리 번들, 데코레이터 설정 불필요. `tsc` 대비 10배 빠름 |
| 5 | 테스트: vitest | jest 대비 ESM 친화, 설정 거의 0 |
| 6 | 린트: eslint + @typescript-eslint | 표준 |
| 7 | 계층 검증: **dependency-cruiser** | ESLint boundaries 대비 선언적이고 CI 출력 친화적 |
| 8 | 엔트리: `src/cmd/index.ts` → `dist/cmd/index.js` → `bin.harness = ./dist/cmd/index.js` | CLI 라이브러리 관례 |
| 9 | 로그: **pino** (silent by default) + `HARNESS_DEBUG=1` 토글 | console 직접 사용 금지 방침과 일관 |
| 10 | 리소스 번들 위치: `resources/templates/`, `resources/playbooks/` (루트) | `src/` 에 두면 빌드 대상으로 오해. 별도 폴더로 분리 |

---

## 4. 비범위 (Out of Scope)

이번 플랜에서 **하지 않는다**:

- 인터뷰 로직 (→ P1)
- 플레이북 매칭 (→ P1)
- 템플릿 렌더링 / 파일 생성 (→ P1)
- `trellis check` 검증기 (→ P3)
- `trellis doctor` (→ P4)
- npm publish / release-please (→ P5)
- Windows 환경 지원 (→ 추후)
- 실제 템플릿 파일 작성 (구조만 존재, 파일은 빈 placeholder)

---

## 5. Phase

| Phase | 작업 | 완료 조건 |
|-------|------|----------|
| P0.1 | `package.json` + `tsconfig.json` + `package-lock.json` | `npm install` 성공 |
| P0.2 | 디렉토리 골격 생성 (L0~L5 + tests + resources) | 각 폴더에 `.gitkeep` 또는 최소 파일 |
| P0.3 | 공통 모듈 최소 구현 (`common/errors/HarnessError.ts`, `common/logger/index.ts`) | 타입체크 통과 |
| P0.4 | `cmd/index.ts` + `cmd/hello.ts` | `npm run build && node dist/cmd/index.js hello` 동작 |
| P0.5 | vitest 설정 + `common/logger` 첫 단위 테스트 1개 | `npm run test` 통과 |
| P0.6 | eslint 설정 + `npm run lint` 통과 | 경고 0건 |
| P0.7 | dependency-cruiser 설정 (L0..L5 역방향 금지) | `npm run dep:check` 통과 |
| P0.8 | GitHub Actions CI (`.github/workflows/ci.yml`) | PR 시 타입체크/린트/테스트/dep:check 돌고 통과 |

---

## 6. 영향 범위

| 대상 | 변경 | 비고 |
|------|------|------|
| `package.json` | 신규 | scripts: build/test/lint/dep:check |
| `tsconfig.json` | 신규 | strict, target ES2022, moduleResolution bundler |
| `src/common/**` | 신규 | `errors/`, `logger/` 최소 |
| `src/cmd/index.ts` | 신규 | commander 진입점 |
| `src/cmd/hello.ts` | 신규 | sanity check 서브커맨드 |
| `src/config/` | 빈 골격 | `.gitkeep` |
| `src/domain/` | 빈 골격 | `.gitkeep` |
| `src/external/` | 빈 골격 | `.gitkeep` |
| `src/service/{interview,matcher,generator,validator,doctor}/` | 빈 골격 | 각각 `.gitkeep` |
| `resources/templates/` | 빈 골격 | `.gitkeep` |
| `resources/playbooks/` | 빈 골격 | `.gitkeep` |
| `tests/` | 신규 | 최소 단위 테스트 1개 |
| `.dependency-cruiser.cjs` | 신규 | L0..L5 규칙 |
| `.eslintrc.cjs` | 신규 | 표준 |
| `.github/workflows/ci.yml` | 신규 | 타입체크 + 린트 + 테스트 + dep:check |
| `.gitignore` | 신규 | `node_modules/`, `dist/`, `.DS_Store` |

---

## 7. 검증 계획

- [ ] `npm install` — 에러 없이 완료
- [ ] `npm run build` — tsup 번들 성공, `dist/` 생성
- [ ] `npm run typecheck` — 타입 오류 0건
- [ ] `npm run lint` — 경고 0건
- [ ] `npm run test` — 최소 1개 테스트 통과
- [ ] `npm run dep:check` — 계층 위반 0건
- [ ] `node dist/cmd/index.js hello` — `Hello from trellis` 출력, exit 0
- [ ] `node dist/cmd/index.js --version` — package.json 버전 출력
- [ ] `node dist/cmd/index.js --help` — commander 도움말 출력
- [ ] GitHub Actions CI — main 푸시 시 초록
- [ ] 수동 확인: `npm link && trellis hello` 도 동일하게 동작

---

## 8. 완료 기준 (Definition of Done)

- [ ] 위 모든 체크박스 채움
- [ ] `README.md` 의 "상태" 섹션을 `Phase 1 — 인터뷰 엔진 준비` 로 갱신
- [ ] 후속 플랜 `docs/plans/01-interview-engine.md` 초안 생성 (하위 Phase까지만)
- [ ] 이 파일을 `docs/plans/completed/00-initial-skeleton.md` 로 이동
