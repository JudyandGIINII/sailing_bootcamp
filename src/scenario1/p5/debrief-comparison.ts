import { createP4Attempt, P4_PUBLIC_SEED, reduceP4Attempt, type P4AttemptState, type P4UserRecord } from '../p4/in-memory-attempt.js';
import { P4_BINDING_DISCRIMINATOR, deriveP4BindingProfile, type P4BindingProfile } from '../p4/binding-contract.js';
import { verifyP4Attempt } from '../p4/in-memory-verifier.js';
import type { P2Controls, P2TargetProfile } from '../p2/deterministic-mechanics.js';
import { P3_SCORE_WEIGHTS, P3_TOTAL_WEIGHT, type P3AvailableScore, type P3Contributors, type P3ScoreResult } from '../p3/deterministic-scoring.js';

export type P5ActionTraceRecord = P4UserRecord;

export interface P5TerminalSnapshot {
  readonly seed: typeof P4_PUBLIC_SEED;
  readonly binding: P4BindingProfile;
  readonly target: P2TargetProfile;
  readonly controls: P2Controls;
  readonly score: P3ScoreResult;
  readonly contributors?: P3Contributors;
  readonly terminal_logical_tick: number;
  readonly terminal_sequence: number;
  /** Logical-order associations only; these records are never score inputs. */
  readonly action_trace: readonly P5ActionTraceRecord[];
}

export interface P5ComparisonHistory {
  readonly attempts: readonly P5TerminalSnapshot[];
}

export type P5TerminalSnapshotResult =
  | Readonly<{ readonly status: 'eligible'; readonly snapshot: P5TerminalSnapshot }>
  | Readonly<{ readonly status: 'rejected_not_terminal' | 'rejected_ineligible' }>;

export interface P5ScoreDifference {
  readonly score: number;
  readonly sail_wind_fit_q: number;
  readonly course_q: number;
  readonly propulsion_q: number;
  readonly propulsion_penalty: number;
}

export interface P5ValueComparison<T> {
  readonly previous: T;
  readonly current: T;
  readonly status: 'changed' | 'unchanged';
}

export interface P5AvailableComparison {
  readonly status: 'available';
  readonly previous: P5TerminalSnapshot;
  readonly current: P5TerminalSnapshot;
  /** Every field is current minus previous; no P2/P3 value is recalculated. */
  readonly difference: P5ScoreDifference;
  readonly target: P5ValueComparison<P2TargetProfile>;
  readonly controls: P5ValueComparison<P2Controls>;
  readonly action_trace: Readonly<{
    readonly previous: readonly P5ActionTraceRecord[];
    readonly current: readonly P5ActionTraceRecord[];
    readonly association: 'canonical logical-order association only; not validated physical causation';
  }>;
}

export type P5Comparison =
  | Readonly<{ readonly status: 'no_prior_same_condition' }>
  | P5AvailableComparison;

export interface P5Debrief {
  readonly current: P5TerminalSnapshot;
  readonly comparison: P5Comparison;
}

export type P5CaptureResult =
  | Readonly<{ readonly status: 'captured'; readonly history: P5ComparisonHistory; readonly debrief: P5Debrief }>
  | Readonly<{ readonly status: 'rejected_not_terminal' | 'rejected_ineligible' | 'rejected_incompatible_history'; readonly history: P5ComparisonHistory }>;

function sameBinding(left: P4BindingProfile, right: P4BindingProfile): boolean {
  return left.binding_discriminator === right.binding_discriminator &&
    left.profile_id === right.profile_id && left.profile_version === right.profile_version &&
    left.scoring_contract_version === right.scoring_contract_version && left.scenario_seed === right.scenario_seed &&
    left.ordinal === right.ordinal && left.synthetic_target_heading_centidegrees === right.synthetic_target_heading_centidegrees &&
    left.propulsion_context === right.propulsion_context &&
    left.sail_targets.main_deployed === right.sail_targets.main_deployed && left.sail_targets.jib_deployed === right.sail_targets.jib_deployed &&
    left.sail_targets.main_trim === right.sail_targets.main_trim && left.sail_targets.jib_trim === right.sail_targets.jib_trim &&
    left.sail_targets.main_reef_level === right.sail_targets.main_reef_level && left.sail_targets.jib_reef_level === right.sail_targets.jib_reef_level;
}

function sameTarget(left: P2TargetProfile, right: P2TargetProfile): boolean {
  return left.profileVersion === right.profileVersion && left.scenarioSeed === right.scenarioSeed && left.ordinal === right.ordinal &&
    left.headingCentidegrees === right.headingCentidegrees && left.mainTrim === right.mainTrim && left.jibTrim === right.jibTrim &&
    left.mainReefLevel === right.mainReefLevel && left.jibReefLevel === right.jibReefLevel;
}

function sameControls(left: P2Controls, right: P2Controls): boolean {
  return left.headingCentidegrees === right.headingCentidegrees && left.engineOutput === right.engineOutput &&
    left.mainDeployed === right.mainDeployed && left.jibDeployed === right.jibDeployed && left.mainTrim === right.mainTrim &&
    left.jibTrim === right.jibTrim && left.mainReefLevel === right.mainReefLevel && left.jibReefLevel === right.jibReefLevel &&
    left.autopilotEnabled === right.autopilotEnabled;
}

function sameContributors(left: P3Contributors, right: P3Contributors): boolean {
  return left.sail_wind_fit_q === right.sail_wind_fit_q && left.course_q === right.course_q &&
    left.propulsion_q === right.propulsion_q && left.propulsion_penalty === right.propulsion_penalty &&
    left.weights.sail_wind_fit === right.weights.sail_wind_fit && left.weights.course_control === right.weights.course_control &&
    left.weights.propulsion_context === right.weights.propulsion_context;
}

function exactObject(value: unknown, keys: readonly string[]): Record<string, unknown> | undefined {
  try {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) return undefined;
    const object = value as object;
    const ownKeys = Reflect.ownKeys(object);
    if (ownKeys.length !== keys.length || ownKeys.some((key) => typeof key !== 'string' || !keys.includes(key))) return undefined;
    const copy: Record<string, unknown> = {};
    for (const key of keys) {
      const descriptor = Object.getOwnPropertyDescriptor(object, key);
      if (!descriptor || !Object.hasOwn(descriptor, 'value')) return undefined;
      copy[key] = descriptor.value;
    }
    return copy;
  } catch {
    return undefined;
  }
}

function exactTarget(value: unknown, expected: P2TargetProfile): value is P2TargetProfile {
  const candidate = exactObject(value, ['profileVersion', 'scenarioSeed', 'ordinal', 'headingCentidegrees', 'mainTrim', 'jibTrim', 'mainReefLevel', 'jibReefLevel']);
  return !!candidate && Object.keys(expected).every((key) => candidate[key] === expected[key as keyof P2TargetProfile]);
}

function exactControls(value: unknown, expected: P2Controls): value is P2Controls {
  const candidate = exactObject(value, ['headingCentidegrees', 'engineOutput', 'mainDeployed', 'jibDeployed', 'mainTrim', 'jibTrim', 'mainReefLevel', 'jibReefLevel', 'autopilotEnabled']);
  return !!candidate && Object.keys(expected).every((key) => candidate[key] === expected[key as keyof P2Controls]);
}

function exactBinding(value: unknown, expected: P4BindingProfile): value is P4BindingProfile {
  const candidate = exactObject(value, ['binding_discriminator', 'profile_id', 'profile_version', 'scoring_contract_version', 'scenario_seed', 'ordinal', 'synthetic_target_heading_centidegrees', 'propulsion_context', 'sail_targets']);
  const sailTargets = candidate && exactObject(candidate.sail_targets, ['main_deployed', 'jib_deployed', 'main_trim', 'jib_trim', 'main_reef_level', 'jib_reef_level']);
  return !!candidate && !!sailTargets && sameBinding(value as P4BindingProfile, expected);
}

/**
 * P5 retains only P4's user-level action associations. Replaying those canonical
 * records gives the sole authoritative P2 target and controls for a snapshot.
 */
function reconstructedTerminal(snapshot: P5TerminalSnapshot): P4AttemptState | undefined {
  let replay = createP4Attempt(snapshot.seed);
  for (const record of snapshot.action_trace) {
    const reduction = reduceP4Attempt(replay, record);
    if (reduction.status !== 'accepted') return undefined;
    replay = reduction.state;
  }
  return replay.p3_state.terminal ? replay : undefined;
}

/** Exact P5 comparison condition: seed, P4 binding identity, and P2 target all agree. */
function sameCondition(left: P5TerminalSnapshot, right: P5TerminalSnapshot): boolean {
  return left.seed === right.seed && sameBinding(left.binding, right.binding) && sameTarget(left.target, right.target);
}

function availableScore(value: P3ScoreResult): value is P3AvailableScore {
  return value.score_status === 'available';
}

function isP3NonNegativeSafeInteger(value: unknown, maximum: number): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && !Object.is(value, -0) && value >= 0 && value <= maximum;
}

function validP3Contributors(value: unknown): value is P3Contributors {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const contributors = value as P3Contributors;
  return isP3NonNegativeSafeInteger(contributors.sail_wind_fit_q, P3_TOTAL_WEIGHT) &&
    isP3NonNegativeSafeInteger(contributors.course_q, P3_TOTAL_WEIGHT) &&
    isP3NonNegativeSafeInteger(contributors.propulsion_q, P3_TOTAL_WEIGHT) &&
    isP3NonNegativeSafeInteger(contributors.propulsion_penalty, P3_TOTAL_WEIGHT) &&
    typeof contributors.weights === 'object' && contributors.weights !== null &&
    contributors.weights.sail_wind_fit === P3_SCORE_WEIGHTS.sail_wind_fit &&
    contributors.weights.course_control === P3_SCORE_WEIGHTS.course_control &&
    contributors.weights.propulsion_context === P3_SCORE_WEIGHTS.propulsion_context;
}

function validSnapshot(value: unknown): value is P5TerminalSnapshot {
  try {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
    const snapshot = value as P5TerminalSnapshot;
    if (snapshot.seed !== P4_PUBLIC_SEED || !snapshot.binding || snapshot.binding.binding_discriminator !== P4_BINDING_DISCRIMINATOR ||
      !snapshot.target || !snapshot.controls || !snapshot.score || !Array.isArray(snapshot.action_trace) ||
      !Number.isSafeInteger(snapshot.terminal_logical_tick) || !Number.isSafeInteger(snapshot.terminal_sequence)) return false;
    if (!availableScore(snapshot.score) || !isP3NonNegativeSafeInteger(snapshot.score.score, 100) ||
      !validP3Contributors(snapshot.score.contributors) || !validP3Contributors(snapshot.contributors) ||
      !sameContributors(snapshot.contributors, snapshot.score.contributors)) return false;
    let prior: P5ActionTraceRecord | undefined;
    for (const record of snapshot.action_trace) {
      if (!record || (record.kind !== 'p2_action' && record.kind !== 'end_voyage') || !Number.isSafeInteger(record.logical_tick) || !Number.isSafeInteger(record.sequence) ||
        (prior && (record.logical_tick < prior.logical_tick || record.logical_tick === prior.logical_tick && record.sequence <= prior.sequence))) return false;
      prior = record;
    }
    if (snapshot.action_trace.at(-1)?.kind !== 'end_voyage' || snapshot.action_trace.at(-1)?.logical_tick !== snapshot.terminal_logical_tick || snapshot.action_trace.at(-1)?.sequence !== snapshot.terminal_sequence) return false;
    const replay = reconstructedTerminal(snapshot);
    const terminal = replay?.p3_state.terminal;
    return !!replay && !!terminal && exactTarget(snapshot.target, replay.p2_state.target) && exactControls(snapshot.controls, replay.p2_state.controls) &&
      exactBinding(snapshot.binding, replay.binding) && snapshot.terminal_logical_tick === terminal.terminal_logical_tick &&
      snapshot.terminal_sequence === terminal.terminal_sequence && JSON.stringify(snapshot.score) === JSON.stringify(terminal.score) &&
      JSON.stringify(snapshot.contributors) === JSON.stringify(terminal.contributors);
  } catch {
    return false;
  }
}

function validHistory(value: unknown): value is P5ComparisonHistory {
  try {
    return typeof value === 'object' && value !== null && !Array.isArray(value) && Array.isArray((value as P5ComparisonHistory).attempts) &&
      (value as P5ComparisonHistory).attempts.length <= 2 && (value as P5ComparisonHistory).attempts.every(validSnapshot) &&
      ((value as P5ComparisonHistory).attempts.length < 2 || sameCondition((value as P5ComparisonHistory).attempts[0]!, (value as P5ComparisonHistory).attempts[1]!));
  } catch {
    return false;
  }
}

/**
 * Copies only canonical plain data, then freezes every copied container. It intentionally
 * does not preserve aliases: a P5 snapshot is page-memory data, not a view of P4 state.
 */
function copyAndFreezePlainData<T>(value: T, ancestors: ReadonlySet<object> = new Set()): T {
  if (value === null || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean' || typeof value === 'undefined') return value;
  if (typeof value !== 'object') throw new TypeError('P5_NON_PLAIN_TERMINAL_VALUE');
  if (ancestors.has(value)) throw new TypeError('P5_CYCLIC_TERMINAL_VALUE');
  const nextAncestors = new Set(ancestors);
  nextAncestors.add(value);
  if (Array.isArray(value)) {
    if (Reflect.ownKeys(value).some((key) => key !== 'length' && (typeof key !== 'string' || !/^(0|[1-9][0-9]*)$/.test(key)))) {
      throw new TypeError('P5_NON_PLAIN_TERMINAL_VALUE');
    }
    return Object.freeze(value.map((entry) => copyAndFreezePlainData(entry, nextAncestors))) as T;
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) throw new TypeError('P5_NON_PLAIN_TERMINAL_VALUE');
  const copied: Record<string, unknown> = {};
  for (const key of Reflect.ownKeys(value)) {
    if (typeof key !== 'string') throw new TypeError('P5_NON_PLAIN_TERMINAL_VALUE');
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor || !Object.hasOwn(descriptor, 'value')) throw new TypeError('P5_NON_PLAIN_TERMINAL_VALUE');
    copied[key] = copyAndFreezePlainData(descriptor.value, nextAncestors);
  }
  return Object.freeze(copied) as T;
}

function freezeSnapshot(attempt: P4AttemptState): P5TerminalSnapshot {
  const terminal = attempt.p3_state.terminal;
  if (!terminal || !availableScore(terminal.score) || !terminal.contributors) throw new RangeError('P5_INELIGIBLE_TERMINAL');
  const trace = attempt.records
    .filter((record): record is P5ActionTraceRecord => record.kind === 'p2_action' || record.kind === 'end_voyage')
    .map((record) => ({ logical_tick: record.logical_tick, sequence: record.sequence, kind: record.kind, payload: record.payload }));
  return copyAndFreezePlainData({
    seed: P4_PUBLIC_SEED,
    binding: attempt.binding,
    target: attempt.p2_state.target,
    controls: attempt.p2_state.controls,
    score: terminal.score,
    contributors: terminal.contributors,
    terminal_logical_tick: terminal.terminal_logical_tick,
    terminal_sequence: terminal.terminal_sequence,
    action_trace: trace,
  });
}

/** Captures terminal P4 values verbatim; it never evaluates scoring, targets, or quality. */
export function snapshotP5TerminalAttempt(value: unknown): P5TerminalSnapshotResult {
  const verified = verifyP4Attempt(value);
  if (verified.status !== 'verified') return Object.freeze({ status: 'rejected_ineligible' });
  const attempt = verified.state;
  if (!attempt.p3_state.terminal) return Object.freeze({ status: 'rejected_not_terminal' });
  try {
    if (attempt.seed !== P4_PUBLIC_SEED || attempt.binding.binding_discriminator !== P4_BINDING_DISCRIMINATOR || !sameBinding(attempt.binding, deriveP4BindingProfile(attempt.p2_state))) {
      return Object.freeze({ status: 'rejected_ineligible' });
    }
    return Object.freeze({ status: 'eligible', snapshot: freezeSnapshot(attempt) });
  } catch {
    return Object.freeze({ status: 'rejected_ineligible' });
  }
}

export function createP5ComparisonHistory(): P5ComparisonHistory {
  return Object.freeze({ attempts: Object.freeze([]) });
}

function comparison(previous: P5TerminalSnapshot | undefined, current: P5TerminalSnapshot): P5Comparison {
  if (!previous) return Object.freeze({ status: 'no_prior_same_condition' });
  const previousScore = previous.score as P3AvailableScore;
  const currentScore = current.score as P3AvailableScore;
  const priorContributors = previousScore.contributors;
  const currentContributors = currentScore.contributors;
  return Object.freeze({
    status: 'available', previous, current,
    difference: Object.freeze({
      score: currentScore.score - previousScore.score,
      sail_wind_fit_q: currentContributors.sail_wind_fit_q - priorContributors.sail_wind_fit_q,
      course_q: currentContributors.course_q - priorContributors.course_q,
      propulsion_q: currentContributors.propulsion_q - priorContributors.propulsion_q,
      propulsion_penalty: currentContributors.propulsion_penalty - priorContributors.propulsion_penalty,
    }),
    target: Object.freeze({ previous: previous.target, current: current.target, status: sameTarget(previous.target, current.target) ? 'unchanged' : 'changed' }),
    controls: Object.freeze({ previous: previous.controls, current: current.controls, status: sameControls(previous.controls, current.controls) ? 'unchanged' : 'changed' }),
    action_trace: Object.freeze({ previous: previous.action_trace, current: current.action_trace, association: 'canonical logical-order association only; not validated physical causation' }),
  });
}

/** Retains only the last two eligible terminals for this page-memory session. */
export function captureP5TerminalAttempt(history: P5ComparisonHistory, value: unknown): P5CaptureResult {
  const snapshot = snapshotP5TerminalAttempt(value);
  if (snapshot.status !== 'eligible') return Object.freeze({ status: snapshot.status, history });
  if (!validHistory(history)) return Object.freeze({ status: 'rejected_incompatible_history', history });
  const previous = history.attempts.at(-1);
  if (previous && !sameCondition(previous, snapshot.snapshot)) return Object.freeze({ status: 'rejected_incompatible_history', history });
  const attempts = Object.freeze([...(previous ? [previous] : []), snapshot.snapshot]);
  const nextHistory = Object.freeze({ attempts });
  return Object.freeze({ status: 'captured', history: nextHistory, debrief: Object.freeze({ current: snapshot.snapshot, comparison: comparison(previous, snapshot.snapshot) }) });
}
