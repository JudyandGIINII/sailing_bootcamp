# Sailing Bootcamp — Project Status

> 갱신: 2026-07-21 KST
> 상태: **`main`/`origin/main` source integration capture `89ab655` / L01 semantic slice `f55877d` ancestor / historical evidence closure `56b13c6` / P1/P1B synthetic scenario/catalog baseline `92a8613` (ancestor) / personal-use scope active**. `89ab655` is the pre-this documentation-reconciliation capture, not a continuing live-tip claim after this docs-only commit.

## 1. 현재 위치

프로젝트는 PRD·레슨 계약·도메인 검증 workflow·기술 아키텍처·구현 계획을 갖추고 있다. `89ab655` is the current source-integration capture before this docs-only reconciliation: it adds the L02 deterministic synthetic trim-input acknowledgment. Its fresh integration verification passed strict typecheck, 18 Vitest files / 177 tests, 15 Chromium smoke tests, production build, and diff check. `f55877d` is its L01 semantic-slice ancestor with versioned synthetic wind/course observations. Neither commit asserts physical sailing/trim, performance, safety, navigation, domain validation, release, or deployment truth. `56b13c6` is the earlier evidence-closure ancestor; `646ac19`, `92a8613`, `7827079`, and `76bf5b6` remain historical evidence references only.

## 2. 완료된 기반

- 제품 결정 D1–D6: browser, 입문자, 장기 boat/rig catalog, 가상 수역, Sloop-only MVP, 물리훈련 보조/약한 게임성
- C1: L01–L05 전체가 `training-sloop-v1`의 MVP 필수 레슨
- 결정론 contract: full versioned replay identity(scenario/seed/ordered input/model/profile/contract/coordinate/determinism/comparison policy), replay, pause/reset/retry, input lifecycle, event/score/debrief comparison
- 안전·점수 원칙: 속도/진행은 safety violation을 상쇄하지 못함
- 검증 체계: registry는 assumption 상태를 보존하며, 개인용 G1 self-review는 limitation acknowledgement만 기록; external-review/qualification/control-apply는 미래 public-distribution 전용
- 기술 권고: TypeScript/Vite/PixiJS/DOM/Vitest/Playwright/IndexedDB
- Claude Opus 독립 검토 P1/P2 반영: comparison-policy draft binding, non-draft release binding, `contract_version` 의미, focus-loss scheduler stop, static sim boundary, Task 2A/2B 분리

## 3. 현재 gate 상태

| Gate | 상태 | 의미 |
|---|---|---|
| Load | post-evidence-closure capture `56b13c6` / historical baselines | `56b13c6` was synchronized to main/origin before this docs-only reconciliation; `646ac19` is its historical parent, `92a8613` its P1/P1B ancestor, while L02–L05 trace lineage and earlier documentation reconciliation remain historical in `7827079`; `76bf5b6` is historical documentation capture |
| Prototype | personal, browser-local, synthetic / assumption-only | Fresh integration QA exists for exact `56b13c6`; domain correctness remains unvalidated and this is not a release-support or supported-browser claim |
| Personal prototype work | available with explicit bounded user authorization | external reviewer/authority/controlled apply/G1/G2/G3/P1/release evidence는 prerequisite가 아님 |
| Archived external-release materials | non-operational | registry assumptions·P1·external review·release authority 절차는 개인용 roadmap을 막거나 자동 재개하지 않음 |

## 4. 구현 전 AP-0

AP-0A, AP-0B(L01), AP-0C(L02–L05/resilience/release evidence), AP-0D P0, and AP-0E G0 statements above are historical shared-main records. The later post-trace lineage is separately integrated in the historical code/candidate-QA baseline `7827079`; `76bf5b6` is historical documentation capture and does not alter those evidence meanings. This work’s capture-time `646ac19` is not current-tip proof after the uncommitted reconciliation diff. AP-0C historical release-evidence와 AP-0D evidence lifecycle 모두 current registry가 `assumption`이므로 `BLOCKED`를 정상 결과로 취급한다. release remediation은 별도 승인·도메인/P1 근거가 필요하다.

## 4.2 Post-main-sync integration checkpoint

Historical capture recorded `JudyandGIINII/sailing-l05-record-evidence` at `6004911508305445d520755e3a082c7654ba79b7`, four commits ahead of historical `origin/main` `0f34184` through L03 `37aac44`, L04 `ed83927`, L02 `f98f611`, and L05 `6004911`; that lineage remains historical context only. Current source increments are `f55877d` (L01 versioned synthetic wind/course observations) and `89ab655` (L02 versioned synthetic trim-input acknowledgment). The L02 slice retained legacy L02 helm compatibility while adding strict profile/terminal replay authority for newly recorded L02 V2 payloads. It is local/browser synthetic prototype evidence only—not domain validation, navigation/safety truth, public release, certification, deployment, or a supported-browser claim. L05 remains decision-ledger record visibility only. Any next L03–L05 or computed trim-effect increment requires a new evidence-backed plan; it must not be inferred from the completed L01/L02 slices.

## 4.1 버전 관리 checkpoint

Historical initialization: 프로젝트는 Git `main` 브랜치로 초기화되었고 `origin`은 `https://github.com/JudyandGIINII/sailing_bootcamp`로 지정되어 있다. 원격의 기존 초기 README 이력은 로컬 baseline과 병합했다. That historical initialization checkpoint did not push; the later user-authorized post-trace synchronization established historical baseline `7827079`, followed at pre-reconciliation documentation capture time by docs-only `76bf5b6`.

## 5. 첫 구현 slice

1. **완료:** Vite TypeScript/PixiJS shell, strict typecheck, Vitest 61 tests, Playwright Chromium 6 tests, production build, contract/gate/sim/replay tests
2. **완료:** L01–L05 keyboard → pure sim → PixiJS/DOM HUD/debrief → IndexedDB local replay lifecycle
3. **완료:** quota/corruption/interrupted-write preservation, 9-field replay fail-closed coverage, machine-readable AP-0C release evidence (`BLOCKED`)
4. **후속 승인 전 보류:** WebKit/Firefox named-project configuration and any release remediation

## 6. Archived external-release materials

- `validated` disposition, external reviewer/authority, concrete binding, P1 artifact, public release evidence는 개인용 prototype work의 requirement가 아니다.
- 이 archived 자료는 과거 설계/향후 별도 제품 전환을 위한 reference일 뿐, 현재 또는 미래 개인용 roadmap을 block·wait·required input 상태로 만들 수 없다.
- public release를 새로 고려한다면 기존 gate를 자동 재개하지 않고, 그때 별도 제품 정책을 새로 작성한다.

## 7. 비목표 / 경계

- 실제 해도·항로·예보·항법·면허/자격 판단 제공 금지
- public distribution, certification, deployment, and release는 현재 개인용 범위 밖; 이를 재개하려면 별도 제품 결정을 기록
- live marine data, backend/account/analytics SDK, multiplayer, 다중 보트/리그 actual physics는 MVP 밖
- domain threshold/polar/safety value를 근거 없이 구현하지 않음
