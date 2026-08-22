# Sailing Bootcamp — Project Status

> 갱신: 2026-08-23 KST
> 상태: **A polar-based boat model, sail-trim and reef correction factors, water-current composition and a tide-driven under-keel clearance are implemented. They are reachable through mandatory lessons L02 (synthetic trim response), L04 (current correction to a mark), and L05 (tide/depth decision records), plus non-mandatory demonstration lesson L06. Current and tide derive from the session-start timestamp and advance with logical time on one shared phase; the stream is the tide's rate of change — a simplified synthetic sinusoid, not real tide data. Only L03 remains on the legacy model among L02–L06; L01 remains unmigrated by design.**

## 1. Current position

Before this work, Scenario 1 P2–P5 (deterministic mechanics, a scoring freeze, a memory-only P4 control deck, and a P5 debrief comparison) were completed and already integrated: `origin/main` at commit `2b99636` (`docs(scenario1): record P5 debrief verification`) carries that work, and this branch is built on top of it (confirmed via `git log`).

A polar-based boat model plus water-current vector composition is reachable through **L06**, a new lesson exposed in the browser UI. L06 is **not** a sixth mandatory lesson — the PRD (§7.2) fixes the mandatory set as L01–L05, and L06 exists to make the polar model reachable and testable.

- `src/contracts/polar-profile.ts` declares a synthetic 8×6 polar table (apparent wind angle × true wind speed → target speed through water): 48 invented educational values, `validation_record_id: 'VR-POLAR-v0'`, `validation_disposition: 'assumption'`.
- `src/sim/polar.ts` performs the bilinear lookup with symmetric angle folding and out-of-grid clamping.
- `src/contracts/polar-kinematics-environment.ts` declares the environment contract (`model_version: 'polar-kinematics-v5'`); it has no `forward_speed_mps` and instead adds `current_epoch_ms` — the real-world timestamp (epoch ms) a session was started, read exactly once by the UI layer.
- `src/sim/tidal-current.ts` is a new pure module: `deriveSyntheticCurrent(epochMs)` derives a synthetic current vector from that stored timestamp using a single sinusoid over a simplified 12.42-hour semidiurnal period. It is a declared educational assumption, not real tide data, harmonic constants, or a navigational current prediction; `src/sim` never reads the wall clock itself — only `src/main.ts` reads it once per session start and stores the result in the replay identity, which keeps replays exactly reproducible.
- `src/sim/polar-kinematics-model.ts` computes the per-tick transition: speed comes from the polar, the current vector is derived via `deriveSyntheticCurrent`, and it is composed into ground velocity via the pre-existing `composeGroundRelativeVelocity`. `src/sim/polar-observation.ts` projects STW / SOG / COG / drift from it.
- `src/contracts/replay.ts` carries and validates `polar_kinematics_environment` on the replay identity, selected by `model_version`. Every field is pinned to the canonical singleton by exact equality except `current_epoch_ms`, which legitimately varies per session (the real time the player started it) and is instead checked structurally (a non-negative safe integer). `src/sim/session.ts` applies the same structural check.
- `src/sim/session.ts` runs the polar path and emits `POLAR_KINEMATIC_TRANSITION` ledger events; `src/scoring/projection.ts` projects a `synthetic_transition` debrief fact for each one.
- `src/content/l06-polar.ts` is the L06 lesson manifest; `src/main.ts` makes L06 selectable in the UI with its observations rendered.
- `docs/content/domain-validation-registry.yaml` registers `VR-POLAR-v0` with `disposition: assumption`.

**Design decision recorded honestly:** migrating **L01** onto the polar model was considered and abandoned. Its replay bindings are derived live from its manifest and relied on at 78 call sites across 5 test files — flipping its `model_version` would have silently reinterpreted all of them and broken 37 tests. The polar model was therefore first added additively as L06.

**L04 was subsequently migrated in place**, because its coupling is nothing like L01's: `l04ReplayBindings` has 3 usages, and the one hardcoded legacy model-version literal in a test belongs to L02. L04 previously had no kinematic path at all (only declared string states); it now runs the polar model, derives mark arrival from real position against the declared course-template mark, and its two golden fixtures were regenerated. Its declaration-only `mark_state` string mechanic was removed, so its runtime-evidence contract moved from miss/correction slots to correction/arrival.

**L02 now runs `polar-kinematics-v5` while retaining its strict Replay V2 trim profile and terminal fields.** Its replay identity therefore carries the polar environment together with the L02 trim profile and terminal authority, and fails closed when a required field is missing or invalid. Main- and jib-trim actions now change declared speed through `MIN_TRIM_EFFICIENCY`; that constant is an invented educational factor, not a real sail-performance claim or trim recommendation. L02 is deliberately unscored in this cycle.

L05 also runs `polar-kinematics-v5`, carries and validates its polar Replay V2 environment, and retains record-only pass/wait/return decisions. **Only L03 remains on the legacy model among L02–L06; L01 remains unmigrated by the earlier design decision.**

## 2. Current verification

| Check | Result |
|---|---|
| TypeScript | PASS (`npm run typecheck`) |
| Full Vitest | **39 files / 393 tests** PASS (`npm test`) |
| Vite production build | PASS (`npm run build`) |
| Playwright smoke | **28 / 28 passed** (`npm run test:smoke`) |
| Simulation purity boundary | PASS (`tests/contracts/sim-boundary.test.ts`, 2 / 2) |
| Golden fixtures | Both `l02-raw-golden.json` and `l02-score-debrief-golden.json` were regenerated this cycle; all `l01-*`, `l03-*`, `l04-*`, and `l05-*` fixtures are byte-identical |

## 3. Local-only boundaries

- L02, L04, L05, and L06 carry the same shared non-navigation boundary text as every other lesson (`Simulation-only prototype • Unvalidated content • Not navigation, safety, or certification guidance.`); none is safety, certification, or real-world sailing guidance.
- L02, L04, L05, and L06 use the same local, browser-only replay/session/reset mechanism as L01 and L03. L02 Replay V2 now carries its polar environment alongside its trim profile and terminal fields and rejects a missing or tampered required field fail-closed. No backend, network, deployment, or access-policy behavior was added or changed.
- The wall clock is read in exactly one place (`src/main.ts`) and stored on the replay identity as `current_epoch_ms`. Nothing under `src/sim` or `src/contracts` reads the clock, randomness, DOM, storage, or network, so replaying a stored identity reproduces exactly.
- L01, L03, L04, and L05 fixtures are unchanged by this L02 migration.

## 4. Product and technical boundaries

What this work closes (for polar lessons L02, L04, L05, and L06):
- PRD §8.1 wind row — `(apparent wind angle, true wind speed) → target speed` is genuinely computed.
- PRD §8.1 current row — SOG/COG and drift derive from vector composition, and the current itself is derived from `current_epoch_ms`, read once by `src/main.ts` and stored on the polar replay identity. This is a declared synthetic assumption, not a real tidal prediction. L05 also projects computed synthetic seabed depth, depth datum, tide height, and under-keel clearance with explicit non-chart/non-sounding/non-datum/non-safety-margin boundaries.
- PRD §8.2 polar bullet; PRD FR-04 — STW/SOG and heading/COG are separated and computed.

What this work does **not** close:
- The polar observations for legacy **L01 and L03** — they still declare these observations unavailable.
- PRD §8.1 wave and visibility — no model supplied. (Tide is now modelled; see above.)
- PRD §8.2 **wave and safety** correction coefficients — not modelled. Trim and reef coefficients now exist; L02 trim changes its declared speed through the invented `MIN_TRIM_EFFICIENCY` factor, and reefing reduces L04 speed so the boat reaches the mark strictly later. These are synthetic, unvalidated educational effects, not real sail-performance or safety guidance. **L03 reef still gains nothing**, because L03 remains on the legacy model and terminates when reef is selected.

L03 was deliberately NOT migrated to make reef meaningful there: `advanceLogicalTick` and `applyCanonicalInput` both return the session unchanged once L03's episode is complete and reef is selected, so L03 terminates at reef selection and a speed factor would apply for zero further ticks. `reef` was added to L04's permitted actions instead, where a 200-plus-tick run to a mark makes the reduction observable.
- PRD §8.2 safety thresholds and hull/rig configuration. (Draft is now declared and drives under-keel clearance.)
- PRD §7.3 five-component scoring — L04 derives four scored components under `score-contract-v0-draft`, with a 100-point denominator. L05 derives judgment from recorded pass/wait/return decision checkpoints plus control stability and safety, with observation and goal declared unavailable and a 75-point denominator. L06 derives judgment from helm-correction checkpoints plus control stability and safety, with observation and goal unavailable and a 75-point denominator. L01, L02, and L03 remain unscored at 0; L02 is migrated but deliberately unscored this cycle. All scored paths are `declared_synthetic_unvalidated`: calculating them does not validate their constants or assess real sailing competence, qualification, or safety.
- **Domain validation** — `VR-POLAR-v0` is `disposition: assumption`. The 48 polar numbers, the trim and reef coefficients, and the tide, clearance, depth and draft constants are all invented educational assumptions asserting no real hull performance, tide, depth, or safety behaviour.
- Renderer scope — waves, wind, current arrows, depth terrain, coastline, hazard zones, and camera zoom or pan are not drawn. The canvas remains `aria-hidden`; a synthetic/unvalidated text alternative carries its track, virtual-mark, and clearance information. The boat glyph is a symbol, not a scale drawing.

Known limitations, tracked as debt rather than closed:
1. **State-contract inconsistency** — `heading`/`cog`/`true_wind`/`apparent_wind` use the `'declared-unavailable'` string sentinel when absent, while `stw`/`sog`/`drift_angle` are optional fields that are `undefined` on non-polar lessons; a consumer must handle three states, not two. Fully resolving it would require regenerating the L02–L05 fixtures.
2. **Defensive-branch coverage** — the HUD's handling of the `'declared-unavailable'` and `undefined` cases for STW/SOG/drift is not exercised by tests, because a live polar session always produces numeric values; TypeScript `strict` mode, not a test, is what prevents a naive two-state rewrite.
3. **`Math.sin`/`Math.cos` are not IEEE-specified across JS engines.** The 6-decimal canonicalization mitigates but does not eliminate cross-engine divergence at rounding boundaries. Pre-existing via `Math.hypot`/`atan2`; the tide and stream now sit on that path too.
4. **`src/contracts` is not purity-scanned.** `tests/contracts/sim-boundary.test.ts` recurses `src/sim` only. `src/contracts` is clean by inspection today but unguarded going forward.
5. **`replayInputs` applies no inputs at `terminalTicks: 0` for L04/L05/L06.** Unlike L01/L02/L03 those lessons carry no V2 terminal-authority fields, so a saved attempt at tick 0 needs at least one advance to restore faithfully. Pre-existing for L06; inherited by L04 and L05 on migration.

## 4a. Review findings closed in this cycle

An independent two-track review (determinism/replay contract, and model correctness/boundary posture) of the polar work found eight issues. All eight are closed:

| # | Finding | Resolution |
|---|---|---|
| 1 | L04 Replay V2 payloads rejected as schema-invalid — the migrated lesson's replays were unloadable | `isReplayV2Shape`, `identityFieldsFor` and `resolveReplayV2` now recognise L04; save→resolve→replay regression test added, verified against the pre-fix code |
| 2 | Advance-time event ids collided with ids minted on later ticks | Mark-arrival and clearance events use namespaced ids like the transition event; ledger-wide uniqueness test added, verified to fail against the old scheme |
| 3 | `VR-POLAR-v0` named an older model version and declared none of the ten new constants | Record rebound to the shipped version with every constant declared; a test now pins the registry to the code |
| 4 | L04's computed observations never reached the HUD (gated on L01/L06) | L04 shares the polar HUD branch; the smoke assertion that had been deleted rather than inverted is restored as a positive check |
| 5 | `PROJECT_STATUS` asserted three claims the merged code contradicted | Corrected here and in the completion matrix |
| 6 | Reef factor unreachable — no polar lesson permitted `reef` | `reef` added to L04. L03 migration was investigated and rejected: L03 terminates at reef selection, so a speed factor would apply for zero further ticks |
| 7 | A session starting below a clearance threshold was never warned | `highest_clearance_alert` seeded `'clear'`, so the first tick records |
| 8 | Tide advanced with logical time while the stream stayed frozen at session start | Both now advance on one shared phase, with the stream as the tide's rate of change (slack at high/low water) |


The L06 binding and polar model are local synthetic calibration only. They do not promote registry dispositions or create domain factual validation.

## 5. Next controlled action

No implementation is currently active. The next code change must start from a new bounded, evidence-backed plan and explicit user authorization. Deployment/integration decisions for this worktree are out of scope for this status update.
