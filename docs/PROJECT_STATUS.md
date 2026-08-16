# Sailing Bootcamp — Project Status

> 갱신: 2026-08-16 KST
> 상태: **A polar-based boat model, sail-trim and reef correction factors, water-current composition and a tide-driven under-keel clearance are implemented. They are reachable through the mandatory lesson **L04** (current correction to a mark) and the non-mandatory demonstration lesson **L06**. Current and tide both derive from the real date/time a session starts and both advance with logical time on one shared phase, the stream being the tide's rate of change — a simplified synthetic sinusoid, not real tide data. L01, L02, L03 and L05 still run the legacy fixed-speed model.**

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

**L01, L02, L03 and L05 remain byte-identical and still run the legacy fixed-speed model.** Their golden fixtures were not regenerated.

## 2. Current verification

| Check | Result |
|---|---|
| TypeScript | PASS (`npm run typecheck`) |
| Full Vitest | **28 files / 293 tests** PASS (`npm test`) |
| Vite production build | PASS (`npm run build`) |
| Playwright smoke | **22 / 22 passed** (`npm run test:smoke`) |

## 3. Local-only boundaries

- L06's UI explicitly carries the same shared non-navigation boundary text as every other lesson (`Simulation-only prototype • Unvalidated content • Not navigation, safety, or certification guidance.`); it is not safety, certification, or real-world sailing guidance.
- L06 uses the same local, browser-only replay/session/reset mechanism as L01–L05. No backend, network, deployment, or access-policy behavior was added or changed.
- L01–L05, their manifests, and their golden fixtures are unchanged by this work.

## 4. Product and technical boundaries

What this work closes (for L06 only):
- PRD §8.1 wind row — `(apparent wind angle, true wind speed) → target speed` is genuinely computed.
- PRD §8.1 current row — SOG/COG and drift derive from vector composition, and the current itself is now derived from the real date and time the player starts an L06 session (`current_epoch_ms`, set once by `src/main.ts` from `Date.now()` and stored in the replay identity), fed through `deriveSyntheticCurrent`'s simplified semidiurnal sinusoid. SOG/COG/drift therefore genuinely diverge from STW/heading for a live session whenever the derived current is nonzero, which is observable end to end (`tests/unit/l06-polar-lesson.test.ts`). This is a declared synthetic assumption, not a real tidal prediction: the canonical fixture (`current_epoch_ms: 0`) still derives zero current, which keeps the pre-existing zero-current unit tests meaningful.
- PRD §8.2 polar bullet; PRD FR-04 — STW/SOG and heading/COG are separated and computed.

What this work does **not** close:
- Any of the above for **L01–L05** — they still declare these observations unavailable.
- PRD §8.1 wave and visibility — no model supplied. (Tide is now modelled; see above.)
- PRD §8.2 **wave and safety** correction coefficients — not modelled. Trim and reef coefficients now exist and trimming does change speed, but **L02 (trim) and L03 (reef) still gain nothing**, because both remain on the legacy model. The reef factor is currently unreachable in the shipped app: no lesson bound to the polar model permits the `reef` action.
- PRD §8.2 safety thresholds and hull/rig configuration. (Draft is now declared and drives under-keel clearance.)
- PRD §7.3 five-component scoring — `total_points` remains 0.
- **Domain validation** — `VR-POLAR-v0` is `disposition: assumption`. The 48 polar numbers, the trim and reef coefficients, and the tide, clearance, depth and draft constants are all invented educational assumptions asserting no real hull performance, tide, depth, or safety behaviour.

Two known limitations, tracked as debt rather than closed:
1. **State-contract inconsistency** — `heading`/`cog`/`true_wind`/`apparent_wind` use the `'declared-unavailable'` string sentinel when absent, while `stw`/`sog`/`drift_angle` are optional fields that are `undefined` on non-polar lessons; a consumer must handle three states, not two. Fully resolving it would require regenerating the L02–L05 fixtures.
2. **Defensive-branch coverage** — the HUD's handling of the `'declared-unavailable'` and `undefined` cases for STW/SOG/drift is not exercised by tests, because a live L06 session always produces numeric values; TypeScript `strict` mode, not a test, is what prevents a naive two-state rewrite.

The L06 binding and polar model are local synthetic calibration only. They do not promote registry dispositions or create domain factual validation.

## 5. Next controlled action

No implementation is currently active. The next code change must start from a new bounded, evidence-backed plan and explicit user authorization. Deployment/integration decisions for this worktree are out of scope for this status update.
