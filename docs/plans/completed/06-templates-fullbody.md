# P6 — Templates Fullbody (b2b-saas + ai-rag-platform)

> 현재 스텁 4개 파일(`CLAUDE.md`, `LICENSE`, `README`, `TODO`)만 있는
> b2b-saas / ai-rag-platform 플레이북을 실제 동작하는 스캐폴드로 만든다.

---

## 1. 목표

P6 종료 시점:

- `trellis new` 로 b2b-saas / ai-rag-platform 선택 시 **빌드/실행 가능한 프로젝트** 생성
- 골든 트리 테스트 + E2E 테스트 (`tsc --noEmit` + `lint` 통과) 추가
- `trellis check` / `trellis doctor` 가 생성된 프로젝트에서 통과
- 두 플레이북 모두 dogfooding 원칙 준수

---

## 2. 핵심 결정사항 (필요)

### 2.1 스택 선택 — 풀바디 vs 경량

상위 `harness-engineering/playbooks/` 의 prescription:
- **b2b-saas**: Spring Boot/NestJS/FastAPI **백엔드** + Next.js 프론트 + PostgreSQL
- **ai-rag-platform**: Spring Boot/FastAPI + Next.js + PostgreSQL + pgvector + Ollama

**문제**: 멀티-언어 멀티-프로세스 스캐폴드는 trellis 가 다루는 단순 파일 트리 생성 범위를 넘는다 (Docker compose, DB migration, multi-package workspace 등).

**옵션**:

| 옵션 | 설명 | 난이도 | 정합성 |
|------|------|--------|--------|
| **A. Full prescription** | Spring Boot + Next.js + Postgres docker-compose 전부 | 매우 높음 | 플레이북 문서 그대로 |
| **B. TS-only 경량 슬라이스** | Next.js (App Router) + Prisma/Drizzle + 내장 API routes 만 | 보통 | 플레이북 문서 수정 필요 |
| **C. 백엔드/프론트 분리하되 둘 다 TS** | NestJS API + Next.js 프론트 + Prisma | 높음 | 부분 수정 |

**추천**: **B (TS-only)**

근거:
- trellis 자체가 Node 생태계, dogfooding 친화
- 첫 사용자(본인)의 빠른 적용 가능
- Spring Boot 백엔드는 부족함 발견 시 P6.5 또는 별도 플레이북 (`b2b-saas-spring`) 으로 분리
- 플레이북 문서는 "추천 스택" 이므로 다른 옵션 추가 가능
- 핵심 가치(인증/RLS/RAG 파이프라인) 는 언어 무관

이 옵션 선택 시 `harness-engineering/playbooks/b2b-saas.md` 와 `ai-rag-platform.md` 에 **TS 변형 섹션 추가** 필요.

### 2.2 풀바디 범위 — 무엇까지 포함하나

각 플레이북의 **최소 동작 단위(MVP slice)**:

#### b2b-saas (TS slice)
- Next.js 14+ App Router + TypeScript
- Auth: NextAuth.js (Email/Password + JWT)
- DB: Prisma + SQLite (dev) — Postgres 는 사용자 선택 환경변수로
- 화면: `/`, `/login`, `/register`, `/dashboard`, `/admin`
- API: `/api/auth/*`, `/api/me`, `/api/admin/users`
- 권한: `role` 필드 + middleware
- Tailwind CSS (선택 — README 안내)
- CI: typecheck + lint + Prisma generate

#### ai-rag-platform (TS slice)
- Next.js 14+ App Router
- DB: Prisma + Postgres (pgvector 확장 안내)
- 업로드: `app/api/documents/route.ts` (multer-style)
- 파싱: `pdf-parse` (PDF), `mammoth` (DOCX)
- 임베딩 인터페이스 (`OllamaEmbedder`, `OpenAIEmbedder` 두 구현)
- 벡터 검색: 원시 SQL (`<-> ` 연산자)
- Chat: SSE 스트리밍 라우트
- 화면: `/`, `/documents`, `/documents/[id]`, `/chat`
- LLM 인터페이스 (`OllamaLlm`, `OpenAiLlm`, `ClaudeLlm`)
- CI: typecheck + lint + Prisma generate

**제외**:
- 결제 연동 (Stripe 등) — 별도 플랜
- 이메일 발송 — 별도 플랜
- 프로덕션급 Docker compose — README 안내만
- Recovery codes / 2FA — 별도 플랜

### 2.3 인터뷰 질문 갱신

현재 `interview.json` 9문항 → b2b-saas / ai-rag 매칭에 필요한 추가 질문:
- DB 선호 (SQLite / Postgres / Mongo)
- 인증 (NextAuth / Clerk / 자체)
- LLM 사용 범위 (RAG / 단순 prompt / 없음)
- 임베딩 provider (Ollama 로컬 / OpenAI / 무관)

매처 점수 가중치 재조정 — 골든 트리 테스트로 회귀 방지.

---

## 3. Phase 분할

| Phase | 작업 |
|-------|------|
| **P6.0** | 본 문서 + 사용자 합의 (옵션 A/B/C 결정, 범위 확정) |
| **P6.1** | `harness-engineering/playbooks/b2b-saas.md` 에 "TS 변형 (Next.js)" 섹션 추가 (옵션 B 시) |
| **P6.2** | b2b-saas 템플릿 풀바디 — 디렉토리 트리, `package.json.hbs`, `prisma/schema.prisma.hbs`, `app/` 라우트들 |
| **P6.3** | b2b-saas 골든 트리 테스트 + E2E (`npx tsc --noEmit` 통과 검증) |
| **P6.4** | b2b-saas 매처 가중치 + 인터뷰 갱신 |
| **P6.5** | `ai-rag-platform.md` TS 변형 섹션 |
| **P6.6** | ai-rag 템플릿 풀바디 |
| **P6.7** | ai-rag 골든 + E2E |
| **P6.8** | ai-rag 매처 + 인터뷰 갱신 |
| **P6.9** | doctor 검증 통과 (`sourceMdHash` 동기화) |
| **P6.10** | release-please 자동 0.2.0 발행 |

---

## 4. 비범위

- 옵션 A (Spring Boot 풀바디) — 별도 플레이북으로 분리 (P9+)
- 결제, 이메일, 멀티 테넌트, recovery code — P7~ 로 분리
- Mobile / Desktop UI — 다른 플레이북

---

## 5. 검증 계획

### 자동
- `npm run typecheck && npm run lint && npm run test` (trellis 본체)
- `tests/golden/b2b-saas-tree.test.ts` — 인터뷰 답변 → 파일 트리 diff
- `tests/e2e/scaffold-b2b-saas.e2e.test.ts` — 실제 생성 후 `npm i && tsc --noEmit`
- `tests/golden/ai-rag-tree.test.ts` + `tests/e2e/scaffold-ai-rag.e2e.test.ts`

### 수동
- `npx @woghks096/trellis@0.2.0 new my-saas` → b2b-saas 선택 → 생성된 프로젝트에서 `npm i && npm run dev` → `localhost:3000` 동작 확인
- 동일하게 ai-rag → 업로드/검색 데모

---

## 6. 영향 범위

| 대상 | 변경 |
|------|------|
| `harness-engineering/playbooks/b2b-saas.md` | TS 변형 섹션 추가 |
| `harness-engineering/playbooks/ai-rag-platform.md` | TS 변형 섹션 추가 |
| `resources/playbooks/b2b-saas.json` | 트리 정의 확장 |
| `resources/playbooks/ai-rag-platform.json` | 트리 정의 확장 |
| `resources/playbooks/*.meta.json` | `sourceMdHash` 갱신 |
| `resources/templates/b2b-saas/**` | 풀 트리 신규 (~30 파일) |
| `resources/templates/ai-rag-platform/**` | 풀 트리 신규 (~35 파일) |
| `resources/interview.json` | 질문 추가 |
| `src/service/matcher/` | 가중치 재조정 |
| `tests/golden/*.test.ts` | 신규 |
| `tests/e2e/*.test.ts` | 신규 |

---

## 7. 완료 기준 (Definition of Done)

- [x] 옵션 결정 + 본 문서 사용자 승인 (옵션 B — TS-only)
- [x] 두 플레이북 모두 풀 트리 생성 (b2b-saas 36 파일, ai-rag-platform 45 파일)
- [x] 골든 + E2E 테스트 통과 (79/79)
- [x] `trellis check . && trellis doctor .` 둘 다 통과
- [x] release-please 가 v0.2.0 PR 생성 → 머지 → npm 배포 (Session B 추가분은 v0.3.0+ 로 후속)
- [x] 본 파일을 `docs/plans/completed/06-templates-fullbody.md` 로 이동

---

## 8. 위험 요소

| 위험 | 대응 |
|------|------|
| 30~35 파일 템플릿 작성 분량 큼 | Phase 분할 + Conventional Commits 단위 PR |
| 템플릿 안의 `{{handlebars}}` 와 TS 의 `${...}` 충돌 | escape 또는 partial 활용 |
| Prisma schema 가 인터뷰 답변에 따라 분기 (DB 선택) | 조건부 partial — `{{#if (eq db "postgres")}}...{{/if}}` |
| pgvector 미설치 환경에서 ai-rag 생성 시 README 안내만으로 충분한가 | E2E 는 Postgres 없이 typecheck/lint 만 검증, DB 의존 부분은 mock |
| LLM 키 없는 환경에서 ai-rag 동작 검증 | 더미 provider 기본값 + README 가이드 |
