# AGENTS.md — Sailing Bootcamp Project Rules

## Product boundary

This workspace defines a browser-based educational sailing simulator, not an actual navigation, safety, weather, certification, or licensing tool. MVP is synthetic virtual water, desktop-first, `training-sloop-v1` only, and mandatory lessons L01–L05.

## Current phase

Implementation planning is complete. AP-0A bootstrap/contract code is verified and integrated; AP-0B is the next gated implementation ceiling. See `docs/PROJECT_STATUS.md` and `docs/HANDOFF.md`.

## Authority gates

- **AP-0:** User must explicitly authorize implementation before creating source code, dependencies, package manifests, or Orca worktrees.
- An AP-0 prototype authorization is not release authorization.
- Release remains blocked unless lesson validation records are `validated`, P1 artifacts are approved, and separate release authority evidence exists.
- Never use force overrides for release gates.

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
- Release check must fail while registry records are `assumption`

## Source documents

- `prd.md`
- `docs/HANDOFF.md`
- `docs/architecture/mvp-technical-plan.md`
- `docs/quality/prototype-and-release-gates.md`
- `docs/content/mandatory-lessons-l01-l05.md`
- `docs/content/domain-validation-registry.yaml`
