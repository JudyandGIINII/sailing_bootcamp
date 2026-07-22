import type { LedgerEvent, RawSimulationState } from '../sim/session.js';
import { getLessonManifest } from '../content/lesson-manifest.js';
import { projectL02SyntheticTrimObservation } from '../sim/l02-observation.js';
import type { L02SyntheticTrimObservation } from '../sim/l02-synthetic-model.js';

export interface ScoreProjection {
  status: 'unavailable_pending_validation' | 'blocked_by_safety_contract' | 'draft_causal_checkpoint_recorded';
  safety: 'clear' | 'blocked';
  total_points: 0;
  causal_event_ids: readonly string[];
}

export interface DebriefFact {
  id: string;
  kind: 'action_recorded' | 'contract_status' | 'safety_blocked' | 'lesson_checkpoint' | 'environment_episode' | 'synthetic_transition';
  cause_event_id?: string;
  contract_status?: RawSimulationState['contract_status'];
  synthetic?: true;
}

export interface L03TraceEvidence {
  readonly label: 'Synthetic cue record' | 'Synthetic acknowledgment record' | 'Synthetic checkpoint record';
  readonly status: 'recorded' | 'unavailable_no_runtime_record';
  readonly event_id?: string;
  readonly recorded_cause?: string;
}

export interface L03RuntimeTraceProjection {
  readonly static_declaration: {
    readonly heading: 'Static lesson-manifest declaration';
    readonly status: 'declared_synthetic';
    readonly episode_label: 'Declared synthetic cue';
    readonly reef_action_label: 'Declared synthetic acknowledgment';
  };
  readonly runtime_trace: {
    readonly heading: 'Current runtime trace';
    readonly episode: L03TraceEvidence;
    readonly reef_action: L03TraceEvidence;
    readonly checkpoint: L03TraceEvidence;
  };
  readonly boundary_copy: 'Synthetic acknowledgment records only. No measurement, advisory, navigation, or physical response is modeled.';
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
  readonly boundary_copy: 'Synthetic control-input acknowledgment — unvalidated. No sail, speed, stability, safety, or navigation response is modeled.';
}

/** Display projection of the immutable L02 control-input acknowledgment only. */
export function projectL02SyntheticTrimAcknowledgment(raw: RawSimulationState): L02SyntheticTrimObservation | undefined {
  return raw.lesson_id === 'L02' && raw.l02_trim_acknowledgment
    ? projectL02SyntheticTrimObservation(raw.l02_trim_acknowledgment)
    : undefined;
}

export interface L05DecisionLedgerRecordEvidence {
  readonly status: 'recorded' | 'unavailable_no_exact_matching_immutable_ledger_record';
  /** Sorted only for stable presentation; this is not temporal record order. */
  readonly record_ids?: readonly string[];
}

export interface L05DecisionLedgerProjection {
  readonly accepted_action_records: {
    readonly heading: 'Accepted-action record evidence';
    readonly pass: L05DecisionLedgerRecordEvidence;
    readonly wait: L05DecisionLedgerRecordEvidence;
    readonly return: L05DecisionLedgerRecordEvidence;
  };
  readonly checkpoint_records: {
    readonly heading: 'Checkpoint record evidence';
    readonly pass: L05DecisionLedgerRecordEvidence;
    readonly wait: L05DecisionLedgerRecordEvidence;
    readonly return: L05DecisionLedgerRecordEvidence;
  };
  readonly boundary_notice: 'Record visibility only. The labels “pass”, “wait”, and “return” reproduce synthetic training records. They are not recommendations, navigation guidance, judgments of correctness, or evidence of route, depth, tide, visibility, clearance, timing, ordering, or safety outcomes.';
  readonly ordering_notice: 'Record IDs are displayed in lexical order for stable presentation only; this order is not temporal and implies no sequence or recommendation.';
  readonly absence_notice: 'No exact matching immutable ledger record is present.';
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
  const sessionStart = ledger.find((event) => event.type === 'SESSION_STARTED');
  const facts: DebriefFact[] = [
    { id: 'contract-status', kind: 'contract_status', contract_status: sessionStart?.contract_status ?? raw.contract_status },
  ];
  const seen = new Set<string>();
  for (const event of ledger) {
    if (seen.has(event.id)) continue;
    seen.add(event.id);
    if (event.type === 'SAFETY_BLOCKED') facts.push({ id: `safety:${event.id}`, kind: 'safety_blocked', cause_event_id: event.id });
    if (event.type === 'ACTION_ACCEPTED') facts.push({ id: `action:${event.id}`, kind: 'action_recorded', cause_event_id: event.id });
    if (event.type === 'LESSON_CHECKPOINT') facts.push({ id: `checkpoint:${event.id}`, kind: 'lesson_checkpoint', cause_event_id: event.id });
    if (event.type === 'ENVIRONMENT_EPISODE') facts.push({ id: `episode:${event.id}`, kind: 'environment_episode', cause_event_id: event.id });
    if (event.type === 'L01_SYNTHETIC_TRANSITION') facts.push({ id: `synthetic-transition:${event.id}`, kind: 'synthetic_transition', cause_event_id: event.id, synthetic: true });
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
    boundary_copy: 'Synthetic control-input acknowledgment — unvalidated. No sail, speed, stability, safety, or navigation response is modeled.',
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
  const hasDeclaredCue = manifest.required_observations.some((observation) => observation.key === 'gust_wave_cue' && observation.status === 'declared_synthetic');
  const hasDeclaredAcknowledgment = manifest.required_observations.some((observation) => observation.key === 'synthetic_acknowledgment' && observation.status === 'declared_synthetic');
  if (!hasDeclaredCue || !hasDeclaredAcknowledgment || !manifest.permitted_actions.includes('reef')) return undefined;

  return Object.freeze({
    static_declaration: Object.freeze({
      heading: 'Static lesson-manifest declaration',
      status: 'declared_synthetic',
      episode_label: 'Declared synthetic cue',
      reef_action_label: 'Declared synthetic acknowledgment',
    }),
    runtime_trace: Object.freeze({
      heading: 'Current runtime trace',
      episode: traceEvidence('Synthetic cue record', ledger.find((event) => event.type === 'ENVIRONMENT_EPISODE' && event.lesson_id === 'L03' && event.cause === 'deterministic synthetic gust/wave cue')),
      reef_action: traceEvidence('Synthetic acknowledgment record', ledger.find((event) => event.type === 'ACTION_ACCEPTED' && event.action === 'reef' && event.lesson_id === undefined)),
      checkpoint: traceEvidence('Synthetic checkpoint record', ledger.find((event) => event.type === 'LESSON_CHECKPOINT' && event.lesson_id === 'L03')),
    }),
    boundary_copy: 'Synthetic acknowledgment records only. No measurement, advisory, navigation, or physical response is modeled.',
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

function l05DecisionLedgerRecordEvidence(matchingEvents: readonly LedgerEvent[]): L05DecisionLedgerRecordEvidence {
  if (matchingEvents.length === 0) {
    return Object.freeze({ status: 'unavailable_no_exact_matching_immutable_ledger_record' });
  }
  return Object.freeze({ status: 'recorded', record_ids: Object.freeze(matchingEvents.map((event) => event.id).sort()) });
}

/**
 * L05 display-only record visibility. Each collection reads only its own exact
 * immutable ledger literals; raw decision state, static context, score, and
 * record ordering are not inputs and establish neither evidence nor a
 * relationship between groups.
 */
export function projectL05DecisionLedger(
  ledger: readonly LedgerEvent[],
): L05DecisionLedgerProjection {

  const actionRecords = (action: 'decision_pass' | 'decision_wait' | 'decision_return') =>
    l05DecisionLedgerRecordEvidence(ledger.filter((event) => event.type === 'ACTION_ACCEPTED' && event.action === action));
  const checkpointRecords = (cause: 'synthetic pass decision recorded' | 'synthetic wait decision recorded' | 'synthetic return decision recorded') =>
    l05DecisionLedgerRecordEvidence(ledger.filter((event) => event.type === 'LESSON_CHECKPOINT' && event.lesson_id === 'L05' && event.cause === cause));

  return Object.freeze({
    accepted_action_records: Object.freeze({
      heading: 'Accepted-action record evidence',
      pass: actionRecords('decision_pass'),
      wait: actionRecords('decision_wait'),
      return: actionRecords('decision_return'),
    }),
    checkpoint_records: Object.freeze({
      heading: 'Checkpoint record evidence',
      pass: checkpointRecords('synthetic pass decision recorded'),
      wait: checkpointRecords('synthetic wait decision recorded'),
      return: checkpointRecords('synthetic return decision recorded'),
    }),
    boundary_notice: 'Record visibility only. The labels “pass”, “wait”, and “return” reproduce synthetic training records. They are not recommendations, navigation guidance, judgments of correctness, or evidence of route, depth, tide, visibility, clearance, timing, ordering, or safety outcomes.',
    ordering_notice: 'Record IDs are displayed in lexical order for stable presentation only; this order is not temporal and implies no sequence or recommendation.',
    absence_notice: 'No exact matching immutable ledger record is present.',
  });
}
