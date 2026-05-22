# P15 — AST 기반 patch 시스템 (block marker 의존도 감소)

> L5 후반 / L6 진입 게이트.
> P9 의 marker 시스템은 명시적·언어무관·예측가능했지만, **풀바디에 marker 를 미리 심어둬야** 하는 제약이 있다.
> 외부 fragment 카탈로그(L6) 가 의미를 가지려면 카탈로그가 임의 풀바디에 patch 가능해야 — marker 강제는 그 길을 막는다.
> P15 는 marker 시스템을 **폐지하지 않고 공존**시키며 AST 기반 patch 를 옵트인으로 도입한다.

---

## 1. 목표

P15 종료 시점:

- **AST 기반 patch 선언** — `fragment/meta.json` 에 `astPatches` 배열 추가
  - selector 종류 (MVP): `arrayPush`, `objectKey`, `importAdd`
  - entryKey 기반 멱등성 (marker 시스템과 동일 철학)
- **`applyAstPatches` / `removeAstPatches` 서비스** — patcher / un-patcher 와 동형 구조
- **`ts-morph` 파서 의존성** — TS/JS 풀바디 전용 (다언어는 P16+)
- **`trellis add` / `remove` / `upgrade` 모두 AST patch 인식**
- **doctor 신규 규칙** `ast-patch-target-valid` — selector 가 가리키는 노드가 실제로 존재하는지 검증
- **marker 시스템 완전 호환** — 기존 fragment 는 변경 없이 동작
- **L6 enabling technology** — 외부 fragment 카탈로그가 사전 marker 없이 풀바디에 patch 가능

---

## 2. 배경 / 문제

현재 P9~P14 의 marker 기반 시스템:

```ts
// 풀바디가 미리 심어둬야 함
// trellis:slot:nav-items:start
// trellis:slot:nav-items:end
```

제약:
1. **풀바디가 marker 를 미리 심어야 함** — 외부 fragment 가 카탈로그로 배포될 때 임의의 풀바디(또는 다른 카탈로그 fragment 가 만든 산출물)에 patch 불가
2. **marker 가 깨지면 fragment 작동 불가** — `doctor patch-marker-presence` 가 회귀 차단하지만 marker 자체가 풀바디 부채
3. **다언어 풀바디 (Go / Python) 도입 시 marker 주석 문법 통일성은 있으나, 다언어 AST 변형 의미는 언어별로 다름** — marker 만으로는 의미 불분명

P9 가 marker 를 채택한 이유 (`09-fragment-patches.md:46`):
- AST 는 TS 전용, next.js/prisma 버전 의존성 큼
- marker 는 명시적·언어무관·예측가능

P15 는 이 trade-off 를 재평가:
- **marker 의 한계가 실제로 드러남** (외부 카탈로그 L6 의 enabling tech 부재)
- AST 의 비용 (파서 의존성) 은 ts-morph 단일 의존성으로 수용 가능 (오프라인 원칙 유지)
- **공존 전략으로 점진 마이그레이션** — marker 시스템 폐지 없이 옵트인

---

## 3. 결정 사항 (사용자 승인 대기 — 2026-05-21)

> P13/P14 와 동일 패턴: 권장안(번호 1) 채택 여부 알려주세요.
> 모두 권장 채택이면 "권장 전부 OK" 한 줄로 충분.

> **Q-A. 도입 전략 — 컷오버 vs 점진 vs 옵트인 공존**
> **권장 (A1)**: **옵트인 공존** — marker 시스템 그대로 유지, AST 는 `meta.json` 의 새 필드 `astPatches` 로 별도 선언. 한 fragment 가 marker 기반 `patches` 와 AST 기반 `astPatches` 를 동시에 가질 수 있음. 풀바디는 marker 가 있어도 되고 없어도 됨.
> - 장점: ① 기존 fragment 0개 깨짐 (호환성 100%), ② 점진 마이그레이션 가능 (각 fragment 가 독립적으로 결정), ③ marker 의 명시성 가치 보존 — 단순한 케이스는 marker 가 더 읽기 쉬움, ④ L6 카탈로그는 AST 우선 사용
> - 대안: A2 컷오버 (모든 fragment 일제히 AST 로 마이그레이션 — 위험), A3 자동 hybrid (시스템이 fragment 별로 자동 선택 — 복잡, 디버그 어려움), A4 marker 폐지 (외부 호환성 깨짐 — 영구 비범위)

> **Q-B. 파서 선택 — ts-morph vs @babel/parser vs treesitter**
> **권장 (B1)**: **ts-morph** — TypeScript Compiler API 의 사용자 친화 래퍼. TS/JS 단일 파서. 의존성 단일, 오프라인 원칙 유지.
> - 장점: ① 우리 풀바디가 모두 TS/JS (cli-tool / b2b-saas / ai-rag-platform), ② tsc 본체와 같은 파서 — 의미 정확성 보장, ③ API 가 React/Next/Prisma 특정 문법 아님 (프레임워크 의존성 0), ④ Manipulation API 가 직관적 (`.addElement`, `.addProperty`, `.addImport`)
> - 단점: TS 전용 — Go/Python 풀바디 도입 시 별도 어댑터 필요 (Q-G 로 처리)
> - 대안: B2 @babel/parser (TS strict 모드 약함, jsx 강점은 trellis 범위 아님), B3 treesitter (다언어 강점이나 native binding 무겁고 오프라인 설치 까다로움), B4 정규식 (이미 P9 에서 거부됨, marker 와 동등하거나 더 약함)

> **Q-C. AST patch 선언 문법**
> **권장 (C1)**: **선언적 selector + entryKey + content** — `meta.json` 에 `astPatches` 배열 추가. MVP selector 3종:
> ```json
> {
>   "file": "src/lib/nav-items.ts",
>   "astPatches": [
>     {
>       "selector": { "type": "arrayPush", "target": "navItems" },
>       "entryKey": "{{nameKebab}}",
>       "content": "{ label: '{{namePascal}}', href: '/{{nameKebab}}' }"
>     },
>     {
>       "selector": { "type": "importAdd", "from": "./{{nameKebab}}" },
>       "entryKey": "{{nameKebab}}-import",
>       "content": "import { {{namePascal}} } from './{{nameKebab}}';"
>     }
>   ]
> }
> ```
> - **`arrayPush`**: `target` (변수명 또는 export name) 의 배열 끝에 요소 추가
> - **`objectKey`**: `target` 객체에 key-value 추가 (`key` + `content` 분리)
> - **`importAdd`**: import 문 추가 (`from` 기준 중복 방지)
> - **장점**: 선언적이라 사용자 검토 가능, fragment 정의가 self-contained, Handlebars 치환 그대로 적용
> - 대안: C2 JSON Path / JSONata (학습 곡선 큼, AST 와 미스매치), C3 사용자 codemod 함수 실행 (보안/디버그 악몽, 오프라인 원칙 위반 가능), C4 ts-morph API 직접 호출 문자열 (eval — 절대 안 됨)

> **Q-D. 멱등성 메커니즘**
> **권장 (D1)**: **entryKey 기반 — selector 영역 내부에서 entryKey 가 이미 등장하면 skip** (marker 시스템과 동일 철학). 예: `arrayPush` 라면 배열 요소들 중 entryKey 텍스트 포함 여부 검사.
> - 장점: ① 사용자가 entryKey 를 명시 통제 (P9 의 동일 결정 재사용), ② 멱등 알고리즘이 marker 시스템과 동형 — un-patcher 도 같은 패턴
> - 대안: D2 AST 노드 deep equal (포맷/공백 차이로 false negative — 위험), D3 자동 hash 기반 (entryKey 와 동등하지만 사용자 시각화/디버그 어려움)

> **Q-E. 사용자 수정 영역 보호**
> **권장 (E1)**: **add 단계에서 selector 영역 외부는 절대 건드리지 않음. remove 단계에서는 entryKey 매칭 노드만 삭제 — 사용자가 그 노드를 수정했어도(주변 형식 변경 등) entryKey 가 살아있으면 삭제 진행**. 단, entryKey 자체가 사라졌다면 notFound 보고 (P14 패턴 재사용).
> - 장점: ① 사용자 수정 영역에 절대 침범 0, ② P14 의 결정론적 재추론 패턴과 일관 — marker 시스템의 hash diff 와 동형
> - 대안: E2 무조건 적용/삭제 (사용자 수정 손상 위험), E3 AST 노드 deep equal 후 다르면 fail-fast (포맷 차이로 false positive — UX 나쁨)

> **Q-F. P14 (remove) 와의 연동**
> **권장 (F1)**: **`removeAstPatches` 신설** — selector 로 노드 위치 찾고 entryKey 매칭 노드만 삭제. P14 의 `removePatches` 와 동형 결과 스키마 (`removed` / `notFound`). cmd/remove.ts 는 marker patch 와 AST patch 모두 처리.
> - 장점: ① P14 의 라운드트립 보장이 AST 까지 자동 확장, ② un-patcher 와 동형 코드 — 학습 곡선 0
> - 대안: F2 AST remove 비범위 (P14 라운드트립 보장 깨짐 — 치명적), F3 별도 명령 `trellis ast-remove` (UX 분열)

> **Q-G. 다언어 범위**
> **권장 (G1)**: **TS/JS 만 (P15 범위)** — 현재 풀바디가 모두 TS/JS. Go / Python 은 P16+ 의 별도 어댑터 (treesitter 기반)로 처리.
> - 장점: ① 범위 축소로 P15 실현 가능성 확보, ② ts-morph 의 단순성 보존, ③ 다언어 풀바디 도입(P16+) 시점에 별도 결정
> - 대안: G2 처음부터 다언어 (treesitter 채택 강요, 범위 폭증, P15 실현 위험)

> **Q-H. P13 (upgrade) 와의 연동**
> **권장 (H1)**: **migration manifest 스키마 확장** — `resources/migrations/<from>-to-<to>.json` 에 `astPatches` 배열도 선언 가능. upgrade 가 인접 minor 마다 manifest 의 marker patch + AST patch 모두 적용.
> - 장점: ① P13 의 enabling tech 흐름 그대로 재사용, ② 외부 사용자에게는 marker / AST 구분 없이 자동 마이그레이션
> - 대안: H2 upgrade 는 marker 만 (AST 도입 fragment 의 upgrade 가 미적용 — 불일치), H3 별도 명령 (분열)

> **Q-I. doctor 신규 규칙**
> **권장 (I1)**: **`ast-patch-target-valid`** — 각 fragment 의 `astPatches[].selector` 가 실제 풀바디 파일에서 유효한 타겟을 가리키는지 정적 검증. 예: `arrayPush.target: "navItems"` 가 풀바디의 `src/lib/nav-items.ts` 에 export 된 `navItems` 배열로 실제 존재하는지.
> - 장점: ① marker 의 `patch-marker-presence` 와 동형 회귀 차단, ② 풀바디 변경 시 fragment 깨짐 즉시 감지
> - 대안: I2 doctor 규칙 없음 (런타임에 add 시점 발견 — 사용자 마찰 큼)

---

## 4. 비범위

- **다언어 풀바디** (Go / Python) — P16+ (treesitter 기반 별도 어댑터)
- **사용자 코드 자동 refactor** (deprecated API 사용처 변경 등) — trellis 책임 아님 (P13 와 동일)
- **marker 시스템 완전 폐지** — 영구 비범위 (외부 호환성 + dogfooding 부담)
- **사용자 codemod 함수 실행** — 보안/오프라인 원칙 위반
- **AST 기반 check 명령 확장** — P15 범위 아님 (check 는 계층 검증 전용 유지)
- **JSX/TSX 컴포넌트 props 조작** — MVP selector 3종 (arrayPush/objectKey/importAdd) 에 포함 안 함. P16+

---

## 5. Phase

| Phase | 작업 | 완료 조건 |
|-------|------|----------|
| P15.0 | 본 문서 + Q-A~I 사용자 승인 | § 3 마감 |
| P15.1 | `ts-morph` 의존성 추가 + `service/fragment/ast-parser.ts` (Project / SourceFile 로딩 추상화) | 단위 테스트 |
| P15.2 | `service/fragment/ast-patcher.ts` — `applyAstPatches(projectDir, patches, fs)`. selector 3종 (arrayPush / objectKey / importAdd) 멱등 적용 | 단위 테스트 |
| P15.3 | `service/fragment/ast-un-patcher.ts` — `removeAstPatches(...)` 역연산 (P14 와 동형 결과 스키마) | 단위 테스트 (라운드트립 케이스 포함) |
| P15.4 | `service/fragment/types.ts` 확장 — `AstPatchDecl` 타입 + `FragmentMeta.astPatches?: readonly AstPatchDecl[]` | 타입 정의 |
| P15.5 | `service/fragment/loader.ts` 확장 — `astPatches` 파싱 + 유효성 검증 | 단위 테스트 |
| P15.6 | `cmd/add.ts` 통합 — marker patches + AST patches 둘 다 처리. 결과 출력에 양쪽 통합 | 단위 테스트 |
| P15.7 | `cmd/remove.ts` 통합 — 동일. P14 라운드트립 E2E 가 AST 케이스에서도 통과 | 라운드트립 E2E |
| P15.8 | `cmd/upgrade.ts` + manifest schema 확장 — `astPatches` 도 manifest 에서 선언 가능 | 단위 + 골든 |
| P15.9 | `service/doctor/rules/ast-patch-target-valid.ts` 신규 규칙 + 등록 | 단위 + 골든 |
| P15.10 | 첫 AST patch fragment 도입 — b2b-saas 의 기존 `_fragments/page/` 에 `astPatches` 시범 추가 (marker 와 공존, A1 검증) | E2E |
| P15.11 | E2E — 외부 카탈로그 시뮬레이션 (marker 없는 풀바디에 AST patch 만으로 fragment 적용) | E2E |
| P15.12 | 문서 갱신 (`architecture.md` / `CLAUDE.md` / `README.md` / `README.ko.md` / `AGENTS.md`) | 갱신 완료 |
| P15.13 | release-please vN.M.0 머지 → npm 배포 + plan 이동 | npm 배포 |

---

## 6. 영향 범위

| 대상 | 변경 |
|------|------|
| `package.json` | 신규 dep `ts-morph` |
| `src/service/fragment/types.ts` | 수정 — `AstPatchDecl` 타입 + `FragmentMeta.astPatches?` |
| `src/service/fragment/loader.ts` | 수정 — `astPatches` 파싱/검증 |
| `src/service/fragment/ast-parser.ts` | 신규 — ts-morph Project 추상화 + fs 어댑터 연동 |
| `src/service/fragment/ast-parser.test.ts` | 신규 |
| `src/service/fragment/ast-patcher.ts` | 신규 — applyAstPatches (selector 3종) |
| `src/service/fragment/ast-patcher.test.ts` | 신규 |
| `src/service/fragment/ast-un-patcher.ts` | 신규 — removeAstPatches |
| `src/service/fragment/ast-un-patcher.test.ts` | 신규 |
| `src/service/fragment/index.ts` | 수정 — export 추가 |
| `src/cmd/add.ts` | 수정 — astPatches 처리 (marker patches 와 통합 결과) |
| `src/cmd/remove.ts` | 수정 — astPatches 역연산 통합 |
| `src/cmd/upgrade.ts` + `src/service/upgrader/*` | 수정 — manifest 의 `astPatches` 적용 |
| `resources/migrations/schema.json` | 수정 — `astPatches` 스키마 |
| `src/service/doctor/rules/ast-patch-target-valid.ts` | 신규 |
| `src/service/doctor/rules/ast-patch-target-valid.test.ts` | 신규 |
| `resources/templates/b2b-saas/_fragments/page/meta.json` | 수정 — `astPatches` 시범 적용 (P15.10) |
| `tests/e2e/ast-patch-roundtrip-*.e2e.test.ts` | 신규 — add + remove 라운드트립 |
| `tests/e2e/ast-patch-no-marker-fullbody.e2e.test.ts` | 신규 — marker 없는 풀바디에서 AST patch 만으로 fragment 적용 (L6 시뮬레이션) |
| `docs/architecture.md` / `CLAUDE.md` / `README.md` / `README.ko.md` / `AGENTS.md` | 수정 |

---

## 7. 검증 계획

### 자동
- `npm run typecheck && npm run lint && npm run test && npm run dep:check`
- 단위: selector 3종 각각의 멱등성, 사용자 수정 영역 보호, entryKey 매칭
- 골든: ast-patcher 출력 스냅샷 (포맷 안정성)
- E2E:
  - **라운드트립** — `add` (marker + AST) → `remove` 후 트리 일치 (P14 라운드트립의 AST 확장)
  - **marker 없는 풀바디** — `astPatches` 만으로 fragment 적용 가능 (L6 시뮬레이션)
  - **공존** — 한 fragment 가 marker `patches` + `astPatches` 동시 보유 시 둘 다 정확히 적용
- doctor 신규 규칙 통과 — 시범 fragment 의 selector 유효성

### 수동
- ast-patcher 출력의 포맷 일관성 (들여쓰기, 줄바꿈) — prettier 없이도 사람이 읽을 만한지
- 멱등 케이스 verbose 출력 가독성
- AST patch 실패 시 에러 메시지 actionable (`→ <파일> 의 <target> 식별자가 export 되는지 확인하세요>`)

---

## 8. 완료 기준

- [ ] § 3 Q-A~I 사용자 승인
- [ ] `ts-morph` 의존성 추가 + ast-parser 추상화 동작
- [ ] `applyAstPatches` / `removeAstPatches` selector 3종 동작
- [ ] `cmd/add` / `remove` / `upgrade` 모두 AST patch 인식
- [ ] doctor `ast-patch-target-valid` 규칙 통과
- [ ] 시범 fragment (b2b-saas page) 가 marker + AST 공존 모드로 동작
- [ ] 라운드트립 E2E 통과 (P14 라운드트립 + AST)
- [ ] **L6 시뮬레이션 E2E 통과** — marker 없는 풀바디에 AST patch 만으로 fragment 적용 성공
- [ ] 자동/수동 검증 모두 통과
- [ ] 문서 갱신 완료 (AGENTS.md Phase = P0~P15, 다음 마일스톤 = 외부 fragment 카탈로그 L6)
- [ ] release-please vN.M.0 머지 → npm 배포
- [ ] 본 파일을 `docs/plans/completed/15-ast-patch-system.md` 로 이동

---

## 9. 다음 단계 (참고)

P15 종료 후:
- **L6: 외부 fragment 카탈로그 (npm 패키지 형태)** — P15 의 enabling tech 완성으로 실현 가능. 다만 영구 비범위 가능성 잔존 (사용자 수요 검증 필요)
- **P16+: 다언어 풀바디 (Go / Python)** — treesitter 기반 AST 어댑터 별도 도입
- **P16+: JSX/TSX selector 확장** — props 조작, 컴포넌트 wrap 등
- **P16+: `--prune-deps`** — AST import 그래프 분석 기반 (P14 의 C1 보완)
- **P16+: doctor 의 AST 기반 규칙 확장** — 계층 검증 일부를 AST 로
