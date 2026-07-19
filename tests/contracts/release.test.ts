import { describe, expect, it } from 'vitest';
import {
  hasValidReleaseEligibility,
  isReleaseEligible,
  type ValidationRecord,
} from '../../src/contracts/release.js';

const releaseVersionBindings = {
  scenario_version: 'scenario-v1',
  model_version: 'model-v1',
  boat_profile_version: 'boat-profile-v1',
  contract_version: 'lesson-contract-model-interface-v1',
  coordinate_contract_version: 'coordinate-contract-v1',
  determinism_contract_version: 'determinism-contract-v1',
  comparison_policy_version: 'comparison-policy-v1',
} as const;

function record(): ValidationRecord {
  return {
    disposition: 'validated',
    release_eligible: true,
    version_bindings: Object.fromEntries(
      Object.entries(releaseVersionBindings).map(([name, value]) => [name, { value, approval: 'approved' }]),
    ) as ValidationRecord['version_bindings'],
  };
}

describe('release fail-closed contract', () => {
  it('permits only validated, fully approved version bindings', () => {
    expect(isReleaseEligible(record())).toBe(true);
    expect(hasValidReleaseEligibility(record())).toBe(true);
  });

  it('rejects a release assertion for any non-validated disposition', () => {
    const candidate = record();
    candidate.disposition = 'pending';
    expect(isReleaseEligible(candidate)).toBe(false);
    expect(hasValidReleaseEligibility(candidate)).toBe(false);
  });

  it.each(['assumption', 'partially_validated', 'rejected', 'missing', 'stale'] as const)(
    'rejects a release assertion for the %s registry disposition',
    (disposition) => {
      const candidate = record();
      candidate.disposition = disposition;
      expect(isReleaseEligible(candidate)).toBe(false);
      expect(hasValidReleaseEligibility(candidate)).toBe(false);
    },
  );

  it.each(['draft', 'tbd', 'incompatible', 'missing'] as const)(
    'rejects a release assertion with a %s binding',
    (approval) => {
      const candidate = record();
      candidate.version_bindings.comparison_policy_version!.approval = approval;
      expect(isReleaseEligible(candidate)).toBe(false);
      expect(hasValidReleaseEligibility(candidate)).toBe(false);
    },
  );

  it('rejects a release assertion with an unapproved or missing required binding', () => {
    const unapproved = record();
    unapproved.version_bindings.comparison_policy_version = {
      value: releaseVersionBindings.comparison_policy_version,
      approval: 'unapproved',
    };
    expect(hasValidReleaseEligibility(unapproved)).toBe(false);

    const missing = record();
    delete missing.version_bindings.comparison_policy_version;
    expect(isReleaseEligible(missing)).toBe(false);
    expect(hasValidReleaseEligibility(missing)).toBe(false);
  });

  it.each([
    ['draft', 'model-v1-draft'],
    ['TBD', 'model-v1-TBD'],
  ])('rejects an approved binding with a %s value', (_label, value) => {
    const candidate = record();
    candidate.version_bindings.model_version = { value, approval: 'approved' };
    expect(isReleaseEligible(candidate)).toBe(false);
    expect(hasValidReleaseEligibility(candidate)).toBe(false);
  });
});
