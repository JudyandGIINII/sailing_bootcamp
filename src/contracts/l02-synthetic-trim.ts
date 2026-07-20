/**
 * Closed, synthetic L02 control-input profile. This declares only the
 * acknowledgment contract; it supplies no physical or domain authority.
 */
export const L02_SYNTHETIC_TRIM_PROFILE_ID = 'l02.synthetic.trim-input-ack.v1' as const;

export interface L02SyntheticTrimProfileV1 {
  readonly profile_id: typeof L02_SYNTHETIC_TRIM_PROFILE_ID;
  readonly profile_version: 'v1';
  readonly authority: 'synthetic-control-input-acknowledgment-only';
  readonly physical_response: 'not-modeled';
}

export const l02SyntheticTrimProfileV1: L02SyntheticTrimProfileV1 = Object.freeze({
  profile_id: L02_SYNTHETIC_TRIM_PROFILE_ID,
  profile_version: 'v1',
  authority: 'synthetic-control-input-acknowledgment-only',
  physical_response: 'not-modeled',
});

export function isL02SyntheticTrimProfileV1(value: unknown): value is L02SyntheticTrimProfileV1 {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const candidate = value as Record<string, unknown>;
  return Object.keys(candidate).length === 4 &&
    candidate.profile_id === l02SyntheticTrimProfileV1.profile_id &&
    candidate.profile_version === l02SyntheticTrimProfileV1.profile_version &&
    candidate.authority === l02SyntheticTrimProfileV1.authority &&
    candidate.physical_response === l02SyntheticTrimProfileV1.physical_response;
}
