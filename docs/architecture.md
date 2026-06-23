# Architecture — trellis

---

## 1. 시스템 구성도

```
[Terminal User]
      │
      ▼
 ┌─────────────────────────────────────────────────┐
 │  trellis (Node.js CLI, 오프라인)            │
 │                                                 │
 │  L5 cmd/       new · add · remove · list · upgrade · check · doctor · hello │
 │     │                                           │
 │  L4 service/   interview · matcher · generator  │
 │     │          · scaffolder · validator         │
 │     │          · doctor · fragment              │
 │     │                                           │
 │  L3 external/  FileSystem · TemplateLoader      │
 │     │          · PlaybookLoader · SpecLoader    │
 │     │          · FragmentTypesLoader            │
 │     │                                           │
 │  L2 domain/    Interview · Playbook · ProjectSpec│
 │     │                                           │
 │  L1 config/    (reserved)                       │
 │     │                                           │
 │  L0 common/    types · errors · logger · tty    │
 └─────────────────────────────────────────────────┘
      │                    │
      ▼                    ▼
 [Bundled Resources]       [User Filesystem]
  templates/                ./my-project/ (new — `.trellis/spec.json` 기록)
   <id>/_fragments/         ./existing-project/ (add — `.trellis/spec.json` 읽기)
  playbooks/                ./any-project/ (check, doctor)
```

데이터베이스, 웹 서버, 외부 API 호출 — **없음**.

---

## 2. 계층 구조

```
src/
├── common/           # L0 — 프레임워크 무관 유틸
│   ├── types/        # 공용 타입
│   ├── errors/       # HarnessError, InterviewError, ValidationError
│   ├── logger/       # TTY 감지 기반 로거 (stderr)
│   └── result/       # Result<T, E> 타입
│
├── config/           # L1 — 예약(미구현): 향후 설정 로드 (default/env/flag/file)
│   └── .gitkeep       # slot 예약 — settings.ts 는 로더 도입 시 추가
│
├── domain/           # L2 — 순수 도메인 모델
│   ├── interview.ts    # Question, Option, Answer, InterviewResult
│   ├── playbook.ts     # Playbook, PlaybookSpec, MatchMode
│   └── project-spec.ts # ProjectSpec (생성 입력 결과)
│
├── external/         # L3 — I/O 어댑터
│   ├── fs-adapter.ts            # 파일 시스템 래퍼 (테스트 대체 가능)
│   ├── fs-writer.ts             # VirtualTree → 디스크 쓰기
│   ├── template-loader.ts       # 번들 templates/ 읽기
│   ├── playbook-loader.ts       # 번들 playbooks/ 읽기
│   ├── interview-loader.ts      # 번들 questions.json 읽기
│   ├── lang-detector.ts         # 언어 감지 (package.json/pom.xml/…)
│   ├── spec-loader.ts           # `.trellis/spec.json` 읽기 (add 진입점)
│   └── fragment-types-loader.ts # `_fragments/<type>/` 디렉토리 열거
│
├── service/          # L4 — 핵심 로직
│   ├── interview/    # 9문항 정의 + 답변 수집 루프
│   ├── matcher/      # 답변 → 플레이북 매칭 (Exact/Close/Hybrid/New)
│   ├── generator/    # Handlebars 템플릿 → 파일 트리 생성
│   ├── scaffolder/   # `new` 오케스트레이션 + `.trellis/spec.json` 직렬화
│   ├── validator/    # `check` — 계층 규칙 검사
│   ├── doctor/       # `doctor` — 문서-코드 일관성 검사
│   ├── fragment/     # `add` — fragment 로드/렌더 + package.json dep merge
│   │   ├── ast-parser.ts     # ts-morph 추상화 (P15)
│   │   ├── ast-patcher.ts    # AST 기반 add (P15)
│   │   └── ast-un-patcher.ts # AST 기반 remove (P15)
│   └── upgrader/     # 버전 마이그레이션 (`trellis upgrade`) — manifest 로더 + applier + git 상태 검사
│
└── cmd/              # L5 — commander 엔트리
    ├── index.ts      # 메인 엔트리 (bin)
    ├── new.ts
    ├── add.ts        # `trellis add [type] [name]`
    ├── remove.ts     # `trellis remove [type] [name]` — add 의 역연산 (P14)
    ├── list.ts       # `trellis list [type]` — fragment 목록/상세/JSON (P12)
    ├── upgrade.ts    # `trellis upgrade [targetDir]` — migration manifest 순차 적용 (P13)
    ├── check.ts
    ├── doctor.ts
    └── hello.ts      # P0 sanity check용
```

### 번들 리소스 (런타임에 읽기 전용)

```
resources/
├── templates/
│   ├── CLAUDE.md.hbs
│   ├── architecture.md.hbs
│   ├── plan-00.md.hbs
│   ├── gitignore.hbs
│   ├── ci.yml.hbs
│   └── <playbookId>/
│       ├── src/                # 풀바디 산출물 (b2b-saas, ai-rag-platform)
│       │   ├── app/            # Next.js App Router 라우트
│       │   ├── components/     # Sidebar.tsx.hbs 등 공용 컴포넌트
│       │   └── lib/            # nav-items.ts.hbs (nav-items + admin-items slot),
│       │                        # breadcrumb-map.ts.hbs (breadcrumb slot, b2b-saas P11),
│       │                        # services.ts.hbs (b2b-saas)
│       │                        # db/, zod/, service/ 등 fragment 가 채우는 서브디렉토리
│       ├── .dependency-cruiser.cjs  # 풀바디 자체 계층 검증 (b2b-saas P11)
│       └── _fragments/
│           └── <type>/         # add 가 렌더하는 부분 단위 (meta.json + *.hbs)
│                               # b2b-saas: api, page, model, service, form, admin
│                               # ai-rag-platform: api, page
│                               # cli-tool: command (imports+commands 2슬롯 multi-slot patch),
│                               #           service-module (src/service/<name>/ 4파일, patches 없음)
├── migrations/
│   ├── schema.json            # migration manifest JSON schema (검증용)
│   └── 0.9.0-to-0.10.0.json  # 인접 minor 마이그레이션 — cli-tool imports+commands 슬롯 삽입 + spec.trellisVersion 갱신
└── playbooks/
    ├── cli-tool.json          # 매처 입력 — 기계 판독용 스펙
    ├── cli-tool.meta.json     # 원본 MD 경로 + 버전 기록
    ├── b2b-saas.json
    ├── b2b-saas.meta.json
    ├── ai-rag-platform.json
    └── ai-rag-platform.meta.json
```

#### 풀바디 네비게이션 구조 (P8 보완)

- `b2b-saas`
  - `src/components/Sidebar.tsx.hbs` — 좌측 고정 사이드바 (정적, 토글 없음)
  - `src/lib/nav-items.ts.hbs` — `{ label, href }[]` 메뉴 데이터
  - `src/app/(authed)/layout.tsx.hbs` — authed 라우트 그룹 레이아웃, Sidebar 임포트
  - `src/app/(authed)/dashboard/`, `src/app/(authed)/admin/` — authed 그룹 안에 배치
  - `(auth)/login`, `(auth)/register` 에는 사이드바 미표시
- `ai-rag-platform`
  - `src/components/Sidebar.tsx.hbs`, `src/lib/nav-items.ts.hbs` — 동일 패턴
  - `src/app/layout.tsx.hbs` — 인증 라우트가 없으므로 root layout 에 Sidebar 직접 통합
- 두 플레이북 공통
  - Sidebar 와 nav-items 는 별도 파일로 분리되어 향후 fragment patch 의 marker 주입 대상이 됨
  - 아이콘 라이브러리, 토글, 헤더, 모바일 햄버거 메뉴는 비범위 — 사용자가 필요 시 추가

#### 플레이북 MD ↔ JSON 관계 (중요 설계 결정)

| 구분 | MD (`harness-engineering/playbooks/*.md`) | JSON (`resources/playbooks/*.json`) |
|------|------------------------------------------|-------------------------------------|
| 역할 | **사람이 읽는 상세 설명서** (왜/언제/주의점) | **매처 로직 입력** (질문·옵션·점수·치환 규칙) |
| 진실원본 | MD 가 원본 (사람이 직접 작성·수정) | JSON은 MD에서 **파생** (P1에서 초기엔 수작업 동기화) |
| 동기화 | `*.meta.json` 에 `sourceMd`, `sourceMdHash` 기록 → `trellis doctor` 가 MD 수정 탐지 시 경고 | |
| 중복 판단 | MD 는 산문, JSON 은 구조화 데이터 — **중복 아님** | |

**원칙:**
- MD 를 수정하면 관련 JSON 도 **반드시** 같은 PR 에서 갱신 (`sourceMdHash` 가 다르면 CI 실패)
- JSON 직접 수정 후 MD 미반영은 금지 — MD 를 먼저 고치고 JSON 전파
- 추후(Phase 4+) `trellis sync-playbooks` 로 MD→JSON 파싱 자동화 여지 있음 (MVP 범위 밖)

---

## 3. 주요 플로우

### 3.1 `trellis new <dir>` 흐름

```
[사용자]
  ↓  trellis new my-docai
cmd/new.ts
  ↓  파싱 (commander)
service/interview
  ↓  9문항 순차 제시 (@inquirer/prompts)
  ↓  답변 수집 → Answer[]
service/matcher
  ↓  Answer[] + Playbook[] → MatchResult
  ↓  (Exact / Close / Hybrid / New 중 하나)
[확인 프롬프트]
  ↓  사용자 OK
service/generator
  ↓  ProjectSpec → Handlebars 렌더
external/fs-adapter
  ↓  파일 트리 생성
[완료 메시지 + 다음 단계 안내]
```

### 3.2 `trellis add [type] [name]` 흐름

```
[사용자]
  ↓  trellis add api users   (in existing trellis project)
cmd/add.ts
  ↓  파싱 (commander) + `.trellis/spec.json` 존재 가드
external/spec-loader
  ↓  ProjectSpec 복원 (playbookId + placeholders)
external/fragment-types-loader
  ↓  resources/templates/<playbookId>/_fragments/ 디렉토리 열거
  ↓  (type / name 인자 누락 시 인터랙티브 fallback)
service/fragment/loader
  ↓  _fragments/<type>/meta.json + *.hbs 로드
service/fragment/renderer
  ↓  buildFragmentContext({name, namePascal, nameKebab, nameCamel, nameSnake, ...spec})
  ↓  Handlebars 렌더 → VirtualTree
cmd/add.ts (checkConflicts)
  ↓  기존 파일 존재 시 fail-fast (--force 로 덮어쓰기)
external/fs-adapter
  ↓  writeTree — 파일 트리 쓰기 (insert-only — 기존 파일 수정 X)
service/fragment/dep-patcher
  ↓  patchPackageJson — meta.dependencies 가 있으면 package.json JSON merge
  ↓  버전 충돌은 경고만 출력하고 기존 값 유지
service/fragment/patcher (P9)
  ↓  applyPatches — meta.patches 가 있으면 풀바디의 block-style slot marker 에 삽입
  ↓  entryKey 멱등 검사로 두 번 적용해도 중복 X
  ↓  slot marker 누락 시 fail-fast (--force 무관)
[완료 메시지 — `--json` 시 stdout 단일 라인 JSON]
```

#### Patch 적용 흐름 (P9, P10 확장)

- 풀바디 템플릿이 미리 심어둔 block-style marker 사이에 fragment 가 텍스트를 삽입한다.
  - 형식: `// trellis:slot:<name>:start` ... `// trellis:slot:<name>:end`
  - 같은 슬롯 이름이 한 파일에 두 번 있으면 첫 번째 쌍에만 삽입한다 (단순화).
- `entryKey` 멱등성 — start..end 사이에 같은 `entryKey` 가 이미 있으면 silent skip (정상 케이스). `--verbose` 로 표시.
- slot 누락 시 fail-fast — 풀바디 템플릿 자체의 버그로 간주하며 `--force` 로 우회 불가.
- `--force` 는 파일 충돌 한정 — entry 중복 멱등성은 우회하지 않는다 (UI 데이터 손상 방지).
- patch 는 insert-only — replace/delete 없음.
- rollback 없음 — 실패 시 부분 적용 상태가 남을 수 있으므로 git 으로 복구한다.
- **Multi-slot patch (P10)** — 하나의 fragment 가 `meta.patches` 배열로 여러 파일/슬롯을 동시에 갱신할 수 있다. 예: `model` fragment 가 `prisma/schema.prisma` 의 `prisma-models` 슬롯과 `src/lib/services.ts` 의 `services` 슬롯을 한 번의 add 로 함께 패치. 각 entry 는 독립적으로 멱등 검사된다.
- **Multi-slot patch — admin fragment 예시 (P11)** — `admin` fragment 는 `src/lib/nav-items.ts` 의 `admin-items` 슬롯과 `src/lib/breadcrumb-map.ts` 의 `breadcrumb` 슬롯을 한 번의 add 로 동시에 패치한다 (사이드바 admin 메뉴 + breadcrumb 라벨 동시 등록). 두 entry 모두 `/admin/{{nameKebab}}` 를 `entryKey` 로 사용하여 멱등성을 보장.
- Prisma 슬롯 호환성 — `// trellis:slot:<name>:start/end` 는 Prisma 가 한 줄 주석을 허용하므로 schema 파싱에 영향이 없다.

#### `--json` / `--verbose` 출력 (P10, P11 확장)

- `trellis add <type> <name> --json` — stdout 에 결과 단일 라인 JSON, stderr 에 진행 로그. UNIX 파이프 친화 (`trellis add model Invoice --json | jq ...`).
- 스키마: `{ "command": "add", "created": string[], "patches": { applied: number, skipped: number, conflicts: string[] } }`.
- `--verbose` — 멱등 skip 된 entry 도 stderr 에 표시 (디버깅용).
- 실패는 `HarnessError` 로 전파되며 메시지 끝에 `→ <다음 명령 예시>` 형식의 actionable hint 가 붙는다 (slot 누락 / 파일 충돌 / spec.json 부재 등).
- `trellis new <projectName> --json` (P11) — 동일한 패턴. stdout 에 결과 단일 라인 JSON (`{ ok, command: "new", projectName, playbookId, matchMode, created, trellisVersion }`), stderr 에 인터뷰 프롬프트와 매칭 요약. 실패 시 `{ ok: false, command: "new", error: { code, message, hint? } }`. 자동화 파이프라인이 매칭 결과와 생성 파일 목록을 그대로 파싱할 수 있다.

### 3.3 `trellis list [type]` 흐름

```
cmd/list.ts
  ↓  파싱 (commander) + `.trellis/spec.json` 존재 가드
external/spec-loader
  ↓  ProjectSpec 복원 (playbookId)
external/fragment-types-loader
  ↓  resources/templates/<playbookId>/_fragments/ 디렉토리 열거
  ↓  (type 인자 있으면 해당 type 의 meta.json 로드 → 상세 모드)
cmd/list.ts
  ↓  --json: stdout 단일 라인 JSON, 없으면 사람 읽기 좋은 표 출력
  ↓  exit code: 0=성공, 1=오류 (spec.json 부재 등)
```

- **목록 모드** (`trellis list`) — 현재 프로젝트 플레이북에서 사용 가능한 fragment 타입 목록 출력
- **상세 모드** (`trellis list <type>`) — 해당 fragment 의 `meta.json` 설명 + patches 정보 상세 출력
- **`--json`** — 두 모드 모두 stdout 단일 라인 JSON 지원 (UNIX 파이프 친화)

### 3.4 `trellis upgrade [targetDir]` 흐름

```
[사용자]
  ↓  trellis upgrade ./my-project   (또는 현재 디렉토리)
cmd/upgrade.ts
  ↓  파싱 (commander) + `.trellis/spec.json` 존재 가드
service/upgrader/git-status
  ↓  git working tree clean 검사 (--force 없으면 dirty 시 fail-fast)
service/upgrader/manifest-loader
  ↓  spec.trellisVersion → 현재 버전 간 인접 minor 경로 탐색
  ↓  resources/migrations/<from>-to-<to>.json 순차 로드
service/upgrader/applier
  ↓  각 manifest 의 steps 순차 적용 (slot 삽입, 파일 추가 등)
  ↓  --dry-run: 실제 변경 없이 적용 계획 출력
  ↓  멱등성: 이미 적용된 step 은 silent skip
service/upgrader/orchestrator
  ↓  spec.trellisVersion 자동 갱신 (최신 버전으로)
  ↓  --json: stdout 단일 라인 JSON 결과 / stderr 진행 로그
[완료 메시지]
```

- **`--dry-run`** — 파일 미변경, 적용 예정 step 목록만 출력 (자동화 사전 검토용)
- **`--json`** — stdout 단일 라인 JSON (`{ ok, command, from, to, steps: { applied, skipped } }`), stderr 진행 로그
- **`--force`** — git working tree dirty 상태에서도 강제 진행
- **인접 minor 전용** — 0.9.0→0.10.0→0.11.0 처럼 한 단계씩 순차 적용 (건너뜀 금지)
- **오프라인** — 네트워크 없이 번들된 `resources/migrations/` 만 사용

### 3.3 `trellis check <dir>` 흐름

```
cmd/check.ts
  ↓
service/validator
  ↓  대상 프로젝트 언어 감지 (package.json / pom.xml / go.mod / pyproject.toml)
  ↓  언어별 어댑터 선택
  ↓    - ts/js → dependency-cruiser 룰 생성 후 자식 프로세스 호출
  ↓    - java  → ArchUnit 테스트 실행 (Phase 2+)
  ↓    - py    → import-linter
  ↓    - go    → 커스텀 `go list` 분석 (Phase 3+)
  ↓  위반 목록 수집
cmd/check.ts
  ↓  --json 플래그 있으면 JSON, 없으면 사람 읽기 좋게
  ↓  exit code: 위반 0건 → 0, 1건+ → 1
```

### 3.5 `trellis doctor <dir>` 흐름

```
cmd/doctor.ts
  ↓
service/doctor
  ↓  CLAUDE.md 파싱 → 선언된 스택/계층 추출
  ↓  architecture.md 파싱 → 디렉토리 구조 선언 추출
  ↓  실제 파일 시스템 스캔
  ↓  3자 교차 비교:
  ↓    - CLAUDE.md 에 frontend 있다고 선언 → frontend/ 있는가?
  ↓    - architecture.md 계층명 ↔ 실제 폴더명 일치?
  ↓    - docs/plans/ 디렉토리 존재?
  ↓  불일치 리스트 반환
```

---

## 4. 도메인 모델 (요약)

```ts
// domain/interview.ts
interface Question {
  id: string;                      // "1", "2", ...
  label: string;                   // "프로젝트 목적"
  options: Option[];
  recommendation?: string;         // option id
}
interface Option {
  id: string;                      // "A", "B", ...
  label: string;
  description: string;
  pros: string[];
  cons: string[];
}
interface Answer {
  questionId: string;
  selectedOptionId: string;        // "A" | "B" | ... | "OTHER"
  freeformNote?: string;           // "기타" 선택 시
}

// domain/playbook.ts
interface Playbook {
  id: string;                      // "cli-tool"
  title: string;
  matchRules: MatchRule[];         // 인터뷰 답변 → 점수
  templateSet: string;             // resources/templates/cli-tool/...
}
// 내부(TS 유니온)는 lowercase, 외부(사람 읽는 출력)는 Capitalize.
// 변환은 domain/playbook.ts 의 displayMatchMode 함수만 사용 (L0 common 으로 끌어내리면 계층 위반).
type MatchMode = "exact" | "close" | "hybrid" | "new";
interface MatchResult {
  mode: MatchMode;
  primary: Playbook;
  secondary?: Playbook;            // hybrid
  score: number;                   // 0.0 ~ 1.0
  diff: string[];                  // close 의 차이점
}
// domain/playbook.ts (요지)
//   export function displayMatchMode(m: MatchMode): string {
//     return m[0].toUpperCase() + m.slice(1);   // "exact" → "Exact"
//   }
// 금지: CLI 출력에서 "exact" 소문자 그대로 표시

// domain/project-spec.ts
interface ProjectSpec {
  projectName: string;
  rootPath: string;
  playbook: Playbook;
  answers: Answer[];
  placeholders: Record<string, string>;   // CLAUDE.md.hbs 치환값
}
```

---

## 5. 외부 연동

**없음 (MVP).**

향후 확장 여지 (지금 구현 안 함):
- GitHub API — `trellis playbook add github:user/repo`

### 풀바디 자체 dependency-cruiser (P11)

- b2b-saas 풀바디 템플릿은 자체 `.dependency-cruiser.cjs` 를 포함한다 (`resources/templates/b2b-saas/.dependency-cruiser.cjs`). `trellis new` 로 생성된 사용자 프로젝트에 그대로 복사되어, 사용자가 `npm run dep:check` (또는 trellis check) 시 `src/lib/{common,config,domain,external,db,zod,service}` 와 `src/{app,components}` 사이의 단방향 의존성을 검증한다.
- 본체(trellis) 의 `.dependency-cruiser.cjs` 와는 별개 — 본체는 자신의 L0..L5 를 검증하고, 풀바디용 cjs 는 사용자 프로젝트의 b2b-saas 계층을 검증한다.
- fragment add 결과 (model: zod+db, service: service, form: components+zod, admin: app(authed)/admin) 가 이 규칙을 만족하도록 fragment 가 작성되어 있다 — 사용자 프로젝트에서 fragment 결과를 dep-cruiser 가 즉시 회귀 차단.

---

## 6. 파이프라인 / 비동기 처리

**없음.** CLI 는 단일 스레드 순차 실행.
대용량 파일 스트리밍 등이 필요한 상황은 MVP 범위 밖.

---

## 7. 보안 / 권한

- 생성 대상 경로는 **사용자가 명시적으로 지정**해야 함 (`trellis new <dir>`)
- 기존 디렉토리 덮어쓰기는 `--force` 플래그 필수
- `trellis add` 의 충돌 정책 — 새로 생성하는 파일이 이미 있으면 fail-fast, `--force` 가 있을 때만 덮어쓰기. 기존 파일 수정은 명시된 `patches` 슬롯에 한해 허용 (P9)
- `trellis add` 의 dep merge — fragment `meta.json` 의 `dependencies` 는 `package.json` 에 JSON merge. 같은 이름이 이미 있고 버전이 다르면 stderr 경고만 출력하고 기존 값을 유지
- `trellis add` 의 patch — fragment `meta.json` 의 `patches` 는 풀바디의 block-style marker (`// trellis:slot:<name>:start/end`) 사이에 삽입. `entryKey` 로 멱등 보장, slot 누락 시 fail-fast (--force 무관)
- `trellis doctor` 의 `patch-marker-presence` 규칙 (P9) — 번들 템플릿이 fragment `meta.patches` 가 가리키는 slot marker 를 잃지 않았는지 검사하여 회귀를 차단
- `trellis doctor` 의 `trellis-version-compat` 규칙 (P10) — 대상 프로젝트의 `.trellis/spec.json.trellisVersion` 이 현재 실행 중인 trellis 와 semver minor 단위로 호환되는지 검사. major 가 다르면 warning, spec.json 부재 시 no-op
- `trellis doctor` 의 `handlebars-token-valid` 규칙 (P11) — 번들 `resources/templates/` 하위 모든 `.hbs` 파일을 스캔하여, 사용된 `{{token}}` / `{{helper arg}}` 가 컨텍스트 (풀바디 = `GeneratorContext`, fragment = `FragmentContext`) 에 정의된 키/헬퍼인지 검증. 풀바디·fragment 별로 허용 키가 분리되어 있고, 미정의 토큰 (오탈자, 신규 fragment 의 컨텍스트 누락) 을 사전 차단
- `trellis doctor` 의 `playbook-still-supported` 규칙 (P12) — 대상 프로젝트의 `.trellis/spec.json.playbookId` 가 현재 번들된 playbooks/ 에 존재하는지 검사. 알 수 없는 playbookId 를 가진 프로젝트를 조기 탐지하여 `add` / `check` 실패 전 경고
- `trellis doctor` 의 `upgrade-pending` 규칙 (P13) — 대상 프로젝트의 `.trellis/spec.json.trellisVersion` 이 현재 trellis minor 버전보다 낮을 때 `info` severity 로 `trellis upgrade` 실행을 안내. spec.json 부재 시 no-op
- 설정 파일(`~/.config/trellis/`)에 비밀값 저장 금지

---

## 8. 배포 / 환경

| 환경 | 방식 |
|------|------|
| 로컬 개발 | `npm install && npm link` |
| 테스트 | vitest (단위/골든) + 자식 프로세스 E2E (Phase 2+) |
| 배포 | `npm publish` via `release-please` GitHub Action |
| 배포 타겟 | npm registry 공개 |

Node.js ≥ 20, OS: macOS / Linux (Windows 는 Phase 2+ 검증).

---

## 9. 모니터링

**없음 (CLI).** `HARNESS_DEBUG=1` 환경변수로 stderr 에 상세 로그.

---

## 10. 자기 검증 (self-referential)

이 저장소 자체가 `cli-tool.md` 구조를 따르므로:

- CI 에서 `npm run dep:check` 로 L0..L5 역방향 의존성 0건 확인 (dependency-cruiser 래핑)
- Phase 3 이후: `trellis check .` 를 자신에게 실행 → 통과 유지
- Phase 4 이후: `trellis doctor .` 자기 자신에게 실행 → 통과 유지
- `trellis add` 자기 적용 (P12): cli-tool 풀바디에 `_fragments/command/` 와 `_fragments/service-module/` 이 추가되어, trellis 본체에 `trellis add command <name>` / `trellis add service-module <name>` 을 직접 실행할 수 있다. cli-tool dogfooding 완성 — `src/cmd/index.ts` 의 imports/commands 슬롯에 multi-slot patch 로 자동 등록.

---

## 11. 변경 이력 (주요 단계)

- P6 — b2b-saas / ai-rag-platform 풀바디 템플릿 초도 작성
- P7 — `trellis add` (fragment) 명령 도입
- P8 — 풀바디 네비게이션 보완 (Sidebar / nav-items / authed layout)
- P9 (2026-05-19): fragment patches — meta.json.patches, block-style marker, applyPatches, doctor 규칙
- P10 (2026-05-19): b2b-saas model + service fragment, multi-slot patch 검증, trellis add --json, actionable errors, doctor trellis-version-compat
- P11 (2026-05-19): b2b-saas form + admin fragment (multi-slot patch), admin-items + breadcrumb slot 인프라, trellis new --json, 풀바디 dep-cruiser, doctor handlebars-token-valid
- P12 (2026-05-19): trellis list 추가 (목록·상세·--json), cli-tool _fragments/command (imports+commands 2슬롯 multi-slot patch) + _fragments/service-module (src/service/<name>/ 4파일), doctor playbook-still-supported, actionable error 일관성 마무리
- P13 (2026-05-19): trellis upgrade 신설 (migration manifest 시스템, cmd + service/upgrader/), doctor upgrade-pending 규칙, L5 진입 게이트 (공공시스템 채택 가능 상태)
- P14 (2026-05-21): trellis remove 신설 (cmd/remove.ts + service/fragment/un-patcher + un-writer + FsAdapter.deleteFile), add ↔ remove 라운드트립 E2E, deps 보존 정책 (Q-C C1)
- P15 (2026-05-21): AST 기반 patch 시스템 (ts-morph + selector 3종 arrayPush/objectKey/importAdd), marker 시스템과 옵트인 공존, doctor ast-patch-target-valid 규칙, migration manifest astPatches 확장, L6 외부 fragment 카탈로그 enabling tech
