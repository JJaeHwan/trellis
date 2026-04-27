# Trellis 템플릿 포맷 (P2.1)

> `resources/templates/<playbook>/` 아래 템플릿이 어떻게 ProjectSpec 과 만나
> 실제 파일 트리로 렌더되는지 정의.

---

## 1. 디렉토리 구조

```
resources/templates/
├── cli-tool/
│   ├── package.json.hbs
│   ├── README.md.hbs
│   ├── CLAUDE.md.hbs
│   ├── tsconfig.json.hbs
│   ├── .gitignore                 ← .hbs 없음 → 그대로 복사
│   ├── src/
│   │   ├── cmd/
│   │   │   ├── index.ts.hbs
│   │   │   └── hello.ts.hbs
│   │   └── common/
│   │       └── ...
│   └── docs/
│       └── plans/
│           └── 00-initial-skeleton.md.hbs
├── b2b-saas/
└── ai-rag-platform/
```

---

## 2. 파일 처리 규칙

| 파일 | 처리 |
|------|------|
| `*.hbs` | Handlebars 렌더 후 `.hbs` 제거 — 예: `package.json.hbs` → `package.json` |
| `.gitkeep` | 그대로 복사 (빈 디렉토리 마커) |
| 그 외 모든 파일 | 그대로 복사 (텍스트로 취급) |

**규칙 1 — 출력 경로:** 입력 파일의 템플릿 루트 기준 상대 경로 = 출력 경로 (단, `.hbs` 제거).

**규칙 2 — 점-디렉토리:** GitHub Actions 등을 위한 `.github/`, `.husky/` 같은 점-디렉토리는 그대로 처리.

**규칙 3 — 이진 파일:** 현재 미지원 (텍스트만). 이미지/폰트가 필요하면 P5+ 에서 별도 메커니즘.

---

## 3. Handlebars 변수

`buildContext(spec)` 가 만드는 `GeneratorContext` 객체가 템플릿에 주입된다.

| 변수 | 예 | 설명 |
|------|-----|------|
| `{{projectName}}` | `my-cli` | 사용자가 지정한 이름 그대로 |
| `{{projectNameKebab}}` | `my-cli` | kebab-case 변환 |
| `{{projectNamePascal}}` | `MyCli` | PascalCase 변환 |
| `{{playbookId}}` | `cli-tool` | 매처가 선정한 플레이북 |
| `{{year}}` | `2026` | `generatedAt` 의 연도 |
| `{{generatedAt}}` | `2026-04-27T00:40:19Z` | ISO-8601 |
| `{{trellisVersion}}` | `0.0.0` | 생성 시 trellis 버전 |
| `{{answers.[1]}}` | `B` | Q1 답변의 옵션 ID — 분기 렌더용 |

### 답변별 분기 예시

```hbs
{{#if (eq answers.[5] "A")}}
  // 프론트엔드 없음 — 서버 only
{{else}}
  // 프론트엔드 있음
{{/if}}
```

---

## 4. 커스텀 헬퍼

| 헬퍼 | 효과 | 예 |
|------|------|------|
| `{{kebab str}}` | kebab-case | `My App` → `my-app` |
| `{{pascal str}}` | PascalCase | `my-app` → `MyApp` |
| `{{camel str}}` | camelCase | `my-app` → `myApp` |
| `{{eq a b}}` | a == b (블록 헬퍼용) | `{{#if (eq answers.[2] "A")}}` |

추가 헬퍼는 `src/service/generator/handlebars-helpers.ts` 에서 등록.

---

## 5. 출력 트리 데이터 모델

```ts
interface VirtualFile {
  path: string;     // 'src/cmd/index.ts' (출력 경로)
  content: string;  // 렌더된 텍스트
}
type VirtualTree = readonly VirtualFile[];
```

generator 가 `VirtualTree` 까지만 만들고, fs-writer 가 그것을 디스크에 쓴다.
이 분리 덕분에 단위 테스트는 디스크 I/O 없이 결정론적으로 검증 가능.

---

## 6. fs-writer 의 안전 규칙

| 상황 | 동작 |
|------|------|
| 대상 디렉토리 없음 | 정상 생성 |
| 대상 디렉토리 있음, 비어있음 | 정상 생성 |
| 대상 디렉토리 있음, 파일 있음 | **에러** (exit 2). `--force` 시 덮어씀 |
| 대상 경로가 파일 | 항상 에러 |

원칙: **사용자 작업 보호.** 이미 작업한 내용을 모르고 덮어쓰지 않는다.

---

## 7. 미지원 / 추후

- 이진 파일 (이미지·폰트) — P5+
- 부분 업데이트 (기존 프로젝트에 새 파일만 추가) — 추후
- 사용자 정의 헬퍼 (플레이북마다 추가) — 추후
- Conditional skip (특정 답변일 때 파일 자체를 만들지 않음) — 추후 (현재는 템플릿 안의 `{{#if}}` 로만 가능)
