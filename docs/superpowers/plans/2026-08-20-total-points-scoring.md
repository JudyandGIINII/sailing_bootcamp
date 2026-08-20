# Total-Points Scoring Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `total_points` a real, non-zero, causally-traceable number on L04 — the five-component score PRD §7.3 requires — without adding simulation state and without disturbing any lesson but L04.

**Architecture:** Two pure modules plus a composition. `score-contract.ts` declares the weights, caps and boundary copy as constants and nothing else. `components.ts` turns `(raw, ledger)` into five `ScoreComponent` records. The existing `projectScore` composes them and applies the safety cap. Scoring stays a projection: nothing is written back to session state.

**Tech Stack:** TypeScript 5.9 (strict), Vitest 4.1, Playwright. No new dependencies.

**Design spec:** `docs/superpowers/specs/2026-08-20-total-points-scoring-design.md` — read it first.

## Global Constraints

- **No new simulation state.** Do not add fields to `RawSimulationState`, to any replay identity, or to `LedgerEvent`. Scoring reads; it never writes.
- **Exactly one fixture may change:** `tests/fixtures/l04-score-debrief-golden.json`. At the end of every task, `git diff --name-only tests/fixtures/` must print that file or nothing at all. If `l01-`, `l02-`, `l03-`, `l05-`, or any `*-raw-golden.json` appears, the optional-field design has leaked — **stop and report**.
- **Leave non-L04 paths byte-identical.** The `SAFETY_BLOCKED` early return and the `unavailable_pending_validation` / `draft_causal_checkpoint_recorded` returns keep their exact current object shape. This is why the three existing `total_points` assertions (`tests/unit/sim-session.test.ts:141` is L01, `tests/unit/sim-session.test.ts:276` and `tests/unit/projection.test.ts:55` are SAFETY_BLOCKED) stay green untouched. Do not edit them.
- **Purity.** `src/scoring/score-contract.ts` and `src/scoring/components.ts` must not use `Date.now`, `performance.now`, `Math.random`, `window`, `document`, `localStorage`, `sessionStorage`, `fetch`, `XMLHttpRequest`, `WebSocket`, or `EventSource`.
- **Integers only.** All component points and the total are integers. The cap is the only place a fraction appears; `Math.floor` it immediately.
- **Boundary language.** Everywhere the number is shown it carries the declared-synthetic, unvalidated framing. Never present it as an assessment of real sailing competence, qualification, or safety.
- **Accessibility.** The total and its breakdown must exist as text; never signal the cap by colour alone.
- **Relative imports use the `.js` extension.**
- **Baseline:** `npm run typecheck` clean, `npm test` = 34 files / 336 tests, `npm run build` clean, `npm run test:smoke` = 25/25.

---

### Task 1: Declared scoring contract (pure constants)

**Files:**
- Create: `src/scoring/score-contract.ts`
- Test: `tests/unit/score-contract.test.ts`

**Interfaces:**
- Consumes: nothing (dependency-free)
- Produces: `SCORE_CONTRACT_VERSION`, `ScoreComponentKey`, `COMPONENT_MAX_POINTS`, `JUDGMENT_POINTS_PER_CORRECTION`, `CONTROL_PENALTY_PER_REVERSAL`, `SAFETY_COMPONENT_POINTS`, `SAFETY_CAP_RATIO`, `L04_UNAVAILABLE_COMPONENTS`, `SAFETY_RECOVERY_REPRESENTATION`, `SCORE_BOUNDARY_TEXT`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/score-contract.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  COMPONENT_MAX_POINTS,
  CONTROL_PENALTY_PER_REVERSAL,
  JUDGMENT_POINTS_PER_CORRECTION,
  L04_UNAVAILABLE_COMPONENTS,
  SAFETY_CAP_RATIO,
  SAFETY_COMPONENT_POINTS,
  SAFETY_RECOVERY_REPRESENTATION,
  SCORE_BOUNDARY_TEXT,
  SCORE_CONTRACT_VERSION,
} from '../../src/scoring/score-contract.js';

describe('declared scoring contract', () => {
  it('declares a draft contract version', () => {
    expect(SCORE_CONTRACT_VERSION).toBe('score-contract-v0-draft');
  });

  it('gives every component the same declared maximum', () => {
    expect(COMPONENT_MAX_POINTS).toEqual({
      observation: 25, judgment: 25, control_stability: 25, safety: 25, goal: 25,
    });
  });

  it('declares integer component rules', () => {
    expect(Number.isInteger(JUDGMENT_POINTS_PER_CORRECTION)).toBe(true);
    expect(Number.isInteger(CONTROL_PENALTY_PER_REVERSAL)).toBe(true);
    for (const points of Object.values(SAFETY_COMPONENT_POINTS)) {
      expect(Number.isInteger(points)).toBe(true);
    }
  });

  it('makes the safety cap strictly tighter as severity rises', () => {
    expect(SAFETY_CAP_RATIO.danger).toBeLessThan(SAFETY_CAP_RATIO.caution);
    expect(SAFETY_CAP_RATIO.caution).toBeLessThan(1);
    expect(SAFETY_CAP_RATIO.danger).toBeGreaterThan(0);
  });

  it('declares observation unavailable for L04 because nothing records it', () => {
    expect(L04_UNAVAILABLE_COMPONENTS).toEqual(['observation']);
  });

  it('declares safety recovery unrepresented rather than inventing it', () => {
    expect(SAFETY_RECOVERY_REPRESENTATION).toBe('not-represented-in-this-draft');
  });

  it('carries boundary copy that denies real-competence meaning', () => {
    expect(SCORE_BOUNDARY_TEXT).toMatch(/synthetic/i);
    expect(SCORE_BOUNDARY_TEXT).toMatch(/unvalidated/i);
    expect(SCORE_BOUNDARY_TEXT).toMatch(/not an assessment/i);
  });

  it('freezes every declared table', () => {
    expect(Object.isFrozen(COMPONENT_MAX_POINTS)).toBe(true);
    expect(Object.isFrozen(SAFETY_COMPONENT_POINTS)).toBe(true);
    expect(Object.isFrozen(SAFETY_CAP_RATIO)).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/score-contract.test.ts`
Expected: FAIL — `Failed to resolve import "../../src/scoring/score-contract.js"`

- [ ] **Step 3: Write the implementation**

Create `src/scoring/score-contract.ts`:

```ts
/**
 * The declared scoring contract for PRD §7.3. Every number here is an invented
 * educational constant chosen for a synthetic training prototype. None of it is
 * an assessment scale, a competence standard, or a safety threshold, and none of
 * it rests on a validated domain record — `VR-POLAR-v0` is `disposition: assumption`.
 *
 * This module declares values only. All logic lives in `components.ts`.
 */
export const SCORE_CONTRACT_VERSION = 'score-contract-v0-draft' as const;

export type ScoreComponentKey =
  | 'observation'
  | 'judgment'
  | 'control_stability'
  | 'safety'
  | 'goal';

export type SafetySeverity = 'clear' | 'caution' | 'danger';

/** Declared maximum for each component when it applies to a lesson. */
export const COMPONENT_MAX_POINTS: Readonly<Record<ScoreComponentKey, number>> = Object.freeze({
  observation: 25,
  judgment: 25,
  control_stability: 25,
  safety: 25,
  goal: 25,
});

/** Each recorded helm correction earns this much judgment credit, saturating at the maximum. */
export const JUDGMENT_POINTS_PER_CORRECTION = 10;

/** Each helm direction reversal costs this much control-stability credit, floored at zero. */
export const CONTROL_PENALTY_PER_REVERSAL = 5;

/** Component credit for the most severe under-keel clearance level recorded. */
export const SAFETY_COMPONENT_POINTS: Readonly<Record<SafetySeverity, number>> = Object.freeze({
  clear: 25,
  caution: 12,
  danger: 0,
});

/**
 * A recorded clearance crossing caps the whole total at this fraction of what was
 * possible. A cap is used rather than a deduction because a deduction can be
 * offset by scoring well elsewhere, which PRD §7.3 forbids outright.
 */
export const SAFETY_CAP_RATIO: Readonly<Record<'caution' | 'danger', number>> = Object.freeze({
  caution: 0.7,
  danger: 0.4,
});

/**
 * L04 records no observation action, so the observation component has no evidence
 * to read. It is declared unavailable rather than scored zero, because zero would
 * read as "did badly" instead of "not scored".
 */
export const L04_UNAVAILABLE_COMPONENTS: readonly ScoreComponentKey[] = Object.freeze(['observation'] as const);

/**
 * PRD §7.3 requires the contract to declare how safety recovery is handled. The
 * current model never records a recovery — `shouldRecordClearanceCrossing` fires
 * only when severity rises — so this draft declares it unrepresented rather than
 * claiming a recovery that was never recorded.
 */
export const SAFETY_RECOVERY_REPRESENTATION = 'not-represented-in-this-draft' as const;

export const SCORE_BOUNDARY_TEXT =
  'Synthetic educational score, unvalidated — not an assessment of real sailing competence, qualification, or safety.' as const;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/score-contract.test.ts`
Expected: PASS — 8 tests

- [ ] **Step 5: Verify the constraints and commit**

```bash
npm run typecheck
git diff --name-only tests/fixtures/   # must print nothing
git add src/scoring/score-contract.ts tests/unit/score-contract.test.ts
git commit -m "feat(scoring): declare the five-component scoring contract"
```

---

### Task 2: Component derivation (pure)

Turns a session's recorded evidence into five component records. Reads only.

**Files:**
- Modify: `src/sim/session.ts:415` (add `export` to one existing const — no behaviour change)
- Create: `src/scoring/components.ts`
- Test: `tests/unit/score-components.test.ts`

**Interfaces:**
- Consumes: everything Task 1 produced; `LedgerEvent`, `RawSimulationState`, `HELM_CORRECTION_CAUSE` from `../sim/session.js`; `L04_MARK_ARRIVAL_CAUSE` from `../content/l02-l05.js`
- Produces:
  - `interface ScoreComponent { readonly key: ScoreComponentKey; readonly status: 'scored' | 'declared-unavailable'; readonly points: number; readonly points_possible: number; readonly causal_event_ids: readonly string[] }`
  - `computeL04Components(raw: RawSimulationState, ledger: readonly LedgerEvent[]): readonly ScoreComponent[]`
  - `countHelmReversals(ledger: readonly LedgerEvent[]): number`

- [ ] **Step 1: Export the shared cause string**

`src/sim/session.ts:415` currently reads:

```ts
const HELM_CORRECTION_CAUSE = 'declared helm correction recorded';
```

Change it to:

```ts
export const HELM_CORRECTION_CAUSE = 'declared helm correction recorded';
```

Nothing else in that file changes. Import the constant rather than retyping the literal — this repo has already been bitten once by a duplicated constant drifting out of sync (`domain-validation-registry.yaml`).

- [ ] **Step 2: Write the failing test**

Create `tests/unit/score-components.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import type { LedgerEvent, RawSimulationState } from '../../src/sim/session.js';
import { HELM_CORRECTION_CAUSE } from '../../src/sim/session.js';
import { L04_MARK_ARRIVAL_CAUSE } from '../../src/content/l02-l05.js';
import { computeL04Components, countHelmReversals, type ScoreComponent } from '../../src/scoring/components.js';
import type { ScoreComponentKey } from '../../src/scoring/score-contract.js';

function event(partial: Partial<LedgerEvent> & { id: string; type: LedgerEvent['type'] }): LedgerEvent {
  return { tick: 0, sequence: 0, ...partial } as LedgerEvent;
}

function componentBy(components: readonly ScoreComponent[], key: ScoreComponentKey): ScoreComponent {
  const found = components.find((component) => component.key === key);
  if (!found) throw new Error(`missing component ${key}`);
  return found;
}

const cleanRaw = { lesson_id: 'L04', highest_clearance_alert: 'clear' } as unknown as RawSimulationState;

describe('helm reversal counting', () => {
  it('counts a direction change as one reversal', () => {
    expect(countHelmReversals([
      event({ id: 'a', type: 'ACTION_ACCEPTED', action: 'helm_port' }),
      event({ id: 'b', type: 'ACTION_ACCEPTED', action: 'helm_starboard' }),
    ])).toBe(1);
  });

  it('does not count repeats of the same direction', () => {
    expect(countHelmReversals([
      event({ id: 'a', type: 'ACTION_ACCEPTED', action: 'helm_port' }),
      event({ id: 'b', type: 'ACTION_ACCEPTED', action: 'helm_port' }),
      event({ id: 'c', type: 'ACTION_ACCEPTED', action: 'helm_port' }),
    ])).toBe(0);
  });

  it('ignores non-helm actions between helm actions', () => {
    expect(countHelmReversals([
      event({ id: 'a', type: 'ACTION_ACCEPTED', action: 'helm_port' }),
      event({ id: 'b', type: 'ACTION_ACCEPTED', action: 'reef' }),
      event({ id: 'c', type: 'ACTION_ACCEPTED', action: 'helm_port' }),
    ])).toBe(0);
  });
});

describe('L04 component derivation', () => {
  it('declares observation unavailable because nothing records it', () => {
    const observation = componentBy(computeL04Components(cleanRaw, []), 'observation');
    expect(observation.status).toBe('declared-unavailable');
    expect(observation.points).toBe(0);
    expect(observation.points_possible).toBe(0);
  });

  it('credits ten judgment points per recorded correction and points at their events', () => {
    const judgment = componentBy(computeL04Components(cleanRaw, [
      event({ id: 'c1', type: 'LESSON_CHECKPOINT', lesson_id: 'L04', cause: HELM_CORRECTION_CAUSE, tick: 0 }),
      event({ id: 'c2', type: 'LESSON_CHECKPOINT', lesson_id: 'L04', cause: HELM_CORRECTION_CAUSE, tick: 1 }),
    ]), 'judgment');
    expect(judgment.points).toBe(20);
    expect(judgment.causal_event_ids).toEqual(['c1', 'c2']);
  });

  it('saturates judgment at the declared maximum', () => {
    const ledger = [0, 1, 2, 3, 4].map((tick) =>
      event({ id: `c${tick}`, type: 'LESSON_CHECKPOINT', lesson_id: 'L04', cause: HELM_CORRECTION_CAUSE, tick }));
    expect(componentBy(computeL04Components(cleanRaw, ledger), 'judgment').points).toBe(25);
  });

  it('counts two corrections recorded on the same tick as one', () => {
    const judgment = componentBy(computeL04Components(cleanRaw, [
      event({ id: 'c1', type: 'LESSON_CHECKPOINT', lesson_id: 'L04', cause: HELM_CORRECTION_CAUSE, tick: 3 }),
      event({ id: 'c2', type: 'LESSON_CHECKPOINT', lesson_id: 'L04', cause: HELM_CORRECTION_CAUSE, tick: 3 }),
    ]), 'judgment');
    expect(judgment.points).toBe(10);
  });

  it('gives full control-stability credit to a session that never reverses the helm', () => {
    expect(componentBy(computeL04Components(cleanRaw, []), 'control_stability').points).toBe(25);
  });

  it('subtracts five control-stability points per reversal and floors at zero', () => {
    const oscillating: LedgerEvent[] = [];
    for (let index = 0; index < 8; index += 1) {
      oscillating.push(event({
        id: `h${index}`, type: 'ACTION_ACCEPTED', tick: index,
        action: index % 2 === 0 ? 'helm_port' : 'helm_starboard',
      }));
    }
    expect(componentBy(computeL04Components(cleanRaw, oscillating), 'control_stability').points).toBe(0);
  });

  it('scores safety from the most severe recorded clearance level', () => {
    const cautionRaw = { lesson_id: 'L04', highest_clearance_alert: 'caution' } as unknown as RawSimulationState;
    const dangerRaw = { lesson_id: 'L04', highest_clearance_alert: 'danger' } as unknown as RawSimulationState;
    expect(componentBy(computeL04Components(cleanRaw, []), 'safety').points).toBe(25);
    expect(componentBy(computeL04Components(cautionRaw, []), 'safety').points).toBe(12);
    expect(componentBy(computeL04Components(dangerRaw, []), 'safety').points).toBe(0);
  });

  it('points the safety component at the clearance episodes that caused it', () => {
    const cautionRaw = { lesson_id: 'L04', highest_clearance_alert: 'caution' } as unknown as RawSimulationState;
    const safety = componentBy(computeL04Components(cautionRaw, [
      event({ id: 'e1', type: 'ENVIRONMENT_EPISODE', lesson_id: 'L04', cause: 'synthetic under-keel clearance caution threshold crossed' }),
    ]), 'safety');
    expect(safety.causal_event_ids).toEqual(['e1']);
  });

  it('awards the goal only when a mark arrival was recorded', () => {
    expect(componentBy(computeL04Components(cleanRaw, []), 'goal').points).toBe(0);
    const arrived = componentBy(computeL04Components(cleanRaw, [
      event({ id: 'm1', type: 'LESSON_CHECKPOINT', lesson_id: 'L04', cause: L04_MARK_ARRIVAL_CAUSE }),
    ]), 'goal');
    expect(arrived.points).toBe(25);
    expect(arrived.causal_event_ids).toEqual(['m1']);
  });

  it('returns all five components in a stable order', () => {
    expect(computeL04Components(cleanRaw, []).map((component) => component.key))
      .toEqual(['observation', 'judgment', 'control_stability', 'safety', 'goal']);
  });

  it('never mutates the ledger it reads', () => {
    const ledger = [event({ id: 'm1', type: 'LESSON_CHECKPOINT', lesson_id: 'L04', cause: L04_MARK_ARRIVAL_CAUSE })];
    const before = structuredClone(ledger);
    computeL04Components(cleanRaw, ledger);
    expect(ledger).toEqual(before);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run tests/unit/score-components.test.ts`
Expected: FAIL — `Failed to resolve import "../../src/scoring/components.js"`

- [ ] **Step 4: Write the implementation**

Create `src/scoring/components.ts`:

```ts
/**
 * Derives the PRD §7.3 score components from evidence a session already
 * recorded. It reads the immutable ledger and the raw state and writes nothing
 * back, so scoring adds no simulation state and cannot change a replay.
 *
 * Every component that has no recorded evidence source is reported as
 * `declared-unavailable` rather than as zero points, because zero would read as
 * a poor performance instead of an absent measurement.
 */
import { L04_MARK_ARRIVAL_CAUSE } from '../content/l02-l05.js';
import { HELM_CORRECTION_CAUSE, type LedgerEvent, type RawSimulationState } from '../sim/session.js';
import {
  COMPONENT_MAX_POINTS,
  CONTROL_PENALTY_PER_REVERSAL,
  JUDGMENT_POINTS_PER_CORRECTION,
  L04_UNAVAILABLE_COMPONENTS,
  SAFETY_COMPONENT_POINTS,
  type SafetySeverity,
  type ScoreComponentKey,
} from './score-contract.js';

export interface ScoreComponent {
  readonly key: ScoreComponentKey;
  readonly status: 'scored' | 'declared-unavailable';
  readonly points: number;
  readonly points_possible: number;
  readonly causal_event_ids: readonly string[];
}

const COMPONENT_ORDER: readonly ScoreComponentKey[] = Object.freeze([
  'observation', 'judgment', 'control_stability', 'safety', 'goal',
] as const);

function scored(key: ScoreComponentKey, points: number, causal_event_ids: readonly string[]): ScoreComponent {
  return Object.freeze({
    key,
    status: 'scored' as const,
    points,
    points_possible: COMPONENT_MAX_POINTS[key],
    causal_event_ids: Object.freeze([...causal_event_ids]),
  });
}

function unavailable(key: ScoreComponentKey): ScoreComponent {
  return Object.freeze({
    key,
    status: 'declared-unavailable' as const,
    points: 0,
    points_possible: 0,
    causal_event_ids: Object.freeze([]),
  });
}

/** A reversal is a helm input in the opposite direction to the previous helm input. */
export function countHelmReversals(ledger: readonly LedgerEvent[]): number {
  let previous: 'helm_port' | 'helm_starboard' | undefined;
  let reversals = 0;
  for (const event of ledger) {
    if (event.type !== 'ACTION_ACCEPTED') continue;
    if (event.action !== 'helm_port' && event.action !== 'helm_starboard') continue;
    if (previous !== undefined && previous !== event.action) reversals += 1;
    previous = event.action;
  }
  return reversals;
}

function judgmentComponent(ledger: readonly LedgerEvent[]): ScoreComponent {
  const corrections = ledger.filter(
    (event) => event.type === 'LESSON_CHECKPOINT' && event.cause === HELM_CORRECTION_CAUSE,
  );
  // PRD 7.3 forbids evaluating the same cause twice before it resolves; one tick
  // contributes at most one correction however many events it recorded.
  const distinctTicks = new Set(corrections.map((event) => event.tick));
  const points = Math.min(
    COMPONENT_MAX_POINTS.judgment,
    distinctTicks.size * JUDGMENT_POINTS_PER_CORRECTION,
  );
  return scored('judgment', points, corrections.map((event) => event.id));
}

function controlStabilityComponent(ledger: readonly LedgerEvent[]): ScoreComponent {
  const reversals = countHelmReversals(ledger);
  const points = Math.max(0, COMPONENT_MAX_POINTS.control_stability - reversals * CONTROL_PENALTY_PER_REVERSAL);
  const helmEvents = ledger.filter(
    (event) => event.type === 'ACTION_ACCEPTED' && (event.action === 'helm_port' || event.action === 'helm_starboard'),
  );
  return scored('control_stability', points, helmEvents.map((event) => event.id));
}

function safetyComponent(raw: RawSimulationState, ledger: readonly LedgerEvent[]): ScoreComponent {
  const severity: SafetySeverity = raw.highest_clearance_alert ?? 'clear';
  const episodes = ledger.filter(
    (event) => event.type === 'ENVIRONMENT_EPISODE' && (event.cause ?? '').includes('under-keel clearance'),
  );
  return scored('safety', SAFETY_COMPONENT_POINTS[severity], episodes.map((event) => event.id));
}

function goalComponent(ledger: readonly LedgerEvent[]): ScoreComponent {
  const arrivals = ledger.filter(
    (event) => event.type === 'LESSON_CHECKPOINT' && event.cause === L04_MARK_ARRIVAL_CAUSE,
  );
  return scored('goal', arrivals.length > 0 ? COMPONENT_MAX_POINTS.goal : 0, arrivals.map((event) => event.id));
}

export function computeL04Components(
  raw: RawSimulationState,
  ledger: readonly LedgerEvent[],
): readonly ScoreComponent[] {
  const byKey: Readonly<Record<ScoreComponentKey, ScoreComponent>> = {
    observation: unavailable('observation'),
    judgment: judgmentComponent(ledger),
    control_stability: controlStabilityComponent(ledger),
    safety: safetyComponent(raw, ledger),
    goal: goalComponent(ledger),
  };
  return Object.freeze(
    COMPONENT_ORDER.map((key) =>
      L04_UNAVAILABLE_COMPONENTS.includes(key) ? unavailable(key) : byKey[key],
    ),
  );
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run tests/unit/score-components.test.ts`
Expected: PASS — 13 tests

**Likely snag:** if TypeScript rejects `event.action` narrowing because `SessionAction` is a wide union, compare against the string literals as written above rather than widening any type.

- [ ] **Step 6: Verify nothing else moved and commit**

```bash
npm run typecheck
npm test
git diff --name-only tests/fixtures/   # must print nothing
git add src/sim/session.ts src/scoring/components.ts tests/unit/score-components.test.ts
git commit -m "feat(scoring): derive the five score components from recorded evidence"
```

Expected `npm test`: 36 files / 357 tests (336 baseline + Task 1's 8 + Task 2's 13).

---

### Task 3: Compose the total and apply the safety cap

**Files:**
- Modify: `src/scoring/projection.ts` (the `ScoreProjection` interface and `projectScore`)
- Modify: `tests/fixtures/l04-score-debrief-golden.json` (regenerate — the only fixture allowed to change)
- Test: `tests/unit/score-total.test.ts`

**Interfaces:**
- Consumes: `computeL04Components`, `ScoreComponent` from `./components.js`; `SAFETY_CAP_RATIO`, `SCORE_CONTRACT_VERSION` from `./score-contract.js`
- Produces: the widened `ScoreProjection` (below), unchanged `projectScore` signature so `src/main.ts:399` keeps working

- [ ] **Step 1: Widen the projection type**

In `src/scoring/projection.ts`, replace the `ScoreProjection` interface with:

```ts
export interface ScoreProjection {
  status: 'unavailable_pending_validation' | 'blocked_by_safety_contract'
        | 'draft_causal_checkpoint_recorded' | 'declared_synthetic_unvalidated';
  safety: 'clear' | 'blocked';
  total_points: number;
  causal_event_ids: readonly string[];
  /** Present only on the L04 scored path; absent everywhere else so no other golden fixture moves. */
  components?: readonly ScoreComponent[];
  points_possible?: number;
  score_contract_version?: typeof SCORE_CONTRACT_VERSION;
  safety_cap?: Readonly<{ level: 'caution' | 'danger'; ratio: number; causal_event_ids: readonly string[] }>;
}
```

Add the imports at the top of the file:

```ts
import { computeL04Components, type ScoreComponent } from './components.js';
import { SAFETY_CAP_RATIO, SCORE_CONTRACT_VERSION } from './score-contract.js';
```

- [ ] **Step 2: Write the failing test**

Create `tests/unit/score-total.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { advanceLogicalTick, createSession, type DeterministicSession } from '../../src/sim/session.js';
import { l04ReplayBindings } from '../../src/content/l02-l05.js';
import { l01ReplayBindings } from '../../src/content/l01.js';
import { projectScore } from '../../src/scoring/projection.js';

function l04Session(seed: string): DeterministicSession {
  return createSession({ ...l04ReplayBindings, seed, ordered_input_log: [] } as never);
}

describe('L04 total points', () => {
  it('reports a non-zero total with a 75 point denominator', () => {
    const session = l04Session('total-basic');
    const score = projectScore(session.raw, session.ledger);
    expect(score.status).toBe('declared_synthetic_unvalidated');
    expect(score.points_possible).toBe(75);
    expect(score.total_points).toBeGreaterThan(0);
    expect(Number.isInteger(score.total_points)).toBe(true);
  });

  it('excludes the unavailable observation component from the denominator', () => {
    const session = l04Session('total-denom');
    const score = projectScore(session.raw, session.ledger);
    const observation = score.components!.find((component) => component.key === 'observation')!;
    expect(observation.status).toBe('declared-unavailable');
    expect(score.points_possible).toBe(
      score.components!.reduce((sum, component) => sum + component.points_possible, 0),
    );
  });

  it('never exceeds the points it declares possible', () => {
    let session = l04Session('total-cap');
    for (let tick = 0; tick < 12; tick += 1) session = advanceLogicalTick(session);
    const score = projectScore(session.raw, session.ledger);
    expect(score.total_points).toBeLessThanOrEqual(score.points_possible!);
  });

  it('caps the total when a danger clearance was recorded, so other components cannot offset it', () => {
    const session = l04Session('total-danger');
    const dangerRaw = { ...session.raw, highest_clearance_alert: 'danger' as const };
    const score = projectScore(dangerRaw, session.ledger);
    expect(score.safety_cap?.level).toBe('danger');
    // 0.4 * 75 = 30, floored.
    expect(score.total_points).toBeLessThanOrEqual(30);
  });

  it('declares the contract version it scored under', () => {
    const session = l04Session('total-version');
    const score = projectScore(session.raw, session.ledger);
    expect(score.score_contract_version).toBe('score-contract-v0-draft');
  });

  it('leaves a non-L04 lesson at zero with no component fields at all', () => {
    const session = createSession({ ...l01ReplayBindings, seed: 'total-l01', ordered_input_log: [] } as never);
    const score = projectScore(session.raw, session.ledger);
    expect(score.total_points).toBe(0);
    expect(score.components).toBeUndefined();
    expect(score.points_possible).toBeUndefined();
  });
});
```

**If `l01ReplayBindings` is not exported from `src/content/l02-l05.js`,** import the L01 bindings from wherever `tests/unit/projection.test.ts` gets them and mirror that import — do not invent a new export.

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run tests/unit/score-total.test.ts`
Expected: FAIL — status is `draft_causal_checkpoint_recorded`, `points_possible` undefined

- [ ] **Step 4: Implement the composition**

Replace the body of `projectScore` in `src/scoring/projection.ts` with:

```ts
export function projectScore(raw: RawSimulationState, ledger: readonly LedgerEvent[]): ScoreProjection {
  const safetyEvent = ledger.find((event) => event.type === 'SAFETY_BLOCKED');
  if (safetyEvent) {
    // Unchanged shape: a blocked contract is not scored at all.
    return Object.freeze({
      status: 'blocked_by_safety_contract',
      safety: 'blocked',
      total_points: 0,
      causal_event_ids: Object.freeze([safetyEvent.id]),
    });
  }

  if (raw.lesson_id === 'L04') return scoreL04(raw, ledger);

  const checkpoints = ledger.filter((event) => event.type === 'LESSON_CHECKPOINT');
  if (checkpoints.length > 0) return Object.freeze({ status: 'draft_causal_checkpoint_recorded', safety: 'clear', total_points: 0, causal_event_ids: Object.freeze(checkpoints.map((event) => event.id)) });
  return Object.freeze({
    status: 'unavailable_pending_validation',
    safety: 'clear',
    total_points: 0,
    causal_event_ids: Object.freeze(ledger.filter((event) => event.type === 'ACTION_ACCEPTED').map((event) => event.id)),
  });
}

/**
 * The safety cap is a ceiling rather than a deduction on purpose: a deduction
 * can be paid off by scoring well elsewhere, and PRD 7.3 forbids speed or
 * progress from offsetting a safety violation.
 */
function scoreL04(raw: RawSimulationState, ledger: readonly LedgerEvent[]): ScoreProjection {
  const components = computeL04Components(raw, ledger);
  const pointsPossible = components.reduce((sum, component) => sum + component.points_possible, 0);
  const earned = components.reduce((sum, component) => sum + component.points, 0);

  const severity = raw.highest_clearance_alert ?? 'clear';
  const capLevel = severity === 'danger' ? 'danger' : severity === 'caution' ? 'caution' : undefined;
  const capped = capLevel === undefined
    ? earned
    : Math.min(earned, Math.floor(SAFETY_CAP_RATIO[capLevel] * pointsPossible));

  const safetyComponent = components.find((component) => component.key === 'safety');
  return Object.freeze({
    status: 'declared_synthetic_unvalidated',
    safety: 'clear',
    total_points: capped,
    points_possible: pointsPossible,
    score_contract_version: SCORE_CONTRACT_VERSION,
    components,
    ...(capLevel === undefined ? {} : {
      safety_cap: Object.freeze({
        level: capLevel,
        ratio: SAFETY_CAP_RATIO[capLevel],
        causal_event_ids: safetyComponent?.causal_event_ids ?? Object.freeze([]),
      }),
    }),
    causal_event_ids: Object.freeze(components.flatMap((component) => [...component.causal_event_ids])),
  });
}
```

- [ ] **Step 5: Run the new test**

Run: `npx vitest run tests/unit/score-total.test.ts`
Expected: PASS — 6 tests

- [ ] **Step 6: Regenerate the one fixture that must change**

Run: `npx vitest run tests/unit/projection.test.ts`
Expected: FAIL on the L04 golden comparison only.

**The correct new value is derivable in advance — do not simply paste what the test prints.**

`tests/fixtures/l04-raw-golden.json` has `terminal_ticks: 1` and exactly two inputs,
`helm_port` then `helm_starboard`, and the existing golden records their causal event ids
as `["0:1:2", "0:2:4"]` — both on tick 0. Working the contract through by hand:

| Component | Derivation | Points |
|---|---|---|
| observation | no evidence source | 0 of 0 (`declared-unavailable`) |
| judgment | 2 corrections, both tick 0 → 1 distinct tick × 10 | 10 of 25 |
| control_stability | port → starboard = 1 reversal → 25 − 5 | 20 of 25 |
| safety | `highest_clearance_alert` is `clear` | 25 of 25 |
| goal | the mark is 600 m away; 1 tick cannot reach it | 0 of 25 |

So the expected result is **`total_points: 55`, `points_possible: 75`**, `status:
'declared_synthetic_unvalidated'`, no `safety_cap` key.

Update the `score` block of `tests/fixtures/l04-score-debrief-golden.json` to that value.

**If the test prints anything other than 55 of 75, stop and report — do not paste the
observed number.** A golden fixture that records a bug is worse than a failing test, and
this is exactly the situation where a worker is tempted to make the test green by
enshrining whatever the code happened to produce. The `debrief_fact_kinds` array in that
file must not change at all; scoring does not touch debrief facts.

- [ ] **Step 7: Run the full verification**

```bash
npm run typecheck
npm test
npm run build
git diff --name-only tests/fixtures/   # must print ONLY l04-score-debrief-golden.json
```

Expected: all green; 37 files / 363 tests. The three pre-existing `total_points: 0` assertions must still pass **without being edited** — if any of them fails, the non-L04 path was changed and must be restored.

- [ ] **Step 8: Commit**

```bash
git add src/scoring/projection.ts tests/unit/score-total.test.ts tests/fixtures/l04-score-debrief-golden.json
git commit -m "feat(scoring): total L04 points with a non-offsettable safety cap"
```

---

### Task 4: Show the score with its boundary

**Files:**
- Modify: `src/main.ts:419-421` (the debrief score line)
- Test: `tests/smoke/app.spec.ts` (add one case)

**Interfaces:**
- Consumes: the widened `ScoreProjection` from Task 3; `SCORE_BOUNDARY_TEXT` from `./scoring/score-contract.js`

- [ ] **Step 1: Replace the score line**

`src/main.ts:419-421` currently reads:

```ts
    const scoreItem = document.createElement('li');
    scoreItem.textContent = `Score status: ${score.status}; no validated numeric score is claimed.`;
    debrief.append(scoreItem);
```

Replace with:

```ts
    const scoreItem = document.createElement('li');
    scoreItem.id = 'score-line';
    scoreItem.textContent = score.points_possible === undefined
      ? `Score status: ${score.status}; this lesson declares no scored components.`
      : `Synthetic score ${score.total_points} of ${score.points_possible}` +
        (score.safety_cap ? ` — capped at ${Math.round(score.safety_cap.ratio * 100)}% by a recorded ${score.safety_cap.level} under-keel clearance crossing, which no other component can offset` : '') +
        `. ${SCORE_BOUNDARY_TEXT}`;
    debrief.append(scoreItem);

    for (const component of score.components ?? []) {
      const componentItem = document.createElement('li');
      componentItem.textContent = component.status === 'declared-unavailable'
        ? `${component.key}: declared unavailable — this lesson records no evidence for it, so it is not scored.`
        : `${component.key}: ${component.points} of ${component.points_possible}, from ${component.causal_event_ids.length} recorded event(s).`;
      debrief.append(componentItem);
    }
```

Add to the imports at the top of `src/main.ts`:

```ts
import { SCORE_BOUNDARY_TEXT } from './scoring/score-contract.js';
```

- [ ] **Step 2: Add smoke coverage**

Add to `tests/smoke/app.spec.ts`:

```ts
test('shows a synthetic L04 score with its unvalidated boundary and component breakdown', async ({ page }) => {
  await page.goto('/');
  await startSession(page, 'L04');
  for (let index = 0; index < 6; index += 1) await page.keyboard.press('ArrowRight');
  await page.waitForTimeout(600);
  const scoreLine = page.locator('#score-line');
  await expect(scoreLine).toContainText('Synthetic score');
  await expect(scoreLine).toContainText('of 75');
  await expect(scoreLine).toContainText('not an assessment of real sailing competence');
  await expect(page.getByText(/observation: declared unavailable/)).toBeVisible();
});
```

**If the debrief is not visible until a debrief control is used,** mirror whatever `startSession` and the existing L04 debrief smoke test at `tests/smoke/app.spec.ts` do to reach it rather than inventing a new selector.

- [ ] **Step 3: Run the full verification**

```bash
npm run typecheck
npm test
npm run build
npm run test:smoke
git diff --name-only tests/fixtures/   # must print ONLY l04-score-debrief-golden.json
```
Expected: all green; smoke 26/26.

- [ ] **Step 4: Commit**

```bash
git add src/main.ts tests/smoke/app.spec.ts
git commit -m "feat(scoring): show the synthetic total and its component breakdown"
```

---

### Task 5: Record the scoring in the status documents

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
- Remove the line claiming `total_points` remains 0, and replace it with what is now true: L04 scores four of five components against a 75-point denominator under `score-contract-v0-draft`; observation is declared unavailable because nothing records it; L01, L02, L03, L05 and L06 remain unscored at 0.
- Update the golden-fixtures row: `l04-score-debrief-golden.json` was regenerated this cycle; the other four score fixtures and all `*-raw-golden.json` are byte-identical.
- Note that the score is `declared_synthetic_unvalidated` and that computing a number does not validate the constants behind it.

- [ ] **Step 3: Update the completion matrix**

In the L04 row's debrief/scoring facet, record that `total_points` is now a real number derived from recorded ledger evidence, that each component carries its causal event ids per FR-07, and that a recorded clearance crossing caps the total so no other component can offset it. Keep the `DECLARED_SYNTHETIC_ONLY` status — scoring a value does not validate it. Do not touch the L01, L02, L03, L05 or L06 rows.

- [ ] **Step 4: Verify and commit**

```bash
npm test
git diff --name-only    # only the two documentation files
git add docs/PROJECT_STATUS.md docs/architecture/training-ground-completion-matrix.md
git commit -m "docs: record the five-component scoring"
```

---

## Completion criteria

- [ ] `npm run typecheck`, `npm test`, `npm run build`, `npm run test:smoke` all pass
- [ ] `git diff --name-only tests/fixtures/` prints only `l04-score-debrief-golden.json` across the whole branch
- [ ] The three pre-existing `total_points: 0` assertions still pass and were never edited
- [ ] An L04 session reports a non-zero integer `total_points` out of 75
- [ ] Every scored component carries the ids of the events that produced it
- [ ] A `danger` clearance crossing caps the total at 30 even when every other component is full
- [ ] L01, L02, L03, L05 and L06 return `total_points: 0` with no `components` field at all
- [ ] The rendered score line always carries the declared-synthetic, unvalidated boundary text
