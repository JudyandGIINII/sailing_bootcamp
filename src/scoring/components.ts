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
import { HELM_CORRECTION_CAUSE, l05DecisionCause, type LedgerEvent, type RawSimulationState } from '../sim/session.js';
import {
  COMPONENT_MAX_POINTS,
  CONTROL_PENALTY_PER_REVERSAL,
  JUDGMENT_POINTS_PER_CORRECTION,
  LESSON_SCORE_PROFILES,
  SAFETY_COMPONENT_POINTS,
  type SafetySeverity,
  type JudgmentEvidence,
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
  // contributes at most one correction however many events it recorded.
  const distinctTicks = new Set(matches.map((event) => event.tick));
  const points = Math.min(
    COMPONENT_MAX_POINTS.judgment,
    distinctTicks.size * JUDGMENT_POINTS_PER_CORRECTION,
  );
  return scored('judgment', points, matches.map((event) => event.id));
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
