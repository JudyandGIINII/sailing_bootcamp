# DEVLOG

## 2026-07-19 — AP-0B L01 prototype integration

- Integrated AP-0B commit `12fba02`: L01-only gate evaluator, pure deterministic session/immutable ledger, raw and score/debrief golden fixtures, readonly PixiJS/DOM projection, keyboard/focus lifecycle handling, and IndexedDB local replay lifecycle.
- Scope guard corrected before integration: L02–L05 runtime manifests were removed; non-L01 lesson IDs fail closed.
- Independent evidence: strict `npm run typecheck`, `npm test` (**36 tests**), Playwright Chromium smoke (**3 tests**), `npm run build`, and `git diff --check` passed.
- AP-0C is now the next implementation gate. Release remains blocked by `assumption` validation records, missing concrete approvals/P1 artifacts, and absent release authority.

## 2026-07-19 — Claude P1/P2 remediation and AP-0A foundation

### Completed

- Applied the independent Claude Opus review P1 items across the registry, replay/determinism contract, release gate, lesson contract, PRD, technical plan, AGENTS, HANDOFF, and project status.
- Made `comparison_policy_version` a required validation-record binding; added `comparison-policy-v1-draft` as a prototype-only structural policy, defined `contract_version` as the lesson-contract/model-interface bundle, and made validated release eligibility require complete approved **non-TBD, non-draft** bindings.
- Clarified focus/visibility loss as immediate scheduler-cadence stop with no bridging logical tick; added a future `src/sim` static boundary guard for wall-clock/randomness and renderer/storage/network imports; split Task 2 into raw ledger/golden replay (2A) and score/debrief causality (2B).
- With AP-0A authority, created the isolated Orca worktree `sailing-ap0a-bootstrap-contract` and implemented only the TypeScript/Vite/Vitest/Playwright bootstrap and renderer-independent contracts. No Task 1+, simulation behavior, lesson UI, deployment, commit, or push occurred.
- Found and corrected a release-gate defect during Hermes independent review: an approved value containing `draft`/`TBD` now still fails release eligibility, with regression coverage.

### Verification

- AP-0A worktree: strict `npm run typecheck` passed; `npm test` passed (**15 tests**); Playwright Chromium smoke passed; `npm run build` passed; `git diff --check` passed.
- Chromium for Playwright was installed to the user cache after the first smoke run reported the browser executable absent. The final independent smoke passed.
- The AP-0A source, `package-lock.json`, and test files were committed and integrated after verification; release remains blocked.

### Next

Await a separate AP-0B authorization before Task 1, Task 2A/2B, or L01 work. `assumption` registry records and P1 approval artifacts still block release.

## 2026-07-19 — Handoff P0/P1 ambiguity remediation

### Completed

- Reordered implementation handoff into Task 0A(testable bootstrap) before Task 0B(contract/gate negative tests), eliminating the prior source/test-runner ordering ambiguity.
- Added bounded AP-0A/B/C authorization ceilings, mandatory per-task Hermes evidence review, and a stop-at-ceiling rule; no AP-0 implementation authorization was granted by this documentation work.
- Reconciled PRD, lesson specification, gate model, AGENTS, implementation plan, and HANDOFF to one full replay identity including coordinate, determinism, and comparison-policy versions.
- Specified fail-closed unsupported replay behavior: stable non-sensitive reason code, no approximate result, and local payload preservation.
- Added deterministic input lifecycle rules (focus-loss/visibility pause, explicit resume, key-repeat normalization), local replay lifecycle expectations, Chromium prototype baseline, and non-release WebKit/Firefox candidate wording.
- Added versioned P1 artifact-manifest minimum fields and restored explicit replay-compatibility to release blockers.

### Validation

- Documentation links, YAML parsing, required handoff-input existence, canonical replay-identity consistency, and Git diff/status are rechecked after this entry.
- No app source tree, package manifest, dependency installation, Git worktree, build, deployment, commit, or push occurred.

### Next

Await a user-selected AP-0A, AP-0B, or AP-0C authorization. Release remains blocked while all registry records are `assumption` and P1 approval artifacts are absent.

## 2026-07-19 — Documentation and implementation handoff baseline

### Completed

- PRD v0.3: browser-based Training Sloop MVP, L01–L05, deterministic/replay/safety contract, domain validation and P1 release gates.
- Multi-agent PRD hardening: Alfred, Claude Code, agent_robin 3-turn audit/reconciliation records retained under `.agent/plans/ALF-20260719-0010-prd-three-turn/`.
- L01–L05 lesson contracts and a five-record validation registry (`assumption` initial state).
- Coach/instructor review packet, submission template, qualification and controlled-apply runbooks.
- Official-source-backed technical option comparison and MVP implementation plan.
- Coordinate, determinism/replay, and prototype/release gate technical contracts.
- Project status, Kanban fallback, AGENTS handoff, and implementation handoff documents.
- Git `main` baseline initialized; `origin` set to `https://github.com/JudyandGIINII/sailing_bootcamp`; remote initial README history merged locally. This operation did not push.

### Decisions preserved

- MVP is `training-sloop-v1` only; no alternate playable profile.
- All water/environment data is synthetic, deterministic, and versioned; no live marine data in MVP.
- Renderer is non-authoritative. Recommended stack is Strict TypeScript + Vite + PixiJS projection + DOM HUD + Vitest + Playwright + IndexedDB.
- Prototype and release are distinct. Current `assumption` registry records block release but not a clearly labeled prototype.

### Validation

- PRD/lesson/registry/technical documentation links and required markers were checked.
- Validation registry and review/apply templates parse as YAML.
- Existing source documents were SHA-256 checked during governance-document creation.
- No app source tree, package manifest, dependency installation, Git worktree, build, or deployment has occurred.

### Next

Await AP-0 user approval to bootstrap the prototype through Orca/Codex Task 0. Do not treat this DEVLOG entry as implementation or release approval.
