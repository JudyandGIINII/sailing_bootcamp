export type ValidationDisposition =
  | 'validated'
  | 'rejected'
  | 'pending'
  | 'assumption'
  | 'partially_validated'
  | 'missing'
  | 'stale';
export type VersionApproval =
  | 'approved'
  | 'draft'
  | 'tbd'
  | 'unapproved'
  | 'incompatible'
  | 'missing';

export interface VersionBinding {
  value: string;
  approval: VersionApproval;
}

export const REQUIRED_VERSION_BINDINGS = [
  'scenario_version',
  'model_version',
  'boat_profile_version',
  'contract_version',
  'coordinate_contract_version',
  'determinism_contract_version',
  'comparison_policy_version',
] as const;

export type RequiredVersionBinding = (typeof REQUIRED_VERSION_BINDINGS)[number];

export interface ValidationRecord {
  disposition: ValidationDisposition;
  release_eligible: boolean;
  version_bindings: Partial<Record<RequiredVersionBinding, VersionBinding>>;
}

/** Versioned schema for the release gate record; missing bindings fail closed. */
export const validationRecordSchemaV1Draft = {
  version: 'validation-record-v1-draft',
  required_version_bindings: REQUIRED_VERSION_BINDINGS,
  release_eligible_requires: 'validated disposition and approved, non-empty, non-TBD, non-draft bindings',
} as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isVersionBinding(value: unknown): value is VersionBinding {
  if (!isRecord(value)) return false;
  return (
    typeof value.value === 'string' &&
    (value.approval === 'approved' ||
      value.approval === 'draft' ||
      value.approval === 'tbd' ||
      value.approval === 'unapproved' ||
      value.approval === 'incompatible' ||
      value.approval === 'missing')
  );
}

export function isValidationRecord(value: unknown): value is ValidationRecord {
  if (!isRecord(value) || !isRecord(value.version_bindings)) return false;
  return (
    (value.disposition === 'validated' ||
      value.disposition === 'rejected' ||
      value.disposition === 'pending' ||
      value.disposition === 'assumption' ||
      value.disposition === 'partially_validated' ||
      value.disposition === 'missing' ||
      value.disposition === 'stale') &&
    typeof value.release_eligible === 'boolean' &&
    Object.values(value.version_bindings).every(isVersionBinding)
  );
}

export function isReleaseEligible(record: unknown): boolean {
  if (!isValidationRecord(record) || !record.release_eligible) return false;
  if (record.disposition !== 'validated') return false;
  return REQUIRED_VERSION_BINDINGS.every((field) => {
    const binding = record.version_bindings[field];
    return (
      binding !== undefined &&
      binding.value.trim().length > 0 &&
      !/(?:tbd|draft)/i.test(binding.value) &&
      binding.approval === 'approved'
    );
  });
}

/** Rejects records that assert release eligibility without satisfying the invariant. */
export function hasValidReleaseEligibility(record: unknown): boolean {
  if (!isValidationRecord(record)) return false;
  return !record.release_eligible || isReleaseEligible(record);
}
