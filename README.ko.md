# trellis

> 하네스 엔지니어링 방법론을 기계화하는 스캐폴딩 + 검증 CLI.

[![npm](https://img.shields.io/npm/v/@woghks096/trellis.svg)](https://www.npmjs.com/package/@woghks096/trellis)
[![license](https://img.shields.io/npm/l/@woghks096/trellis.svg)](LICENSE)

```bash
$ trellis new my-project        # 방법론 준수 스켈레톤 생성
$ trellis list                  # 현재 플레이북에서 사용 가능한 fragment 목록
$ trellis list command          # command fragment 상세 정보 (--json 지원)
$ trellis add command greet     # cli-tool: commander 서브커맨드 추가 + index.ts 자동 등록
$ trellis add api users         # 기존 프로젝트에 fragment 추가 (필요 시 사이드바 등 기존 파일에 멱등 patch 적용)
$ trellis add model Invoice     # Prisma 모델 + Zod + Repository 한 묶음 추가 (b2b-saas)
$ trellis add admin Invoice     # CRUD 페이지 (Table + Filter + actions) + 사이드바/breadcrumb 자동 등록 (b2b-saas)
$ trellis remove admin Invoice  # add 의 역연산 — CRUD 페이지 및 자동 등록 항목 제거 (b2b-saas)
$ trellis upgrade [dir]         # 프로젝트를 최신 trellis 버전으로 마이그레이션 (slot 삽입 + spec.json 버전 갱신)
$ trellis check .               # 계층 규칙 위반 탐지
$ trellis doctor .              # 문서-코드 일관성 점검
```

---

## 설치

```bash
npm i -g @woghks096/trellis
trellis --version
```

또는 일회성 실행:

```bash
npx @woghks096/trellis new my-project
```

---

## Fragment Patch 시스템

Fragment 가 프로젝트를 확장하는 두 가지 방식:

- **Block-style marker** — 템플릿이 `// trellis:slot:<name>:start/end` 블록을 선언하고, fragment entry 가 그 사이에 멱등 삽입 (entryKey 기준).
- **AST patch** (P15) — `astPatches` 를 가진 fragment 는 ts-morph selector (`arrayPush`, `objectKey`, `importAdd`) 로 marker 없이 export 갱신. 기본 템플릿 수정 없이 외부 fragment 카탈로그 구현 가능.

두 메커니즘이 공존 — 하나의 fragment 가 marker + AST patch 를 함께 가질 수 있음.

---

## 왜

AI 에이전트와 함께 프로젝트를 만들 때 **예측 가능한 품질**이 핵심이다.
`harness-engineering/` 에 정리된 방법론 문서를 사람/AI가 매번 해석하는 대신,
**CLI 한 줄**로 동일한 구조를 재현 가능하게 만든다.

상위 방법론 문서: [`harness-engineering/`](../harness-engineering/)

---

## 상태

✅ **npm 배포 중** (최신 버전은 [상단 배지](https://www.npmjs.com/package/@woghks096/trellis) 참조) — **L5 (공공시스템 채택 게이트) 진입, L6 enabling tech 완비**

P0~P15 완료: 스캐폴딩 / 인터뷰 / 생성기 / 검증기 / 닥터 / `trellis add` (fragment + multi-slot patch) / `trellis remove` (add 의 멱등 역연산 — 라운드트립) / `trellis list` (목록·상세·`--json`) / `trellis upgrade` (migration manifest, 멱등 slot 삽입, `--dry-run`/`--force`) / cli-tool 자기 적용 fragments (`command` + `service-module`) / ts-morph 기반 **AST patch 시스템** (`arrayPush` / `objectKey` / `importAdd` — marker 불필요, block marker 와 공존). 모든 명령에 `--json` 옵션, actionable error hints, doctor 8규칙.
release-please 가 main 으로의 `feat:`/`fix:` 커밋을 추적해 자동 release PR 을 만들고 (`extra-files` 로 버전 상수 동기화), npm publish 는 Trusted Publishing (OIDC + provenance) 으로 게시된다.
로드맵은 [`docs/plans/`](docs/plans/).

---

## 지원 플레이북 (MVP 목표)

- `cli-tool` — 단일 바이너리 CLI
- `b2b-saas` — 인증 + 다중 사용자 SaaS (사이드바 + authed 라우트 그룹 포함)
- `ai-rag-platform` — 문서 업로드 + RAG + LLM (사이드바 포함)

---

## 개발

```bash
npm install
npm run build
npm run test
npm run lint
```

---

## English version

[English README →](README.md)

---

## 라이선스

MIT — see [LICENSE](LICENSE).
