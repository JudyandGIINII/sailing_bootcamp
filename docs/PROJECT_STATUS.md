# Sailing Bootcamp — Project Status

> 갱신: 2026-07-19 KST
> 상태: **AP-0B L01 prototype integrated and verified / AP-0C pending**

## 1. 현재 위치

프로젝트는 PRD·레슨 계약·도메인 검증 workflow·기술 아키텍처·구현 계획을 갖추고 있다. AP-0A TypeScript bootstrap과 contract negative tests는 isolated Orca worktree에서 검증된 뒤 shared history에 integrated 되었다.

## 2. 완료된 기반

- 제품 결정 D1–D6: browser, 입문자, 장기 boat/rig catalog, 가상 수역, Sloop-only MVP, 물리훈련 보조/약한 게임성
- C1: L01–L05 전체가 `training-sloop-v1`의 MVP 필수 레슨
- 결정론 contract: full versioned replay identity(scenario/seed/ordered input/model/profile/contract/coordinate/determinism/comparison policy), replay, pause/reset/retry, input lifecycle, event/score/debrief comparison
- 안전·점수 원칙: 속도/진행은 safety violation을 상쇄하지 못함
- 검증 체계: validation registry, reviewer submission, qualification/control-apply runbook
- 기술 권고: TypeScript/Vite/PixiJS/DOM/Vitest/Playwright/IndexedDB
- Claude Opus 독립 검토 P1/P2 반영: comparison-policy draft binding, non-draft release binding, `contract_version` 의미, focus-loss scheduler stop, static sim boundary, Task 2A/2B 분리

## 3. 현재 gate 상태

| Gate | 상태 | 의미 |
|---|---|---|
| Load | planned | 향후 schema/version/profile/action compatibility로 판정 |
| Prototype | planned | unvalidated assumption을 명시한 내부 prototype은 가능 |
| Release | blocked | L01–L05 registry가 모두 `assumption`, P1 artifacts 미승인 |

## 4. 구현 전 AP-0

AP-0A와 AP-0B(L01까지)는 2026-07-19 integrated/verified 되었다. 다음 구현은 AP-0C(L02–L05/resilience/release evidence) 별도 ceiling 승인이 필요하며, release 권한을 포함하지 않는다.

## 4.1 버전 관리 checkpoint

프로젝트는 Git `main` 브랜치로 초기화되었고 `origin`은 `https://github.com/JudyandGIINII/sailing_bootcamp`로 지정되어 있다. 원격의 기존 초기 README 이력은 로컬 baseline과 병합했다. 이 checkpoint 작업에서는 **원격 push를 수행하지 않았다**.

## 5. 첫 구현 slice

1. **완료:** Vite TypeScript/PixiJS shell, strict typecheck, Vitest 36 tests, Playwright Chromium 3 tests, production build, contract/gate/sim/replay tests
2. **완료:** L01 keyboard → pure sim → PixiJS/DOM HUD/debrief → IndexedDB local replay lifecycle
3. **다음 AP-0C 후:** L02–L05 순차 확장, resilience QA, release-evidence report (release는 계속 차단)

## 6. launch 전 별도 의존성

- review record의 `validated` disposition 및 concrete model/contract/coordinate/determinism/comparison-policy version binding
- browser/accessibility/pilot/operations/replay compatibility/privacy P1 artifacts
- 별도 release authority evidence

## 7. 비목표 / 경계

- 실제 해도·항로·예보·항법·면허/자격 판단 제공 금지
- live marine data, backend/account/analytics SDK, multiplayer, 다중 보트/리그 actual physics는 MVP 밖
- domain threshold/polar/safety value를 근거 없이 구현하지 않음
