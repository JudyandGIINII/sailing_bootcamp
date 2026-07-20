import { getLessonManifest, isLessonActionAllowed, isLessonActionAllowedV2 } from '../content/lesson-manifest.js';
import { validateScenarioPackage, type ScenarioPackageV1 } from './scenario.js';
import { isValidVariationTrace, type VariationTraceV1 } from '../sim/scenario-variation.js';

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

/** Versioned, renderer-independent shape for stored replay identity. */
export const replayIdentitySchemaV1Draft = {
  version: 'replay-identity-v1-draft',
  required_fields: REPLAY_IDENTITY_FIELDS,
  additional_fields: 'forbidden',
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

export function isReplayIdentity(value: unknown): value is ReplayIdentity {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const candidate = value as Record<string, unknown>;
  const keys = Object.keys(candidate);
  if (keys.length !== REPLAY_IDENTITY_FIELDS.length) return false;
  if (!REPLAY_IDENTITY_FIELDS.every((field) => Object.hasOwn(candidate, field))) return false;

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
    isNonEmptyString(candidate.comparison_policy_version)
  );
}

export function resolveStoredReplay(
  storedPayload: unknown,
  supportedBindings: Readonly<Pick<ReplayIdentity, Exclude<ReplayIdentityField, 'seed' | 'ordered_input_log'>>>,
): ReplayResolution {
  if (!isReplayIdentity(storedPayload)) {
    const object = typeof storedPayload === 'object' && storedPayload !== null && !Array.isArray(storedPayload)
      ? storedPayload as Record<string, unknown> : undefined;
    const hasMissingIdentityField = object !== undefined && REPLAY_IDENTITY_FIELDS.some((field) => !Object.hasOwn(object, field));
    return { outcome: 'rejected', reason_code: hasMissingIdentityField ? 'REPLAY_IDENTITY_MISSING' : 'REPLAY_PAYLOAD_CORRUPT', stored_payload: storedPayload };
  }

  for (const field of REPLAY_IDENTITY_FIELDS) {
    if (field === 'seed' || field === 'ordered_input_log') continue;
    if (storedPayload[field] !== supportedBindings[field]) {
      return { outcome: 'rejected', reason_code: 'REPLAY_IDENTITY_INCOMPATIBLE', stored_payload: storedPayload };
    }
  }
  if (!storedPayload.ordered_input_log.every((entry) => isCanonicalLessonActionInput(storedPayload, entry.input))) {
    return { outcome: 'rejected', reason_code: 'REPLAY_ACTION_DISALLOWED', stored_payload: storedPayload };
  }
  return { outcome: 'accepted', replay: storedPayload };
}

/** Full-identity comparison for a declared replay fixture; no aliases or migrations. */
export function resolveExactReplayIdentity(storedPayload: unknown, expectedIdentity: ReplayIdentity): ReplayResolution {
  if (!isReplayIdentity(storedPayload)) {
    const candidate = typeof storedPayload === 'object' && storedPayload !== null && !Array.isArray(storedPayload) ? storedPayload as Record<string, unknown> : undefined;
    return { outcome: 'rejected', reason_code: candidate && REPLAY_IDENTITY_FIELDS.some((field) => !Object.hasOwn(candidate, field)) ? 'REPLAY_IDENTITY_MISSING' : 'REPLAY_PAYLOAD_CORRUPT', stored_payload: storedPayload };
  }
  for (const field of REPLAY_IDENTITY_FIELDS) {
    if (JSON.stringify(storedPayload[field]) !== JSON.stringify(expectedIdentity[field])) {
      return { outcome: 'rejected', reason_code: 'REPLAY_IDENTITY_INCOMPATIBLE', stored_payload: storedPayload };
    }
  }
  if (!storedPayload.ordered_input_log.every((entry) => isCanonicalLessonActionInput(storedPayload, entry.input))) {
    return { outcome: 'rejected', reason_code: 'REPLAY_ACTION_DISALLOWED', stored_payload: storedPayload };
  }
  return { outcome: 'accepted', replay: storedPayload };
}

const v2Keys = ['schema_version', 'lesson_binding', 'scenario_snapshot', 'variation_trace', 'seed', 'ordered_input_log'] as const;
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
  if (!exactKeys(value, v2Keys)) return false;
  const candidate = value as Record<string, unknown>;
  return candidate.schema_version === REPLAY_V2_SCHEMA_VERSION && isNonEmptyString(candidate.seed) && Array.isArray(candidate.ordered_input_log) && candidate.ordered_input_log.every(isReplayV2OrderedInput) && isStrictlyOrderedInputLog(candidate.ordered_input_log) && exactKeys(candidate.lesson_binding, lessonBindingKeys) && Object.values(candidate.lesson_binding as Record<string, unknown>).every(isNonEmptyString) && ['L01', 'L02', 'L03', 'L04', 'L05'].includes((candidate.lesson_binding as Record<string, unknown>).lesson_id as string);
}
/** V2 is separately discriminated: malformed V2 never falls back to the legacy parser. */
export async function resolveReplayV2(storedPayload: unknown): Promise<ReplayV2Resolution> {
  if (!isReplayV2Shape(storedPayload)) return { outcome: 'rejected', reason_code: 'REPLAY_V2_SCHEMA_INVALID', stored_payload: storedPayload };
  const replay = storedPayload as unknown as ReplayV2;
  if (!isRegisteredLessonBindingV2(replay.lesson_binding)) return { outcome: 'rejected', reason_code: 'REPLAY_ACTION_DISALLOWED', stored_payload: storedPayload };
  const scenario = await validateScenarioPackage(replay.scenario_snapshot);
  if (!scenario.ok || scenario.scenario.source_kind !== 'synthetic' || scenario.scenario.calibration_version !== 'synthetic-calibration-v1') return { outcome: 'rejected', reason_code: 'REPLAY_V2_SCENARIO_INVALID', stored_payload: storedPayload };
  if (!await isValidVariationTrace(replay.variation_trace, scenario.scenario, replay.seed)) return { outcome: 'rejected', reason_code: 'REPLAY_V2_VARIATION_INVALID', stored_payload: storedPayload };
  if (!replay.ordered_input_log.every((entry) => typeof entry.input === 'object' && entry.input !== null && !Array.isArray(entry.input) && Object.keys(entry.input as Record<string, unknown>).length === 1 && isLessonActionAllowedV2(replay.lesson_binding, (entry.input as { action?: unknown }).action))) return { outcome: 'rejected', reason_code: 'REPLAY_ACTION_DISALLOWED', stored_payload: storedPayload };
  return { outcome: 'accepted', replay };
}
