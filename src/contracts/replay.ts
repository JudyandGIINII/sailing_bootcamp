import { getLessonManifest, isLessonActionAllowed, isLessonActionAllowedV2 } from '../content/lesson-manifest.js';
import { validateScenarioPackage, type ScenarioPackageV1 } from './scenario.js';
import { isValidVariationTrace, type VariationTraceV1 } from '../sim/scenario-variation.js';
import { isL01SyntheticEnvironmentV1, l01SyntheticEnvironmentV1, type L01SyntheticEnvironmentV1 } from './l01-synthetic-environment.js';
import { isL02SyntheticTrimProfileV1, l02SyntheticTrimProfileV1, type L02SyntheticTrimProfileV1 } from './l02-synthetic-trim.js';
import { isL03SyntheticAcknowledgmentProfileV2, l03SyntheticAcknowledgmentProfileV2, type L03SyntheticAcknowledgmentProfileV2 } from '../content/l02-l05.js';

export const REPLAY_IDENTITY_FIELDS = [
  'scenario_version',
  'seed',
  'ordered_input_log',
  'model_version',
  'boat_profile_version',
  'contract_version',
  'coordinate_contract_version',
  'determinism_contract_version',
  'comparison_policy_version',
] as const;

export type ReplayIdentityField = (typeof REPLAY_IDENTITY_FIELDS)[number];
const L01_REPLAY_IDENTITY_FIELD = 'l01_synthetic_environment' as const;
export const L01_REPLAY_IDENTITY_FIELDS = [...REPLAY_IDENTITY_FIELDS, L01_REPLAY_IDENTITY_FIELD] as const;

/** Versioned, renderer-independent shape for stored replay identity. */
export const replayIdentitySchemaV1Draft = {
  version: 'replay-identity-v1-draft',
  discriminator: {
    field: 'scenario_version',
    l01_value: 'l01-scenario-v0-draft',
  },
  variants: {
    l01: {
      required_fields: L01_REPLAY_IDENTITY_FIELDS,
      additional_fields: 'forbidden',
    },
    non_l01: {
      excluded_scenario_version: 'l01-scenario-v0-draft',
      required_fields: REPLAY_IDENTITY_FIELDS,
      additional_fields: 'forbidden',
    },
  },
} as const;

export interface OrderedInput {
  logical_tick: number;
  sequence: number;
  input: unknown;
}

/** Canonical replay identity; no omitted or extension fields are accepted. */
export interface ReplayIdentity {
  scenario_version: string;
  seed: string;
  ordered_input_log: readonly OrderedInput[];
  model_version: string;
  boat_profile_version: string;
  contract_version: string;
  coordinate_contract_version: string;
  determinism_contract_version: string;
  comparison_policy_version: string;
  /** Required only for L01; legacy/incomplete L01 payloads fail closed. */
  l01_synthetic_environment?: L01SyntheticEnvironmentV1;
}

export const REPLAY_V2_SCHEMA_VERSION = 'replay-v2' as const;
export interface LessonBindingV2 {
  lesson_id: 'L01' | 'L02' | 'L03' | 'L04' | 'L05';
  model_version: string; boat_profile_version: string; contract_version: string;
  coordinate_contract_version: string; determinism_contract_version: string; comparison_policy_version: string;
}
export interface ReplayV2 {
  schema_version: typeof REPLAY_V2_SCHEMA_VERSION;
  lesson_binding: LessonBindingV2;
  scenario_snapshot: ScenarioPackageV1;
  variation_trace: VariationTraceV1;
  seed: string;
  ordered_input_log: readonly OrderedInput[];
  l01_synthetic_environment?: L01SyntheticEnvironmentV1;
  /**
   * Required only by the strict L01 Replay V2 variant. It identifies the
   * canonical session after ordered inputs at this tick, before its advance.
   */
  l01_terminal_logical_tick?: number;
  /**
   * Required only by the strict L01 Replay V2 variant. This records the
   * authoritative terminal session pause state, including lifecycle pauses
   * that intentionally have no canonical input or ledger event.
   */
  l01_terminal_paused?: boolean;
  /** Required only by the strict synthetic L02 trim-input acknowledgment variant. */
  l02_synthetic_trim_profile?: L02SyntheticTrimProfileV1;
  /** Authoritative canonical terminal boundary for strict L02 Replay V2. */
  l02_terminal_logical_tick?: number;
  /** Authoritative terminal pause state for strict L02 Replay V2. */
  l02_terminal_paused?: boolean;
  /** Required only by the strict L03 synthetic acknowledgment Replay V2 variant. */
  l03_synthetic_acknowledgment_profile?: L03SyntheticAcknowledgmentProfileV2;
  /** Authoritative canonical terminal boundary for strict L03 Replay V2. */
  l03_terminal_logical_tick?: number;
  /** Authoritative terminal pause state for strict L03 Replay V2. */
  l03_terminal_paused?: boolean;
}
export type ReplayV2Resolution = { outcome: 'accepted'; replay: ReplayV2 } | { outcome: 'rejected'; reason_code: 'REPLAY_V2_SCHEMA_INVALID' | 'REPLAY_V2_SCENARIO_INVALID' | 'REPLAY_V2_VARIATION_INVALID' | 'REPLAY_ACTION_DISALLOWED'; stored_payload: unknown };

export type ReplayResolution =
  | { outcome: 'accepted'; replay: ReplayIdentity }
  | {
      outcome: 'rejected';
      reason_code: 'REPLAY_IDENTITY_MISSING' | 'REPLAY_IDENTITY_INCOMPATIBLE' | 'REPLAY_PAYLOAD_CORRUPT' | 'REPLAY_ACTION_DISALLOWED';
      /** The untouched stored payload is retained for diagnostics/migration. */
      stored_payload: unknown;
    };

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isOrderedInput(value: unknown): value is OrderedInput {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const candidate = value as Record<string, unknown>;
  return (
    Number.isSafeInteger(candidate.logical_tick) &&
    (candidate.logical_tick as number) >= 0 &&
    Number.isSafeInteger(candidate.sequence) &&
    (candidate.sequence as number) >= 0 &&
    Object.hasOwn(candidate, 'input')
  );
}

function isStrictlyOrderedInputLog(value: readonly OrderedInput[]): boolean {
  return value.every((entry, index) => {
    if (index === 0) return true;
    const previous = value[index - 1];
    if (previous === undefined) return false;
    return (
      entry.logical_tick > previous.logical_tick ||
      (entry.logical_tick === previous.logical_tick && entry.sequence > previous.sequence)
    );
  });
}

function isCanonicalLessonActionInput(identity: ReplayIdentity, value: unknown): boolean {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const candidate = value as Record<string, unknown>;
  return Object.keys(candidate).length === 1 && Object.hasOwn(candidate, 'action') &&
    isLessonActionAllowed(identity, candidate.action);
}

function isReplayableLegacyLessonActionInput(identity: ReplayIdentity, value: unknown): boolean {
  if (!isCanonicalLessonActionInput(identity, value)) return false;
  return identity.scenario_version !== 'l01-scenario-v0-draft' || (value as { action: unknown }).action !== 'reset';
}

function identityFieldsFor(candidate: Record<string, unknown>): readonly string[] {
  return candidate.scenario_version === 'l01-scenario-v0-draft'
    ? L01_REPLAY_IDENTITY_FIELDS
    : REPLAY_IDENTITY_FIELDS;
}

function sameL01Environment(value: unknown): boolean {
  if (!isL01SyntheticEnvironmentV1(value)) return false;
  return value.environment_id === l01SyntheticEnvironmentV1.environment_id &&
    value.environment_version === l01SyntheticEnvironmentV1.environment_version &&
    value.model_id === l01SyntheticEnvironmentV1.model_id &&
    value.model_version === l01SyntheticEnvironmentV1.model_version &&
    value.logical_step_seconds === l01SyntheticEnvironmentV1.logical_step_seconds &&
    value.initial_position_m.x === l01SyntheticEnvironmentV1.initial_position_m.x &&
    value.initial_position_m.y === l01SyntheticEnvironmentV1.initial_position_m.y &&
    value.initial_heading_rad === l01SyntheticEnvironmentV1.initial_heading_rad &&
    value.forward_speed_mps === l01SyntheticEnvironmentV1.forward_speed_mps &&
    value.true_wind_from_rad === l01SyntheticEnvironmentV1.true_wind_from_rad &&
    value.true_wind_speed_mps === l01SyntheticEnvironmentV1.true_wind_speed_mps &&
    value.full_helm_turn_rad_per_step === l01SyntheticEnvironmentV1.full_helm_turn_rad_per_step &&
    value.canonical_precision_version === l01SyntheticEnvironmentV1.canonical_precision_version;
}

export function isReplayIdentity(value: unknown): value is ReplayIdentity {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const candidate = value as Record<string, unknown>;
  const keys = Object.keys(candidate);
  const identityFields = identityFieldsFor(candidate);
  if (keys.length !== identityFields.length) return false;
  if (!identityFields.every((field) => Object.hasOwn(candidate, field))) return false;

  return (
    isNonEmptyString(candidate.scenario_version) &&
    isNonEmptyString(candidate.seed) &&
    Array.isArray(candidate.ordered_input_log) &&
    candidate.ordered_input_log.every(isOrderedInput) &&
    isStrictlyOrderedInputLog(candidate.ordered_input_log) &&
    isNonEmptyString(candidate.model_version) &&
    isNonEmptyString(candidate.boat_profile_version) &&
    isNonEmptyString(candidate.contract_version) &&
    isNonEmptyString(candidate.coordinate_contract_version) &&
    isNonEmptyString(candidate.determinism_contract_version) &&
    isNonEmptyString(candidate.comparison_policy_version) &&
    (candidate.scenario_version !== 'l01-scenario-v0-draft' || isL01SyntheticEnvironmentV1(candidate.l01_synthetic_environment))
  );
}

export function resolveStoredReplay(
  storedPayload: unknown,
  supportedBindings: Readonly<Omit<ReplayIdentity, 'seed' | 'ordered_input_log'>>,
): ReplayResolution {
  if (!isReplayIdentity(storedPayload)) {
    const object = typeof storedPayload === 'object' && storedPayload !== null && !Array.isArray(storedPayload)
      ? storedPayload as Record<string, unknown> : undefined;
    const hasMissingIdentityField = object !== undefined && identityFieldsFor(object).some((field) => !Object.hasOwn(object, field));
    return { outcome: 'rejected', reason_code: hasMissingIdentityField ? 'REPLAY_IDENTITY_MISSING' : 'REPLAY_PAYLOAD_CORRUPT', stored_payload: storedPayload };
  }

  for (const field of REPLAY_IDENTITY_FIELDS) {
    if (field === 'seed' || field === 'ordered_input_log') continue;
    if (storedPayload[field] !== supportedBindings[field]) {
      return { outcome: 'rejected', reason_code: 'REPLAY_IDENTITY_INCOMPATIBLE', stored_payload: storedPayload };
    }
  }
  if (storedPayload.scenario_version === 'l01-scenario-v0-draft' &&
    (!sameL01Environment(storedPayload.l01_synthetic_environment) || !sameL01Environment(supportedBindings.l01_synthetic_environment))) {
    return { outcome: 'rejected', reason_code: 'REPLAY_IDENTITY_INCOMPATIBLE', stored_payload: storedPayload };
  }
  if (!storedPayload.ordered_input_log.every((entry) => isReplayableLegacyLessonActionInput(storedPayload, entry.input))) {
    return { outcome: 'rejected', reason_code: 'REPLAY_ACTION_DISALLOWED', stored_payload: storedPayload };
  }
  return { outcome: 'accepted', replay: storedPayload };
}

/** Full-identity comparison for a declared replay fixture; no aliases or migrations. */
export function resolveExactReplayIdentity(storedPayload: unknown, expectedIdentity: ReplayIdentity): ReplayResolution {
  if (!isReplayIdentity(storedPayload)) {
    const candidate = typeof storedPayload === 'object' && storedPayload !== null && !Array.isArray(storedPayload) ? storedPayload as Record<string, unknown> : undefined;
    return { outcome: 'rejected', reason_code: candidate && identityFieldsFor(candidate).some((field) => !Object.hasOwn(candidate, field)) ? 'REPLAY_IDENTITY_MISSING' : 'REPLAY_PAYLOAD_CORRUPT', stored_payload: storedPayload };
  }
  for (const field of REPLAY_IDENTITY_FIELDS) {
    if (JSON.stringify(storedPayload[field]) !== JSON.stringify(expectedIdentity[field])) {
      return { outcome: 'rejected', reason_code: 'REPLAY_IDENTITY_INCOMPATIBLE', stored_payload: storedPayload };
    }
  }
  if (storedPayload.scenario_version === 'l01-scenario-v0-draft' && (!sameL01Environment(storedPayload.l01_synthetic_environment) || !sameL01Environment(expectedIdentity.l01_synthetic_environment))) {
    return { outcome: 'rejected', reason_code: 'REPLAY_IDENTITY_INCOMPATIBLE', stored_payload: storedPayload };
  }
  if (!storedPayload.ordered_input_log.every((entry) => isReplayableLegacyLessonActionInput(storedPayload, entry.input))) {
    return { outcome: 'rejected', reason_code: 'REPLAY_ACTION_DISALLOWED', stored_payload: storedPayload };
  }
  return { outcome: 'accepted', replay: storedPayload };
}

const v2Keys = ['schema_version', 'lesson_binding', 'scenario_snapshot', 'variation_trace', 'seed', 'ordered_input_log'] as const;
const L01_REPLAY_V2_TERMINAL_TICK_FIELD = 'l01_terminal_logical_tick' as const;
const L01_REPLAY_V2_TERMINAL_PAUSED_FIELD = 'l01_terminal_paused' as const;
const L02_REPLAY_V2_PROFILE_FIELD = 'l02_synthetic_trim_profile' as const;
const L02_REPLAY_V2_TERMINAL_TICK_FIELD = 'l02_terminal_logical_tick' as const;
const L02_REPLAY_V2_TERMINAL_PAUSED_FIELD = 'l02_terminal_paused' as const;
const L03_REPLAY_V2_PROFILE_FIELD = 'l03_synthetic_acknowledgment_profile' as const;
const L03_REPLAY_V2_TERMINAL_TICK_FIELD = 'l03_terminal_logical_tick' as const;
const L03_REPLAY_V2_TERMINAL_PAUSED_FIELD = 'l03_terminal_paused' as const;
const l01V2Keys = [...v2Keys, L01_REPLAY_IDENTITY_FIELD, L01_REPLAY_V2_TERMINAL_TICK_FIELD, L01_REPLAY_V2_TERMINAL_PAUSED_FIELD] as const;
const l02V2Keys = [...v2Keys, L02_REPLAY_V2_PROFILE_FIELD, L02_REPLAY_V2_TERMINAL_TICK_FIELD, L02_REPLAY_V2_TERMINAL_PAUSED_FIELD] as const;
const l03V2Keys = [...v2Keys, L03_REPLAY_V2_PROFILE_FIELD, L03_REPLAY_V2_TERMINAL_TICK_FIELD, L03_REPLAY_V2_TERMINAL_PAUSED_FIELD] as const;
const lessonBindingKeys = ['lesson_id', 'model_version', 'boat_profile_version', 'contract_version', 'coordinate_contract_version', 'determinism_contract_version', 'comparison_policy_version'] as const;
const orderedInputKeys = ['logical_tick', 'sequence', 'input'] as const;
function exactKeys(value: unknown, keys: readonly string[]): value is Record<string, unknown> { return typeof value === 'object' && value !== null && !Array.isArray(value) && Object.keys(value).length === keys.length && keys.every((key) => Object.hasOwn(value, key)); }
function isReplayV2OrderedInput(value: unknown): value is OrderedInput { return exactKeys(value, orderedInputKeys) && isOrderedInput(value); }
function isRegisteredLessonBindingV2(binding: LessonBindingV2): boolean {
  const manifest = getLessonManifest(binding.lesson_id);
  return manifest !== undefined &&
    manifest.model_version === binding.model_version &&
    manifest.boat_profile_version === binding.boat_profile_version &&
    manifest.contract_version === binding.contract_version &&
    manifest.coordinate_contract_version === binding.coordinate_contract_version &&
    manifest.determinism_contract_version === binding.determinism_contract_version &&
    manifest.comparison_policy_version === binding.comparison_policy_version;
}
export function isReplayV2Shape(value: unknown): value is Omit<ReplayV2, 'scenario_snapshot' | 'variation_trace'> & { scenario_snapshot: unknown; variation_trace: unknown } {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const candidate = value as Record<string, unknown>;
  const isL01 = (candidate.lesson_binding as { lesson_id?: unknown } | undefined)?.lesson_id === 'L01';
  const isL02 = (candidate.lesson_binding as { lesson_id?: unknown } | undefined)?.lesson_id === 'L02';
  const isL03 = (candidate.lesson_binding as { lesson_id?: unknown } | undefined)?.lesson_id === 'L03';
  if (!exactKeys(candidate, isL01 ? l01V2Keys : isL02 ? l02V2Keys : isL03 ? l03V2Keys : v2Keys)) return false;
  const terminalTick = isL01 ? candidate.l01_terminal_logical_tick : isL02 ? candidate.l02_terminal_logical_tick : candidate.l03_terminal_logical_tick;
  const hasValidStrictTerminalBoundary = typeof terminalTick === 'number' &&
    Number.isSafeInteger(terminalTick) &&
    terminalTick >= 0 &&
    Array.isArray(candidate.ordered_input_log) &&
    candidate.ordered_input_log.every((entry) => isReplayV2OrderedInput(entry) && entry.logical_tick <= terminalTick);
  return candidate.schema_version === REPLAY_V2_SCHEMA_VERSION && isNonEmptyString(candidate.seed) && Array.isArray(candidate.ordered_input_log) && candidate.ordered_input_log.every(isReplayV2OrderedInput) && isStrictlyOrderedInputLog(candidate.ordered_input_log) && exactKeys(candidate.lesson_binding, lessonBindingKeys) && Object.values(candidate.lesson_binding as Record<string, unknown>).every(isNonEmptyString) && ['L01', 'L02', 'L03', 'L04', 'L05'].includes((candidate.lesson_binding as Record<string, unknown>).lesson_id as string) &&
    (!isL01 || (hasValidStrictTerminalBoundary && typeof candidate.l01_terminal_paused === 'boolean')) &&
    (!isL02 || (isL02SyntheticTrimProfileV1(candidate.l02_synthetic_trim_profile) && hasValidStrictTerminalBoundary && typeof candidate.l02_terminal_paused === 'boolean')) &&
    (!isL03 || (isL03SyntheticAcknowledgmentProfileV2(candidate.l03_synthetic_acknowledgment_profile) && hasValidStrictTerminalBoundary && typeof candidate.l03_terminal_paused === 'boolean'));
}

/**
 * L01 terminal state is meaningful only if canonical inputs can progress to
 * it. A pause stops tick advancement immediately, so a later-tick resume is
 * never observable. Only a later sequence at the same tick can clear it.
 */
function hasReachableL01V2Terminal(
  orderedInputLog: readonly OrderedInput[],
  terminalLogicalTick: number,
): boolean {
  let paused = false;
  for (let index = 0; index < orderedInputLog.length; index += 1) {
    const entry = orderedInputLog[index];
    if (!entry) continue;
    const action = (entry.input as { action: unknown }).action;
    if (action === 'pause' && !paused) paused = true;
    if (action === 'resume' && paused) paused = false;

    const next = orderedInputLog[index + 1];
    const isLastInputAtTick = next === undefined || next.logical_tick > entry.logical_tick;
    if (isLastInputAtTick && paused && entry.logical_tick < terminalLogicalTick) return false;
  }
  return true;
}

/**
 * Input-driven pauses are canonical. A persisted terminal pause may add a
 * lifecycle pause, but it may never erase an input-driven canonical pause.
 */
function hasSoundL01V2TerminalPausedState(
  orderedInputLog: readonly OrderedInput[],
  terminalLogicalTick: number,
  terminalPaused: boolean,
): boolean {
  let paused = false;
  for (const entry of orderedInputLog) {
    if (entry.logical_tick > terminalLogicalTick) return false;
    const action = (entry.input as { action: unknown }).action;
    if (action === 'pause' && !paused) paused = true;
    if (action === 'resume' && paused) paused = false;
  }
  return !paused || terminalPaused;
}

function hasReachableStrictV2Terminal(orderedInputLog: readonly OrderedInput[], terminalLogicalTick: number): boolean {
  return hasReachableL01V2Terminal(orderedInputLog, terminalLogicalTick);
}

function hasSoundStrictV2TerminalPausedState(orderedInputLog: readonly OrderedInput[], terminalLogicalTick: number, terminalPaused: boolean): boolean {
  return hasSoundL01V2TerminalPausedState(orderedInputLog, terminalLogicalTick, terminalPaused);
}

/**
 * The L01 V2 terminal boundary and pause state are one authority.  This
 * synchronous guard is shared by the pure replay core and the persisted-payload
 * resolver so neither path can accept a looser terminal representation.
 */
export function hasStrictL01ReplayV2TerminalAuthority(value: unknown): value is ReplayV2 {
  if (!isReplayV2Shape(value)) return false;
  const replay = value as ReplayV2;
  return replay.lesson_binding.lesson_id === 'L01' &&
    hasReachableL01V2Terminal(replay.ordered_input_log, replay.l01_terminal_logical_tick!) &&
    hasSoundL01V2TerminalPausedState(replay.ordered_input_log, replay.l01_terminal_logical_tick!, replay.l01_terminal_paused!);
}

/** Strict L02 profile, input log, terminal tick, and pause state are one authority. */
export function hasStrictL02ReplayV2TerminalAuthority(value: unknown): value is ReplayV2 {
  if (!isReplayV2Shape(value)) return false;
  const replay = value as ReplayV2;
  return replay.lesson_binding.lesson_id === 'L02' &&
    isRegisteredLessonBindingV2(replay.lesson_binding) &&
    isL02SyntheticTrimProfileV1(replay.l02_synthetic_trim_profile) &&
    replay.l02_synthetic_trim_profile.profile_id === l02SyntheticTrimProfileV1.profile_id &&
    hasReachableStrictV2Terminal(replay.ordered_input_log, replay.l02_terminal_logical_tick!) &&
    hasSoundStrictV2TerminalPausedState(replay.ordered_input_log, replay.l02_terminal_logical_tick!, replay.l02_terminal_paused!);
}

/**
 * L03 has a synthetic cue at tick one, but an attempt may be persisted before
 * that cue is acknowledged. Lifecycle controls are canonical inputs: a pause
 * cannot be crossed by a later-tick input, and the terminal paused flag may
 * add a lifecycle pause but may never erase a canonical one. An
 * acknowledgment remains terminal and immutable.
 */
function hasSoundL03V2AcknowledgmentProgression(
  orderedInputLog: readonly OrderedInput[],
  terminalLogicalTick: number,
  terminalPaused: boolean,
): boolean {
  let paused = false;
  let acknowledged = false;
  let currentLogicalTick = 0;

  for (const entry of orderedInputLog) {
    if (typeof entry.input !== 'object' || entry.input === null || Array.isArray(entry.input) ||
      Object.keys(entry.input as Record<string, unknown>).length !== 1 || !Object.hasOwn(entry.input, 'action')) return false;
    if (paused && entry.logical_tick > currentLogicalTick) return false;

    const action = (entry.input as { action?: unknown }).action;
    if (acknowledged) return false;
    if (action === 'pause') {
      if (paused) return false;
      paused = true;
    } else if (action === 'resume') {
      if (!paused) return false;
      paused = false;
    } else if (action === l03SyntheticAcknowledgmentProfileV2.acknowledgment_action) {
      if (entry.logical_tick < 1 || paused) return false;
      acknowledged = true;
    } else {
      return false;
    }
    currentLogicalTick = entry.logical_tick;
  }

  if (acknowledged) return currentLogicalTick === terminalLogicalTick && !paused;
  if (paused) return currentLogicalTick === terminalLogicalTick && terminalPaused;
  return currentLogicalTick <= terminalLogicalTick;
}

/** Strict L03 profile, cue acknowledgment input, terminal state, and pause state are one authority. */
export function hasStrictL03ReplayV2TerminalAuthority(value: unknown): value is ReplayV2 {
  if (!isReplayV2Shape(value)) return false;
  const replay = value as ReplayV2;
  return replay.lesson_binding.lesson_id === 'L03' &&
    isRegisteredLessonBindingV2(replay.lesson_binding) &&
    isL03SyntheticAcknowledgmentProfileV2(replay.l03_synthetic_acknowledgment_profile) &&
    replay.l03_synthetic_acknowledgment_profile.profile_id === l03SyntheticAcknowledgmentProfileV2.profile_id &&
    hasSoundL03V2AcknowledgmentProgression(replay.ordered_input_log, replay.l03_terminal_logical_tick!, replay.l03_terminal_paused!);
}

/**
 * Creates the persisted Replay V2 attempt without deriving progression from
 * browser cadence or input count. L01, L02, and L03 canonical terminal values are
 * part of their strict V2 variants; other variants deliberately have no such field.
 */
export function serializeReplayV2Attempt(
  replay: ReplayV2,
  orderedInputLog: readonly OrderedInput[],
  terminalLogicalTick?: number,
  terminalPaused?: boolean,
): ReplayV2 {
  const ordered_input_log = Object.freeze([...orderedInputLog]);
  if (replay.lesson_binding.lesson_id === 'L01' || replay.lesson_binding.lesson_id === 'L02' || replay.lesson_binding.lesson_id === 'L03') {
    const lesson = replay.lesson_binding.lesson_id;
    if (ordered_input_log.some((entry) =>
      typeof entry.input === 'object' && entry.input !== null && !Array.isArray(entry.input) && (entry.input as { action?: unknown }).action === 'reset',
    )) {
      throw new Error('REPLAY_ACTION_DISALLOWED');
    }
    if (typeof terminalLogicalTick !== 'number' || !Number.isSafeInteger(terminalLogicalTick) || terminalLogicalTick < 0) {
      throw new Error(`${lesson} Replay V2 terminal logical tick must be a non-negative safe integer.`);
    }
    if (typeof terminalPaused !== 'boolean') {
      throw new Error(`${lesson} Replay V2 terminal paused state must be a boolean.`);
    }
    if (ordered_input_log.some((entry) => entry.logical_tick > terminalLogicalTick)) {
      throw new Error(`${lesson} Replay V2 input is after the terminal logical tick.`);
    }
    if (lesson === 'L01') {
      const { l01_terminal_logical_tick: _previousBoundary, l01_terminal_paused: _previousPaused, ...identity } = replay;
      void _previousBoundary;
      void _previousPaused;
      return Object.freeze({ ...identity, ordered_input_log, l01_terminal_logical_tick: terminalLogicalTick, l01_terminal_paused: terminalPaused });
    }
    if (lesson === 'L03') {
      if (!isL03SyntheticAcknowledgmentProfileV2(replay.l03_synthetic_acknowledgment_profile)) throw new Error('L03 Replay V2 synthetic acknowledgment profile is invalid.');
      const { l03_terminal_logical_tick: _previousBoundary, l03_terminal_paused: _previousPaused, ...identity } = replay;
      void _previousBoundary;
      void _previousPaused;
      const serialized = Object.freeze({ ...identity, ordered_input_log, l03_terminal_logical_tick: terminalLogicalTick, l03_terminal_paused: terminalPaused });
      if (!hasStrictL03ReplayV2TerminalAuthority(serialized)) throw new Error('L03 Replay V2 terminal acknowledgment authority is invalid.');
      return serialized;
    }
    if (!isL02SyntheticTrimProfileV1(replay.l02_synthetic_trim_profile)) throw new Error('L02 Replay V2 synthetic trim profile is invalid.');
    const { l02_terminal_logical_tick: _previousBoundary, l02_terminal_paused: _previousPaused, ...identity } = replay;
    void _previousBoundary;
    void _previousPaused;
    return Object.freeze({ ...identity, ordered_input_log, l02_terminal_logical_tick: terminalLogicalTick, l02_terminal_paused: terminalPaused });
  }
  const { l01_terminal_logical_tick: _l01Boundary, l01_terminal_paused: _l01Paused, l02_synthetic_trim_profile: _l02Profile, l02_terminal_logical_tick: _l02Boundary, l02_terminal_paused: _l02Paused, l03_synthetic_acknowledgment_profile: _l03Profile, l03_terminal_logical_tick: _l03Boundary, l03_terminal_paused: _l03Paused, ...identity } = replay;
  void _l01Boundary;
  void _l01Paused;
  void _l02Profile;
  void _l02Boundary;
  void _l02Paused;
  void _l03Profile;
  void _l03Boundary;
  void _l03Paused;
  return Object.freeze({ ...identity, ordered_input_log });
}
/** V2 is separately discriminated: malformed V2 never falls back to the legacy parser. */
export async function resolveReplayV2(storedPayload: unknown): Promise<ReplayV2Resolution> {
  if (!isReplayV2Shape(storedPayload)) return { outcome: 'rejected', reason_code: 'REPLAY_V2_SCHEMA_INVALID', stored_payload: storedPayload };
  const replay = storedPayload as unknown as ReplayV2;
  if (!isRegisteredLessonBindingV2(replay.lesson_binding)) return { outcome: 'rejected', reason_code: 'REPLAY_ACTION_DISALLOWED', stored_payload: storedPayload };
  if (replay.lesson_binding.lesson_id === 'L01' && (!isL01SyntheticEnvironmentV1(replay.l01_synthetic_environment) || !sameL01Environment(replay.l01_synthetic_environment))) return { outcome: 'rejected', reason_code: 'REPLAY_V2_SCHEMA_INVALID', stored_payload: storedPayload };
  const scenario = await validateScenarioPackage(replay.scenario_snapshot);
  if (!scenario.ok || scenario.scenario.source_kind !== 'synthetic' || scenario.scenario.calibration_version !== 'synthetic-calibration-v1') return { outcome: 'rejected', reason_code: 'REPLAY_V2_SCENARIO_INVALID', stored_payload: storedPayload };
  if (!await isValidVariationTrace(replay.variation_trace, scenario.scenario, replay.seed)) return { outcome: 'rejected', reason_code: 'REPLAY_V2_VARIATION_INVALID', stored_payload: storedPayload };
  if (!replay.ordered_input_log.every((entry) => {
    const action = typeof entry.input === 'object' && entry.input !== null && !Array.isArray(entry.input)
      ? (entry.input as { action?: unknown }).action
      : undefined;
    return typeof entry.input === 'object' && entry.input !== null && !Array.isArray(entry.input) &&
      Object.keys(entry.input as Record<string, unknown>).length === 1 &&
      isLessonActionAllowedV2(replay.lesson_binding, action) &&
      ((replay.lesson_binding.lesson_id !== 'L01' && replay.lesson_binding.lesson_id !== 'L02' && replay.lesson_binding.lesson_id !== 'L03') || action !== 'reset');
  })) return { outcome: 'rejected', reason_code: 'REPLAY_ACTION_DISALLOWED', stored_payload: storedPayload };
  if (replay.lesson_binding.lesson_id === 'L01' && !hasStrictL01ReplayV2TerminalAuthority(replay)) {
    return { outcome: 'rejected', reason_code: 'REPLAY_V2_SCHEMA_INVALID', stored_payload: storedPayload };
  }
  if (replay.lesson_binding.lesson_id === 'L02' && !hasStrictL02ReplayV2TerminalAuthority(replay)) {
    return { outcome: 'rejected', reason_code: 'REPLAY_V2_SCHEMA_INVALID', stored_payload: storedPayload };
  }
  if (replay.lesson_binding.lesson_id === 'L03' && !hasStrictL03ReplayV2TerminalAuthority(replay)) {
    return { outcome: 'rejected', reason_code: 'REPLAY_V2_SCHEMA_INVALID', stored_payload: storedPayload };
  }
  return { outcome: 'accepted', replay };
}
