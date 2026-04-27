# trellis

> 하네스 엔지니어링 방법론을 기계화하는 스캐폴딩 + 검증 CLI.

```bash
$ trellis new my-project        # 방법론 준수 스켈레톤 생성
$ trellis check .               # 계층 규칙 위반 탐지
$ trellis doctor .              # 문서-코드 일관성 점검
```

---

## 왜

AI 에이전트와 함께 프로젝트를 만들 때 **예측 가능한 품질**이 핵심이다.
`harness-engineering/` 에 정리된 방법론 문서를 사람/AI가 매번 해석하는 대신,
**CLI 한 줄**로 동일한 구조를 재현 가능하게 만든다.

상위 방법론 문서: [`harness-engineering/`](../harness-engineering/)

---

## 상태

🚧 **개발 중 — Phase 5 (Release 준비)**

P4 (Doctor) 완료 — `trellis doctor [dir]` 가 필수 파일 존재 + 플레이북
sourceMdHash 동기화를 검사. dogfooding: 트렐리스 자신 + 3 플레이북 모두 통과.
다음: npm publish 자동화, release-please, 첫 버전(0.1.0) 출시.
로드맵은 [`docs/plans/`](docs/plans/).

---

## 지원 플레이북 (MVP 목표)

- `cli-tool` — 단일 바이너리 CLI
- `b2b-saas` — 인증 + 다중 사용자 SaaS
- `ai-rag-platform` — 문서 업로드 + RAG + LLM

---

## 개발

```bash
npm install
npm run build
npm run test
npm run lint
```

---

## 라이선스

MIT — see [LICENSE](LICENSE).
