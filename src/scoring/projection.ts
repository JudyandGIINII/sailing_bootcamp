import type { LedgerEvent, RawSimulationState } from '../sim/session.js';
import { getLessonManifest } from '../content/lesson-manifest.js';

export interface ScoreProjection {
  status: 'unavailable_pending_validation' | 'blocked_by_safety_contract' | 'draft_causal_checkpoint_recorded';
  safety: 'clear' | 'blocked';
  total_points: 0;
  causal_event_ids: readonly string[];
}

export interface DebriefFact {
  id: string;
  kind: 'action_recorded' | 'contract_status' | 'safety_blocked' | 'lesson_checkpoint' | 'environment_episode';
  cause_event_id?: string;
  contract_status?: RawSimulationState['contract_status'];
}

export interface L03TraceEvidence {
  readonly label: 'Synthetic episode evidence' | 'Registered reef action evidence' | 'Declared checkpoint evidence';
  readonly status: 'recorded' | 'unavailable_no_runtime_record';
  readonly event_id?: string;
  readonly recorded_cause?: string;
}

export interface L03RuntimeTraceProjection {
  readonly static_declaration: {
    readonly heading: 'Static lesson-manifest declaration';
    readonly status: 'declared_synthetic';
    readonly episode_label: 'Synthetic gust/wave episode declaration';
    readonly reef_action_label: 'Registered reef action declaration';
  };
  readonly runtime_trace: {
    readonly heading: 'Current runtime trace';
    readonly episode: L03TraceEvidence;
    readonly reef_action: L03TraceEvidence;
    readonly checkpoint: L03TraceEvidence;
  };
  readonly boundary_copy: 'Simulation-only runtime trace. Unvalidated content. Not navigation or safety guidance.';
}

/** Pure projections: no values are written back to the canonical state or ledger. */
export function projectScore(_raw: RawSimulationState, ledger: readonly LedgerEvent[]): ScoreProjection {
  const safetyEvent = ledger.find((event) => event.type === 'SAFETY_BLOCKED');
  if (safetyEvent) {
    return Object.freeze({
      status: 'blocked_by_safety_contract',
      safety: 'blocked',
      total_points: 0,
      causal_event_ids: Object.freeze([safetyEvent.id]),
    });
  }
  const checkpoints = ledger.filter((event) => event.type === 'LESSON_CHECKPOINT');
  if (checkpoints.length > 0) return Object.freeze({ status: 'draft_causal_checkpoint_recorded', safety: 'clear', total_points: 0, causal_event_ids: Object.freeze(checkpoints.map((event) => event.id)) });
  return Object.freeze({
    status: 'unavailable_pending_validation',
    safety: 'clear',
    total_points: 0,
      causal_event_ids: Object.freeze(ledger.filter((event) => event.type === 'ACTION_ACCEPTED').map((event) => event.id)),
  });
}

export function projectDebrief(raw: RawSimulationState, ledger: readonly LedgerEvent[]): readonly DebriefFact[] {
  const facts: DebriefFact[] = [
    { id: 'contract-status', kind: 'contract_status', contract_status: raw.contract_status },
  ];
  const seen = new Set<string>();
  for (const event of ledger) {
    if (seen.has(event.id)) continue;
    seen.add(event.id);
    if (event.type === 'SAFETY_BLOCKED') facts.push({ id: `safety:${event.id}`, kind: 'safety_blocked', cause_event_id: event.id });
    if (event.type === 'ACTION_ACCEPTED') facts.push({ id: `action:${event.id}`, kind: 'action_recorded', cause_event_id: event.id });
    if (event.type === 'LESSON_CHECKPOINT') facts.push({ id: `checkpoint:${event.id}`, kind: 'lesson_checkpoint', cause_event_id: event.id });
    if (event.type === 'ENVIRONMENT_EPISODE') facts.push({ id: `episode:${event.id}`, kind: 'environment_episode', cause_event_id: event.id });
  }
  return Object.freeze(facts.map((fact) => Object.freeze(fact)));
}

function traceEvidence(
  label: L03TraceEvidence['label'],
  event: LedgerEvent | undefined,
): L03TraceEvidence {
  return event
    ? Object.freeze({ label, status: 'recorded', event_id: event.id, ...(event.cause ? { recorded_cause: event.cause } : {}) })
    : Object.freeze({ label, status: 'unavailable_no_runtime_record' });
}

/**
 * L03 display-only evidence. Static manifest declarations and runtime ledger
 * records remain separate so no event or causal relationship is inferred.
 */
export function projectL03RuntimeTrace(
  raw: RawSimulationState,
  ledger: readonly LedgerEvent[],
): L03RuntimeTraceProjection | undefined {
  if (raw.lesson_id !== 'L03') return undefined;

  const manifest = getLessonManifest('L03');
  if (!manifest || manifest.lesson_id !== 'L03') return undefined;
  const hasDeclaredEpisode = manifest?.required_observations.some((observation) => observation.key === 'gust_wave_cue' && observation.status === 'declared_synthetic') ?? false;
  const hasRegisteredReefAction = manifest?.permitted_actions.includes('reef') ?? false;
  if (!hasDeclaredEpisode || !hasRegisteredReefAction) return undefined;

  return Object.freeze({
    static_declaration: Object.freeze({
      heading: 'Static lesson-manifest declaration',
      status: 'declared_synthetic',
      episode_label: 'Synthetic gust/wave episode declaration',
      reef_action_label: 'Registered reef action declaration',
    }),
    runtime_trace: Object.freeze({
      heading: 'Current runtime trace',
      episode: traceEvidence('Synthetic episode evidence', ledger.find((event) => event.type === 'ENVIRONMENT_EPISODE' && event.lesson_id === 'L03')),
      reef_action: traceEvidence('Registered reef action evidence', ledger.find((event) => event.type === 'ACTION_ACCEPTED' && event.action === 'reef')),
      checkpoint: traceEvidence('Declared checkpoint evidence', ledger.find((event) => event.type === 'LESSON_CHECKPOINT' && event.lesson_id === 'L03')),
    }),
    boundary_copy: 'Simulation-only runtime trace. Unvalidated content. Not navigation or safety guidance.',
  });
}
