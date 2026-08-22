# L06 Scoring and L02 Polar Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Score L06 (one table row), and migrate L02 onto the polar model so that trimming the sails actually changes boat speed instead of doing nothing.

**Architecture:** L06 needs no migration — it is already polar, so scoring it is a single `LESSON_SCORE_PROFILES` entry. L02 is the real work: it is the first migration of a lesson that has a **strict Replay V2 variant**, so it needs a new combined key set (`polarL02V2Keys`) carrying the polar environment *and* its trim profile *and* its terminal fields, following the `polarL01V2Keys` precedent.

**Tech Stack:** TypeScript 5.9 (strict), Vitest 4.1, Playwright. No new dependencies.

**Design spec:** `docs/superpowers/specs/2026-08-22-l06-scoring-and-l02-migration-design.md` — read it first.

## Global Constraints

- **Exactly two fixtures may change:** `tests/fixtures/l02-raw-golden.json` and `tests/fixtures/l02-score-debrief-golden.json`. Run `git diff --name-only tests/fixtures/` at the end of every task. If any `l01-`, `l03-`, `l04-` or `l05-` fixture appears, **stop and report**. L06 scoring has no fixture, so Task 1 must move no fixture at all.
- **Run the FULL suites at every task gate** — `npm test` in full, and `npm run test:smoke` for any task touching `src/main.ts`. Stop if red, even when the failure looks like it belongs to a later task. In the previous cycle three defects were invisible to a green partial run, including one where a lesson could not start in a browser while 380 unit tests passed.
- **Do not migrate any other lesson.** L03 (strict variant, out of scope), L01 (89 binding sites, abandoned by decision).
- **Known follow-up, deliberately out of scope:** because L02 keeps a valid legacy key set, a *stored* pre-migration L02 replay still passes the shape gate and would then throw `CanonicalInputContractError: Polar kinematics profile is missing.` inside `createSession` rather than being rejected with a stable reason code. L04/L05/L06 do not have this path because their polar key set is unconditional. Do not fix it in this cycle; do not make it worse. It is recorded for a follow-up cycle.
- **Do not score L02.** Its judgment-evidence question is deliberately deferred; adding an L02 row to `LESSON_SCORE_PROFILES` is out of scope.
- **Do not declare what is not computed.** Only the five L02 observations listed in Task 4 change status.
- **Purity.** `src/scoring/*` must not use `Date.now`, `performance.now`, `Math.random`, `window`, `document`, `localStorage`, `sessionStorage`, `fetch`, `XMLHttpRequest`, `WebSocket`, or `EventSource`.
- **Boundary language.** L02's trim affecting speed stays synthetic and unvalidated — never real sail-trim performance or safety guidance. `MIN_TRIM_EFFICIENCY` and `REEF_SPEED_FACTOR` are invented educational constants.
- **Relative imports use the `.js` extension.**
- **Baseline:** `npm run typecheck` clean, `npm test` = 38 files / 381 tests, `npm run build` clean, `npm run test:smoke` = 27/27.

---

### Task 1: Score L06

Smallest possible change — the machinery became table-driven in the previous cycle.

**Files:**
- Modify: `src/scoring/score-contract.ts` (one profile row)
- Modify: `tests/unit/score-contract.test.ts`, `tests/unit/score-total.test.ts`

- [ ] **Step 1: Write the failing tests**

Add to `tests/unit/score-total.test.ts`:

```ts
describe('L06 total points', () => {
  it('scores helm activity out of a 75 point denominator', () => {
    const session = createSession({ ...l06ReplayBindings, seed: 'l06-score', ordered_input_log: [] } as never);
    const score = projectScore(session.raw, session.ledger);
    expect(score.status).toBe('declared_synthetic_unvalidated');
    expect(score.points_possible).toBe(75);
    expect(Number.isInteger(score.total_points)).toBe(true);
  });

  it('declares observation and goal unavailable for L06, which has no mark', () => {
    const session = createSession({ ...l06ReplayBindings, seed: 'l06-unavail', ordered_input_log: [] } as never);
    const components = projectScore(session.raw, session.ledger).components!;
    expect(components.find((component) => component.key === 'goal')!.status).toBe('declared-unavailable');
    expect(components.find((component) => component.key === 'observation')!.status).toBe('declared-unavailable');
  });
});
```

Add `l06ReplayBindings` to that file's imports from `../../src/content/l06-polar.js`.

Add to `tests/unit/score-contract.test.ts`, inside the existing profile assertion test:

```ts
    expect(LESSON_SCORE_PROFILES.L06).toEqual({ unavailable: ['observation', 'goal'], judgment_evidence: 'helm_correction' });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/unit/score-total.test.ts tests/unit/score-contract.test.ts`
Expected: FAIL — `LESSON_SCORE_PROFILES.L06` is undefined, so `computeComponents` returns undefined for L06

- [ ] **Step 3: Add the L06 profile row**

In `src/scoring/score-contract.ts`, add after the `L05` entry:

```ts
  L06: Object.freeze({
    // L06 declares no mark, so there is no goal event to detect. Unlike L05 it
    // records no pass/wait/return decision either, so judgment falls back to the
    // same helm-correction approximation L04 uses.
    unavailable: Object.freeze(['observation', 'goal'] as const),
    judgment_evidence: 'helm_correction' as const,
  }),
```

That row is the entire change.

- [ ] **Step 4: Run the full gate**

```bash
npm run typecheck
npm test
git diff --name-only tests/fixtures/   # must print NOTHING
```

**L06 scoring has no golden fixture, so this task must move no fixture at all.** If any fixture appears, stop and report.

- [ ] **Step 5: Commit**

```bash
git add src/scoring/score-contract.ts tests/unit/score-contract.test.ts tests/unit/score-total.test.ts
git commit -m "feat(scoring): score L06 from its recorded helm activity"
```

---

### Task 2: Teach the identity contract about a polar L02 (additive)

L02 is the first migrated lesson that already has a strict Replay V2 variant, so the identity
contract needs a new combined key set before anything else works.

**This task is purely additive and changes no behaviour.** The manifest is NOT flipped here —
`l02ReplayBindings` still declares the legacy model, so no existing payload changes shape and
no fixture moves. The contract simply learns to accept a polar L02 *should one exist*. Task 3
flips the manifest and regenerates the fixture together. Keeping the two apart is what lets
both tasks end green.

**Files:**
- Modify: `src/contracts/replay.ts` (new key set + three lesson branches)
- Test: `tests/contracts/replay.test.ts`

**Interfaces:**
- Produces: `polarL02V2Keys`

- [ ] **Step 1: Write the failing test**

Add to `tests/contracts/replay.test.ts`:

```ts
describe('L02 polar replay identity', () => {
  it('accepts an L02 payload carrying the polar environment alongside its strict fields', () => {
    expect(isReplayV2Shape(l02PolarReplayFixture())).toBe(true);
  });

  it('rejects an L02 payload whose polar environment is missing', () => {
    const { polar_kinematics_environment: _dropped, ...withoutEnvironment } = l02PolarReplayFixture();
    expect(isReplayV2Shape(withoutEnvironment)).toBe(false);
  });

  it('still requires the L02 trim profile and terminal fields', () => {
    const { l02_synthetic_trim_profile: _dropped, ...withoutProfile } = l02PolarReplayFixture();
    expect(isReplayV2Shape(withoutProfile)).toBe(false);
  });
});
```

**Build `l02PolarReplayFixture()` by copying the existing L02 Replay V2 fixture helper in that
file, setting its `lesson_binding.model_version` to `POLAR_KINEMATICS_MODEL_VERSION`, and
adding `polar_kinematics_environment: polarKinematicsEnvironmentV1`.** The manifest is still
legacy at this point, so the fixture must declare the polar model itself rather than reading it
from `l02ReplayBindings`. Do not invent
the shape — `lesson_binding` must satisfy `exactKeys(..., lessonBindingKeys)` with every value
a non-empty string, and the payload needs `l02_synthetic_trim_profile`,
`l02_terminal_logical_tick` and `l02_terminal_paused`. Find the existing helper first; if there
is no reusable one, mirror the `polar kinematics replay identity carrier` block's construction
style. If you cannot make the *positive* case pass for a reason other than the missing L02
polar branch, stop and report.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/contracts/replay.test.ts`
Expected: FAIL — bindings still declare the legacy model version

- [ ] **Step 3: Add the combined key set**

In `src/contracts/replay.ts`, beside the existing `l02V2Keys` declaration (~line 341), add:

```ts
/**
 * L02 migrated onto the polar model while keeping its strict trim-profile and
 * terminal authority, so its identity carries both. This mirrors
 * `polarL01V2Keys`, which does the same for L01.
 */
const polarL02V2Keys = [...v2Keys, POLAR_REPLAY_IDENTITY_FIELD, L02_REPLAY_V2_PROFILE_FIELD, L02_REPLAY_V2_TERMINAL_TICK_FIELD, L02_REPLAY_V2_TERMINAL_PAUSED_FIELD] as const;
```

- [ ] **Step 4: Route L02 through it**

Three edits, all in `src/contracts/replay.ts`.

**(a)** Add a polar flag beside the existing `isPolarL01` (~line 369):

```ts
  const isPolarL02 = isL02 && (candidate.lesson_binding as { model_version?: unknown } | undefined)?.model_version === POLAR_KINEMATICS_MODEL_VERSION;
```

**(b)** Use it in the key selection on the next line, replacing `isL02 ? l02V2Keys` with:

```ts
isL02 ? (isPolarL02 ? polarL02V2Keys : l02V2Keys)
```

Keep the legacy `l02V2Keys` branch — a stored pre-migration L02 replay must still validate.

**(c)** In `resolveReplayV2` (~line 578), add L02 to the lesson list guarding
`hasCanonicalL01Environment` — but **conditionally on L02 declaring the polar model.**

`hasCanonicalL01Environment` falls through to `sameL01Environment(l01_synthetic_environment)`
for any non-polar model. Legacy L01 survives that because it genuinely carries
`l01_synthetic_environment`; **a legacy L02 carries neither environment** (it has
`l02_synthetic_trim_profile` instead), so an unconditional branch rejects every pre-migration
L02 replay. Declare the flag first:

```ts
  const isPolarL02Replay = replay.lesson_binding.lesson_id === 'L02' &&
    replay.lesson_binding.model_version === POLAR_KINEMATICS_MODEL_VERSION;
```

then use it in the guard:

```ts
  if ((replay.lesson_binding.lesson_id === 'L01' || isPolarL02Replay || replay.lesson_binding.lesson_id === 'L04' || replay.lesson_binding.lesson_id === 'L05' || replay.lesson_binding.lesson_id === 'L06') && !hasCanonicalL01Environment({
```

This is permanently correct, not a Task-2 workaround: the guard's job is to validate a declared
environment, and L02 only declares one once migrated.

**Leave `hasStrictL02ReplayV2TerminalAuthority` and every other L02 branch alone.** L02 keeps
its strict terminal authority; this migration adds the environment, it does not remove the
existing contract.

- [ ] **Step 5: Run the full gate**

```bash
npm run typecheck
npm test
git diff --name-only tests/fixtures/   # must print NOTHING
```

**This task must be fully green and must move no fixture.** It only teaches the contract to
accept a shape that nothing produces yet. If any test fails or any fixture moves, the change
was not additive — stop and report.

- [ ] **Step 6: Commit**

```bash
git add src/contracts/replay.ts tests/contracts/replay.test.ts
git commit -m "feat(contracts): accept a polar L02 identity beside its strict fields"
```

---

### Task 3: Run L02 on the polar model

**Files:**
- Modify: `src/content/l02-l05.ts` (`l02Manifest` model version, `l02ReplayBindings`)
- Modify: `src/sim/session.ts` (three lesson branches)
- Modify: `src/main.ts` (start path)
- Modify: `tests/fixtures/l02-raw-golden.json` (regenerate)
- Test: `tests/unit/l02-polar-migration.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/l02-polar-migration.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { advanceLogicalTick, applyCanonicalInput, createSession, type DeterministicSession } from '../../src/sim/session.js';
import { l02ReplayBindings } from '../../src/content/l02-l05.js';

function l02Session(seed: string): DeterministicSession {
  return createSession({ ...l02ReplayBindings, seed, ordered_input_log: [] } as never);
}

// Sequence must strictly increase within one logical tick (see the collision
// guard in src/sim/session.ts), so the caller passes it explicitly.
function trim(session: DeterministicSession, action: 'main_trim' | 'jib_trim', sequence: number): DeterministicSession {
  return applyCanonicalInput(session, { logical_tick: session.raw.logical_tick, sequence, input: { action } });
}

describe('L02 polar migration', () => {
  it('starts with a polar kinematic state rather than the legacy shape', () => {
    const raw = l02Session('l02-polar-start').raw;
    expect(raw.polar_kinematic_state).toBeDefined();
    expect(raw.l01_synthetic_state).toBeUndefined();
  });

  it('keeps the synthetic trim acknowledgment record', () => {
    expect(l02Session('l02-ack-kept').raw.l02_trim_acknowledgment).toBeDefined();
  });

  it('makes trimming change the declared speed through water', () => {
    let session = advanceLogicalTick(l02Session('l02-trim-effect'));
    const before = session.raw.stw;
    session = advanceLogicalTick(trim(session, 'main_trim', 1));
    expect(typeof before).toBe('number');
    expect(session.raw.stw).not.toBe(before);
  });

  it('still records the trim causality checkpoint after both sheets move', () => {
    let session = trim(l02Session('l02-causality'), 'main_trim', 1);
    session = trim(session, 'jib_trim', 2);
    expect(session.ledger.some((event) => event.cause === 'main/jib synthetic trim causality recorded')).toBe(true);
  });

  it('declares no virtual mark', () => {
    expect(l02Session('l02-nomark').raw.mark_state).toBeUndefined();
  });

  it('reproduces exactly for two identical sessions advanced the same number of ticks', () => {
    let a = l02Session('l02-determinism');
    let b = l02Session('l02-determinism');
    for (let tick = 0; tick < 4; tick += 1) { a = advanceLogicalTick(a); b = advanceLogicalTick(b); }
    expect({ raw: a.raw, ledger: a.ledger }).toEqual({ raw: b.raw, ledger: b.ledger });
  });
});
```

**If `applyCanonicalInput`'s argument shape differs from the sketch above, copy it from
`tests/unit/l04-current-correction.test.ts`** rather than guessing.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/l02-polar-migration.test.ts`
Expected: FAIL — `polar_kinematic_state` is undefined

- [ ] **Step 3: Flip the manifest onto the polar model**

In `src/content/l02-l05.ts`, add to `l02Manifest` immediately after its `validation_record_id`:

```ts
  model_version: POLAR_KINEMATICS_MODEL_VERSION,
```

and change the bindings export:

```ts
export const l02ReplayBindings = Object.freeze({ ...bindings(l02Manifest), polar_kinematics_environment: polarKinematicsEnvironmentV1 });
```

Task 2 already taught `isReplayV2Shape` and `resolveReplayV2` to accept this shape, so the
identity contract is ready for it.

- [ ] **Step 3b: Open the polar path to L02**

Three edits in `src/sim/session.ts`.

**(a)** `polarProfile()` (~line 318) — add `l02-`:

```ts
  if (!lesson.startsWith('l01-') && !lesson.startsWith('l02-') && !lesson.startsWith('l04-') && !lesson.startsWith('l05-') && !lesson.startsWith('l06-')) return undefined;
```

**(b)** `polarLessonTag()` (~line 403) — add L02 and widen the return type:

```ts
function polarLessonTag(identity: ReplayIdentity | ReplayV2): 'L01' | 'L02' | 'L04' | 'L05' | 'L06' {
  const lesson = sessionLesson(identity);
  if (lesson.startsWith('l06-')) return 'L06';
  if (lesson.startsWith('l05-')) return 'L05';
  if (lesson.startsWith('l04-')) return 'L04';
  if (lesson.startsWith('l02-')) return 'L02';
  return 'L01';
}
```

Widen `l01CausalControlsForTick`'s `lessonId` parameter type to match, or `tsc` will reject the call.

**(c)** The L02 branch of `createSession` (~line 220) currently returns the legacy shape. Give
it polar initialization while **keeping `l02_trim_acknowledgment`**. It has no `mark_state` and
no `declared_navigation_concepts`:

```ts
  if (scenario.startsWith('l02-')) {
    if (!polarProfile) throw new CanonicalInputContractError('Polar kinematics profile is missing.');
    const initialState = createInitialPolarKinematicState(polarProfile);
    const initialTransition = transitionPolarKinematicState(polarProfile, initialState, []);
    const observations = projectPolarObservations(polarProfile, initialTransition);
    return freeze({
      ...base,
      lesson_id: 'L02',
      l02_trim_acknowledgment: createInitialL02SyntheticTrimObservation(),
      helm_command: initialState.helm_command,
      heading: observations.heading_rad,
      cog: observations.cog_rad,
      true_wind: freeze({ from_rad: observations.true_wind_from_rad, speed_mps: observations.true_wind_speed_mps }),
      apparent_wind: freeze({ from_rad: observations.apparent_wind_from_rad, speed_mps: observations.apparent_wind_speed_mps }),
      stw: observations.stw_mps,
      sog: observations.sog_mps,
      drift_angle: observations.drift_angle_rad,
      polar_kinematic_state: initialState,
      polar_last_helm_sequence: 0,
      clearance_m: clearanceAt(polarProfile, 0),
      clearance_level: clearanceLevel(clearanceAt(polarProfile, 0)),
      highest_clearance_alert: 'clear',
    });
  }
```

**Do not touch `applyCanonicalInput`.** Its trim branch (~line 712) is gated on
`isPolarRaw(raw)`, not on lesson id, so trim starts feeding `sail_trim` automatically; and the
L02 acknowledgment reducer (~line 721) is separately gated on `raw.lesson_id === 'L02'`, so it
keeps working. Both coexist with no edit. If you find yourself changing that function, stop and
report — it means an assumption in this plan is wrong.

- [ ] **Step 4: Attach the environment on the app's start path**

`src/main.ts:670` builds the started replay. L02 needs its existing fields **and** the polar
environment. Change the L02 clause and the polar clause so both apply:

```ts
...(currentLesson.id === 'L02' ? { l02_synthetic_trim_profile: l02SyntheticTrimProfileV1, l02_terminal_logical_tick: 0, l02_terminal_paused: false } : {}), ...(currentLesson.id === 'L02' || currentLesson.id === 'L04' || currentLesson.id === 'L05' || currentLesson.id === 'L06' ? { polar_kinematics_environment: polarEnvironmentAtStart } : {})
```

**This step exists because omitting it in the previous cycle made the lesson fail to start in a
browser while every unit test passed.** Verify with the smoke suite, not only with `npm test`.

Leave `src/main.ts:154-155` alone — L02 keeps its terminal tick and pause authority.

- [ ] **Step 5: Regenerate the raw golden fixture**

Run `npm test`; `tests/unit/l02-l05.test.ts` and `tests/unit/projection.test.ts` will fail on
the L02 golden comparison.

`tests/fixtures/l02-raw-golden.json` needs: `identity.model_version` → `"polar-kinematics-v5"`,
`identity.polar_kinematics_environment` added (**copy all 15 fields verbatim from
`tests/fixtures/l04-raw-golden.json`**, including `current_epoch_ms: 0`), and
`expected.raw` / `expected.ledger` regenerated.

**Before pasting, verify:** `expected.raw.polar_kinematic_state` exists,
`expected.raw.l02_trim_acknowledgment` is still present, `l01_synthetic_state` is gone,
`mark_state` is **absent**, and the identity still carries `l02_synthetic_trim_profile`,
`l02_terminal_logical_tick` and `l02_terminal_paused`. **If `mark_state` appears or the trim
profile disappeared, stop and report.**

- [ ] **Step 6: Run the full gate**

```bash
npm run typecheck
npm test
npm run build
npm run test:smoke
git diff --name-only tests/fixtures/   # must print ONLY l02-raw-golden.json
```

The L02 score fixture is Task 5's; if `l02-score-debrief-golden.json` fails here, note it and
continue only if that is the sole remaining failure.

- [ ] **Step 7: Commit**

```bash
git add src/content/l02-l05.ts src/sim/session.ts src/main.ts tests/fixtures/l02-raw-golden.json tests/unit/l02-polar-migration.test.ts
git commit -m "feat(sim): run L02 on the polar model so trim changes boat speed"
```

---

### Task 4: Tell the truth about what L02 now teaches

The lesson's declared semantics and its observations both become false after Task 3. Fixing
them is not optional polish — it is the repository's central constraint.

**Files:**
- Modify: `src/content/l02-l05.ts` (`l02Manifest` semantics + five observation statuses)
- Modify: `src/main.ts` (observation rendering)
- Test: `tests/smoke/app.spec.ts`

- [ ] **Step 1: Correct the declared semantics**

`l02Manifest.pass_semantics` currently reads:

> `'Synthetic control-input acknowledgment only; no performance or safety metric is asserted.'`

That is now false — `MIN_TRIM_EFFICIENCY = 0.55` means a badly trimmed sail costs 45% of
declared speed. Replace it with wording that says trim now affects the declared synthetic
speed while denying any real performance or safety claim, for example:

```ts
  pass_semantics: 'Synthetic control-input acknowledgment plus a declared synthetic speed response: trim adjusts the declared speed through water by an invented educational factor. No real sail performance, boat handling, or safety metric is asserted.',
```

Also check `hint_and_debrief` on the same manifest and correct it if it claims no speed
response.

- [ ] **Step 2: Flip the four observations that are now computed**

In `l02Manifest.required_observations`, change these from `'declared_unavailable'` to
`'declared_synthetic'`:

- `apparent_wind_angle`
- `main_sheet`
- `jib_sheet`
- `declared_speed_response`

`declared_trim_feedback` is already `declared_synthetic` and stays as it is.

- [ ] **Step 3: Render all five**

Add L02 to the polar observation branch in `src/main.ts` (~line 301):

```ts
    } else if ((currentLesson.id === 'L02' || currentLesson.id === 'L04' || currentLesson.id === 'L05' || currentLesson.id === 'L06') && observation.status === 'declared_synthetic') {
```

**Adding L02 to that branch captures every L02 observation whose status is
`declared_synthetic` — all five, including `declared_trim_feedback`, which today is handled by
a separate `currentLesson.id === 'L02'` branch further down that will now be unreachable.**
This is exactly the regression that bit the previous cycle: any key without its own condition
falls to the branch's final `else` and renders "Synthetic computed observation unavailable."

Handle the four new keys inside that branch, and **move the existing `declared_trim_feedback`
rendering into it** so it is not orphaned:

```ts
      } else if (observation.key === 'apparent_wind_angle' && session.raw.apparent_wind !== 'declared-unavailable') {
        description.textContent = `Synthetic computed apparent wind angle from ${numeric(session.raw.apparent_wind.from_rad)} rad — an invented educational value, not a real wind reading.`;
      } else if (observation.key === 'main_sheet' || observation.key === 'jib_sheet') {
        const trimState = session.raw.polar_kinematic_state?.sail_trim;
        const value = observation.key === 'main_sheet' ? trimState?.main_trim : trimState?.jib_trim;
        description.textContent = value === undefined
          ? 'Synthetic declared sheet position unavailable.'
          : `Synthetic declared ${observation.key === 'main_sheet' ? 'main' : 'jib'} sheet position ${numeric(value)} (0 to 1), reefed: ${trimState?.reefed ?? 'unknown'} — an invented educational control value, not a real sheet setting or sail trim recommendation.`;
      } else if (observation.key === 'declared_speed_response') {
        description.textContent = polarText('speed through water', 'mps', session.raw.stw) + ' Trim adjusts this by an invented educational factor; it is not a real speed or performance claim.';
      } else if (observation.key === 'declared_trim_feedback') {
        const acknowledgment = projectL02SyntheticTrimAcknowledgment(session.raw);
        description.textContent = acknowledgment
          ? `main_trim_adjusted: ${acknowledgment.main_trim_adjusted}; jib_trim_adjusted: ${acknowledgment.jib_trim_adjusted}; last_accepted_trim: ${acknowledgment.last_accepted_trim ?? 'null'}; last_accepted_tick: ${acknowledgment.last_accepted_tick ?? 'null'}; causal_state: ${acknowledgment.causal_state}. Synthetic control-input acknowledgment — unvalidated.`
          : 'Synthetic control-input acknowledgment unavailable.';
```

Then **delete the now-unreachable `currentLesson.id === 'L02' && observation.key === 'declared_trim_feedback'` branch** further down, so there is one definition rather than two.

**Before moving on, check your work against `l02Manifest.required_observations` directly:**
every observation whose status is `declared_synthetic` must hit a condition that names it and
denies a real-world reading.

- [ ] **Step 4: Add smoke coverage**

Add to `tests/smoke/app.spec.ts`:

```ts
test('shows L02 computed sheet positions and speed response with synthetic boundaries', async ({ page }) => {
  await page.goto('/');
  await startSession(page, 'L02');
  await expect(page.getByText(/Synthetic declared main sheet position/)).toBeVisible();
  await expect(page.getByText(/not a real sheet setting or sail trim recommendation/)).toBeVisible();
  await expect(page.getByText(/Synthetic control-input acknowledgment/)).toBeVisible();
  // The regression this guards: no L02 observation may render as generically unavailable.
  await expect(page.getByText('Synthetic computed observation unavailable.')).toHaveCount(0);
});
```

- [ ] **Step 5: Run the full gate**

```bash
npm run typecheck
npm test
npm run build
npm run test:smoke
git diff --name-only tests/fixtures/   # only l02- files
```

- [ ] **Step 6: Commit**

```bash
git add src/content/l02-l05.ts src/main.ts tests/smoke/app.spec.ts
git commit -m "feat(content): declare L02's real speed response and render its computed trim"
```

---

### Task 5: Regenerate the L02 score fixture and record the work

**Files:**
- Modify: `tests/fixtures/l02-score-debrief-golden.json`
- Modify: `docs/PROJECT_STATUS.md`, `docs/architecture/training-ground-completion-matrix.md`

- [ ] **Step 1: Regenerate the score/debrief fixture**

L02 is **not** being scored this cycle, so its `score` block must still read
`total_points: 0` with no `points_possible` and no `components`. What changes is
`debrief_fact_kinds`: L02 now emits `POLAR_KINEMATIC_TRANSITION`, so the array gains
`"synthetic_transition"` entries.

**If `total_points` is anything other than 0, stop and report** — that would mean L02 reached
`LESSON_SCORE_PROFILES`, which this cycle explicitly excludes.

- [ ] **Step 2: Capture the real numbers**

```bash
npm run typecheck && npm test && npm run build && npm run test:smoke
```
Use the observed counts, not the ones this plan predicts.

- [ ] **Step 3: Update `docs/PROJECT_STATUS.md`**

- Refresh the verification table with observed counts.
- Update the model line: **only L03 remains on the legacy model** among L02–L06; L01 stays unmigrated by decision.
- Update the scoring line: L04 (4 components / 100), L05 (3 / 75), **L06 (3 / 75)** now scored; L01, L02, L03 remain 0. Say explicitly that L02 is migrated but deliberately unscored this cycle.
- Update the golden-fixtures line: both `l02-` fixtures regenerated; `l01-`, `l03-`, `l04-`, `l05-` byte-identical.
- Record that L02's trim now changes declared speed through `MIN_TRIM_EFFICIENCY`, and that this is an invented educational constant, not a real performance claim.

- [ ] **Step 4: Update the completion matrix**

Update the **L02 and L06 rows**, and **also fix any prose elsewhere in the document that this
cycle falsifies** — in particular the "Which lessons run which model" paragraph, which will
still list L02 as legacy. Do not touch the L01, L03, L04 or L05 rows. A matrix that
contradicts itself is the failure this project has already hit three times.

- [ ] **Step 5: Verify and commit**

```bash
npm test
git diff --name-only tests/fixtures/   # only the two l02- files
git add tests/fixtures/l02-score-debrief-golden.json docs/PROJECT_STATUS.md docs/architecture/training-ground-completion-matrix.md
git commit -m "docs: record L06 scoring and the L02 polar migration"
```

---

## Completion criteria

- [ ] `npm run typecheck`, `npm test`, `npm run build`, `npm run test:smoke` all pass
- [ ] `git diff --name-only tests/fixtures/` prints only the two `l02-` files across the branch
- [ ] L06 reports a non-zero integer `total_points` out of 75
- [ ] An L02 session has a computed `polar_kinematic_state` and **trimming changes `stw`**
- [ ] L02's trim acknowledgment checkpoint still fires after both sheets move
- [ ] L02 replay round-trips: a payload with the polar environment validates, one without it is rejected, and the trim profile is still required
- [ ] L02 starts in a browser (smoke, not just unit tests)
- [ ] `l02Manifest.pass_semantics` no longer claims no performance metric is asserted
- [ ] All five `declared_synthetic` L02 observations render with their own denial; none reads "Synthetic computed observation unavailable."
- [ ] L02's `total_points` is still 0 — it is migrated, not scored
