# Sailing Bootcamp — Project Status

> 갱신: 2026-07-19 KST
> 상태: **Implementation planning complete / Prototype not started**

## 1. 현재 위치

프로젝트는 PRD·레슨 계약·도메인 검증 workflow·기술 아키텍처·구현 계획이 완료된 **구현 전 단계**다. 앱 코드, package manifest, dependency, Git worktree, 테스트 런타임은 아직 없다.

## 2. 완료된 기반

- 제품 결정 D1–D6: browser, 입문자, 장기 boat/rig catalog, 가상 수역, Sloop-only MVP, 물리훈련 보조/약한 게임성
- C1: L01–L05 전체가 `training-sloop-v1`의 MVP 필수 레슨
- 결정론 contract: versioned scenario/seed/input/model/profile/contract identity, replay, pause/reset/retry, event/score/debrief comparison
- 안전·점수 원칙: 속도/진행은 safety violation을 상쇄하지 못함
- 검증 체계: validation registry, reviewer submission, qualification/control-apply runbook
- 기술 권고: TypeScript/Vite/PixiJS/DOM/Vitest/Playwright/IndexedDB

## 3. 현재 gate 상태

| Gate | 상태 | 의미 |
|---|---|---|
| Load | planned | 향후 schema/version/profile/action compatibility로 판정 |
| Prototype | planned | unvalidated assumption을 명시한 내부 prototype은 가능 |
| Release | blocked | L01–L05 registry가 모두 `assumption`, P1 artifacts 미승인 |

## 4. 구현 전 AP-0

사용자 명시 구현 승인이 필요하다. 승인 범위는 code/dependency/worktree bootstrap으로 한정되며 release 권한은 포함하지 않는다.

## 4.1 버전 관리 checkpoint

프로젝트는 Git `main` 브랜치로 초기화되었고 `origin`은 `https://github.com/JudyandGIINII/sailing_bootcamp`로 지정되어 있다. 원격의 기존 초기 README 이력은 로컬 baseline과 병합했다. 이 checkpoint 작업에서는 **원격 push를 수행하지 않았다**.

## 5. 첫 구현 slice

1. coordinate/determinism/replay/gate contract를 code schema·negative tests로 동결
2. Vite TypeScript shell, strict typecheck, Vitest, Playwright lane 구축
3. renderer 없는 deterministic core + golden replay
4. L01 vertical slice: keyboard → sim → PixiJS → DOM HUD/debrief → IndexedDB replay

## 6. launch 전 별도 의존성

- review record의 `validated` disposition 및 concrete version binding
- browser/accessibility/pilot/operations/replay compatibility/privacy P1 artifacts
- 별도 release authority evidence

## 7. 비목표 / 경계

- 실제 해도·항로·예보·항법·면허/자격 판단 제공 금지
- live marine data, backend/account/analytics SDK, multiplayer, 다중 보트/리그 actual physics는 MVP 밖
- domain threshold/polar/safety value를 근거 없이 구현하지 않음
