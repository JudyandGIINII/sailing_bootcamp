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

export type ReplayResolution =
  | { outcome: 'accepted'; replay: ReplayIdentity }
  | {
      outcome: 'rejected';
      reason_code: 'REPLAY_IDENTITY_MISSING' | 'REPLAY_IDENTITY_INCOMPATIBLE' | 'REPLAY_PAYLOAD_CORRUPT';
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
  return { outcome: 'accepted', replay: storedPayload };
}
