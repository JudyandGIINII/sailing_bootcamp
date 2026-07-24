# Implementation Handoff — Training Sloop MVP

> **Training-ground-first decision (2026-07-20):** The next active product focus is completing the personal, browser-local, synthetic **Training Ground**. Do not begin actual physical-environment modeling, historical observation package import, place/date reconstruction, live marine/weather access, or a separate “main game” area until the Training Ground has a user-approved completion scope and is finished.
>
> **Baseline reconciliation:** For this work, `646ac19f13919906bd7fac12cb52a05bcdfe3d69` (`646ac19`) was the capture-time/pre-reconciliation `HEAD` and `origin/main`; do not read this as a claim it remains current after the uncommitted reconciliation diff. `92a8613` is the P1/P1B synthetic scenario/catalog code-feature baseline and an ancestor of `646ac19`. GitHub prerelease [`v0.1.0-p1b`](https://github.com/JudyandGIINII/sailing_bootcamp/releases/tag/v0.1.0-p1b) points to `92a8613` as a source/prototype prerelease only—not deployment or release readiness. `7827079` is historical integrated code/candidate-QA baseline, not current-head proof; `76bf5b6` is a historical post-main documentation capture, not the current tip.
>
> **Verified P1/P1B foundation:** versioned synthetic scenario selection, strict content hash, deterministic variation trace, Replay V2 snapshot freeze, directions, dominant wave period, visibility, synthetic datum water level/tide phase, and exact synthetic start/mark/finish templates are present. These are declared/unvalidated scenario/replay/UI values only and do not change session physics, scoring, action authority, ticks, renderer truth, or storage format. Replay V2 rejects incomplete, historical, unregistered-binding, and malformed extension payloads; V1 does not fabricate P1B values.
>
> **Personal-use boundary:** current work remains personal, browser-local, synthetic, and non-navigation. Registry records remain `assumption`; no real-world sailing, safety, certification, physical-model, or historical-environment claim is asserted.
>
> **Integrated semantic-slice status (2026-07-21–22):** `f55877d` integrated the L01 versioned synthetic wind/course educational model; `89ab655` integrated the L02 synthetic trim-input acknowledgment; and `60202d8` integrated the bounded L03 synthetic cue/checkpoint repair. All remain browser-local, deterministic, synthetic, unvalidated, and non-navigation source increments. None changes the registry or asserts physical sailing/trim/performance/safety truth.
>
> **Current continuation boundary (2026-07-24):** Scenario 1 planning correction is committed as documentation/Seed work only. `docs/design/scenario1-synthetic-score-calibration-v2.md` and `seeds/scenario1-first-playable-planning-v1.yaml` preserve the approved 50/30/20 synthetic allocation and target-heading course rule. They do **not** authorize source implementation. The next user decision is a versioned synthetic propulsion penalty curve/composition rule, followed by a separate bounded implementation authorization.
>
> **Historical resume artifact:** `docs/HANDOFF_NEXT_SESSION_L03_REPAIR_AND_DEPLOYMENT_2026-07-21.md` preserves the previous L03 repair/deployment-preparation context. L03 repair is now integrated; that artifact does not authorize future deployment or Scenario 1 source work.

## 목적

다음 구현 agent는 브라우저 기반 Training Sloop prototype을 만들되, renderer가 simulation truth를 소유하지 않고 release gate를 우회하지 않게 한다. MVP에서 선택 가능한 boat profile은 **`training-sloop-v1` 하나**이며, L01–L05가 모두 이 profile을 사용한다.

## 반드시 읽을 문서

1. `prd.md`
2. `docs/PROJECT_STATUS.md`
3. `docs/architecture/mvp-technical-plan.md`
4. `docs/architecture/technical-options.md`
5. `docs/contracts/coordinate-contract.md`
6. `docs/contracts/determinism-replay-contract.md`
7. `docs/quality/prototype-and-release-gates.md`
8. `docs/content/mandatory-lessons-l01-l05.md`
9. `docs/content/domain-validation-registry.yaml`
10. `AGENTS.md`

## 구현 권한 경계

- AP-0 사용자 승인 전에는 코드, dependency install, package manifest, Git worktree를 만들지 않는다.
- AP-0 뒤 implementation은 Orca-managed worktree에서 수행한다.
- primary builder는 Codex CLI다. Claude Code는 architecture/diff read-only review, Hermes는 QA/controller다.
- agent는 commit/push/deploy/reset/restore/stash/rebase/merge를 수행하지 않는다. 별도 사용자 권한이 있어야 한다.

### AP-0 승인 범위

AP-0는 release 권한이 아니며, 승인 메시지는 아래 ceiling 중 하나를 명시해야 한다. ceiling을 생략하면 **AP-0A만** 승인된 것으로 해석한다. 2026-07-19 AP-0A는 isolated Orca worktree에서 완료·독립 검증된 뒤 `feat: bootstrap deterministic replay contract foundation`으로 committed/integrated 되었다.

- **AP-0A:** Task 0A–0B(bootstrap과 contract/gate negative tests)까지만.
- **AP-0B:** AP-0A 범위와 Task 1–3(L01 vertical slice)까지만.
- **AP-0C:** AP-0B 범위와 Task 4–6(L02–L05, resilience QA, release-evidence report)까지의 prototype 작업. release·배포·commit/push 권한은 포함하지 않는다.

각 task는 해당 task의 diff, 결정된 dependency/lockfile(해당 시), test/build/browser evidence를 Hermes가 독립 확인한 뒤에만 다음 task로 진행한다. 승인 ceiling에 도달하면 agent는 멈추고 사용자 지시를 기다린다.

## non-negotiable architecture

```text
contracts/content → pure deterministic sim → immutable event ledger → scoring/debrief
                         ↓
                 replay/session controller
                         ↓
        PixiJS projection | DOM/CSS HUD | IndexedDB local storage
```

- `sim`은 DOM/PixiJS/storage/network/wall-clock/unseeded randomness를 import하지 않는다.
- renderer/HUD는 canonical state를 수정하지 않는다.
- input은 `logical_tick + sequence`로 기록하며 browser timestamp는 authoritative하지 않다.
- focus-loss/visibility/key-repeat 처리는 versioned input lifecycle policy로 기록하며, 그 policy 밖 browser event를 canonical input으로 추론하지 않는다.
- speed control은 scheduler cadence만 바꾸며 fixed logical state evolution을 바꾸지 않는다.
- pause는 tick/RNG/state/event/score 모두를 진행시키지 않는다.
- replay identity는 `scenario_version + seed + ordered_input_log + model_version + boat_profile_version + contract_version + coordinate_contract_version + determinism_contract_version + comparison_policy_version` 전체다.
- unknown/incompatible version은 approximate replay를 하지 않고 fail-closed 한다. 원본 local replay는 보존하고, 실행 결과를 주장하지 않는 stable reason code를 표시한다.

## Active priority — Training Ground before Main Game

1. Treat L01–L05 and their synthetic scenario selection/replay lifecycle as the Training Ground product surface.
2. The bounded Training Ground completion audit and acceptance matrix are complete at `56b13c6`; they identify remaining semantic gaps without claiming a completed physical/environment model.
3. L01 semantic observation and L02 input acknowledgment are integrated. L02 remains acknowledgment-only: it does not compute sail shape, sheets, wind effect, speed, stability, performance, safety, or navigation truth.
4. L03 has an approved acknowledgment-only plan: declared synthetic cue `pending → gust_wave_observed`, then synthetic checkpoint `gust_wave_observed/not_selected → complete/selected`. The candidate must not integrate until strict Replay V2 terminal/paused local-save behavior and full browser smoke pass.
5. Keep P1/P1B fields scenario/replay/UI-only unless a separately planned physical-model slice explicitly changes the pure simulation core with units, invariants, golden traces, sensitivity tests, and a validity envelope.
6. Defer: historical data providers/licences/provenance ingestion; date/place observation packages; actual physical-environment coupling; live APIs; and any distinct Main Game mode/UI.
7. User-authorized automatic continuation does not cross product/domain/release hard stops. Deployment may target only a clean, integrated `main` SHA; an uncommitted L03 candidate is excluded.

## Historical architecture task order

The following AP-0 task sequence is retained as historical architecture context. It is **not** the next automatic execution plan; the Training-ground-first priority above takes precedence.

1. **Task 0A:** TypeScript/Vite/Vitest/Playwright 최소 bootstrap, lockfile, strict typecheck/test/build lane
2. **Task 0B:** contract schema와 gate negative tests — Task 0A toolchain 위에서 실행
3. **Task 1:** content/profile/lesson/release gate evaluator
4. **Task 2A:** headless deterministic core, immutable event ledger, raw state/event golden replay
5. **Task 2B:** score/debrief causality를 Task 2A golden baseline 위에 추가
6. **Task 3:** L01 vertical slice
7. **Task 4:** L02→L05 순차 확장
8. **Task 5:** browser/accessibility/storage resilience QA
9. **Task 6:** release evidence report — 현재 registry 상태에서는 release check가 실패해야 정상

Task 0A의 완료 증거는 선택한 dependency compatibility record·lockfile·strict typecheck·unit-test smoke·production build다. Task 0B는 `comparison-policy-v1-draft` binding, `contract_version` 의미, registry의 complete identity fields, `validated` record의 non-draft binding release-negative test, contract negative fixtures를 포함해야 한다. 또한 `src/sim`의 wall-clock/unseeded-randomness/DOM·Pixi·storage·network import 금지 static boundary check를 추가한다. Task 1 이후 각 task는 추가한 invariant의 failing test와 passing evidence를 함께 남긴다. 어떠한 task도 sailing threshold, polar, safety 수치, 실제 항법 조언을 새로 만들 수 없다.

## prototype / release 분리

- Prototype은 versioned `assumption`을 simulation-only/unvalidated/non-navigation label과 함께 사용할 수 있다.
- Release는 모든 대상 registry record가 `validated`이고 P1 artifact·release approval이 존재할 때만 후보가 된다.
- `assumption`, `partially_validated`, `rejected`, missing, stale record는 release를 막는다.
- force override는 없다.

## 필수 검증

- strict TypeScript check
- Vitest: contracts, sim, replay, scoring causality, safety non-offsettable property
- golden replay: state/event/score/debrief equality, pause/reset/input order/RNG/cadence independence
- Playwright: keyboard-only L01, visible focus/non-color/reduced motion, no unexpected network
- input lifecycle: focus-loss/visibility/key-repeat policy와 explicit resume, renderer-independent replay
- storage: local replay 목록/삭제, reset attempt 보존, quota/corruption에서 기존 record 비파괴
- prototype browser baseline: current Chromium development verification; WebKit/Firefox는 Task 5 candidate evidence이며 release-support claim이 아님
- release check negative test: current `assumption` registry이면 실패

## 사용자 승인 후 첫 행동

1. Orca runtime/repo/worktree preflight
2. 승인된 AP-0 ceiling과 `Task 0A` implementation contract를 Codex lane에 전달
3. no-diff/no-test evidence 없이 다음 Task로 진행하지 않음
4. Hermes가 each slice의 diff/test/build/browser evidence를 독립 확인

## 현재 handoff 위치

- **Capture-time reference:** `646ac19` is the historical pre-evidence-closure parent; it does not claim that ref remains current. `92a8613` is the ancestor P1/P1B synthetic scenario/catalog code-feature baseline, verified there with strict typecheck, 127 Vitest tests, 14 Playwright smoke tests, production build, diff check, and independent source review.
- **Historical prerelease record:** GitHub prerelease `v0.1.0-p1b` targets `92a8613`. It communicates a synthetic prototype source milestone only; it does not deploy a web application, demonstrate release readiness, or alter the local-only, non-navigation boundary.
- **Evidence closure state:** `56b13c6` added `docs/architecture/training-ground-completion-matrix.md` and the L01 record-only helm checkpoint. `f55877d` then added L01 versioned synthetic wind/course observations; `89ab655` added L02 versioned trim-input acknowledgment. Fresh L02 integration verification passed strict typecheck, 18 Vitest files / 177 tests, 15 Chromium smoke tests, production build, and diff check. This remains prototype evidence, not physical-model completion.
- **Training Ground state:** P1/P1B provides synthetic environment/course choices plus deterministic replay identity. L01 observations and L02 acknowledgment are functional synthetic increments; neither is a completed physical-environment model or historical scenario importer.
- **Deferred Main Game state:** no separate Main Game mode exists. Historical environment packages, source licences, date/place provenance, physics coupling, and live data are deliberately not started.
- **Current L03 repair boundary:** L03 acknowledgment planning is approved, but the candidate is not integrated. A real browser smoke exposed pre-terminal paused local-save/replay mismatch; repair and fresh source review remain required before commit/integration. Do not infer physical/historical environment work, registry changes, deployment, or release from completed prototype slices.

## Public-distribution reference

The repository has a GitHub **prerelease**, but the future public-distribution gate remains a separate reference path. It does not block personal Training Ground work and must not be used to claim domain validation, navigation/safety correctness, certification, deployed-service readiness, or supported-browser coverage.
