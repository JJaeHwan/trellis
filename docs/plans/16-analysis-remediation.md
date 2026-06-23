# P16 — 전수 분석 후속 보강 (upgrade 체인 + 문서 동기화 + 잠재 결함 백로그)

> 9-에이전트 전수 분석(2026-06-22) 결과를 실행 계획으로 전환한다.
> P0 두 건(출시본 영향)을 이번에 닫고, P1/P2 잠재 결함을 우선순위 백로그로 남긴다.
> 분석 출처: ultrawork 병렬 분석 + 상위 발견 5건 코드 직접 검증.

---

## 1. 목표

이 플랜이 끝나면:

- **`trellis upgrade` 가 출시 버전(0.12.x)에서 정상 동작**한다 — 0.9.x/0.10.x/0.11.x 어떤 프로젝트도 현재 버전까지 끊김 없이 단계 적용된다.
- **번들 바이너리에서 `add`/`remove`/`upgrade`/`doctor` 가 `resources/` 를 못 찾던 치명적 경로 버그를 근절**한다 — 모든 loader 가 번들·소스 양쪽에서 동작하는 공유 resolver 를 경유한다.
- **마이그레이션 체인 갭이 재발하지 않는다** — 다음 minor 릴리스에서 매니페스트가 누락되면 테스트가 빨갛게 실패한다.
- **README(en/ko)가 저장소 실측과 일치**한다 — npm 표지가 더 이상 2버전·2페이즈 뒤처지지 않는다.
- P1/P2 잠재 결함이 근거·위치와 함께 백로그로 정리되어 후속 PR 의 진입점이 된다.

---

## 2. 배경 / 문제

전수 분석에서 게이트(typecheck/lint/dep:check/657 tests)는 모두 녹색이었으나, **게이트가 못 잡는 결함**이 출시본에 존재했다.

### P0-1 — `trellis upgrade` 출시본 작동 불능 (high)
- `package.json` = `0.12.1`, `TRELLIS_VERSION` = `0.12.1` 이지만 `resources/migrations/` 에는 `0.9.0-to-0.10.0.json` **하나뿐**.
- 업그레이더는 인접 minor 를 산술로 순회(`upgrader/index.ts:125-147`)하며, 누락 매니페스트는 hard throw(`manifest-loader.ts:26-32`).
  → 0.10.x/0.11.x 프로젝트는 즉시 실패, 0.9.x 도 `0.10→0.11` 단계에서 실패.
- **녹색으로 출시된 이유**: `upgrade-cli-tool.e2e.test.ts` 의 모든 케이스가 `runUpgrade(dir, "0.10.0", …)` 로 현재 버전을 하드코딩 → 멀티스텝 루프가 미커버.
- 게다가 doctor `upgrade-pending` 룰은 사용자에게 업그레이드를 **권고**하지만 upgrade 가 그것을 **이행 불가**.

**심화 발견 (실제 바이너리 스모크 중 발견)** — 매니페스트 백필만으론 부족했다. 컴파일된 바이너리(`dist/cmd/index.js`)에서 `trellis upgrade` 는 **어떤 매니페스트도 로드하지 못했다**(`0.9.0-to-0.10.0` 포함). 각 loader 가 자기 *소스* 위치 기준 상대경로(`../../..` 등)를 하드코딩하는데, tsup 가 전 소스를 단일 번들로 묶으면 `import.meta.url` 이 항상 `dist/cmd/index.js` 가 되어 깊이가 어긋난다(소스 깊이 ≠ 번들 깊이). 결과:
- depth-2 loader(`src/external/*`) → 번들에서도 우연히 정확 → `new`/`list` 동작.
- depth-3 loader(`fragment/loader.ts`, `upgrader/manifest-loader.ts`) → 패키지 루트 위로 빗나감 → **`add`/`remove`/`upgrade` 전면 불능**.
- depth-4 loader(doctor 템플릿 4규칙) → 더 위로 빗나감 → **`doctor` 가 템플릿을 못 읽고 조용히 통과(false pass)**.

모든 테스트가 소스 모드(vitest on `src/`)로 돌아 이 번들 버그를 한 번도 잡지 못했다 — 분석이 "0.10.x/0.11.x 만 깨짐"으로 과소평가한 이유.

### P0-2 — README(en/ko) stale 정보를 npm 표지에 광고 (high)
- `README.md:63` `v0.10.0` / `P0–P13` / `doctor 6-rules`, `README.ko.md` 동일. 실측: `0.12.1` / `P0–P15` / `doctor 8-rules`.
- README 는 `package.json files[]` 에 포함되어 npm 패키지 표지로 노출 → 외부 채택자가 2버전·2페이즈 뒤를 봄.
- `v0.11.0 never reached npm` 인시던트 노트는 CHANGELOG(0.11.0/0.12.0/0.12.1 릴리스 기록)와 모순 — 폐기 대상.
- 프로젝트 자신의 도그푸딩 전제(doc–code 일관성)를 자기 위반.

---

## 3. 결정 사항

| # | 결정 | 왜 (대안 대비) |
|---|------|---------------|
| 1 | `0.10.0-to-0.11.0`, `0.11.0-to-0.12.0` 매니페스트를 **no-op (`"playbooks": {}`)** 로 백필 | git 실측: 0.10.0 릴리스 이후 풀바디 변경 0건(유일 변경은 `b2b-saas/_fragments/page/meta.json` = on-demand fragment). 0.11/0.12 는 tool-side 기능(upgrade/remove/AST). 가짜 slot 을 넣는 것보다 **정직한 no-op + spec.json 버전 갱신**이 정확. 대안(업그레이더가 누락 단계를 skip)은 "인접 minor 만 단계 적용" 계약을 흐리고 갭을 은폐 |
| 2 | 매니페스트에 `"note"` 필드로 no-op 사유 명시 | loader/schema 모두 미지의 키 허용 — 후대 독자가 "왜 비었나"를 추론하지 않게. JSON 주석 부재의 대체 |
| 3 | 체인 연속성 가드를 **`package.json` 버전** 기준 단위 테스트로 추가 | 하드코딩 상수가 아니라 release-please 가 올리는 실제 버전을 진실원본으로 삼아야 다음 릴리스에서 자동으로 빨갛게 실패. `TRELLIS_VERSION` 중복 상수에 결합하지 않음 |
| 4 | E2E 는 기존 케이스 보존 + **Case 8 신규**(현재 버전까지 풀체인) 추가 | 기존 케이스는 0.9→0.10 단일스텝/에러 경로를 의도적으로 검증 — 재작성 시 회귀 위험. 신규 케이스로 멀티스텝 갭만 메움. 버전은 package.json 에서 읽어 staleness 재유입 방지 |
| 5 | README 인시던트 노트 **삭제**, 상태 라인을 저장소 실측(0.12.1/P15/8-rules)으로 동기화 | npm 실제 상태는 오프라인(DEP-06)에서 검증 불가하나, CHANGELOG(release-please 생성) + package.json 이 0.12.1 을 진실원본으로 뒷받침 |
| 6 | 모든 loader 를 공유 `resolveResourcesRoot()`(`import.meta.url` 에서 위로 `resources/` 탐색)로 일원화 | 단일 상대경로로는 소스·번들 깊이를 동시 만족 불가. 상향 탐색은 양쪽 모두 정확. 탐색 시작점이 설치 위치라 사용자 cwd 의 `resources/` 와 무관. 깨진 6개만 고치지 않고 10개 전부 일원화해 동일 부류 재발 차단 |
| 7 | 실제 바이너리 스모크 E2E 추가 (`bin-smoke.e2e.test.ts`, beforeAll 에서 빌드) | 소스 모드 테스트가 못 잡는 번들 경로 버그를 회귀 가드. CLAUDE.md §6 가 예고한 "실제 서브프로세스 E2E" 공백도 메움 |

---

## 4. 비범위 (Out of Scope)

이번 플랜에서 **하지 않는 것**:

- 업그레이드 롤백/원자성 도입 (P1 백로그).
- `astPatches` dry-run 충실도 수정 (P1 백로그).
- substring 멱등성 → 구조적 매칭 교체 (P1 백로그).
- L1 `config` 계층 구현 또는 문서 강등 (P1 백로그).
- `common-no-framework` dependency-cruiser 룰 수정 (P1 백로그).
- check/doctor `--json` 단일라인·에러봉투 정합 (P2 백로그).
- cmd 패치 렌더 로직 L4 hoist, form↔admin 의존 해소 (P2 백로그).
- 실제 subprocess E2E 도입 (P2 백로그).

---

## 5. Phase

| Phase | 작업 | 완료 조건 | 상태 |
|-------|------|----------|------|
| P0-1a | `0.10.0-to-0.11.0.json`, `0.11.0-to-0.12.0.json` no-op 매니페스트 백필 | 두 파일 존재, loader 검증 통과 | ✅ |
| P0-1b | `migration-chain.test.ts` — package.json 기준 체인 연속성 가드 | 현재 통과 + 다음 minor 누락 시 실패하도록 설계 | ✅ |
| P0-1c | E2E `Case 8` — 0.9.0 → 현재버전 풀체인 + 멱등 재실행 | 멀티스텝 루프 커버, spec.json 현재버전 갱신 검증 | ✅ |
| P0-1d | 공유 `external/resources-root.ts` 도입 + loader 10개 일원화 (번들 경로 버그 수정) | 실제 바이너리에서 add/remove/upgrade/list/doctor 가 resources/ 정확 해석 | ✅ |
| P0-1e | 실제 바이너리 스모크 E2E (`bin-smoke.e2e.test.ts`) + resolver 단위 테스트 | 빌드 후 dist 실행으로 회귀 가드 | ✅ |
| P0-2a | `README.md` Status 동기화 (0.12.1/P15/8-rules, 인시던트 노트 삭제) | doctor `required-files` 영향 없음, 내용 실측 일치 | ✅ |
| P0-2b | `README.ko.md` Status 동기화 | en 과 동등 | ✅ |
| P0-V | 전체 게이트 재실행 + 신규 테스트 통과 + dogfooding(check/doctor 자기적용) 유지 | typecheck/lint/dep:check/test 녹색 | ⏳ |

---

## 6. 영향 범위

| 대상 | 변경 | 비고 |
|------|------|------|
| `resources/migrations/0.10.0-to-0.11.0.json` | 신규 | no-op 매니페스트 |
| `resources/migrations/0.11.0-to-0.12.0.json` | 신규 | no-op 매니페스트 |
| `src/service/upgrader/migration-chain.test.ts` | 신규 | 체인 연속성 가드 (단위) |
| `tests/e2e/upgrade-cli-tool.e2e.test.ts` | 수정 | import 보강 + Case 8 추가 |
| `README.md` / `README.ko.md` | 수정 | Status 섹션 동기화 |
| `src/external/resources-root.ts` (+ `.test.ts`) | 신규 | 번들-안전 공유 resolver |
| loader 10개 (`external/{interview,template,playbook,fragment-types}-loader`, `fragment/loader`, `upgrader/manifest-loader`, `doctor/rules/{patch-marker-presence,ast-patch-target-valid,handlebars-token-valid,playbook-still-supported}`) | 수정 | 하드코딩 상대경로 → `resolveResourcesDir()` 경유 |
| `tests/e2e/bin-smoke.e2e.test.ts` | 신규 | 실제 바이너리 회귀 가드 (upgrade/add/list/doctor) |
| upgrade 적용 로직 (`applier.ts`) | **무변경** | no-op 매니페스트를 기존 로직이 이미 정확히 처리 (`applier.ts:29-39`) |

---

## 7. 검증 계획

- [ ] `npm run typecheck` 통과
- [ ] `npm run lint` (`--max-warnings=0`) 통과
- [ ] `npm run dep:check` 통과 (계층 무위반)
- [ ] `npm test` 통과 — 신규 가드 테스트 + E2E Case 8 포함
- [ ] 수동 시나리오: 0.9.0 spec 프로젝트 → `runUpgrade(현재버전)` → steps=(현재minor−9), spec.json=현재버전, 재실행 no-op
- [ ] 독립 검토(adversarial): no-op 결정이 실제 풀바디 변경 부재와 일치하는지 재확인

---

## 8. 완료 기준 (Definition of Done)

- [ ] 코드/문서 병합 (feature/16-upgrade-chain-and-doc-sync)
- [ ] 테스트 통과 (가드 + E2E Case 8)
- [ ] README en/ko 실측 동기화
- [ ] 이 파일을 `docs/plans/completed/` 로 이동

---

## 부록 A — 후속 백로그 (P1/P2, 분석 발견 기반)

### P1 (정확성 / 잠재 데이터 손상) — 6건 중 5건 완료

| 항목 | 위치 | 처리 | 상태 |
|------|------|------|:---:|
| substring 멱등성 prefix 충돌 | `fragment/patcher.ts`, `ast-patcher.ts`, `ast-un-patcher.ts` | 공유 `entry-key.ts` `entryKeyPresent()` 토큰 경계 매칭(`[A-Za-z0-9_-]` 연속 문자)으로 3개 지점 교체. `/user`↔`/users`, `user`↔`user-profile` 차단, `reports`-in-`/reports` 컨벤션 보존 | ✅ |
| `common-no-framework` 룰 무효 | `.dependency-cruiser.cjs` | `dependencyTypes:["npm"]` + `pathNot:"node_modules/pino/"` 로 교체 → DEP-02 실제 강제(pino 만 허용). CLAUDE.md DEP-02 문구 동기화. 음성 테스트로 검증 | ✅ |
| upgrade 롤백 부재 | `upgrader/transactional-fs.ts`(신규), `index.ts` | writeFile 백업/복구 래퍼로 멀티스텝 실패 시 전체 롤백. 멀티슬롯 실패 통합 테스트 | ✅ |
| astPatches dry-run 과대보고 | `fragment/ast-patcher.ts`, `upgrader/applier.ts` | `applyAstPatches(..., dryRun)` 추가 — dry-run 시 in-memory 로 정확한 applied/skipped 계산(쓰기 없음) + target 오류 surface | ✅ |
| 'New' 매치 무경고 스캐폴드 | `cmd/new.ts` | mode==='new' 시 stderr 경고 + confirm 기본값 false(명시적 opt-in 요구) | ✅ |
| L1 `config` 계층 미구현 | `CLAUDE.md §2/§4/§5`, `docs/architecture.md` | **문서 강등**(소유자 결정) — config 를 '예약(미구현)'으로 명시, 실질 5계층. `src/config/.gitkeep` + cruiser L1 규칙은 slot 예약 유지. 드리프트 해소 | ✅ |

### P2 (일관성 / 견고성)
| 항목 | 위치 | 핵심 |
|------|------|------|
| check/doctor `--json` 멀티라인 + 에러봉투 부재 | `cmd/check.ts:22`, `cmd/doctor.ts:22` | 단일라인 + `{ok:false,…}` 봉투로 다른 명령과 정합 |
| cmd 패치 렌더 로직 중복/누수 | `cmd/add.ts`, `cmd/remove.ts` | `renderHandlebars/renderAstPatch/renderSelector` verbatim 중복 → L4 fragment 서비스로 hoist (DEP-05) |
| form↔admin 교차 의존 | `b2b-saas/_fragments/form/.../{{namePascal}}Form.tsx.hbs:4` | `form` 단독 add 시 admin 의 `actions.ts` import 깨짐 → self-contained 화 or 의존 선언 |
| ai-rag `.dependency-cruiser.cjs` 누락 | `resources/templates/ai-rag-platform/` | 동일 계층 구조인데 self-validation 무방비 |
| 실제 subprocess E2E 부재 | `tests/e2e/**` | 전부 in-process — commander 파싱/bin 진입점 미검증 |
| handlebars-token-valid false-positive | `doctor/rules/handlebars-token-valid.ts` | `{{answers.x}}`, `{{this}}`, `{{@index}}` dotted/스코프 미인식 |
| logger.test.ts 빈 단언 | `common/logger/logger.test.ts:13` | `logger.level` 미검증 → 실질 행위 테스트로 보강 |
| 중복 버전 상수 | `cmd/upgrade.ts:8`, `doctor/rules/upgrade-pending.ts:15` | 단일 소스로 통합 |
