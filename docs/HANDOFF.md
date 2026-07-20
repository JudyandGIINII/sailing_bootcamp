# Implementation Handoff — Training Sloop MVP

> **Current reconciliation (2026-07-20):** The active product path is personal, browser-local synthetic use. Any future personal prototype work requires only explicit user approval of a bounded scope. External qualification, authority, controlled apply, G1/G2/G3, P1, deployment, and release materials are archived non-operational references; they cannot block or automatically resume personal work. Registry records remain `assumption` and no real-world sailing authority is asserted.

> **Handoff status:** pre-reconciliation capture-time docs-only record `76bf5b6` — historical integrated code/candidate-QA baseline `7827079`; no evidenced code increment is currently pending
> 이 문서는 구현 시작을 자동 승인하지 않는다.

> **P1B local extension note (2026-07-20):** This isolated-worktree extension adds only declared/unvalidated synthetic scenario/replay/UI values: true-north direction selectors, dominant period, visibility, synthetic datum water level/phase, and exact synthetic course templates. Their versioned snapshot hash and variation trace are renderer-independent display/replay identity material only; they do not change session physics, scoring, action authority, ticks, scheduler, renderer truth, or local storage format. Replay V2 rejects incomplete P1B snapshots without V1 fallback; V1 displays no fabricated P1B values.

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

## 작업 순서

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

- Historical capture: `JudyandGIINII/sailing-l05-record-evidence` pointed to exact `6004911508305445d520755e3a082c7654ba79b7`; at capture, its remote was pushed with no PR. That capture-time branch statement is not a continuing remote-state claim.
- The historical integrated code and candidate-QA baseline is `782707954c8ed711395c0ee5572de3be9f9fd256` (`7827079`), containing L03 `37aac44` → L04 `ed83927` → L02 `f98f611` → L05 `6004911` and the earlier documentation reconciliation. At pre-reconciliation documentation capture time, `HEAD`/`origin/main` pointed to its subsequent documentation-only post-main-sync record `76bf5b669a48706f3eea8399ac0baa366ca4cac8` (`76bf5b6`).
- Recorded candidate QA on exact `7827079` passed strict TypeScript typecheck, 13 Vitest files / 118 tests, 12 Chromium Playwright tests, production build, and `git diff --check`. It was not rerun for capture-time `76bf5b6` and is local/browser synthetic prototype evidence only, not domain validation, navigation/safety truth, public release, certification, deployment, or supported-browser claim.
- L05 remains display-only record visibility with its existing boundary: it reproduces only exact immutable ledger records. Its `pass`/`wait`/`return` labels are not recommendations, correctness judgments, outcomes, or route/depth/tide/visibility/clearance/timing/order/safety evidence.
- **다음 권한 경계:** no evidenced code increment is currently pending. Any future feature requires explicit user authorization for a bounded scope; this integrated evidence does not assert release, deployment, external review, domain validation, registry promotion, or release eligibility.

## 알려진 출시 blocker

도메인 검토자 approval, concrete model/contract/coordinate/determinism/comparison-policy binding, P1 browser/accessibility/pilot/operations/**replay-compatibility**/privacy artifacts, release authority가 없다. 이는 prototype 구현을 막지는 않지만 release를 막는다.
