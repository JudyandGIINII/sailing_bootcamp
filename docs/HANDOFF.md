# Implementation Handoff — Training Sloop MVP

> **Handoff status:** READY_FOR_AP-0_USER_APPROVAL
> 이 문서는 구현 시작을 자동 승인하지 않는다.

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
- speed control은 scheduler cadence만 바꾸며 fixed logical state evolution을 바꾸지 않는다.
- pause는 tick/RNG/state/event/score 모두를 진행시키지 않는다.
- unknown/incompatible version은 approximate replay를 하지 않고 fail-closed 한다.

## 작업 순서

1. Task 0: contract schema와 gate negative tests
2. Task 1: TypeScript/Vite/PixiJS/Vitest/Playwright bootstrap 및 lockfile
3. Task 2: content/profile/lesson/release gate evaluator
4. Task 3: headless deterministic core, event ledger, scoring/debrief, replay/golden tests
5. Task 4: L01 vertical slice
6. Task 5: L02→L05 순차 확장
7. Task 6: browser/accessibility/storage resilience QA
8. Task 7: release evidence report — 현재 registry 상태에서는 release check가 실패해야 정상

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
- release check negative test: current `assumption` registry이면 실패

## 사용자 승인 후 첫 행동

1. Orca runtime/repo/worktree preflight
2. `Task 0` implementation contract를 Codex lane에 전달
3. no-diff/no-test evidence 없이 다음 Task로 진행하지 않음
4. Hermes가 each slice의 diff/test/build/browser evidence를 독립 확인

## 알려진 출시 blocker

도메인 검토자 approval, concrete model/contract/coordinate/determinism binding, P1 browser/accessibility/pilot/operations/privacy artifacts, release authority가 없다. 이는 prototype 구현을 막지는 않지만 release를 막는다.
