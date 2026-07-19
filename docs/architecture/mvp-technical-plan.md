# Training Sloop MVP Implementation Plan — Archived Baseline

> **Current policy (2026-07-19):** Tasks below describe completed/bootstrap historical work. They are not the active next-step plan. New personal prototype work requires a fresh bounded user-approved plan only; it has no external reviewer/qualification/authority/controlled-apply/G1/G2/G3 prerequisite.

> **For Hermes:** 구현 승인 후 `orca-codex-primary-hermes-qa`에 따라 Orca worktree의 Codex primary lane으로 task-by-task 실행하고, Hermes가 독립 QA를 수행한다.

**Goal:** 결정론적·replay 가능한 브라우저 기반 Training Sloop 학습 prototype을 L01부터 구현하고 L05까지 확장한다.

**Architecture:** Strict TypeScript의 renderer-independent simulation core가 canonical state/event/score/debrief를 소유한다. PixiJS는 world projection, DOM/CSS는 접근 가능한 HUD/debrief, IndexedDB는 local-only replay를 담당한다. Domain validation과 P1 artifacts는 prototype 제작과 별개인 release gate다.

**Tech Stack:** TypeScript, Vite, PixiJS, Vitest, Playwright, IndexedDB. 정확한 version은 bootstrap 직전 compatibility check 후 lockfile에 고정한다.

---

## 구현 전 AP-0 — 사용자 승인 필요

이 문서는 구현 권한이 아니다. 코드, dependency install, Git initialization, Orca worktree 생성은 사용자의 명시적 “구현 시작” 승인 뒤에만 진행한다. 구현 승인이 있어도 release 권한은 생기지 않는다. 승인 ceiling은 `docs/HANDOFF.md`의 AP-0A/B/C를 명시하며, 생략 시 AP-0A까지만 허용한다.

## Task 0A — 최소 testable bootstrap

**Objective:** 뒤의 contract negative test를 실제 실행할 수 있는 빈 TypeScript 브라우저 shell을 만든다.

**예정 경로:**
- `package.json`, lockfile, `tsconfig.json`, `vite.config.*`, `vitest.config.*`, `playwright.config.*`
- `src/main.ts`, `src/app/`
- `tests/unit/`, `tests/contracts/`, `tests/e2e/`

**완료 조건:** compatibility check 기록과 lockfile이 있고, strict typecheck·Vitest smoke·Playwright smoke·production build가 실행된다. current Chromium만 prototype development baseline으로 확인하며, backend/analytics/live-data dependency나 sailing-domain 수치는 추가하지 않는다.

## Task 0B — 기술 계약 동결 및 negative tests

**Objective:** Task 0A의 test lane 위에서 renderer-independent contracts를 code보다 먼저 확정한다.

**문서 입력:**
- `docs/contracts/coordinate-contract.md`
- `docs/contracts/determinism-replay-contract.md`
- `docs/quality/prototype-and-release-gates.md`

**구현 산출물 예정:** `src/contracts/` schema와 `tests/contracts/` negative fixture.

**완료 조건:** coordinate/direction, logical tick/input ordering, seeded RNG policy, update/event ordering, pause/reset/retry, full replay identity, `comparison-policy-v1-draft`, `contract_version` bundle 의미, prototype/release gates가 versioned·testable하다. registry가 comparison policy를 포함한 full identity를 요구하고 `validated` record의 draft/TBD/incompatible binding을 release에서 거부한다. `src/sim`의 wall-clock/unseeded-randomness/DOM·Pixi·storage·network import 금지 static boundary test를 추가한다. unknown/incompatible replay는 원본을 보존한 채 stable reason code로 거부한다. sailing threshold/polar/safety 수치를 새로 만들지 않는다.

## Task 1 — contracts와 gate evaluator

**Objective:** invalid content를 시작 전 fail-closed 처리한다.

**예정 경로:** `src/contracts/`, `src/content/`, `src/gates/`, `tests/contracts/`.

**먼저 작성할 실패 테스트:** unknown/missing version, non-Sloop profile, lesson/profile mismatch, unsupported action, missing record, `assumption` prototype 허용·release 거부, stale/rejected record release 거부.

**완료 조건:** L01–L05 contract가 runtime load eligibility를 보고하며 release check는 현재 registry 상태에서 실패한다.

## Task 2A — pure deterministic core, ledger, raw golden replay

**Objective:** DOM/Pixi 없이 state transition·immutable event ledger·raw state/event replay를 구현하고 scoring/debrief 이전의 golden baseline을 고정한다.

**예정 경로:** `src/sim/`, `src/replay/`, `tests/unit/`, `tests/golden-replays/`.

**먼저 작성할 실패 테스트:** same full-identity/input equality, tick/sequence tie-break, pause non-progression, reset restoration, seeded RNG, zero-current / current composition, single-emission boundary event, renderer cadence independence, focus-loss/visibility 즉시 scheduler stop 및 explicit-resume ordering, key-repeat normalization.

**완료 조건:** headless golden replay가 canonical raw state/event fields를 비교하고 unknown replay는 local 원본을 보존한 채 stable reason code로 거부한다. focus-loss/visibility는 scheduler를 즉시 정지하며, resume은 explicit input 뒤에만 진행된다.

## Task 2B — score/debrief causality

**Objective:** Task 2A의 변경 불가능한 raw golden baseline 위에서 score components와 debrief facts를 event-causal하게 추가한다.

**예정 경로:** `src/scoring/`, `src/debrief/`, `tests/unit/`, `tests/golden-replays/`.

**먼저 작성할 실패 테스트:** score change의 causal event 연결, safety non-offsettable property, 동일 원인·미해결 상태의 중복 평가 방지, raw replay baseline 불변.

**완료 조건:** golden replay가 state/event와 함께 score/debrief canonical fields를 비교하며, Task 2A raw fixture가 score/debrief 작업으로 변경되지 않는다.

## Task 3 — L01 vertical slice

**Objective:** L01을 content→input→sim→render→HUD→debrief→local replay 전체 경로로 완성한다.

**예정 경로:** `src/content/l01/`, `src/app/`, `src/render/`, `src/ui/`, `src/storage/`, `tests/integration/`, `tests/e2e/`.

**검증:** keyboard-only flow, true/apparent wind와 heading/COG 표시, event-derived debrief, same full-identity retry, persistent unvalidated/non-navigation notice, no network telemetry, local replay 목록/삭제, reset이 이전 attempt를 삭제하지 않음.

**완료 조건:** L01 prototype은 architecture 증명용으로만 동작하며 domain correctness/release readiness를 주장하지 않는다.

## Task 4 — L02~L05 순차 확장

| 순서 | 범위 | 먼저 추가할 회귀 증거 |
|---|---|---|
| L02 | main/jib controls·trim causality | trim action/event/debrief, safety가 speed에 상쇄되지 않음 |
| L03 | deterministic gust/wave·reef mitigation | episode ordering, recovery/terminal semantics, conservative mitigation |
| L04 | heading/COG·STW/SOG·drift·mark | vector composition, recoverable miss, slower valid correction |
| L05 | synthetic tide/depth/visibility·pass/wait/return | observation completeness, decision outcome, wait/return pass eligibility |

모든 레슨은 다른 profile이나 live data를 추가하지 않고, contract→invariant→replay→score/debrief→UI 순서로 확장한다.

## Task 5 — browser/resilience QA

**검증:** keyboard focus/key-repeat, versioned pause/focus-loss session policy, visible focus/non-color/reduced motion, IndexedDB corruption/quota에서 기존 record 비파괴, unknown replay reason code와 원본 보존, no unexpected network, Chromium/WebKit/Firefox candidate tests. candidate test 성공은 release-support claim이 아니다.

## Task 6 — release evidence assembly

**Objective:** prototype과 release를 혼동하지 않는 machine-readable gate report를 만든다.

**검증:** golden replay compatibility, registry disposition report, browser/accessibility/performance/pilot/operations/replay-compatibility/privacy artifact manifest, no release override.

**완료 조건:** current `assumption` registry로 release check는 계속 실패하며, 이를 정상 동작으로 보고한다.

## 실행 lane

- **Primary builder:** Orca worktree 안 Codex CLI
- **Architecture / high-risk review:** Claude Code read-only
- **UI/browser second opinion:** Agy/Gemini 필요 시
- **QA / gate verification:** Hermes 독립 실행

Git commit/push/deploy는 별도 사용자 권한이다.
