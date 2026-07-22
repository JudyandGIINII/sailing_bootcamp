# L03 Paused Replay Repair — Next-Stage Implementation Plan

> **For Hermes:** The user approved and this plan was executed through `orca-codex-primary-hermes-qa`. The validated Alfred/Hermes planning record is `.agent/plans/ALF-20260722-0830-sailing-l03-repair-resolution-r1/`.

**Status:** `EXECUTED_2026-07-22` — repair `60202d8` passed final QA and independent review, then was fresh-integrated/fast-forwarded/pushed. Static Vercel configuration `561d011` was also integrated; Vercel reported deployment `dpl_68Hqj4yDJQekxwhNYfy2sPvDKNuA` as a public production target. This outcome does not create release, domain, safety, navigation, certification, or supported-browser claims.

**Goal:** Repair the generic paused pre-terminal Replay V2 local-save regression in the existing L03 candidate without changing Training Ground’s synthetic acknowledgment-only, local-only, deterministic, or non-navigation boundaries.

**Architecture:** The pure TypeScript sim remains canonical; DOM/PixiJS only project it and IndexedDB stores local replay records. The repair must preserve full Replay V2 identity and the invariant that pause advances no logical tick, RNG, state, immutable ledger event, score, or L03 acknowledgment transition.

**Tech Stack:** TypeScript, Vite, Vitest, Playwright Chromium, IndexedDB; existing Orca isolated worktree and Codex primary implementation lane.

## Execution outcome (2026-07-22)

This document’s remaining starting-evidence and gate sections are retained as the historical approved plan, not current task state. The actual result is: candidate commit `c5a749c`; fresh-main repair integration `60202d8`; static Vercel configuration integration `561d011`; all QA and final independent source review passed; deployment `dpl_68Hqj4yDJQekxwhNYfy2sPvDKNuA` is Ready and publicly reachable. See `docs/HANDOFF_NEXT_SESSION_L03_REPAIR_AND_DEPLOYMENT_2026-07-21.md` for the authoritative post-execution handoff.

---

## Verified starting evidence

| Item | Current fact |
|---|---|
| Shared baseline | `main = origin/main = 13184195f792040956fdf96b47ee26033ecf21b6` (`docs: add L03 repair handoff`) |
| Candidate worktree | `/Users/hipgiinii/orca/workspaces/Sailing_training/sailing-l03-ack-20260721` |
| Candidate branch/base | `JudyandGIINII/sailing-l03-ack-20260721` / `9be03688de95a2437183c56e1d1e936854fb8aff` |
| Candidate state | Dirty, 10 changed paths, 521 insertions / 124 deletions; uncommitted, unintegrated, unpushed, undeployed |
| Candidate checks | `typecheck` pass; Vitest **18 files / 192 tests** pass; Playwright **15/16** pass |
| Exact blocker | Generic browser flow `L03 start → Space pause → R` does not display `Saved local attempt` in `tests/smoke/app.spec.ts` |
| Control check | Targeted L03 paused V2 save/reload smoke passes; this does **not** prove the generic regression is resolved |
| Current `main` control | typecheck, **18 files / 177 Vitest**, **15 Chromium smokes**, build, and `git diff --check` pass |

## Scope and hard stops

### Permitted functional meaning

Only L03’s existing synthetic acknowledgment sequence may exist:

```text
pending → gust_wave_observed → complete/selected
```

### Explicit exclusions

Do **not** add wind/wave values, reef timing or advice, thresholds, safety/physics/navigation/performance/scoring semantics, L04/L05 work, P1/P1B core coupling, backend, analytics, registry disposition changes, release evidence, deployment configuration, or public-product claims.

### Authorization gates

1. **Gate A — candidate repair:** Requires the user to approve source edits in the existing candidate worktree, the diagnosis-first repair objective, and the verification bundle.
2. **Gate B — commit/integrate/push:** After Gate A passes QA/review and remains in the approved scope, Hermes commits only the reviewed change, creates a fresh integration worktree from current `main`, applies the reviewed change to make an integration commit directly atop current `main`, reruns QA, fast-forward-merges it into `main`, pushes `origin/main`, and verifies remote ancestry. This is automatic only under the project’s approved source-change Git policy; no deployment is implied.
3. **Gate C — Vercel preparation:** Separate user authorization after a clean, integrated commit. It may discover/propose project/team/linkage, static Vite build/output settings, and access model only.
4. **Gate D — Vercel deployment:** Separate user authorization after Gate C. Preview is first; production requires an explicit production target confirmation.

## Task 1: Preserve and reproduce the regression

**Objective:** Create a non-mutating evidence snapshot and distinguish the failing generic flow from the passing targeted L03 flow.

**Files:**
- Read only: candidate working tree and its 10-path diff against `9be03688de95a2437183c56e1d1e936854fb8aff`
- Coordination output: `.agent/plans/ALF-20260722-0830-sailing-l03-repair-resolution-r1/` (no source paths)

**Steps:**
1. Record candidate `git status --short --branch`, complete `git diff --name-status`, `git diff --stat`, and a SHA-256 checksum of the patch in the coordination artifact.
2. Run the two Playwright flows under clean browser isolation: the generic `L03 → pause → R` flow and the targeted paused L03 Replay V2 save/reload flow.
3. Capture the first branch where they diverge: keyboard dispatch, paused-save eligibility, Replay V2 serialization, IndexedDB completion, or UI success acknowledgement.
4. Stop if evidence points outside the candidate’s existing functional boundary; request a revised plan rather than changing broad code.

**Acceptance:** The root-cause hypothesis identifies one first divergent condition and does not infer generic success from the targeted smoke.

## Task 2: Implement the smallest proven repair

**Objective:** Restore the generic paused pre-terminal save confirmation without weakening the regression test or broadening L03 semantics.

**Files:**
- Likely modify: `src/main.ts`, `tests/smoke/app.spec.ts`
- Conditional only if Task 1 proves the boundary defective: `src/contracts/replay.ts`, `src/sim/session.ts`, `tests/contracts/replay.test.ts`
- Read-only context: `src/content/l02-l05.ts`, `src/scoring/projection.ts`, existing replay/session tests

**Steps:**
1. Add/retain a regression assertion for the generic flow’s visible `Saved local attempt` acknowledgement.
2. Preserve the targeted paused L03 save/reload smoke unchanged as an independent regression.
3. Change only the first proven defective boundary; do not increase timeout, loosen selector semantics, remove assertions, or replace success checks with incidental UI state.
4. If a Replay V2/session contract changes, add fail-closed contract coverage before implementation for: missing record/field, tampered or incompatible identity, unreachable input, and post-terminal input.
5. Verify no save/reload introduces a tick/RNG/state/ledger/score/L03-acknowledgment transition.

**Acceptance:** Both browser flows pass while generic and L03-specific coverage remain distinct.

## Task 3: Candidate QA and independent review

**Objective:** Prove the repaired candidate is deterministic, local-only, in scope, and not timing-dependent.

**Files:**
- Review all 10 candidate paths; reject unrelated/generated/coordination artifacts.

**Run in candidate worktree:**
```bash
npm run typecheck
npm test
npm run test:smoke
npm run build
git diff --check
git status --short --branch
git diff --name-status 9be03688de95a2437183c56e1d1e936854fb8aff --
```

**Additional verification:**
1. Re-run both paused browser flows at least twice in fresh browser contexts.
2. Confirm all smoke assertions, timeouts, selectors, and expected outcomes are at least as strict as before repair.
3. Have a read-only Claude review assess the full final candidate diff for scope, replay/pause invariants, record-vs-inference correctness, local-only behavior, and drift relative to current main.
4. Hermes independently repeats the full command matrix and inspects the final diff.

**Acceptance:** All commands pass; both flows pass repeatedly; independent review explicitly recommends integration; no forbidden meaning or unreviewed path remains.

## Task 4: Integrate only after Gate B

**Objective:** Integrate a reviewed candidate without mutating the shared checkout or assuming its older base is compatible.

**Files:**
- Candidate: reviewed source commit only
- Integration: a fresh Orca worktree based on the revalidated current `main` SHA

**Steps:**
1. Recheck that `main` and `origin/main` still point to the pinned/revalidated baseline. Stop on drift.
2. Commit only the exact reviewed candidate paths on the candidate branch.
3. Create a fresh Orca integration worktree from current `main`; apply the reviewed commit there so the integration commit is a direct child of current `main`.
4. Re-run the entire Task 3 command matrix and both paused flows on that integration commit.
5. Inspect the final diff from the pinned `main` parent; if approved, fast-forward-merge with `git merge --ff-only` into `main` and push `origin/main`.
6. Fetch and prove `origin/main` resolves to the verified integration commit.

**Rollback:** Before push, abandon only the fresh integration worktree/commit. After push, use a reviewed revert commit plus the same QA and normal fast-forward integration—never rewrite shared history.

## Task 5: Later, separately authorized Vercel preparation

**Objective:** Prepare—not deploy—the clean integrated Vite prototype.

**Prerequisites:** Gate C user authorization and a clean integrated `main` SHA; no use of an uncommitted candidate.

**Decision record required before any deployment:** project/team link, GitHub-connected or CLI-only model, public/protected/preview-only access model, static Vite build/output configuration, production URL, and browser verification markers.

**Truthful product label:** Any future static surface remains synthetic, assumption-only, browser-local, non-navigation, non-certification, and not a release/domain/safety claim.

## Explicit user approval text for Gate A

> Approve the L03 paused Replay V2 repair only in the existing isolated candidate worktree. Diagnose and minimally fix the generic `L03 → pause → R` local-save acknowledgement regression; retain strict generic and targeted paused-save/reload browser tests; make no physical, safety, navigation, scoring, registry, backend, analytics, release, or deployment changes. Run typecheck, full Vitest, full Chromium smoke, build, diff check, repeat both browser flows, and obtain independent review before the project’s normal commit → fresh integration worktree → `main` fast-forward → `origin/main` push path. Do not deploy.
