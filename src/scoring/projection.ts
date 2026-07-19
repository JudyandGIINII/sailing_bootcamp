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

export interface L04TraceEvidence {
  readonly label: 'Recoverable synthetic mark miss runtime evidence' | 'Slower valid synthetic correction runtime evidence';
  readonly status: 'recorded' | 'unavailable_no_runtime_record';
  readonly event_id?: string;
  readonly recorded_cause?: string;
}

export interface L04RuntimeTraceProjection {
  readonly static_declaration: {
    readonly heading: 'L04 static lesson-manifest declarations';
    readonly status: 'declared_synthetic';
    readonly mark_relation_label: 'Declared virtual mark relation declaration';
    readonly helm_action_label: 'Registered L04 helm action declarations';
  };
  readonly runtime_evidence: {
    readonly heading: 'L04 runtime evidence';
    readonly miss: L04TraceEvidence;
    readonly correction: L04TraceEvidence;
  };
  readonly boundary_copy: 'Simulation-only runtime evidence. Unvalidated content. Not navigation or safety guidance.';
}

export interface L02TraceEvidence {
  readonly label: 'Recorded main trim action evidence' | 'Recorded jib trim action evidence' | 'Recorded synthetic trim causality evidence';
  readonly status: 'recorded' | 'unavailable_no_runtime_record';
  /** Sorted only for deterministic presentation; this is not runtime event order. */
  readonly record_ids?: readonly string[];
  readonly recorded_cause?: 'main/jib synthetic trim causality recorded';
}

export interface L02RuntimeTraceProjection {
  readonly static_declaration: {
    readonly heading: 'L02 static lesson-manifest declarations';
    readonly status: 'declared_synthetic';
    readonly trim_feedback_label: 'Declared synthetic trim feedback declaration';
    readonly trim_actions_label: 'Registered L02 trim action declarations';
  };
  readonly runtime_evidence: {
    readonly heading: 'L02 browser-local synthetic recorded evidence';
    readonly main_action: L02TraceEvidence;
    readonly jib_action: L02TraceEvidence;
    readonly checkpoint: L02TraceEvidence;
  };
  readonly boundary_copy: 'Browser-local synthetic recorded evidence only. It is not trim, performance, or safety advice.';
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

function l02TraceEvidence(
  label: L02TraceEvidence['label'],
  matchingEvents: readonly LedgerEvent[],
  recordedCause?: L02TraceEvidence['recorded_cause'],
): L02TraceEvidence {
  if (matchingEvents.length === 0) return Object.freeze({ label, status: 'unavailable_no_runtime_record' });
  const recordIds = Object.freeze(matchingEvents.map((event) => event.id).sort());
  return Object.freeze({ label, status: 'recorded', record_ids: recordIds, ...(recordedCause ? { recorded_cause: recordedCause } : {}) });
}

/**
 * L02 display-only evidence. Each entry is read from its own exact immutable
 * ledger record; raw trim state, record adjacency, and record order establish
 * neither evidence nor causality.
 */
export function projectL02RuntimeTrace(
  raw: RawSimulationState,
  ledger: readonly LedgerEvent[],
): L02RuntimeTraceProjection | undefined {
  if (raw.lesson_id !== 'L02') return undefined;

  const manifest = getLessonManifest('L02');
  if (!manifest || manifest.lesson_id !== 'L02') return undefined;
  const hasDeclaredTrimFeedback = manifest.required_observations.some((observation) => observation.key === 'declared_trim_feedback' && observation.status === 'declared_synthetic');
  const hasRegisteredTrimActions = manifest.permitted_actions.includes('main_trim') && manifest.permitted_actions.includes('jib_trim');
  if (!hasDeclaredTrimFeedback || !hasRegisteredTrimActions) return undefined;

  return Object.freeze({
    static_declaration: Object.freeze({
      heading: 'L02 static lesson-manifest declarations',
      status: 'declared_synthetic',
      trim_feedback_label: 'Declared synthetic trim feedback declaration',
      trim_actions_label: 'Registered L02 trim action declarations',
    }),
    runtime_evidence: Object.freeze({
      heading: 'L02 browser-local synthetic recorded evidence',
      main_action: l02TraceEvidence(
        'Recorded main trim action evidence',
        ledger.filter((event) => event.type === 'ACTION_ACCEPTED' && event.action === 'main_trim'),
      ),
      jib_action: l02TraceEvidence(
        'Recorded jib trim action evidence',
        ledger.filter((event) => event.type === 'ACTION_ACCEPTED' && event.action === 'jib_trim'),
      ),
      checkpoint: l02TraceEvidence(
        'Recorded synthetic trim causality evidence',
        ledger.filter((event) => event.type === 'LESSON_CHECKPOINT' && event.lesson_id === 'L02' && event.cause === 'main/jib synthetic trim causality recorded'),
        'main/jib synthetic trim causality recorded',
      ),
    }),
    boundary_copy: 'Browser-local synthetic recorded evidence only. It is not trim, performance, or safety advice.',
  });
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

function l04TraceEvidence(
  label: L04TraceEvidence['label'],
  event: LedgerEvent | undefined,
): L04TraceEvidence {
  return event
    ? Object.freeze({ label, status: 'recorded', event_id: event.id, recorded_cause: event.cause })
    : Object.freeze({ label, status: 'unavailable_no_runtime_record' });
}

/**
 * L04 display-only evidence. Each entry comes only from its own explicit L04
 * checkpoint cause; static declarations and raw state do not establish it.
 */
export function projectL04RuntimeTrace(
  raw: RawSimulationState,
  ledger: readonly LedgerEvent[],
): L04RuntimeTraceProjection | undefined {
  if (raw.lesson_id !== 'L04') return undefined;

  const manifest = getLessonManifest('L04');
  if (!manifest || manifest.lesson_id !== 'L04') return undefined;
  const hasDeclaredMarkRelation = manifest.required_observations.some((observation) => observation.key === 'declared_mark_relation' && observation.status === 'declared_synthetic');
  const hasRegisteredHelmActions = manifest.permitted_actions.includes('helm_port') && manifest.permitted_actions.includes('helm_starboard');
  if (!hasDeclaredMarkRelation || !hasRegisteredHelmActions) return undefined;

  return Object.freeze({
    static_declaration: Object.freeze({
      heading: 'L04 static lesson-manifest declarations',
      status: 'declared_synthetic',
      mark_relation_label: 'Declared virtual mark relation declaration',
      helm_action_label: 'Registered L04 helm action declarations',
    }),
    runtime_evidence: Object.freeze({
      heading: 'L04 runtime evidence',
      miss: l04TraceEvidence(
        'Recoverable synthetic mark miss runtime evidence',
        ledger.find((event) => event.type === 'LESSON_CHECKPOINT' && event.lesson_id === 'L04' && event.cause === 'recoverable synthetic mark miss recorded'),
      ),
      correction: l04TraceEvidence(
        'Slower valid synthetic correction runtime evidence',
        ledger.find((event) => event.type === 'LESSON_CHECKPOINT' && event.lesson_id === 'L04' && event.cause === 'slower valid synthetic correction recorded'),
      ),
    }),
    boundary_copy: 'Simulation-only runtime evidence. Unvalidated content. Not navigation or safety guidance.',
  });
}
