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
 │  L5 cmd/       new · add · check · doctor · hello │
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
 │  L1 config/    settings loader                  │
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
├── config/           # L1 — 설정 로드 (default/env/flag/file)
│   └── settings.ts
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
│   └── fragment/     # `add` — fragment 로드/렌더 + package.json dep merge
│
└── cmd/              # L5 — commander 엔트리
    ├── index.ts      # 메인 엔트리 (bin)
    ├── new.ts
    ├── add.ts        # `trellis add [type] [name]`
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
│       └── _fragments/
│           └── <type>/        # add 가 렌더하는 부분 단위 (meta.json + *.hbs)
└── playbooks/
    ├── cli-tool.json          # 매처 입력 — 기계 판독용 스펙
    ├── cli-tool.meta.json     # 원본 MD 경로 + 버전 기록
    ├── b2b-saas.json
    ├── b2b-saas.meta.json
    ├── ai-rag-platform.json
    └── ai-rag-platform.meta.json
```

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
  ↓  파일 트리 쓰기 (insert-only — 기존 파일 수정 X)
service/fragment/dep-patcher
  ↓  meta.dependencies 가 있으면 package.json JSON merge
  ↓  버전 충돌은 경고만 출력하고 기존 값 유지
[완료 메시지]
```

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

### 3.4 `trellis doctor <dir>` 흐름

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

---

## 6. 파이프라인 / 비동기 처리

**없음.** CLI 는 단일 스레드 순차 실행.
대용량 파일 스트리밍 등이 필요한 상황은 MVP 범위 밖.

---

## 7. 보안 / 권한

- 생성 대상 경로는 **사용자가 명시적으로 지정**해야 함 (`trellis new <dir>`)
- 기존 디렉토리 덮어쓰기는 `--force` 플래그 필수
- `trellis add` 의 충돌 정책 — 기존 파일이 있으면 fail-fast, `--force` 가 있을 때만 덮어쓰기. fragment 는 insert-only (기존 파일 수정 금지, P8 로 분리)
- `trellis add` 의 dep merge — fragment `meta.json` 의 `dependencies` 는 `package.json` 에 JSON merge. 같은 이름이 이미 있고 버전이 다르면 stderr 경고만 출력하고 기존 값을 유지
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
- `trellis add` 는 b2b-saas / ai-rag-platform 플레이북에만 fragment 가 정의되어 있다. trellis 본체는 `cli-tool` 플레이북이고 cli-tool fragment 는 P8 로 분리되어 있으므로 본체에 대한 `add` 자기 적용 사례는 현재 없다.
