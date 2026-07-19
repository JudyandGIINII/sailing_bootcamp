# Training Sloop MVP Implementation Plan

> **For Hermes:** 구현 승인 후 `orca-codex-primary-hermes-qa`에 따라 Orca worktree의 Codex primary lane으로 task-by-task 실행하고, Hermes가 독립 QA를 수행한다.

**Goal:** 결정론적·replay 가능한 브라우저 기반 Training Sloop 학습 prototype을 L01부터 구현하고 L05까지 확장한다.

**Architecture:** Strict TypeScript의 renderer-independent simulation core가 canonical state/event/score/debrief를 소유한다. PixiJS는 world projection, DOM/CSS는 접근 가능한 HUD/debrief, IndexedDB는 local-only replay를 담당한다. Domain validation과 P1 artifacts는 prototype 제작과 별개인 release gate다.

**Tech Stack:** TypeScript, Vite, PixiJS, Vitest, Playwright, IndexedDB. 정확한 version은 bootstrap 직전 compatibility check 후 lockfile에 고정한다.

---

## 구현 전 AP-0 — 사용자 승인 필요

이 문서는 구현 권한이 아니다. 코드, dependency install, Git initialization, Orca worktree 생성은 사용자의 명시적 “구현 시작” 승인 뒤에만 진행한다. 구현 승인이 있어도 release 권한은 생기지 않는다.

## Task 0 — 기술 계약 동결

**Objective:** renderer-independent contracts를 code보다 먼저 확정한다.

**문서 입력:**
- `docs/contracts/coordinate-contract.md`
- `docs/contracts/determinism-replay-contract.md`
- `docs/quality/prototype-and-release-gates.md`

**구현 산출물 예정:** `src/contracts/` schema와 `tests/contracts/` negative fixture.

**완료 조건:** coordinate/direction, logical tick/input ordering, seeded RNG policy, update/event ordering, pause/reset/retry, replay comparison, prototype/release gates가 versioned·testable하다. sailing threshold/polar/safety 수치를 새로 만들지 않는다.

## Task 1 — 빈 TypeScript 브라우저 shell bootstrap

**Objective:** strict typecheck와 테스트 lane이 있는 빈 앱을 만든다.

**예정 경로:**
- `package.json`, lockfile, `tsconfig.json`, `vite.config.*`, `vitest.config.*`, `playwright.config.*`
- `src/main.ts`, `src/app/`
- `tests/unit/`, `tests/contracts/`, `tests/e2e/`

**검증:** strict typecheck, Vitest, Playwright smoke, production build. backend/analytics/live-data dependency 없음.

## Task 2 — contracts와 gate evaluator

**Objective:** invalid content를 시작 전 fail-closed 처리한다.

**예정 경로:** `src/contracts/`, `src/content/`, `src/gates/`, `tests/contracts/`.

**먼저 작성할 실패 테스트:** unknown/missing version, non-Sloop profile, lesson/profile mismatch, unsupported action, missing record, `assumption` prototype 허용·release 거부, stale/rejected record release 거부.

**완료 조건:** L01–L05 contract가 runtime load eligibility를 보고하며 release check는 현재 registry 상태에서 실패한다.

## Task 3 — pure deterministic simulation과 replay

**Objective:** DOM/Pixi 없이 state transition·event ledger·score facts·replay를 구현한다.

**예정 경로:** `src/sim/`, `src/replay/`, `src/scoring/`, `tests/unit/`, `tests/golden-replays/`.

**먼저 작성할 실패 테스트:** same identity/input equality, tick/sequence tie-break, pause non-progression, reset restoration, seeded RNG, zero-current / current composition, single-emission boundary event, renderer cadence independence.

**완료 조건:** headless golden replay가 canonical state/event/score/debrief fields를 비교하고 unknown replay는 거부한다.

## Task 4 — L01 vertical slice

**Objective:** L01을 content→input→sim→render→HUD→debrief→local replay 전체 경로로 완성한다.

**예정 경로:** `src/content/l01/`, `src/app/`, `src/render/`, `src/ui/`, `src/storage/`, `tests/integration/`, `tests/e2e/`.

**검증:** keyboard-only flow, true/apparent wind와 heading/COG 표시, event-derived debrief, same identity retry, persistent unvalidated/non-navigation notice, no network telemetry.

**완료 조건:** L01 prototype은 architecture 증명용으로만 동작하며 domain correctness/release readiness를 주장하지 않는다.

## Task 5 — L02~L05 순차 확장

| 순서 | 범위 | 먼저 추가할 회귀 증거 |
|---|---|---|
| L02 | main/jib controls·trim causality | trim action/event/debrief, safety가 speed에 상쇄되지 않음 |
| L03 | deterministic gust/wave·reef mitigation | episode ordering, recovery/terminal semantics, conservative mitigation |
| L04 | heading/COG·STW/SOG·drift·mark | vector composition, recoverable miss, slower valid correction |
| L05 | synthetic tide/depth/visibility·pass/wait/return | observation completeness, decision outcome, wait/return pass eligibility |

모든 레슨은 다른 profile이나 live data를 추가하지 않고, contract→invariant→replay→score/debrief→UI 순서로 확장한다.

## Task 6 — browser/resilience QA

**검증:** keyboard focus/key-repeat, pause/focus-loss session policy, visible focus/non-color/reduced motion, IndexedDB corruption/quota, unknown replay, no unexpected network, Chromium/WebKit/Firefox candidate tests.

## Task 7 — release evidence assembly

**Objective:** prototype과 release를 혼동하지 않는 machine-readable gate report를 만든다.

**검증:** golden replay compatibility, registry disposition report, browser/accessibility/performance/pilot/operations/privacy artifact manifest, no release override.

**완료 조건:** current `assumption` registry로 release check는 계속 실패하며, 이를 정상 동작으로 보고한다.

## 실행 lane

- **Primary builder:** Orca worktree 안 Codex CLI
- **Architecture / high-risk review:** Claude Code read-only
- **UI/browser second opinion:** Agy/Gemini 필요 시
- **QA / gate verification:** Hermes 독립 실행

Git commit/push/deploy는 별도 사용자 권한이다.
