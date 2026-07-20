# AGENTS.md — Sailing Bootcamp Project Rules

## Product boundary

This workspace defines a browser-based educational sailing simulator, not an actual navigation, safety, weather, certification, or licensing tool. MVP is synthetic virtual water, desktop-first, `training-sloop-v1` only, and mandatory lessons L01–L05.

## Current phase

AP-0A through AP-0E are verified and integrated. For any future personal local prototype work, the only planning authorization is an explicit user-approved bounded scope. External reviewer qualification, authority, controlled apply, G1/G2/G3, P1, and release evidence are archived non-operational materials; they cannot block or automatically resume personal work.

## Personal-use operating policy

- **Personal local use:** an explicit user-approved bounded code scope is sufficient. No external reviewer, qualification, authority, controlled apply, G1/G2/G3 approval, P1 artifact, or public-release evidence is a prerequisite now or later in this product scope.
- **Archived materials:** former external-review/release documents are non-operational references. They cannot create a required input, blocked state, or automatic resumption.
- **Code work:** user must explicitly authorize implementation before creating source code, dependencies, package manifests, or Orca worktrees.
- **Automatic Git completion:** Once a user-authorized source change passes the required scope and QA gates, Hermes must stage only the approved changes, create the scoped commit, integrate it through a fresh Orca worktree with `git merge --ff-only` into `main`, and push `origin/main` without a separate commit/merge/push question. A user may explicitly prohibit or narrow this policy for a task. Deployment, release, tagging, and external publication remain separately authorized actions.
- Never use the absence of formal gates to claim certification, factual validation, supported-browser coverage, deployment readiness, or release eligibility.

## Implementation routing

After AP-0, use the `orca-codex-primary-hermes-qa` workflow:

- Hermes: PM/controller/QA
- Orca: isolated worktree runtime
- Codex CLI: primary builder
- Claude Code: read-only architecture/diff review
- Agy/Gemini: optional UI/browser second opinion

Do not edit code in the shared checkout. Do not add, commit, push, deploy, reset, restore, stash, rebase, or merge unless the user separately authorizes that Git action.

## Technical invariants

- Read `docs/contracts/coordinate-contract.md` and `docs/contracts/determinism-replay-contract.md` before code.
- Canonical simulation state/event ledger/scoring/debrief must be pure TypeScript and renderer-independent.
- `sim` may not depend on DOM, PixiJS, storage, network, wall-clock, or unseeded randomness.
- Input authority is logical tick + sequence, not browser timestamp.
- Replay compatibility uses the full identity: scenario, seed, ordered input log, model/profile/contract, coordinate/determinism/comparison-policy versions. Missing or incompatible identity fails closed; do not approximate replay.
- Pause changes no tick/RNG/state/event/score. Reset restores declared initial state + seed.
- Focus loss or hidden visibility stops scheduler cadence immediately; no additional tick/RNG/state/event/score may progress before explicit resume; key-repeat is normalized to declared logical actions.
- Renderer/DOM project state; they do not modify it.
- Local-only replay/telemetry: no backend, account, analytics SDK, or live marine data in MVP.
- Preserve unsupported/corrupt replay payloads, show stable non-sensitive failure reasons, allow local per-record deletion, and never erase earlier attempts implicitly on reset.
- Do not invent sailing thresholds, polars, safety limits, navigational advice, or real-coast accuracy.

## Required verification

- Strict TypeScript typecheck
- Vitest contracts, deterministic sim, replay, scoring causality, safety non-offsettable tests
- Golden replay equality and renderer cadence independence
- Playwright keyboard-only, focus/non-color/reduced-motion, local-only network tests
- Static `src/sim` boundary check rejects wall-clock, `Math.random`, DOM/Pixi/storage/network imports
- The TypeScript release check must remain fail-closed while registry records are `assumption`; it is a future public-distribution guard and does not block personal local use.

## Source documents

- `prd.md`
- `docs/HANDOFF.md`
- `docs/architecture/mvp-technical-plan.md`
- `docs/quality/prototype-and-release-gates.md`
- `docs/content/mandatory-lessons-l01-l05.md`
- `docs/content/domain-validation-registry.yaml`
