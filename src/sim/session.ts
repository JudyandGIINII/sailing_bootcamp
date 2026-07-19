import type { ReplayIdentity } from '../contracts/replay.js';

export type HelmCommand = 'neutral' | 'port' | 'starboard';
export type SessionAction = 'helm_port' | 'helm_starboard' | 'main_trim' | 'jib_trim' | 'reef' | 'decision_pass' | 'decision_wait' | 'decision_return' | 'pause' | 'reset' | 'resume';
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
  type: 'SESSION_STARTED' | 'ACTION_ACCEPTED' | 'LESSON_CHECKPOINT' | 'ENVIRONMENT_EPISODE' | 'SAFETY_BLOCKED';
  action?: SessionAction;
  contract_status?: 'UNVALIDATED_DOMAIN_MODEL';
  cause?: string;
  lesson_id?: 'L02' | 'L03' | 'L04' | 'L05';
}

export interface RawSimulationState {
  logical_tick: number;
  rng_state: number;
  helm_command: HelmCommand;
  heading: 'declared-unavailable';
  cog: 'declared-unavailable';
  true_wind: 'declared-unavailable';
  apparent_wind: 'declared-unavailable';
  contract_status: 'UNVALIDATED_DOMAIN_MODEL';
  lesson_id?: 'L02' | 'L03' | 'L04' | 'L05';
  main_trim?: 'declared-initial' | 'declared-adjusted';
  jib_trim?: 'declared-initial' | 'declared-adjusted';
  reef_state?: 'not_selected' | 'selected';
  synthetic_episode?: 'pending' | 'gust_wave_observed' | 'complete';
  declared_navigation_concepts?: 'heading_cog_stw_sog_drift_mark';
  mark_state?: 'declared-approach' | 'recoverable_miss_recorded' | 'slower_valid_correction_recorded';
  synthetic_environment?: 'tide_depth_visibility_declared';
  decision_state?: 'undecided' | 'pass_recorded' | 'wait_recorded' | 'return_recorded';
}

export interface DeterministicSession {
  identity: ReplayIdentity;
  initial_seed_state: number;
  raw: RawSimulationState;
  ledger: readonly LedgerEvent[];
  paused: boolean;
  lifecycle: readonly { reason: LifecycleReason; logical_tick: number; next_sequence: number }[];
}

export class CanonicalInputContractError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CanonicalInputContractError';
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

function initialRaw(seedState: number, scenario: string): RawSimulationState {
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
  if (scenario.startsWith('l02-')) return freeze({ ...base, lesson_id: 'L02', main_trim: 'declared-initial', jib_trim: 'declared-initial' });
  if (scenario.startsWith('l03-')) return freeze({ ...base, lesson_id: 'L03', reef_state: 'not_selected', synthetic_episode: 'pending' });
  if (scenario.startsWith('l04-')) return freeze({ ...base, lesson_id: 'L04', declared_navigation_concepts: 'heading_cog_stw_sog_drift_mark', mark_state: 'declared-approach' });
  if (scenario.startsWith('l05-')) return freeze({ ...base, lesson_id: 'L05', synthetic_environment: 'tide_depth_visibility_declared', decision_state: 'undecided' });
  return freeze(base);
}

export function createSession(identity: ReplayIdentity): DeterministicSession {
  const seedState = seededState(identity.seed);
  return freeze({
    identity: freeze({ ...identity, ordered_input_log: freeze([...identity.ordered_input_log]) }),
    initial_seed_state: seedState,
    raw: initialRaw(seedState, identity.scenario_version),
    ledger: immutableLedger([
      { id: eventId(0, 0, 0), tick: 0, sequence: 0, type: 'SESSION_STARTED', contract_status: 'UNVALIDATED_DOMAIN_MODEL' },
    ]),
    paused: false,
    lifecycle: freeze([]),
  });
}

function withSession(
  previous: DeterministicSession,
  changes: Partial<Omit<DeterministicSession, 'identity' | 'initial_seed_state'>>,
): DeterministicSession {
  return freeze({ ...previous, ...changes });
}

/** A logical tick has no renderer or wall-clock dependency. */
export function advanceLogicalTick(session: DeterministicSession): DeterministicSession {
  if (session.paused) return session;
  if (session.raw.lesson_id === 'L03' && session.raw.logical_tick === 0) {
    const episode: LedgerEvent = { id: eventId(0, 0, session.ledger.length), tick: 0, sequence: 0, type: 'ENVIRONMENT_EPISODE', lesson_id: 'L03', cause: 'deterministic synthetic gust/wave cue' };
    return withSession(session, { raw: freeze({ ...session.raw, logical_tick: 1, rng_state: nextRng(session.raw.rng_state), synthetic_episode: 'gust_wave_observed' }), ledger: immutableLedger([...session.ledger, episode]) });
  }
  return withSession(session, {
    raw: freeze({ ...session.raw, logical_tick: session.raw.logical_tick + 1, rng_state: nextRng(session.raw.rng_state) }),
  });
}

export function applyCanonicalInput(session: DeterministicSession, input: CanonicalInput): DeterministicSession {
  if (input.logical_tick !== session.raw.logical_tick) return session;
  if (input.input.action === 'reset') return createSession({ ...session.identity, ordered_input_log: session.identity.ordered_input_log });
  if (session.paused && input.input.action !== 'resume') return session;
  if (!session.paused && input.input.action === 'resume') return session;
  if (input.input.action === 'pause') return withSession(session, { paused: true });
  if (input.input.action === 'resume') return withSession(session, { paused: false });

  const action = input.input.action;
  const event: LedgerEvent = {
    id: eventId(input.logical_tick, input.sequence, session.ledger.length),
    tick: input.logical_tick,
    sequence: input.sequence,
    type: 'ACTION_ACCEPTED',
    action,
    contract_status: 'UNVALIDATED_DOMAIN_MODEL',
  };
  let raw: RawSimulationState = action === 'helm_port'
    ? freeze({ ...session.raw, helm_command: 'port' as const })
    : action === 'helm_starboard'
      ? freeze({ ...session.raw, helm_command: 'starboard' as const })
      : session.raw;
  let extra: LedgerEvent | undefined;
  if (action === 'main_trim' && raw.lesson_id === 'L02') raw = freeze({ ...raw, main_trim: 'declared-adjusted' });
  if (action === 'jib_trim' && raw.lesson_id === 'L02') raw = freeze({ ...raw, jib_trim: 'declared-adjusted' });
  if (action === 'reef' && raw.lesson_id === 'L03') { raw = freeze({ ...raw, reef_state: 'selected', synthetic_episode: 'complete' }); extra = { id: eventId(input.logical_tick, input.sequence, session.ledger.length + 1), tick: input.logical_tick, sequence: input.sequence, type: 'LESSON_CHECKPOINT', lesson_id: 'L03', cause: 'conservative synthetic reef mitigation recorded' }; }
  if (raw.lesson_id === 'L04' && action === 'helm_port') { raw = freeze({ ...raw, mark_state: 'recoverable_miss_recorded' }); extra = { id: eventId(input.logical_tick, input.sequence, session.ledger.length + 1), tick: input.logical_tick, sequence: input.sequence, type: 'LESSON_CHECKPOINT', lesson_id: 'L04', cause: 'recoverable synthetic mark miss recorded' }; }
  if (raw.lesson_id === 'L04' && action === 'helm_starboard' && raw.mark_state === 'recoverable_miss_recorded') { raw = freeze({ ...raw, mark_state: 'slower_valid_correction_recorded' }); extra = { id: eventId(input.logical_tick, input.sequence, session.ledger.length + 1), tick: input.logical_tick, sequence: input.sequence, type: 'LESSON_CHECKPOINT', lesson_id: 'L04', cause: 'slower valid synthetic correction recorded' }; }
  if (raw.lesson_id === 'L05' && (action === 'decision_pass' || action === 'decision_wait' || action === 'decision_return')) { raw = freeze({ ...raw, decision_state: action === 'decision_pass' ? 'pass_recorded' : action === 'decision_wait' ? 'wait_recorded' : 'return_recorded' }); extra = { id: eventId(input.logical_tick, input.sequence, session.ledger.length + 1), tick: input.logical_tick, sequence: input.sequence, type: 'LESSON_CHECKPOINT', lesson_id: 'L05', cause: `synthetic ${action.replace('decision_', '')} decision recorded` }; }
  if (raw.lesson_id === 'L02' && raw.main_trim === 'declared-adjusted' && raw.jib_trim === 'declared-adjusted') extra = { id: eventId(input.logical_tick, input.sequence, session.ledger.length + 1), tick: input.logical_tick, sequence: input.sequence, type: 'LESSON_CHECKPOINT', lesson_id: 'L02', cause: 'main/jib synthetic trim causality recorded' };
  return withSession(session, { raw, ledger: immutableLedger(extra ? [...session.ledger, event, extra] : [...session.ledger, event]) });
}

/** Browser lifecycle is recorded without progressing raw tick/RNG/ledger. */
export function pauseForLifecycle(session: DeterministicSession, reason: LifecycleReason, nextSequence: number): DeterministicSession {
  if (session.paused) return session;
  return withSession(session, {
    paused: true,
    lifecycle: freeze([...session.lifecycle, freeze({ reason, logical_tick: session.raw.logical_tick, next_sequence: nextSequence })]),
  });
}

export function replayInputs(identity: ReplayIdentity, inputs: readonly CanonicalInput[], terminalTicks: number): DeterministicSession {
  if (!Number.isSafeInteger(terminalTicks) || terminalTicks < 0) {
    throw new CanonicalInputContractError('terminalTicks must be a non-negative safe integer.');
  }
  let session = createSession(identity);
  const ordered = [...inputs].sort((left, right) => left.logical_tick - right.logical_tick || left.sequence - right.sequence);
  for (let index = 1; index < ordered.length; index += 1) {
    const previous = ordered[index - 1];
    const input = ordered[index];
    if (!previous || !input) continue;
    if (previous.logical_tick === input.logical_tick && previous.sequence === input.sequence) {
      throw new CanonicalInputContractError('Input sequence collision at one logical tick.');
    }
  }
  let index = 0;
  while (session.raw.logical_tick < terminalTicks) {
    while (ordered[index]?.logical_tick === session.raw.logical_tick) {
      const input = ordered[index];
      if (!input) break;
      session = applyCanonicalInput(session, input);
      index += 1;
    }
    const before = session.raw.logical_tick;
    session = advanceLogicalTick(session);
    if (session.raw.logical_tick === before) break;
  }
  return session;
}
