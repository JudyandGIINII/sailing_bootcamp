# L05 Polar Migration and Scoring Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move L05 off the legacy fixed-speed model onto the polar model so its depth and under-keel clearance become genuinely computed, and extend the existing scoring contract to L05 so it stops reporting 0.

**Architecture:** Five edits migrate the lesson (manifest, bindings, and three lesson branches in `session.ts`); the replay-identity layer follows automatically because it keys off `model_version`, not a lesson list. Scoring then generalizes from a hardcoded `computeL04Components` to a lesson-profile table, because L05 draws its judgment evidence from decision records rather than helm corrections.

**Tech Stack:** TypeScript 5.9 (strict), Vitest 4.1, Playwright. No new dependencies.

**Design spec:** `docs/superpowers/specs/2026-08-21-l05-polar-migration-design.md` — read it first.

## Global Constraints

- **Exactly two fixtures may change:** `tests/fixtures/l05-raw-golden.json` and `tests/fixtures/l05-score-debrief-golden.json`. At the end of every task, `git diff --name-only tests/fixtures/` must print only those. If any `l01-`, `l02-`, `l03-` or `l04-` fixture appears, the migration has leaked — **stop and report**.
- **Do not migrate any other lesson.** L01 (89 binding sites) stays on the legacy model; L02 and L03 are out of scope entirely.
- **Do not make decisions consequential.** `decision_pass` / `decision_wait` / `decision_return` keep recording state and must not affect the simulation this cycle.
- **Do not declare what is not computed.** L05's `visibility` and `route_state` observations stay `declared_unavailable`; no model supplies them.
- **Purity.** `src/scoring/*` must not use `Date.now`, `performance.now`, `Math.random`, `window`, `document`, `localStorage`, `sessionStorage`, `fetch`, `XMLHttpRequest`, `WebSocket`, or `EventSource`.
- **Boundary language.** L05's computed depth and clearance remain synthetic and unvalidated — never a charted depth, sounding, datum, or under-keel safety margin. `VR-L05-v0` and `VR-POLAR-v0` are both `disposition: assumption`.
- **Relative imports use the `.js` extension.**
- **Baseline:** `npm run typecheck` clean, `npm test` = 37 files / 364 tests, `npm run build` clean, `npm run test:smoke` = 26/26.

---

### Task 1: Migrate L05 onto the polar model

**Files:**
- Modify: `src/content/l02-l05.ts` (`l05Manifest`, `l05ReplayBindings`)
- Modify: `src/sim/session.ts` (three lesson branches)
- Modify: `tests/fixtures/l05-raw-golden.json` (regenerate)
- Test: `tests/unit/l05-polar-migration.test.ts`

**Interfaces:**
- Consumes: `POLAR_KINEMATICS_MODEL_VERSION`, `polarKinematicsEnvironmentV1` from `../contracts/polar-kinematics-environment.js`
- Produces: `l05ReplayBindings` carrying `polar_kinematics_environment`; `polarLessonTag` returning `'L05'`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/l05-polar-migration.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { advanceLogicalTick, createSession, type DeterministicSession } from '../../src/sim/session.js';
import { l05ReplayBindings } from '../../src/content/l02-l05.js';
import { POLAR_KINEMATICS_MODEL_VERSION } from '../../src/contracts/polar-kinematics-environment.js';

function l05Session(seed: string): DeterministicSession {
  return createSession({ ...l05ReplayBindings, seed, ordered_input_log: [] } as never);
}

describe('L05 polar migration', () => {
  it('declares the polar model version on its replay bindings', () => {
    expect(l05ReplayBindings.model_version).toBe(POLAR_KINEMATICS_MODEL_VERSION);
    expect(l05ReplayBindings).toHaveProperty('polar_kinematics_environment');
  });

  it('starts with a polar kinematic state rather than the legacy shape', () => {
    const raw = l05Session('l05-polar-start').raw;
    expect(raw.polar_kinematic_state).toBeDefined();
    expect(raw.l01_synthetic_state).toBeUndefined();
  });

  it('keeps its decision state and synthetic environment declaration', () => {
    const raw = l05Session('l05-decision-kept').raw;
    expect(raw.decision_state).toBe('undecided');
    expect(raw.synthetic_environment).toBe('tide_depth_visibility_declared');
  });

  it('computes an under-keel clearance for the tide and depth lesson', () => {
    const raw = l05Session('l05-clearance').raw;
    expect(typeof raw.clearance_m).toBe('number');
    expect(['clear', 'caution', 'danger']).toContain(raw.clearance_level);
    expect(raw.highest_clearance_alert).toBe('clear');
  });

  it('computes heading, COG, STW and SOG instead of declaring them unavailable', () => {
    const raw = l05Session('l05-observations').raw;
    expect(typeof raw.heading).toBe('number');
    expect(typeof raw.cog).toBe('number');
    expect(typeof raw.stw).toBe('number');
    expect(typeof raw.sog).toBe('number');
  });

  it('appends a polar transition per advanced tick and tags it L05', () => {
    const session = advanceLogicalTick(l05Session('l05-transition'));
    const transitions = session.ledger.filter((event) => event.type === 'POLAR_KINEMATIC_TRANSITION');
    expect(transitions.length).toBeGreaterThan(0);
  });

  it('declares no virtual mark, unlike L04', () => {
    expect(l05Session('l05-nomark').raw.mark_state).toBeUndefined();
  });

  it('reproduces exactly for two identical sessions advanced the same number of ticks', () => {
    let a = l05Session('l05-determinism');
    let b = l05Session('l05-determinism');
    for (let tick = 0; tick < 4; tick += 1) { a = advanceLogicalTick(a); b = advanceLogicalTick(b); }
    expect({ raw: a.raw, ledger: a.ledger }).toEqual({ raw: b.raw, ledger: b.ledger });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/l05-polar-migration.test.ts`
Expected: FAIL — `model_version` is still `training-sloop-model-v0-draft`

- [ ] **Step 3: Declare the polar model on the manifest and bindings**

In `src/content/l02-l05.ts`, add `model_version` to `l05Manifest` (it currently inherits the legacy value from `common`). Insert it immediately after the `validation_record_id` line, mirroring how `l04Manifest` does it:

```ts
  model_version: POLAR_KINEMATICS_MODEL_VERSION,
```

Then change the L05 bindings export to carry the environment, exactly as L04's does:

```ts
export const l05ReplayBindings = Object.freeze({ ...bindings(l05Manifest), polar_kinematics_environment: polarKinematicsEnvironmentV1 });
```

- [ ] **Step 4: Open the polar path to L05**

Three edits in `src/sim/session.ts`.

First, `polarProfile()` at line 318 currently reads:

```ts
  if (!lesson.startsWith('l01-') && !lesson.startsWith('l04-') && !lesson.startsWith('l06-')) return undefined;
```

Replace with:

```ts
  if (!lesson.startsWith('l01-') && !lesson.startsWith('l04-') && !lesson.startsWith('l05-') && !lesson.startsWith('l06-')) return undefined;
```

Second, `polarLessonTag()` at line 403 becomes:

```ts
function polarLessonTag(identity: ReplayIdentity | ReplayV2): 'L01' | 'L04' | 'L05' | 'L06' {
  const lesson = sessionLesson(identity);
  if (lesson.startsWith('l06-')) return 'L06';
  if (lesson.startsWith('l05-')) return 'L05';
  if (lesson.startsWith('l04-')) return 'L04';
  return 'L01';
}
```

`l01CausalControlsForTick` takes a `lessonId: 'L01' | 'L04' | 'L06'` parameter — widen that parameter type to `'L01' | 'L04' | 'L05' | 'L06'` too, or `tsc` will reject the call.

Third, the L05 branch of `createSession` at line 253 currently reads:

```ts
  if (scenario.startsWith('l05-')) return freeze({ ...base, lesson_id: 'L05', synthetic_environment: 'tide_depth_visibility_declared', decision_state: 'undecided' });
```

Replace with a polar initialization that keeps both L05-specific fields. Note it has **no** `mark_state` and no `declared_navigation_concepts` — L05 has no mark:

```ts
  if (scenario.startsWith('l05-')) {
    if (!polarProfile) throw new CanonicalInputContractError('Polar kinematics profile is missing.');
    const initialState = createInitialPolarKinematicState(polarProfile);
    const initialTransition = transitionPolarKinematicState(polarProfile, initialState, []);
    const observations = projectPolarObservations(polarProfile, initialTransition);
    return freeze({
      ...base,
      lesson_id: 'L05',
      synthetic_environment: 'tide_depth_visibility_declared',
      decision_state: 'undecided',
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

- [ ] **Step 5: Run the new test**

Run: `npx vitest run tests/unit/l05-polar-migration.test.ts`
Expected: PASS — 8 tests

- [ ] **Step 6: Regenerate the raw golden fixture**

Run: `npm test` — `tests/unit/projection.test.ts` and `tests/unit/l02-l05.test.ts` will fail on the L05 golden comparison.

`tests/fixtures/l05-raw-golden.json` needs two edits:

1. `identity.model_version` becomes `"polar-kinematics-v5"`.
2. `identity` gains `polar_kinematics_environment`. **Copy it verbatim from `tests/fixtures/l04-raw-golden.json`** — all 15 fields including `current_epoch_ms: 0`, which is the canonical value that derives exactly zero current and keeps the fixture's arithmetic simple.
3. `expected.raw` and `expected.ledger` regenerate from the observed run.

**Before pasting the regenerated `expected`, verify these are true:** `expected.raw.polar_kinematic_state` exists, `expected.raw.l01_synthetic_state` is gone, `decision_state` is still present, `mark_state` is absent, and `expected.ledger` contains a `POLAR_KINEMATIC_TRANSITION`. **If `mark_state` appears, stop** — that means L05 fell through into the L04 mark logic.

- [ ] **Step 7: Verify and commit**

```bash
npm run typecheck
npm test
git diff --name-only tests/fixtures/   # must print ONLY l05-raw-golden.json
git add src/content/l02-l05.ts src/sim/session.ts tests/fixtures/l05-raw-golden.json tests/unit/l05-polar-migration.test.ts
git commit -m "feat(sim): migrate L05 onto the polar and current model"
```

---

### Task 2: Generalize scoring to a lesson profile table

Replaces the single-lesson `computeL04Components` with a table-driven version, because L05's judgment evidence is a decision record rather than a helm correction.

**Files:**
- Modify: `src/sim/session.ts` (extract the decision cause into a shared function)
- Modify: `src/scoring/score-contract.ts` (add the profile table, remove `L04_UNAVAILABLE_COMPONENTS`)
- Modify: `src/scoring/components.ts` (`computeL04Components` → `computeComponents`)
- Modify: `tests/unit/score-contract.test.ts`, `tests/unit/score-components.test.ts`
- Test: as above

**Interfaces:**
- Produces: `LESSON_SCORE_PROFILES`, `l05DecisionCause`, `computeComponents(raw, ledger): readonly ScoreComponent[] | undefined`

- [ ] **Step 1: Give the decision cause a single source of truth**

`src/sim/session.ts:711` builds the decision cause inline as
`` `synthetic ${action.replace('decision_', '')} decision recorded` ``. The scorer needs to
match that string, and a copied literal would drift. Add this exported helper near
`HELM_CORRECTION_CAUSE`:

```ts
/** The cause recorded for an L05 pass/wait/return decision, and the string the scorer matches. */
export function l05DecisionCause(action: 'decision_pass' | 'decision_wait' | 'decision_return'): string {
  return `synthetic ${action.replace('decision_', '')} decision recorded`;
}
```

Then use it at line 711 in place of the inline template so there is exactly one definition.

- [ ] **Step 2: Write the failing test**

Replace the L04-only helper assertions in `tests/unit/score-components.test.ts` by adding this block at the end of the file (keep every existing test):

```ts
describe('L05 component derivation', () => {
  const l05Raw = { lesson_id: 'L05', highest_clearance_alert: 'clear' } as unknown as RawSimulationState;

  it('scores judgment from recorded decisions, not helm corrections', () => {
    const components = computeComponents(l05Raw, [
      event({ id: 'd1', type: 'LESSON_CHECKPOINT', lesson_id: 'L05', cause: l05DecisionCause('decision_wait'), tick: 0 }),
    ])!;
    const judgment = componentBy(components, 'judgment');
    expect(judgment.points).toBe(10);
    expect(judgment.causal_event_ids).toEqual(['d1']);
  });

  it('ignores a helm correction for L05 judgment', () => {
    const components = computeComponents(l05Raw, [
      event({ id: 'h1', type: 'LESSON_CHECKPOINT', lesson_id: 'L05', cause: HELM_CORRECTION_CAUSE, tick: 0 }),
    ])!;
    expect(componentBy(components, 'judgment').points).toBe(0);
  });

  it('declares both observation and goal unavailable for L05', () => {
    const components = computeComponents(l05Raw, [])!;
    expect(componentBy(components, 'observation').status).toBe('declared-unavailable');
    expect(componentBy(components, 'goal').status).toBe('declared-unavailable');
  });

  it('leaves L05 a 75 point denominator', () => {
    const total = computeComponents(l05Raw, [])!.reduce((sum, component) => sum + component.points_possible, 0);
    expect(total).toBe(75);
  });

  it('returns undefined for a lesson with no scoring profile', () => {
    expect(computeComponents({ lesson_id: 'L02' } as unknown as RawSimulationState, [])).toBeUndefined();
  });
});
```

Add `l05DecisionCause` to the existing `src/sim/session.js` import in that file, and rename the
existing `computeL04Components` calls to `computeComponents` throughout.

In `tests/unit/score-contract.test.ts`, replace the `L04_UNAVAILABLE_COMPONENTS` test with:

```ts
  it('declares a scoring profile per scored lesson', () => {
    expect(LESSON_SCORE_PROFILES.L04).toEqual({ unavailable: ['observation'], judgment_evidence: 'helm_correction' });
    expect(LESSON_SCORE_PROFILES.L05).toEqual({ unavailable: ['observation', 'goal'], judgment_evidence: 'decision_record' });
  });
```

updating its import from `L04_UNAVAILABLE_COMPONENTS` to `LESSON_SCORE_PROFILES`.

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run tests/unit/score-components.test.ts tests/unit/score-contract.test.ts`
Expected: FAIL — `computeComponents` and `LESSON_SCORE_PROFILES` are not exported

- [ ] **Step 4: Add the profile table**

In `src/scoring/score-contract.ts`, delete `L04_UNAVAILABLE_COMPONENTS` and its doc comment, and add:

```ts
/** Which recorded artefact a lesson's judgment component reads. */
export type JudgmentEvidence = 'helm_correction' | 'decision_record';

export interface LessonScoreProfile {
  readonly unavailable: readonly ScoreComponentKey[];
  readonly judgment_evidence: JudgmentEvidence;
}

/**
 * Scored lessons and what each one can actually evidence. A component is listed
 * as unavailable when the lesson records nothing that could support it, never to
 * express a poor result. L04 approximates judgment from helm corrections because
 * that is all it records; L05 records an explicit pass/wait/return decision,
 * which is a truer judgment artefact, so it reads that instead.
 */
export const LESSON_SCORE_PROFILES: Readonly<Record<string, LessonScoreProfile>> = Object.freeze({
  L04: Object.freeze({
    unavailable: Object.freeze(['observation'] as const),
    judgment_evidence: 'helm_correction' as const,
  }),
  L05: Object.freeze({
    // L05 has no mark; its own pass_semantics say transit is not mastery, so
    // there is no single goal event to detect.
    unavailable: Object.freeze(['observation', 'goal'] as const),
    judgment_evidence: 'decision_record' as const,
  }),
});
```

- [ ] **Step 5: Generalize the component derivation**

In `src/scoring/components.ts`, replace the `judgmentComponent` function and the
`computeL04Components` export with:

```ts
function judgmentComponent(ledger: readonly LedgerEvent[], evidence: JudgmentEvidence): ScoreComponent {
  const matches = ledger.filter((event) => {
    if (event.type !== 'LESSON_CHECKPOINT') return false;
    return evidence === 'helm_correction'
      ? event.cause === HELM_CORRECTION_CAUSE
      : event.cause === l05DecisionCause('decision_pass')
        || event.cause === l05DecisionCause('decision_wait')
        || event.cause === l05DecisionCause('decision_return');
  });
  // PRD 7.3 forbids evaluating the same cause twice before it resolves; one tick
  // contributes at most one judgment however many events it recorded.
  const distinctTicks = new Set(matches.map((event) => event.tick));
  const points = Math.min(
    COMPONENT_MAX_POINTS.judgment,
    distinctTicks.size * JUDGMENT_POINTS_PER_CORRECTION,
  );
  return scored('judgment', points, matches.map((event) => event.id));
}

export function computeComponents(
  raw: RawSimulationState,
  ledger: readonly LedgerEvent[],
): readonly ScoreComponent[] | undefined {
  const profile = raw.lesson_id === undefined ? undefined : LESSON_SCORE_PROFILES[raw.lesson_id];
  if (!profile) return undefined;
  const byKey: Readonly<Record<ScoreComponentKey, ScoreComponent>> = {
    observation: unavailable('observation'),
    judgment: judgmentComponent(ledger, profile.judgment_evidence),
    control_stability: controlStabilityComponent(ledger),
    safety: safetyComponent(raw, ledger),
    goal: goalComponent(ledger),
  };
  return Object.freeze(
    COMPONENT_ORDER.map((key) => (profile.unavailable.includes(key) ? unavailable(key) : byKey[key])),
  );
}
```

Update the imports at the top of the file: drop `L04_UNAVAILABLE_COMPONENTS`, add
`LESSON_SCORE_PROFILES` and `type JudgmentEvidence` from `./score-contract.js`, and add
`l05DecisionCause` to the existing `../sim/session.js` import.

**Do not "simplify" the `if (!profile) return undefined;` guard.** This repo sets
`noUncheckedIndexedAccess: true`, so indexing `Record<string, LessonScoreProfile>` yields
`LessonScoreProfile | undefined` and that guard is what makes the function typecheck. (The
neighbouring `byKey[key]` access needs no guard, because `Record<ScoreComponentKey, …>` over
a finite literal union is a mapped type rather than an index signature.)

- [ ] **Step 6: Run the tests**

Run: `npx vitest run tests/unit/score-components.test.ts tests/unit/score-contract.test.ts`
Expected: PASS

- [ ] **Step 7: Verify and commit**

```bash
npm run typecheck
npm test
git diff --name-only tests/fixtures/   # must print ONLY l05-raw-golden.json
git add src/sim/session.ts src/scoring/score-contract.ts src/scoring/components.ts tests/unit/score-contract.test.ts tests/unit/score-components.test.ts
git commit -m "refactor(scoring): drive components from a lesson profile table"
```

---

### Task 3: Score L05

**Files:**
- Modify: `src/scoring/projection.ts` (`projectScore` dispatch)
- Modify: `tests/fixtures/l05-score-debrief-golden.json` (regenerate)
- Test: `tests/unit/score-total.test.ts` (add cases)

- [ ] **Step 1: Write the failing test**

Add to `tests/unit/score-total.test.ts`:

```ts
describe('L05 total points', () => {
  it('scores a recorded decision out of a 75 point denominator', () => {
    const session = createSession({ ...l05ReplayBindings, seed: 'l05-score', ordered_input_log: [] } as never);
    const score = projectScore(session.raw, session.ledger);
    expect(score.status).toBe('declared_synthetic_unvalidated');
    expect(score.points_possible).toBe(75);
    expect(Number.isInteger(score.total_points)).toBe(true);
  });

  it('declares observation and goal unavailable for L05', () => {
    const session = createSession({ ...l05ReplayBindings, seed: 'l05-unavail', ordered_input_log: [] } as never);
    const components = projectScore(session.raw, session.ledger).components!;
    expect(components.find((component) => component.key === 'goal')!.status).toBe('declared-unavailable');
    expect(components.find((component) => component.key === 'observation')!.status).toBe('declared-unavailable');
  });
});
```

Add `l05ReplayBindings` to the existing `../../src/content/l02-l05.js` import in that file.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/score-total.test.ts`
Expected: FAIL — L05 still returns `draft_causal_checkpoint_recorded` with `total_points: 0`

- [ ] **Step 3: Dispatch on the profile table instead of a hardcoded lesson**

In `src/scoring/projection.ts`, replace this line in `projectScore`:

```ts
  if (raw.lesson_id === 'L04') return scoreL04(raw, ledger);
```

with:

```ts
  const components = computeComponents(raw, ledger);
  if (components) return scoreFromComponents(raw, components);
```

Rename `scoreL04` to `scoreFromComponents` and change its signature so it receives the
components rather than computing them:

```ts
function scoreFromComponents(raw: RawSimulationState, components: readonly ScoreComponent[]): ScoreProjection {
```

Delete the `const components = computeL04Components(raw, ledger);` line from its body; every
other line of that function stays exactly as it is. Update the import from
`computeL04Components` to `computeComponents`.

- [ ] **Step 4: Run the test**

Run: `npx vitest run tests/unit/score-total.test.ts`
Expected: PASS

- [ ] **Step 5: Regenerate the score golden fixture**

**The correct value is derivable in advance — do not simply paste what the test prints.**

`tests/fixtures/l05-raw-golden.json` has `terminal_ticks: 1` and exactly one input,
`decision_wait`, recorded at tick 0. Working the contract through by hand:

| Component | Derivation | Points |
|---|---|---|
| observation | no evidence source | 0 of 0 (`declared-unavailable`) |
| judgment | 1 decision, 1 distinct tick × 10 | 10 of 25 |
| control_stability | no helm inputs → 0 reversals → 25 − 0 | 25 of 25 |
| safety | `highest_clearance_alert` is `clear` | 25 of 25 |
| goal | L05 has no mark | 0 of 0 (`declared-unavailable`) |

So the expected result is **`total_points: 60`, `points_possible: 75`**, `status:
'declared_synthetic_unvalidated'`, no `safety_cap` key.

`debrief_fact_kinds` also changes: L05 now emits a `POLAR_KINEMATIC_TRANSITION`, so the array
gains exactly one `"synthetic_transition"` entry while its existing three entries
(`contract_status`, `action_recorded`, `lesson_checkpoint`) stay in their current order.

**If the test prints any total other than 60 of 75, or `debrief_fact_kinds` changes in any
other way, stop and report — do not paste the observed value.**

- [ ] **Step 6: Verify and commit**

```bash
npm run typecheck
npm test
npm run build
git diff --name-only tests/fixtures/   # must print ONLY the two l05- files
git add src/scoring/projection.ts tests/unit/score-total.test.ts tests/fixtures/l05-score-debrief-golden.json
git commit -m "feat(scoring): score L05 from its recorded decisions"
```

---

### Task 4: Surface L05's computed depth and clearance

**Files:**
- Modify: `src/content/l02-l05.ts` (two observation statuses on `l05Manifest`)
- Modify: `src/main.ts:301` and the observation branch
- Test: `tests/smoke/app.spec.ts` (add one case)

- [ ] **Step 1: Flip the two observations that are now computed**

In `l05Manifest.required_observations`, change **only** these two entries' `status` from
`'declared_unavailable'` to `'declared_synthetic'`:

- `scenario_depth`
- `declared_clearance`

**Leave `visibility` and `route_state` as `declared_unavailable`** — no model computes them,
and declaring them would be a false claim.

- [ ] **Step 2: Render them**

`src/main.ts:301` currently gates the polar observation branch on two lessons:

```ts
    } else if ((currentLesson.id === 'L04' || currentLesson.id === 'L06') && observation.status === 'declared_synthetic') {
```

Change it to include L05:

```ts
    } else if ((currentLesson.id === 'L04' || currentLesson.id === 'L05' || currentLesson.id === 'L06') && observation.status === 'declared_synthetic') {
```

That branch handles `observation.key === 'clearance'`, but L05's manifest keys are
`declared_clearance` and `scenario_depth`. Extend the existing `clearance` condition at
line 322 to accept L05's key, and add a depth branch beside it:

```ts
      } else if (observation.key === 'clearance' || observation.key === 'declared_clearance') {
        description.textContent = session.raw.clearance_m === undefined || session.raw.clearance_m === 'declared-unavailable'
          ? 'Synthetic declared under-keel clearance not computed for this lesson.'
          : `Synthetic declared under-keel clearance ${numeric(session.raw.clearance_m)} m (${session.raw.clearance_level ?? 'unknown'}) — declared seabed depth plus a simplified semidiurnal tide minus declared draft; not a charted depth, sounding, datum, or under-keel safety margin.`;
      } else if (observation.key === 'scenario_depth') {
        const polarEnvironment = (session.identity as ReplayV2).polar_kinematics_environment;
        description.textContent = polarEnvironment
          ? `Synthetic declared seabed depth ${numeric(polarEnvironment.seabed_depth_m)} m and declared draft ${numeric(polarEnvironment.draft_m)} m — invented educational constants, not a charted depth, sounding, or datum.`
          : 'Synthetic declared seabed depth unavailable.';
```

- [ ] **Step 3: Add smoke coverage**

Add to `tests/smoke/app.spec.ts`:

```ts
test('shows L05 computed under-keel clearance and depth with their synthetic boundary', async ({ page }) => {
  await page.goto('/');
  await startSession(page, 'L05');
  await expect(page.getByText(/Synthetic declared under-keel clearance [\d.]+ m/)).toBeVisible();
  await expect(page.getByText(/not a charted depth, sounding, datum/)).toBeVisible();
  await expect(page.getByText(/Synthetic declared seabed depth/)).toBeVisible();
});
```

- [ ] **Step 4: Run the full verification**

```bash
npm run typecheck
npm test
npm run build
npm run test:smoke
git diff --name-only tests/fixtures/   # must print ONLY the two l05- files
```
Expected: all green; smoke 27/27.

- [ ] **Step 5: Commit**

```bash
git add src/content/l02-l05.ts src/main.ts tests/smoke/app.spec.ts
git commit -m "feat(content): surface L05's computed depth and under-keel clearance"
```

---

### Task 5: Record the migration in the status documents

**Files:**
- Modify: `docs/PROJECT_STATUS.md`
- Modify: `docs/architecture/training-ground-completion-matrix.md`

- [ ] **Step 1: Capture the real numbers**

```bash
npm run typecheck && npm test && npm run build && npm run test:smoke
```
Write down the observed counts. Use those, not the counts this plan predicts.

- [ ] **Step 2: Update `docs/PROJECT_STATUS.md`**

- Refresh the verification table with the observed counts.
- Update the legacy-model claim: **L02 and L03 remain on the legacy model; L05 no longer does.** L01 stays unmigrated by decision (89 binding sites).
- Update the scoring line: L04 scores four components out of 100, L05 scores three out of 75 from its recorded decisions; L01, L02, L03 and L06 remain 0.
- Update the golden-fixtures line: both `l05-` fixtures were regenerated this cycle; all `l01-`, `l02-`, `l03-` and `l04-` fixtures are byte-identical.
- Note that L05's `visibility` and `route_state` remain unavailable, and that computing depth and clearance does not validate the constants behind them.

- [ ] **Step 3: Update the completion matrix**

Update the **L05 row only**. Its observation facet moves from `declared_unavailable` for depth and clearance to `DECLARED_SYNTHETIC_ONLY` computed values, noting the polar model version and that `VR-L05-v0` remains `assumption`. Its debrief/scoring facet records the three scored components and the 75-point denominator, with judgment sourced from recorded pass/wait/return decisions. Do not touch the L01, L02, L03, L04 or L06 rows.

- [ ] **Step 4: Verify and commit**

```bash
npm test
git diff --name-only    # only the two documentation files
git add docs/PROJECT_STATUS.md docs/architecture/training-ground-completion-matrix.md
git commit -m "docs: record the L05 polar migration and scoring"
```

---

## Completion criteria

- [ ] `npm run typecheck`, `npm test`, `npm run build`, `npm run test:smoke` all pass
- [ ] `git diff --name-only tests/fixtures/` prints only `l05-raw-golden.json` and `l05-score-debrief-golden.json` across the whole branch
- [ ] An L05 session has a computed `polar_kinematic_state`, `clearance_m`, heading, COG, STW and SOG
- [ ] L05 keeps `decision_state` and gains no `mark_state`
- [ ] L05 reports `total_points: 60` of 75 on its golden fixture
- [ ] L05's judgment component points at its decision checkpoint's event id, not a helm correction
- [ ] L05's `visibility` and `route_state` are still `declared_unavailable`
- [ ] Two identical L05 sessions advanced the same number of ticks are deep-equal
- [ ] Every L05 depth and clearance string denies being a charted depth, sounding, or datum
