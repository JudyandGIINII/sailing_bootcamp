import { hasStrictL01ReplayV2TerminalAuthority, hasStrictL02ReplayV2TerminalAuthority, type ReplayIdentity, type ReplayV2 } from '../contracts/replay.js';
import { isLessonActionAllowedV2, resolveLessonPolicy, type DeclaredLessonAction } from '../content/lesson-manifest.js';
import { isL01SyntheticEnvironmentV1, l01SyntheticEnvironmentV1, type L01SyntheticEnvironmentV1 } from '../contracts/l01-synthetic-environment.js';
import { isL02SyntheticTrimProfileV1, l02SyntheticTrimProfileV1, type L02SyntheticTrimProfileV1 } from '../contracts/l02-synthetic-trim.js';
import { projectL01SyntheticObservations, type L01SyntheticObservations } from './l01-observation.js';
import { createInitialL01SyntheticState, transitionL01SyntheticState, type L01SyntheticState } from './l01-synthetic-model.js';
import { createInitialL02SyntheticTrimObservation, reduceL02SyntheticTrimObservation, type L02SyntheticTrimObservation } from './l02-synthetic-model.js';

export type HelmCommand = 'neutral' | 'port' | 'starboard';
export type SessionAction = DeclaredLessonAction;
export type LifecycleReason = 'focus_lost' | 'visibility_hidden';

export interface CanonicalInput {
  logical_tick: number;
  sequence: number;
  input: { action: SessionAction };
}

export interface LedgerEvent {
  id: string;
  tick: number;
  sequence: number;
  type: 'SESSION_STARTED' | 'ACTION_ACCEPTED' | 'LESSON_CHECKPOINT' | 'ENVIRONMENT_EPISODE' | 'SAFETY_BLOCKED' | 'L01_SYNTHETIC_TRANSITION';
  action?: SessionAction;
  contract_status?: 'UNVALIDATED_DOMAIN_MODEL';
  synthetic?: true;
  cause?: string;
  lesson_id?: 'L01' | 'L02' | 'L03' | 'L04' | 'L05';
  /** Immutable backward link from an L01 checkpoint to its already-recorded action. */
  action_event_id?: string;
  transition_event_id?: string;
  l01_transition?: Readonly<{
    environment_id: string;
    environment_version: number;
    model_id: string;
    model_version: number;
    canonical_precision_version: string;
    accepted_helm_command: HelmCommand;
    /** Ordered immutable input evidence consumed by this exact transition. */
    causal_controls: readonly Readonly<{
      logical_tick: number;
      sequence: number;
      helm_command: HelmCommand;
      action_event_id: string;
      checkpoint_event_id: string;
    }>[];
    prior_state: L01SyntheticState;
    next_state: L01SyntheticState;
    observations: L01SyntheticObservations;
  }>;
}

export interface RawSimulationState {
  logical_tick: number;
  rng_state: number;
  helm_command: HelmCommand;
  heading: 'declared-unavailable' | number;
  cog: 'declared-unavailable' | number;
  true_wind: 'declared-unavailable' | Readonly<{ from_rad: number; speed_mps: number }>;
  apparent_wind: 'declared-unavailable' | Readonly<{ from_rad: number; speed_mps: number }>;
  contract_status: 'UNVALIDATED_DOMAIN_MODEL';
  lesson_id?: 'L02' | 'L03' | 'L04' | 'L05';
  l02_trim_acknowledgment?: L02SyntheticTrimObservation;
  reef_state?: 'not_selected' | 'selected';
  synthetic_episode?: 'pending' | 'gust_wave_observed' | 'complete';
  declared_navigation_concepts?: 'heading_cog_stw_sog_drift_mark';
  mark_state?: 'declared-approach' | 'recoverable_miss_recorded' | 'slower_valid_correction_recorded';
  synthetic_environment?: 'tide_depth_visibility_declared';
  decision_state?: 'undecided' | 'pass_recorded' | 'wait_recorded' | 'return_recorded';
  l01_synthetic_state?: L01SyntheticState;
  l01_last_helm_sequence?: number;
}

export interface DeterministicSession {
  identity: ReplayIdentity | ReplayV2;
  initial_seed_state: number;
  raw: RawSimulationState;
  ledger: readonly LedgerEvent[];
  paused: boolean;
  /**
   * Non-ledger authority evidence for accepted canonical actions. Lifecycle
   * controls deliberately do not emit ledger events, but still participate in
   * the same-tick sequence contract.
   */
  canonical_input_evidence: readonly { logical_tick: number; sequence: number }[];
  lifecycle: readonly { reason: LifecycleReason; logical_tick: number; next_sequence: number }[];
}

export class CanonicalInputContractError extends Error {
  readonly reason_code: 'REPLAY_ACTION_DISALLOWED' | 'CANONICAL_INPUT_CONTRACT_VIOLATION';

  constructor(message: string, reasonCode: 'REPLAY_ACTION_DISALLOWED' | 'CANONICAL_INPUT_CONTRACT_VIOLATION' = 'CANONICAL_INPUT_CONTRACT_VIOLATION') {
    super(message);
    this.name = 'CanonicalInputContractError';
    this.reason_code = reasonCode;
  }
}

function freeze<T>(value: T): Readonly<T> {
  return Object.freeze(value);
}

function seededState(seed: string): number {
  let state = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    state ^= seed.charCodeAt(index);
    state = Math.imul(state, 16777619);
  }
  return state >>> 0;
}

/** Named xorshift32 is deterministic and only consumed by logical tick progression. */
function nextRng(state: number): number {
  let next = state || 1;
  next ^= next << 13;
  next ^= next >>> 17;
  next ^= next << 5;
  return next >>> 0;
}

function eventId(tick: number, sequence: number, offset: number): string {
  return `${tick}:${sequence}:${offset}`;
}

function immutableLedger(events: readonly LedgerEvent[]): readonly LedgerEvent[] {
  return freeze(events.map((event) => freeze({ ...event })));
}

function initialRaw(seedState: number, scenario: string, l01Profile?: L01SyntheticEnvironmentV1, l02Profile?: L02SyntheticTrimProfileV1): RawSimulationState {
  const base = {
    logical_tick: 0,
    rng_state: seedState,
    helm_command: 'neutral',
    heading: 'declared-unavailable',
    cog: 'declared-unavailable',
    true_wind: 'declared-unavailable',
    apparent_wind: 'declared-unavailable',
    contract_status: 'UNVALIDATED_DOMAIN_MODEL',
  } as const;
  if (scenario.startsWith('l01-')) {
    if (!l01Profile) throw new CanonicalInputContractError('L01 synthetic profile is missing.');
    const initialState = createInitialL01SyntheticState(l01Profile);
    const initialTransition = transitionL01SyntheticState(l01Profile, initialState, []);
    const observations = projectL01SyntheticObservations(l01Profile, initialTransition);
    return freeze({
      ...base,
      helm_command: initialState.helm_command,
      heading: observations.heading_rad,
      cog: observations.cog_rad,
      true_wind: freeze({ from_rad: observations.true_wind_from_rad, speed_mps: observations.true_wind_speed_mps }),
      apparent_wind: freeze({ from_rad: observations.apparent_wind_from_rad, speed_mps: observations.apparent_wind_speed_mps }),
      l01_synthetic_state: initialState,
      l01_last_helm_sequence: 0,
    });
  }
  if (scenario.startsWith('l02-')) {
    if (l02Profile && !isL02SyntheticTrimProfileV1(l02Profile)) throw new CanonicalInputContractError('L02 synthetic trim profile is invalid.');
    return freeze({ ...base, lesson_id: 'L02', l02_trim_acknowledgment: createInitialL02SyntheticTrimObservation() });
  }
  if (scenario.startsWith('l03-')) return freeze({ ...base, lesson_id: 'L03', reef_state: 'not_selected', synthetic_episode: 'pending' });
  if (scenario.startsWith('l04-')) return freeze({ ...base, lesson_id: 'L04', declared_navigation_concepts: 'heading_cog_stw_sog_drift_mark', mark_state: 'declared-approach' });
  if (scenario.startsWith('l05-')) return freeze({ ...base, lesson_id: 'L05', synthetic_environment: 'tide_depth_visibility_declared', decision_state: 'undecided' });
  return freeze(base);
}

/** Creates state only; action authority is resolved from the registered identity at use time. */
function isV2(identity: ReplayIdentity | ReplayV2): identity is ReplayV2 { return 'schema_version' in identity && identity.schema_version === 'replay-v2'; }
function sessionLesson(identity: ReplayIdentity | ReplayV2): string { return isV2(identity) ? `${identity.lesson_binding.lesson_id.toLowerCase()}-` : identity.scenario_version; }
function allowed(identity: ReplayIdentity | ReplayV2, action: unknown): action is DeclaredLessonAction { return isV2(identity) ? isLessonActionAllowedV2(identity.lesson_binding, action) : Boolean(resolveLessonPolicy(identity)?.permitted_actions.includes(action as DeclaredLessonAction)); }
function l01Profile(identity: ReplayIdentity | ReplayV2): L01SyntheticEnvironmentV1 | undefined {
  if (!sessionLesson(identity).startsWith('l01-')) return undefined;
  const profile = identity.l01_synthetic_environment;
  if (!isL01SyntheticEnvironmentV1(profile) ||
    profile.environment_id !== l01SyntheticEnvironmentV1.environment_id ||
    profile.environment_version !== l01SyntheticEnvironmentV1.environment_version ||
    profile.model_id !== l01SyntheticEnvironmentV1.model_id ||
    profile.model_version !== l01SyntheticEnvironmentV1.model_version ||
    profile.logical_step_seconds !== l01SyntheticEnvironmentV1.logical_step_seconds ||
    profile.initial_position_m.x !== l01SyntheticEnvironmentV1.initial_position_m.x ||
    profile.initial_position_m.y !== l01SyntheticEnvironmentV1.initial_position_m.y ||
    profile.initial_heading_rad !== l01SyntheticEnvironmentV1.initial_heading_rad ||
    profile.forward_speed_mps !== l01SyntheticEnvironmentV1.forward_speed_mps ||
    profile.true_wind_from_rad !== l01SyntheticEnvironmentV1.true_wind_from_rad ||
    profile.true_wind_speed_mps !== l01SyntheticEnvironmentV1.true_wind_speed_mps ||
    profile.full_helm_turn_rad_per_step !== l01SyntheticEnvironmentV1.full_helm_turn_rad_per_step ||
    profile.canonical_precision_version !== l01SyntheticEnvironmentV1.canonical_precision_version) {
    throw new CanonicalInputContractError('L01 synthetic replay profile is invalid.');
  }
  return l01SyntheticEnvironmentV1;
}
function l02Profile(identity: ReplayIdentity | ReplayV2): L02SyntheticTrimProfileV1 | undefined {
  if (!isV2(identity) || identity.lesson_binding.lesson_id !== 'L02') return undefined;
  if (!hasStrictL02ReplayV2TerminalAuthority(identity) || !isL02SyntheticTrimProfileV1(identity.l02_synthetic_trim_profile)) {
    throw new CanonicalInputContractError('L02 synthetic trim replay profile is invalid.');
  }
  return l02SyntheticTrimProfileV1;
}
function l01TransitionEventId(tick: number): string { return `l01-transition:${tick}`; }
function isL01Raw(raw: RawSimulationState): raw is RawSimulationState & { l01_synthetic_state: L01SyntheticState; l01_last_helm_sequence: number } {
  return raw.l01_synthetic_state !== undefined && raw.l01_last_helm_sequence !== undefined;
}

function l01CausalControlsForTick(ledger: readonly LedgerEvent[], logicalTick: number): readonly Readonly<{
  logical_tick: number;
  sequence: number;
  helm_command: HelmCommand;
  action_event_id: string;
  checkpoint_event_id: string;
}>[] {
  const checkpointsByActionId = new Map<string, LedgerEvent>();
  for (const event of ledger) {
    if (event.type !== 'LESSON_CHECKPOINT' || event.lesson_id !== 'L01' || event.tick !== logicalTick) continue;
    if (!event.action_event_id || checkpointsByActionId.has(event.action_event_id)) {
      throw new CanonicalInputContractError('L01 checkpoint causal evidence is invalid.');
    }
    checkpointsByActionId.set(event.action_event_id, event);
  }
  const controls = ledger
    .filter((event) => event.type === 'ACTION_ACCEPTED' && event.tick === logicalTick && (event.action === 'helm_port' || event.action === 'helm_starboard'))
    .sort((left, right) => left.sequence - right.sequence)
    .map((event) => {
      const checkpoint = checkpointsByActionId.get(event.id);
      if (!checkpoint || checkpoint.sequence !== event.sequence || checkpoint.tick !== event.tick) {
        throw new CanonicalInputContractError('L01 accepted helm action has no matching immutable checkpoint.');
      }
      return freeze({
        logical_tick: event.tick,
        sequence: event.sequence,
        helm_command: event.action === 'helm_port' ? 'port' as const : 'starboard' as const,
        action_event_id: event.id,
        checkpoint_event_id: checkpoint.id,
      });
    });
  if (controls.length !== checkpointsByActionId.size) {
    throw new CanonicalInputContractError('L01 checkpoint has no matching accepted helm action.');
  }
  return freeze(controls);
}

export function createSession(identity: ReplayIdentity | ReplayV2): DeterministicSession {
  const seedState = seededState(identity.seed);
  const profile = l01Profile(identity);
  const trimProfile = l02Profile(identity);
  const storedIdentity = freeze({
    ...identity,
    ordered_input_log: freeze([...identity.ordered_input_log]),
    ...(profile ? { l01_synthetic_environment: profile } : {}),
    ...(trimProfile ? { l02_synthetic_trim_profile: trimProfile } : {}),
  }) as ReplayIdentity | ReplayV2;
  return freeze({
    identity: storedIdentity,
    initial_seed_state: seedState,
    raw: initialRaw(seedState, sessionLesson(identity), profile, trimProfile),
    ledger: immutableLedger([
      { id: eventId(0, 0, 0), tick: 0, sequence: 0, type: 'SESSION_STARTED', contract_status: 'UNVALIDATED_DOMAIN_MODEL' },
    ]),
    paused: false,
    canonical_input_evidence: freeze([]),
    lifecycle: freeze([]),
  });
}

function withSession(
  previous: DeterministicSession,
  changes: Partial<Omit<DeterministicSession, 'identity' | 'initial_seed_state'>>,
): DeterministicSession {
  return freeze({ ...previous, ...changes });
}

function assertCanonicalSequence(session: DeterministicSession, input: CanonicalInput): void {
  const conflicting = session.canonical_input_evidence.find((evidence) =>
    evidence.logical_tick === input.logical_tick && evidence.sequence >= input.sequence,
  );
  if (!conflicting) return;
  if (conflicting.sequence === input.sequence) {
    throw new CanonicalInputContractError('Input sequence collision at one logical tick.');
  }
  throw new CanonicalInputContractError('Input sequence must strictly increase at one logical tick.');
}

function withAcceptedCanonicalInput(session: DeterministicSession, input: CanonicalInput): DeterministicSession {
  return withSession(session, {
    canonical_input_evidence: freeze([
      ...session.canonical_input_evidence,
      freeze({ logical_tick: input.logical_tick, sequence: input.sequence }),
    ]),
  });
}

/** A logical tick has no renderer or wall-clock dependency. */
export function advanceLogicalTick(session: DeterministicSession): DeterministicSession {
  if (session.paused) return session;
  if (isL01Raw(session.raw)) {
    const profile = l01Profile(session.identity);
    if (!profile) throw new CanonicalInputContractError('L01 synthetic replay profile is missing.');
    const causalControls = l01CausalControlsForTick(session.ledger, session.raw.logical_tick);
    const transition = transitionL01SyntheticState(profile, session.raw.l01_synthetic_state, causalControls);
    const observations = projectL01SyntheticObservations(profile, transition);
    const transitionId = l01TransitionEventId(session.raw.logical_tick);
    const event: LedgerEvent = {
      id: transitionId,
      tick: session.raw.logical_tick,
      sequence: causalControls.at(-1)?.sequence ?? session.raw.l01_last_helm_sequence,
      type: 'L01_SYNTHETIC_TRANSITION',
      lesson_id: 'L01',
      synthetic: true,
      l01_transition: freeze({
        environment_id: profile.environment_id,
        environment_version: profile.environment_version,
        model_id: profile.model_id,
        model_version: profile.model_version,
        canonical_precision_version: profile.canonical_precision_version,
        accepted_helm_command: transition.accepted_helm_command,
        causal_controls: causalControls,
        prior_state: transition.prior_state,
        next_state: transition.next_state,
        observations,
      }),
    };
    return withSession(session, {
      raw: freeze({
        ...session.raw,
        logical_tick: transition.next_state.logical_tick,
        rng_state: nextRng(session.raw.rng_state),
        helm_command: transition.accepted_helm_command,
        heading: observations.heading_rad,
        cog: observations.cog_rad,
        true_wind: freeze({ from_rad: observations.true_wind_from_rad, speed_mps: observations.true_wind_speed_mps }),
        apparent_wind: freeze({ from_rad: observations.apparent_wind_from_rad, speed_mps: observations.apparent_wind_speed_mps }),
        l01_synthetic_state: transition.next_state,
        l01_last_helm_sequence: causalControls.at(-1)?.sequence ?? session.raw.l01_last_helm_sequence,
      }),
      ledger: immutableLedger([...session.ledger, event]),
    });
  }
  if (session.raw.lesson_id === 'L03' && session.raw.logical_tick === 0) {
    const episode: LedgerEvent = { id: eventId(0, 0, session.ledger.length), tick: 0, sequence: 0, type: 'ENVIRONMENT_EPISODE', lesson_id: 'L03', cause: 'deterministic synthetic gust/wave cue' };
    return withSession(session, { raw: freeze({ ...session.raw, logical_tick: 1, rng_state: nextRng(session.raw.rng_state), synthetic_episode: 'gust_wave_observed' }), ledger: immutableLedger([...session.ledger, episode]) });
  }
  return withSession(session, {
    raw: freeze({ ...session.raw, logical_tick: session.raw.logical_tick + 1, rng_state: nextRng(session.raw.rng_state) }),
  });
}

export function applyCanonicalInput(session: DeterministicSession, input: CanonicalInput): DeterministicSession {
  if (!allowed(session.identity, input.input.action)) return session;
  const policy = isV2(session.identity) ? undefined : resolveLessonPolicy(session.identity);
  if (input.logical_tick !== session.raw.logical_tick) return session;
  assertCanonicalSequence(session, input);
  if (input.input.action === 'reset') return createSession({ ...session.identity, ordered_input_log: session.identity.ordered_input_log } as ReplayIdentity | ReplayV2);
  if (session.paused && input.input.action !== 'resume') return session;
  if (!session.paused && input.input.action === 'resume') return session;
  if (input.input.action === 'pause') return withAcceptedCanonicalInput(withSession(session, { paused: true }), input);
  if (input.input.action === 'resume') return withAcceptedCanonicalInput(withSession(session, { paused: false }), input);

  const action = input.input.action;
  const event: LedgerEvent = {
    id: eventId(input.logical_tick, input.sequence, session.ledger.length),
    tick: input.logical_tick,
    sequence: input.sequence,
    type: 'ACTION_ACCEPTED',
    action,
    contract_status: 'UNVALIDATED_DOMAIN_MODEL',
  };
  let raw: RawSimulationState = isL01Raw(session.raw)
    ? session.raw
    : action === 'helm_port'
      ? freeze({ ...session.raw, helm_command: 'port' as const })
      : action === 'helm_starboard'
        ? freeze({ ...session.raw, helm_command: 'starboard' as const })
        : session.raw;
  let extra: LedgerEvent | undefined;
  if (sessionLesson(session.identity).startsWith('l01-') && (action === 'helm_port' || action === 'helm_starboard')) {
    extra = { id: eventId(input.logical_tick, input.sequence, session.ledger.length + 1), tick: input.logical_tick, sequence: input.sequence, type: 'LESSON_CHECKPOINT', lesson_id: 'L01', cause: 'declared helm correction recorded', action_event_id: event.id };
  }
  if (raw.lesson_id === 'L02' && (action === 'main_trim' || action === 'jib_trim')) {
    const previousAcknowledgment = raw.l02_trim_acknowledgment;
    if (!previousAcknowledgment) throw new CanonicalInputContractError('L02 synthetic trim acknowledgment is missing.');
    const acknowledgment = reduceL02SyntheticTrimObservation(previousAcknowledgment, { action, logical_tick: input.logical_tick, sequence: input.sequence });
    raw = freeze({ ...raw, l02_trim_acknowledgment: acknowledgment });
    if (previousAcknowledgment.causal_state !== 'both' && acknowledgment.causal_state === 'both') {
      extra = { id: eventId(input.logical_tick, input.sequence, session.ledger.length + 1), tick: input.logical_tick, sequence: input.sequence, type: 'LESSON_CHECKPOINT', lesson_id: 'L02', cause: 'main/jib synthetic trim causality recorded' };
    }
  }
  if (action === 'reef' && raw.lesson_id === 'L03') { raw = freeze({ ...raw, reef_state: 'selected', synthetic_episode: 'complete' }); extra = { id: eventId(input.logical_tick, input.sequence, session.ledger.length + 1), tick: input.logical_tick, sequence: input.sequence, type: 'LESSON_CHECKPOINT', lesson_id: 'L03', cause: 'conservative synthetic reef mitigation recorded' }; }
  if (raw.lesson_id === 'L04' && action === 'helm_port') { raw = freeze({ ...raw, mark_state: 'recoverable_miss_recorded' }); extra = { id: eventId(input.logical_tick, input.sequence, session.ledger.length + 1), tick: input.logical_tick, sequence: input.sequence, type: 'LESSON_CHECKPOINT', lesson_id: 'L04', cause: 'recoverable synthetic mark miss recorded' }; }
  if (raw.lesson_id === 'L04' && action === 'helm_starboard' && raw.mark_state === 'recoverable_miss_recorded') { raw = freeze({ ...raw, mark_state: 'slower_valid_correction_recorded' }); extra = { id: eventId(input.logical_tick, input.sequence, session.ledger.length + 1), tick: input.logical_tick, sequence: input.sequence, type: 'LESSON_CHECKPOINT', lesson_id: 'L04', cause: 'slower valid synthetic correction recorded' }; }
  if (raw.lesson_id === 'L05' && (action === 'decision_pass' || action === 'decision_wait' || action === 'decision_return')) { raw = freeze({ ...raw, decision_state: action === 'decision_pass' ? 'pass_recorded' : action === 'decision_wait' ? 'wait_recorded' : 'return_recorded' }); extra = { id: eventId(input.logical_tick, input.sequence, session.ledger.length + 1), tick: input.logical_tick, sequence: input.sequence, type: 'LESSON_CHECKPOINT', lesson_id: 'L05', cause: `synthetic ${action.replace('decision_', '')} decision recorded` }; }
  const safetyEvent = policy?.synthetic_safety_event?.action === action
    ? { id: eventId(input.logical_tick, input.sequence, session.ledger.length + (extra ? 2 : 1)), tick: input.logical_tick, sequence: input.sequence, type: 'SAFETY_BLOCKED' as const, contract_status: 'UNVALIDATED_DOMAIN_MODEL' as const, synthetic: true as const, cause: 'manifest-declared synthetic event' }
    : undefined;
  return withAcceptedCanonicalInput(withSession(session, {
    raw,
    ledger: immutableLedger([...session.ledger, event, ...(extra ? [extra] : []), ...(safetyEvent ? [safetyEvent] : [])]),
  }), input);
}

/** Browser lifecycle is recorded without progressing raw tick/RNG/ledger. */
export function pauseForLifecycle(session: DeterministicSession, reason: LifecycleReason, nextSequence: number): DeterministicSession {
  if (session.paused) return session;
  return withSession(session, {
    paused: true,
    lifecycle: freeze([...session.lifecycle, freeze({ reason, logical_tick: session.raw.logical_tick, next_sequence: nextSequence })]),
  });
}

function isExactCanonicalInput(value: unknown): value is CanonicalInput {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const input = value as Record<string, unknown>;
  if (!Number.isSafeInteger(input.logical_tick) || (input.logical_tick as number) < 0 ||
    !Number.isSafeInteger(input.sequence) || (input.sequence as number) < 0 ||
    typeof input.input !== 'object' || input.input === null || Array.isArray(input.input)) return false;
  const action = input.input as Record<string, unknown>;
  return Object.keys(input).length === 3 && Object.keys(action).length === 1 && Object.hasOwn(action, 'action');
}

function sameCanonicalInputLog(
  persisted: readonly unknown[],
  supplied: readonly CanonicalInput[],
): boolean {
  return persisted.length === supplied.length && persisted.every((entry, index) => {
    const input = supplied[index];
    return input !== undefined && isExactCanonicalInput(entry) && isExactCanonicalInput(input) &&
      entry.logical_tick === input.logical_tick &&
      entry.sequence === input.sequence &&
      entry.input.action === input.input.action;
  });
}

export function replayInputs(
  identity: ReplayIdentity | ReplayV2,
  inputs: readonly CanonicalInput[],
  terminalTicks: number,
): DeterministicSession {
  if (!Number.isSafeInteger(terminalTicks) || terminalTicks < 0) {
    throw new CanonicalInputContractError('terminalTicks must be a non-negative safe integer.');
  }
  if (!isV2(identity) && !resolveLessonPolicy(identity)) {
    throw new CanonicalInputContractError('REPLAY_ACTION_DISALLOWED', 'REPLAY_ACTION_DISALLOWED');
  }
  const isL01V2TerminalReplay = isV2(identity) && identity.lesson_binding.lesson_id === 'L01';
  const isL02V2TerminalReplay = isV2(identity) && identity.lesson_binding.lesson_id === 'L02';
  if (isL01V2TerminalReplay) {
    if (!hasStrictL01ReplayV2TerminalAuthority(identity)) {
      throw new CanonicalInputContractError('L01 Replay V2 terminal authority is invalid.');
    }
    if (terminalTicks !== identity.l01_terminal_logical_tick) {
      throw new CanonicalInputContractError('L01 Replay V2 terminal logical tick contradicts its identity.');
    }
    if (!sameCanonicalInputLog(identity.ordered_input_log, inputs)) {
      throw new CanonicalInputContractError('L01 Replay V2 inputs contradict its canonical identity log.');
    }
  }
  if (isL02V2TerminalReplay) {
    if (!hasStrictL02ReplayV2TerminalAuthority(identity)) {
      throw new CanonicalInputContractError('L02 Replay V2 terminal authority is invalid.');
    }
    if (terminalTicks !== identity.l02_terminal_logical_tick) {
      throw new CanonicalInputContractError('L02 Replay V2 terminal logical tick contradicts its identity.');
    }
    if (!sameCanonicalInputLog(identity.ordered_input_log, inputs)) {
      throw new CanonicalInputContractError('L02 Replay V2 inputs contradict its canonical identity log.');
    }
  }
  const authoritativeTerminalTicks: number = isL01V2TerminalReplay ? identity.l01_terminal_logical_tick! : isL02V2TerminalReplay ? identity.l02_terminal_logical_tick! : terminalTicks;
  const ordered = isL01V2TerminalReplay || isL02V2TerminalReplay
    ? [...identity.ordered_input_log] as CanonicalInput[]
    : [...inputs].sort((left, right) => left.logical_tick - right.logical_tick || left.sequence - right.sequence);
  for (const input of ordered) {
    if (!allowed(identity, input.input.action)) {
      throw new CanonicalInputContractError('REPLAY_ACTION_DISALLOWED', 'REPLAY_ACTION_DISALLOWED');
    }
    if ((sessionLesson(identity).startsWith('l01-') || isL02V2TerminalReplay) && input.input.action === 'reset') {
      throw new CanonicalInputContractError('REPLAY_ACTION_DISALLOWED', 'REPLAY_ACTION_DISALLOWED');
    }
  }
  for (let index = 1; index < ordered.length; index += 1) {
    const previous = ordered[index - 1];
    const input = ordered[index];
    if (!previous || !input) continue;
    if (previous.logical_tick === input.logical_tick && previous.sequence === input.sequence) {
      throw new CanonicalInputContractError('Input sequence collision at one logical tick.');
    }
  }
  let session = createSession(identity);
  let index = 0;
  while (session.raw.logical_tick < authoritativeTerminalTicks || isL01V2TerminalReplay || isL02V2TerminalReplay) {
    while (ordered[index]?.logical_tick === session.raw.logical_tick) {
      const input = ordered[index];
      if (!input) break;
      session = applyCanonicalInput(session, input);
      index += 1;
    }
    if ((isL01V2TerminalReplay || isL02V2TerminalReplay) && session.raw.logical_tick === authoritativeTerminalTicks) break;
    const before = session.raw.logical_tick;
    session = advanceLogicalTick(session);
    if (session.raw.logical_tick === before) break;
  }
  if ((isL01V2TerminalReplay || isL02V2TerminalReplay) && session.raw.logical_tick !== authoritativeTerminalTicks) {
    throw new CanonicalInputContractError(`${isL01V2TerminalReplay ? 'L01' : 'L02'} Replay V2 terminal logical tick is unreachable.`);
  }
  const terminalPaused = isL01V2TerminalReplay ? identity.l01_terminal_paused : isL02V2TerminalReplay ? identity.l02_terminal_paused : undefined;
  return terminalPaused !== undefined && terminalPaused !== session.paused
    ? withSession(session, { paused: terminalPaused })
    : session;
}
