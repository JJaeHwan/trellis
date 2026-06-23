# trellis — Project Rules

> 이 문서는 하네스 엔지니어링의 핵심입니다.
> 에이전트(AI)가 코드를 생성할 때 반드시 이 규칙을 따라야 합니다.
> 메타-원칙과 플레이북은 `../harness-engineering/` 를 따른다.

---

## 1. 프로젝트 개요

- **이름**: trellis
- **목적**: 하네스 엔지니어링 방법론을 기계화하는 스캐폴딩 + 검증 CLI.
  `trellis new` 로 방법론 규칙을 따르는 프로젝트 스켈레톤을 생성하고,
  `trellis check` / `trellis doctor` 로 기존 프로젝트가 규칙을 지키는지 점검한다.
- **주 사용자**: 본인 (dogfooding). 부차적으로 지인 개발자.
- **매칭 플레이북**: `harness-engineering/playbooks/cli-tool.md` (Exact)

### 기술 스택

| 계층 | 선택 | 비고 |
|------|------|------|
| 런타임 | Node.js ≥ 20 | LTS 기준, `engines.node` 강제 |
| 언어 | TypeScript 5.x (strict) | |
| 패키지 매니저 | npm | Homebrew Node 번들, 제로 설치 비용. pnpm 전환은 workspace 필요 시 재검토 |
| CLI 프레임워크 | commander | 서브커맨드·옵션 파싱 |
| 프롬프트 | @inquirer/prompts | select / input / confirm |
| 템플릿 엔진 | handlebars | `{{PLACEHOLDER}}` 치환 |
| 빌드 | tsup (esbuild) | 단일 엔트리 번들, tsc 대비 ~10× |
| 로거 | pino | silent by default, `HARNESS_DEBUG=1` 토글 |
| 테스트 | vitest | 단위 + 스냅샷 |
| 린트 | eslint + @typescript-eslint | |
| 계층 검증 | dependency-cruiser | self-validation |
| 배포 | npm publish | `release-please` |
| DB / FE / 외부 API | **없음** | 완전 오프라인, stateless |

---

## 2. 아키텍처 계층 규칙

CLI 이므로 Web/DB 계층이 없다. `cli-tool.md` 축약형을 따른다.

```
Layer 0: common     (타입, 예외, 유틸리티 — 프레임워크 의존 금지)
Layer 1: config     (예약 — 미구현; 향후 설정 우선순위 로더. § 5 참조)
Layer 2: domain     (Interview / Playbook / ProjectSpec 등 순수 모델)
Layer 3: external   (파일 시스템, 번들 리소스 접근 — repository 역할)
Layer 4: service    (interview / matcher / generator / validator / doctor / scaffolder / fragment)
Layer 5: cmd        (서브커맨드 엔트리 — new / add / list / upgrade / check / doctor / hello)
```

### 의존성 규칙

| ID | 규칙 |
|----|------|
| DEP-01 | Layer N은 Layer 0..N-1만 import 가능 |
| DEP-02 | common(L0)은 써드파티 프레임워크 의존 금지 (Node 표준 + 로깅 인프라 pino 만) |
| DEP-03 | domain(L2)은 순수 타입/클래스 — I/O 금지 |
| DEP-04 | external(L3)은 I/O 어댑터 — 비즈니스 로직 금지 |
| DEP-05 | cmd(L5)는 얇게 — commander 파싱과 service 호출만 |
| DEP-06 | 네트워크 호출 금지 (MVP 오프라인 원칙) |

### service 서브패키지

```
service/
├── interview/    # 9문항 정의 + 답변 수집
├── matcher/      # 답변 → 플레이북 판정 (Exact / Close / Hybrid / New)
├── generator/    # 템플릿 + 답변 → 파일 트리 렌더
├── scaffolder/   # `trellis new` — 인터뷰 → 매칭 → 생성 오케스트레이션 + `.trellis/spec.json` 직렬화
├── validator/    # `trellis check` — 계층 규칙 위반 탐지
├── doctor/       # `trellis doctor` — 문서-코드 일관성 점검
└── fragment/     # `trellis add` — 플레이북 fragment 로드/렌더/dep merge
```

---

## 3. 코딩 컨벤션

- 클래스/타입: PascalCase
- 함수/변수: camelCase
- 상수: UPPER_SNAKE_CASE
- 파일명: kebab-case (`interview-runner.ts`)
- 예외: `common/exception/`의 커스텀 예외만 사용 (`HarnessError` 등)
- `any` 타입 금지 — `unknown` + 타입 가드
- 반환 타입 명시 (public 함수)
- Optional 반환은 `| undefined` 명시
- 에러는 삼키지 말 것 — 상위로 전파하거나 `HarnessError`로 래핑

---

## 4. CLI 규칙 (cli-tool.md 준수)

- **서브커맨드**: `new` / `add` / `remove` / `list` / `upgrade` / `check` / `doctor` / `hello`
  - `new <dir>` — 인터뷰 후 플레이북 매칭, 새 프로젝트 트리 생성 + `.trellis/spec.json` 기록. `--json` 옵션 시 stdout=결과 단일 라인 JSON (`{ ok, command, projectName, playbookId, matchMode, created, trellisVersion }`) / stderr=인터뷰 프롬프트와 매칭 요약 (UNIX 파이프 친화)
  - `add [type] [name]` — 기존 trellis 프로젝트(=`.trellis/spec.json` 보유)에 fragment 추가. 새 파일은 insert-only, 충돌 시 fail-fast / `--force` 로 덮어쓰기, fragment `meta.json` 의 dependencies 는 `package.json` 에 JSON merge, `patches` 는 풀바디의 block-style slot marker (`// trellis:slot:<name>:start/end`) 사이에 멱등 삽입 (slot 누락 시 fail-fast, `--force` 무관). `astPatches` (P15) 는 풀바디에 marker 가 없어도 ts-morph 기반 selector (`arrayPush` / `objectKey` / `importAdd`) 로 export 된 배열/객체에 entryKey 멱등 삽입. marker 시스템과 공존 (옵트인) — 한 fragment 가 둘 다 가질 수 있음. `--json` 옵션 시 stdout=결과 JSON 단일 라인 / stderr=진행 로그 (UNIX 파이프 친화), `--verbose` 로 멱등 skip entry 도 stderr 노출. 모든 `HarnessError` 메시지에는 `→ <다음 명령 예시>` 형식의 actionable hint 가 포함된다 (slot 누락 / 파일 충돌 / spec.json 부재 등)
  - `list [type]` — 현재 플레이북에서 사용 가능한 fragment 타입 목록 출력 (목록 모드) 또는 특정 타입 상세 출력 (상세 모드). `--json` 옵션으로 구조화 출력 지원
  - `upgrade [targetDir]` — 기존 trellis 프로젝트를 최신 버전으로 마이그레이션. `resources/migrations/<from>-to-<to>.json` manifest 를 인접 minor 단계별 순차 적용 (slot 삽입 등). `--dry-run` 으로 변경 없이 적용 계획 미리보기, `--json` 으로 stdout 단일 라인 JSON 결과 출력, `--force` 로 git working tree dirty 상태 강제 진행. 완료 시 `spec.trellisVersion` 자동 갱신. git working tree clean 검사 기본 수행
  - `remove [type] [name]` — `add` 의 역연산. 같은 (type, name) 으로 fragment 를 다시 로드/렌더하여 식별된 파일 삭제 + slot entry 제거. `package.json` deps 는 보존 (no-op). 사용자가 수정한 파일은 hash diff 로 감지해 fail-fast (`--force` 로 강제 삭제). git working tree clean 기본 검사 (`--force` 로 우회, `--dry-run` 시 검사 생략). `--dry-run` / `--json` / `--verbose` 옵션. 멱등 — 이미 없는 fragment 는 `notFound` 로 보고하고 성공 exit
  - `check <dir>` — 계층 규칙 위반 탐지
  - `doctor <dir>` — 문서-코드 일관성 점검
- **stdin/stdout 1등 시민** — 파이프 친화적
- **exit code**: `0`=성공, `1`=일반 오류, `2`=사용자 입력 오류, `3+`=도구 고유
- `--json` 플래그로 구조화 출력 제공 (특히 `check`)
- **설정 우선순위 (위가 최상위)**:
  1. CLI flag (`--playbook cli-tool`)
  2. 환경변수 (`HARNESS_*`)
  3. 설정 파일 (`~/.config/trellis/config.json`, 존재 시)
  4. 내장 기본값
  → 즉 `flag > env > file > default`. 뒤의 것은 앞이 없을 때만 적용.
  → **현 시점 미구현 — 예약된 목표 설계.** 현재는 `HARNESS_DEBUG` 만 `src/common/logger` 가 직접 읽는다. 통합 우선순위 로더는 향후 L1(`src/config/`)에 도입한다.
- **TTY 감지** — 파이프면 컬러/스피너 off
- stdout에 진행바·컬러 이스케이프 직접 박지 않는다 (`picocolors` + `process.stdout.isTTY`)
- 사용자 지정 없이 현재 디렉토리에 임의 파일 생성 금지
- 매 실행 네트워크 체크 금지 (MVP는 네트워크 자체 없음)

---

## 5. 설정 규칙

> **상태: L1 config 계층은 예약(미구현)이다.** 아래는 향후 도입할 목표 설계이며,
> 현 MVP 는 config 계층 없이 동작한다 — 유일한 런타임 설정 입력은 `HARNESS_DEBUG` 로
> `src/common/logger` 가 직접 읽는다. `src/config/` 는 `.gitkeep` 로 slot 만 예약돼
> 있고(dependency-cruiser 의 L1 규칙도 예약 유지), 통합 우선순위 로더 도입 시 채운다.

- 설정 위치(목표): `~/.config/trellis/config.json` (선택)
- 환경변수 접두사(목표): `HARNESS_*` (예: `HARNESS_TEMPLATE_DIR`)
- MVP는 설정 파일 없이도 동작해야 함

---

## 6. 테스트 규칙

- 프레임워크: **vitest**
- 테스트 범위:
  - **단위**: matcher / interview / generator 순수 로직 (모든 PR)
  - **골든 스냅샷**: 고정 인터뷰 답변 → 파일 트리 diff (`tests/__golden__/`, 모든 PR)
  - **E2E**: 실제 `trellis new` 서브프로세스 → 생성 결과의 타입체크/린트 통과 (Phase 2 이후, 머지 전 1회)
- 테스트 파일 위치 (엄격히 분리):
  - **단위 테스트**: `src/**/*.test.ts` — 소스 바로 옆
  - **골든 스냅샷 / E2E**: `tests/golden/`, `tests/e2e/` — 루트 `tests/` 아래
  - `src/` 와 `tests/` 양쪽에 같은 대상 중복 배치 금지
- 테스트명: `{함수}_{조건}_{기대결과}`
- 파일 I/O 는 인터페이스로 추상화 → 단위 테스트에서 in-memory 어댑터로 대체

---

## 7. Git 규칙

- 브랜치: `feature/*`, `fix/*`, `refactor/*`, `docs/*`
- 커밋: Conventional Commits (`feat:`, `fix:`, `refactor:`, `test:`, `docs:`, `chore:`)
- PR 머지 전 요구사항:
  - 타입체크 통과
  - 린트 통과
  - 단위 + 골든 테스트 통과
  - `docs/plans/NN-*.md` 있을 것 (비자명한 작업 시)

---

## 8. 플랜 문서 규약

- 위치: `docs/plans/`
- 파일명: `NN-title-kebab.md` (예: `00-initial-skeleton.md`)
- 템플릿: `harness-engineering/templates/plan-template.md`
- 완료 시 `docs/plans/completed/`로 이동

---

## 9. 금지 사항

- [ ] 네트워크 호출 (MVP 오프라인 원칙)
- [ ] L5(cmd)에 비즈니스 로직
- [ ] 계층 역방향 의존 (예: service → cmd)
- [ ] `any` 타입
- [ ] stdout에 이스케이프 코드 직접 (`\x1b[...`)
- [ ] stdout 에 진행바 (stderr 로)
- [ ] 프로덕션 코드의 `console.log` (구조화된 logger 사용)
- [ ] 하드코딩된 경로 — 모두 `config` 경유
- [ ] `trellis new` 가 사용자 지정 없이 cwd 덮어쓰기
- [ ] 플랜 문서 없는 비자명한 PR

---

## 10. 이 프로젝트의 특수 규칙 (self-referential)

이 CLI 자체도 하네스 규칙의 **적용 대상**이다 (dogfooding).

- `trellis` 저장소 자체가 `cli-tool.md` 플레이북의 구조를 **정확히** 따른다
- CI 에서 `npm run dep:check` 로 계층 규칙을 자기 검증 (dependency-cruiser 래핑)
- `trellis check .` 를 자기 자신에게 실행해도 통과해야 한다 (Phase 3 이후)
- `trellis doctor .` 를 자기 자신에게 실행해도 통과해야 한다 (Phase 4 이후)
- `trellis add` 의 자기참조성: trellis 본체는 `cli-tool` 플레이북을 따르고, 현재 MVP 에선 cli-tool fragment 가 별도 단계로 분리되어 있으므로 자기 자신에 적용할 fragment 가 아직 없다 — 본체 dogfooding 측면에선 현 시점 NA. b2b-saas / ai-rag 플레이북 사용자에게만 의미가 있다.
- 풀바디 보완(P8): b2b-saas / ai-rag-platform 풀바디는 사이드바(`Sidebar.tsx` + `nav-items.ts`) 와 라우트 그룹 레이아웃을 포함한다. 본체(cli-tool) 의 계층 규칙에는 영향 없음 — `resources/templates/` 내부 산출물.
- Fragment patches (P9): b2b-saas / ai-rag-platform 풀바디의 `nav-items.ts` 에 block-style marker 가 심어져 있고, `page` fragment 가 add 될 때 `applyPatches` 로 사이드바 메뉴가 자동 등록된다. doctor 의 `patch-marker-presence` 규칙이 marker 회귀를 차단. 본체(cli-tool) 에는 patch 대상 풀바디가 없어 자기 자신에 대한 영향 없음.
- Fragment 카탈로그 확장(P10): b2b-saas 풀바디에 `_fragments/model/` (Prisma 모델 + Zod + Repository + 테스트, prisma-models / services 2개 슬롯 동시 patch) 과 `_fragments/service/` (서비스 클래스 + 테스트, services 슬롯 patch) 가 추가됨. 풀바디에는 `prisma/schema.prisma` 끝의 `prisma-models` 슬롯과 `src/lib/services.ts` 의 `services` 슬롯이 미리 심어져 있다. 본체(cli-tool) 적용 대상 없음.
- Fragment 카탈로그 확장(P11): b2b-saas 풀바디에 `_fragments/form/` (Form 컴포넌트 + Server Action + Zod 한 묶음) 과 `_fragments/admin/` (CRUD 페이지 = page + Table + Filter + actions, `admin-items` + `breadcrumb` 2슬롯 동시 multi-slot patch) 가 추가됨. 풀바디에는 `src/lib/nav-items.ts` 의 `admin-items` 슬롯과 `src/lib/breadcrumb-map.ts` (신규) 의 `breadcrumb` 슬롯이 미리 심어져 있고, 풀바디 자체 `.dependency-cruiser.cjs` 가 fragment 결과의 계층 규칙을 검증한다. doctor `handlebars-token-valid` 규칙이 `.hbs` 토큰을 사전 검증. 본체(cli-tool) 적용 대상 없음.
- Fragment 카탈로그 확장(P12): cli-tool 풀바디에 `_fragments/command/` (commander 서브커맨드 + index.ts imports/commands 2슬롯 multi-slot patch) 과 `_fragments/service-module/` (src/service/<name>/ 서브패키지 4파일, patches 없음) 가 추가됨. cli-tool 본체 dogfooding 완성 — `trellis add command <name>` 으로 자기 자신에 fragment 적용 가능. doctor `playbook-still-supported` 규칙 (P12 마무리) 으로 알 수 없는 playbookId 감지.
- 방법론 문서(`harness-engineering/`)의 규칙과 충돌이 생기면 그것은 **문서의 결함** — 문서를 고친다
- 외부 채택 게이트 완성(P13): `trellis upgrade` 가 도입되어 trellis 진화 비용을 사용자가 아닌 trellis 가 흡수한다. `resources/migrations/<from>-to-<to>.json` migration manifest 가 minor release 별 변경 (신규 slot marker / 신규 필수 파일) 을 선언하고, upgrade 가 인접 minor 만 순차 적용한다. doctor `upgrade-pending` 규칙 (P13 마무리) 이 minor 차이 시 안내. **L5 진입 게이트 — 공공시스템 채택 가능**.
- L5 도구 완성도 마무리(P14): `trellis remove` 가 도입되어 `add` ↔ `remove` 사이클이 라운드트립으로 닫힌다. 결정론적 재추론 (spec.json 스키마 변경 없음) — `(playbookId, type, name)` 으로 fragment 를 다시 로드해 add 가 만든 파일/patch 집합을 산출하고 그대로 제거한다. `package.json` deps 는 보존 (참조 카운팅 비용/위험 회피, `--prune-deps` 는 P15+ 검토). 사용자 수정 파일은 hash diff 로 감지 후 `--force` 없이 fail-fast. block marker (P9 의 채택 사유 중 하나가 remove 의 entry 식별 자명성) 기반 patch 역연산이 검증됨 — P15 AST patch 시스템의 enabling tech.
- L6 enabling tech 완비(P15): AST 기반 patch 시스템 도입 — `meta.json` 의 `astPatches` 배열로 ts-morph 기반 selector (`arrayPush` / `objectKey` / `importAdd`) 를 선언. 풀바디에 marker 가 없어도 fragment 적용 가능 → 외부 fragment 카탈로그 (L6) 의 enabling tech. marker 시스템 (P9) 완전 호환 유지 (옵트인 공존, A1) — 한 fragment 가 marker `patches` 와 `astPatches` 동시 보유 가능. ts-morph 의 in-memory 모드 (5중 차단) 로 오프라인 원칙 준수. doctor `ast-patch-target-valid` 규칙이 풀바디의 selector target export 유효성 검증. add/remove/upgrade 모두 AST patch 인식, P14 라운드트립이 AST 까지 자동 확장.
