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

## 왜

AI 에이전트와 함께 프로젝트를 만들 때 **예측 가능한 품질**이 핵심이다.
`harness-engineering/` 에 정리된 방법론 문서를 사람/AI가 매번 해석하는 대신,
**CLI 한 줄**로 동일한 구조를 재현 가능하게 만든다.

상위 방법론 문서: [`harness-engineering/`](../harness-engineering/)

---

## 상태

✅ **Released v0.10.0** ([npm](https://www.npmjs.com/package/@woghks096/trellis)) — **L4 (매일 쓰는 도구) 졸업**

P0~P12 완료: 스캐폴딩 / 인터뷰 / 생성기 / 검증기 / 닥터 / `trellis add` (fragment + multi-slot patch) / `trellis list` (목록·상세·`--json`) / cli-tool 자기 적용 fragments (`command` + `service-module`). 모든 명령에 `--json` 옵션, actionable error hints, doctor 5규칙.
release-please 가 main 으로의 `feat:`/`fix:` 커밋을 추적해 자동 release PR 을 만든다 (`extra-files` 로 버전 상수 3곳도 자동 동기화).
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
