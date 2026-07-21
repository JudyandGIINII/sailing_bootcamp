# Next-Session Handoff — L03 Replay Repair and Deployment Preparation

> **Created:** 2026-07-21 KST
> **Scope:** personal, browser-local, synthetic Training Ground prototype.
> **No real-world claim:** this project does not provide navigation, sailing safety, physical performance, certification, or environmental advice.

## 1. Exact integrated baseline

- Shared/remote baseline at handoff creation: `main = origin/main = 5614a7a6e331703de5c718696e391ca163028e80` (`docs: record L03 repair status`).
- Integrated source increments contained by that commit:
  - `f55877d` — L01 versioned synthetic wind/course observation model.
  - `89ab655` — L02 synthetic main/jib trim-input acknowledgment.
- `5614a7a` documents L03 as an **uncommitted repair candidate**. It is not evidence that L03 has been integrated or deployed.

## 2. Current active lane — L03 acknowledgment-only repair

Alfred plan: `ALF-20260721-0855-l03-next-slice`.

Permitted L03 semantics are exactly:

1. declared synthetic cue acknowledgment: `pending → gust_wave_observed`;
2. synthetic checkpoint acknowledgment: `gust_wave_observed/not_selected → complete/selected`.

The candidate must not add wind/wave values, reef timing, advice, thresholds, safety, physics, navigation, scoring, performance, registry changes, P1/P1B core coupling, L04/L05 work, backend, analytics, release, or deployment semantics.

### Candidate location and current diff

- Worktree: `/Users/hipgiinii/orca/workspaces/Sailing_training/sailing-l03-ack-20260721`
- Branch: `JudyandGIINII/sailing-l03-ack-20260721`
- Base: `5614a7a` was not available when the worktree was created; rebase/merge only in a future fresh integration worktree after candidate QA passes.
- Candidate paths:
  - `src/content/l02-l05.ts`
  - `src/contracts/replay.ts`
  - `src/main.ts`
  - `src/scoring/projection.ts`
  - `src/sim/session.ts`
  - `tests/contracts/replay.test.ts`
  - `tests/fixtures/l03-raw-golden.json`
  - `tests/fixtures/l03-score-debrief-golden.json`
  - `tests/smoke/app.spec.ts`
  - `tests/unit/projection.test.ts`

### Repair status — do not integrate yet

Controller checks observed during the repair loop:

- `npm run typecheck`: PASS.
- `npm test`: latest observed **18 files / 192 tests PASS**.
- `npm run test:smoke`: latest controller run **14/15 PASS**.
- Failing real browser path: `L03 start → Space pause → R save/reset` did not show `Saved local attempt`.

The current unverified repair must prove that a pre-terminal paused L03 Replay V2 attempt (`pending/not_selected`, terminal tick `0`, paused terminal state, canonical pause input) saves locally, resolves, reloads, and remains paused without inventing an acknowledgment. Missing, tampered, unreachable, or post-terminal inputs must remain fail-closed.

## 3. Resume procedure

1. Do **not** start a new Codex terminal until current source state is inspected; terminal cleanup is complete for Sailing-related Orca records.
2. In the L03 candidate worktree run:

   ```bash
   npm run typecheck
   npm test
   npm run test:smoke
   npm run build
   git diff --check
   ```

3. If any check fails, make the smallest repair in the same isolated worktree with a regression test. Do not weaken the browser smoke merely to mask the save/load contract failure.
4. When all controller checks pass, run a fresh read-only source review pinned to the final diff.
5. Only after review approval: stage the listed approved paths, commit, create a fresh current-main integration worktree, `git merge --ff-only`, rerun the full suite, push `origin/main`, fetch/verify ancestry, then create a truthful post-sync documentation commit if required.

## 4. Deployment preparation

The user requested deployment preparation, but the following facts are established:

- Vercel CLI is installed and authenticated for the current profile.
- The Vercel account has **no existing Sailing Training project**.
- The repository has no `.vercel/project.json`, `vercel.json`, GitHub Pages site, or GitHub Actions deployment workflow.
- Deployment may target only a clean, integrated `main` commit. It must exclude the uncommitted L03 candidate.

Before first Vercel deployment, choose and record:

1. project name/link and whether it is GitHub-connected;
2. access model: public, protected, or preview-only;
3. deployment model: this Vite app is static unless production API routes are intentionally added; do not rely on localhost/Vite proxy behavior in Vercel;
4. production URL and verification markers.

A successful static deployment would still be a synthetic prototype surface only, not domain validation, release eligibility, certification, or navigation/safety evidence.

## 5. Preserved local artifacts and terminal state

- Shared checkout intentionally retains untracked historical coordination artifacts under `.agent/plans/` and `docs/plans/2026-07-19-l03-runtime-trace-preparation.md`; never stage them incidentally.
- Sailing-related stale Orca terminal records were explicitly cleared. Do not use terminal polling/restart loops; run bounded batches only.
- Other projects’ terminals (for example Apt_study) were not touched.

## 6. First decision on resume

**Priority:** finish the strict L03 pre-terminal paused local-save replay repair and obtain green browser smoke + fresh review.

**Deployment decision:** choose a first Vercel project/access model only after the target commit is clean and integrated. No deployment of the uncommitted L03 candidate is permitted.
