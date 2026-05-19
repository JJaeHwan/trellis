# P10 — b2b-saas fragments: model + service (multi-file, multi-slot)

> P9 까지 만들어진 fragment patch 인프라(meta.json.patches, marker, applyPatches) 의 첫 본격 확장.
> "page" 단일 파일이 아닌 **multi-file 묶음** + **multi-slot patch** 의 첫 검증 케이스.
> 매일 자주 필요한 두 종류: **새 모델 추가** (Prisma + Zod + repository),
> **새 서비스 추가** (서비스 클래스 + 등록 + 테스트).

---

## 1. 목표

P10 종료 시점:

- b2b-saas 풀바디에 새 slot 2종 추가: `prisma-models` (schema.prisma), `services` (services.ts barrel)
- **model fragment** (`_fragments/model/`) — 새 Prisma 모델 1개 추가 시 필요한 보일러플레이트 한 묶음
- **service fragment** (`_fragments/service/`) — 새 서비스 클래스 한 묶음
- multi-file fragment + multi-slot patch 검증
- `trellis add --json` 출력 옵션 (F 흡수)
- 에러 메시지에 actionable suggestions (E 흡수 첫 단계)
- doctor 의 `trellis-version-compat` 규칙 (I 흡수 첫 단계)
- v0.8.0 npm 배포

---

## 2. 배경 / 문제

P9 까지 trellis add 가 동작하지만 카탈로그가 너무 얇음:

```
b2b-saas/
└── _fragments/
    ├── api/    ← API route 1개 (route.ts + 테스트)
    └── page/   ← page.tsx 1개 + nav-items patch
```

실전 SaaS 개발 시 가장 자주 필요한 작업은:
- **새 모델** 추가 (Invoice, Subscription, AuditLog 등) — 주 2~3회
- **새 서비스** 추가 (InvoiceService, BillingService 등) — 주 2~3회

각각 다음 3~5개 파일 + 풀바디의 2~3 군데 패치를 손으로 해야 함:
- Prisma `schema.prisma` 에 model 정의
- Zod 스키마
- Repository 또는 service 클래스
- 단위 테스트
- (services.ts 같은) barrel 에 등록

이 자동화가 L4 의 핵심 가치 — "매일 쓰는 도구" 의 본격 검증.

---

## 3. 결정 사항

| # | 결정 | 왜 |
|---|------|----|
| 1 | **model fragment 의 파일 묶음**: schema patch + Zod + Repository + 테스트 (4 파일) | service 는 별도 fragment 로 분리 — 단일 책임 |
| 2 | **service fragment 의 파일 묶음**: service.ts + service.test.ts (2 파일) + barrel patch | 단순 보일러 |
| 3 | **Prisma marker 문법**: `// trellis:slot:prisma-models:start/end` — Prisma 가 `//` 한 줄 주석 지원 | 컴파일 영향 없음 (검증 완료 필요) |
| 4 | **services barrel 위치**: `src/lib/services.ts` 신설 — 각 service export | 기존 디자인과 일관 |
| 5 | **`--json` 스키마**: `{ "command": "add", "created": [...], "patches": { applied, skipped, conflicts: [] } }` | 안정적 키 + 향후 확장 가능 |
| 6 | **actionable error**: 모든 HarnessError 메시지 끝에 `→ <다음 명령 예시>` 한 줄 | 사용자 다음 액션 명시 |
| 7 | **doctor `trellis-version-compat` 규칙**: `.trellis/spec.json` 의 `trellisVersion` 이 현재 trellis 버전과 minor 단위 호환 시 통과, major 다르면 warning | semver 기준 |

### 핵심 결정 (2026-05-19 사용자 승인 완료)

> **Q-A. model fragment 가 만드는 Repository 의 패턴은?**
> ✅ **결정: class 기반** — `<Name>Repository.ts` 가 `findById`, `list`, `create`, `update`, `delete` 메서드 제공.
> Prisma client (`src/lib/external/db.ts` 의 `prisma`) 를 inject 받음.
> 이유: 함수형보다 테스트/모킹 용이 + OOP 친화 + Service 가 inject 받기 쉬움.
>
> **Q-B. service fragment 가 model 의존성을 어떻게 표현?**
> ✅ **결정: 권고만** — meta.json description 에 "보통 model fragment 와 함께 사용" 한 줄. 강제 X.
> 이유: P11 admin 에서 진짜 의존성 검증 메커니즘 필요 시 재검토. 현재는 단순화.
>
> **Q-C. `--json` 출력 스킴**
> ✅ **결정: stdout=JSON 단일 라인, stderr=진행상황** — 파이프 친화 (`trellis add ... --json | jq ...`).
> 이유: UNIX 컨벤션 준수, AI/CI 에이전트가 결과만 깔끔히 받음.

---

## 4. 비범위 (Out of Scope)

- form / admin fragment — P11 로 분리
- ai-rag-platform 의 동등 fragment — P11 또는 P12 (b2b-saas 우선)
- AST 기반 patch — P13+
- fragment 간 의존성 강제 메커니즘 (`requiresFragments`) — P11 admin 에서 재검토
- `trellis list` 명령 — P12
- cli-tool fragment — P12
- patch 의 replace/delete — 영구 비범위

---

## 5. Phase

| Phase | 작업 | 완료 조건 |
|-------|------|----------|
| P10.0 | 본 문서 + Q-A/B/C 결정 | § 3 미결정 마감 |
| P10.1 | 풀바디 `prisma/schema.prisma.hbs` 끝에 `prisma-models` slot marker 주입 | Prisma 컴파일 영향 없음 검증 |
| P10.2 | 풀바디 `src/lib/services.ts.hbs` 신설 — services barrel + `services` slot marker | 새 파일 |
| P10.3 | 풀바디 골든/E2E 갱신 (새 파일 + marker) | 통과 |
| P10.4 | **model fragment** 신설 (`_fragments/model/`) — schema patch + Zod + Repository + 테스트 + meta.json | multi-file 묶음 |
| P10.5 | model fragment 의 multi-slot patch 선언 (schema + services barrel) | meta.json |
| P10.6 | **service fragment** 신설 (`_fragments/service/`) — service.ts + 테스트 + meta.json patches | 두 번째 검증 |
| P10.7 | `cmd/add` 에 `--json` 출력 옵션 추가 (F 흡수) | 옵션 + 출력 |
| P10.8 | HarnessError 메시지 actionable suggestion 추가 (E 흡수, slot/file/dep 충돌 케이스) | 메시지 갱신 |
| P10.9 | doctor `trellis-version-compat` 규칙 신설 (I 흡수) | 단위 테스트 |
| P10.10 | E2E: scaffold → add model Invoice → add service InvoiceService → tsc 통과 + 멱등성 | 통과 |
| P10.11 | `trellis check . / doctor .` 자기 검증 + 문서 갱신 (architecture / CLAUDE / README) | 통과 |
| P10.12 | release-please v0.8.0 머지 → npm 배포 | npm 0.8.0 |
| P10.13 | 본 파일을 `docs/plans/completed/` 로 이동 | 완료 |

---

## 6. 영향 범위

| 대상 | 변경 | 비고 |
|------|------|------|
| `resources/templates/b2b-saas/prisma/schema.prisma.hbs` | 수정 | prisma-models slot marker 끝에 추가 |
| `resources/templates/b2b-saas/src/lib/services.ts.hbs` | 신규 | services barrel + slot marker |
| `resources/templates/b2b-saas/_fragments/model/` | 신규 (4 파일 + meta) | model fragment |
| `resources/templates/b2b-saas/_fragments/service/` | 신규 (2 파일 + meta) | service fragment |
| `src/cmd/add.ts` | 수정 | `--json` 옵션, actionable error |
| `src/cmd/add.test.ts` | 수정 | --json 케이스 + error message 케이스 |
| `src/common/errors/` | 수정 | HarnessError 의 메시지에 actionable hint 보조 메서드 |
| `src/service/doctor/rules/trellis-version-compat.ts` | 신규 | semver 비교 규칙 |
| `src/service/doctor/rules/trellis-version-compat.test.ts` | 신규 | 단위 테스트 |
| `src/service/doctor/doctor.ts` | 수정 | 새 규칙 통합 |
| `tests/golden/b2b-saas-tree.test.ts` | 스냅샷 갱신 | 새 파일 + marker |
| `tests/e2e/scaffold-b2b-saas.e2e.test.ts` | 확장 | 새 marker 존재 검증 |
| `tests/e2e/add-fragments.e2e.test.ts` | 확장 | model + service fragment 시나리오 |
| `tests/e2e/add-patches.e2e.test.ts` | 확장 (선택) | multi-slot patch 멱등 검증 |
| `docs/architecture.md` | 수정 | fragment 카탈로그 + --json 출력 + 새 doctor 규칙 |
| `CLAUDE.md` | 수정 | § 4 에 --json 동작 명시 |

---

## 7. 검증 계획

### 자동
- `npm run typecheck && npm run lint && npm run test`
- E2E: scaffold b2b-saas → add model Invoice → schema.prisma 에 model 추가 + Zod 파일 생성 + Repository 생성 + services.ts 에 patch entry → tsc 통과
- 멱등성: 같은 model 두 번 add → schema 에 model 정확히 1번
- multi-slot: 한 fragment 의 patches 가 2 군데 동시 적용
- `--json` 출력 파싱 가능 (JSON.parse 통과)
- doctor `trellis-version-compat`: spec.json 의 trellisVersion 이 다른 major 일 때 violation

### 수동
- 새 디렉토리 `trellis new` → b2b-saas → `trellis add model Invoice` → `npx prisma generate` → 컴파일 통과
- `trellis add service InvoiceService` → 빌드 통과

---

## 8. 완료 기준 (Definition of Done)

- [ ] § 3 Q-A/B/C 사용자 승인
- [ ] 풀바디에 prisma-models + services slot 주입
- [ ] model fragment (multi-file, multi-slot patch) 동작
- [ ] service fragment 동작
- [ ] `trellis add --json` 동작 (파싱 가능)
- [ ] actionable error suggestions (slot/file/dep 충돌)
- [ ] doctor `trellis-version-compat` 규칙 통과
- [ ] E2E 회귀 없음 + 멱등성 검증
- [ ] 자기 검증 (check/doctor) 통과
- [ ] release-please v0.8.0 머지 → npm 배포
- [ ] 본 파일을 `docs/plans/completed/10-b2b-fragments-model-service.md` 로 이동
