import { describe, expect, it } from 'vitest';
import { l01ReplayBindings } from '../../src/content/l01.js';
import { evaluateL01Load, evaluatePrototypeEligibility, evaluateReleaseEligibility, validateL01ReplayPayload } from '../../src/gates/eligibility.js';
import type { ReplayIdentity } from '../../src/contracts/replay.js';

describe('L01 content and gate eligibility', () => {
  it('admits exactly the declared L01/Sloop/actions/binding path', () => {
    expect(evaluateL01Load('L01', 'training-sloop-v1', ['helm_port', 'pause'], l01ReplayBindings)).toMatchObject({ eligible: true });
    expect(evaluateL01Load('L02', 'training-sloop-v1', [], l01ReplayBindings).reasons).toContain('UNSUPPORTED_LESSON');
    expect(evaluateL01Load('L01', 'other-profile', [], l01ReplayBindings).reasons).toContain('UNSUPPORTED_PROFILE');
    expect(evaluateL01Load('L01', 'training-sloop-v1', ['reef'], l01ReplayBindings).reasons).toContain('UNSUPPORTED_ACTION');
    expect(evaluateL01Load('L01', 'training-sloop-v1', [], { ...l01ReplayBindings, comparison_policy_version: 'other' }).reasons).toContain('INCOMPATIBLE_BINDING');
    const { comparison_policy_version: _missing, ...missingVersion } = l01ReplayBindings;
    expect(evaluateL01Load('L01', 'training-sloop-v1', [], missingVersion as typeof l01ReplayBindings).reasons).toContain('INCOMPATIBLE_BINDING');
  });

  it.each(['L02', 'L03', 'L04', 'L05'])('fails closed for unsupported AP-0B lesson %s', (lessonId) => {
    expect(evaluateL01Load(
      lessonId,
      'training-sloop-v1',
      [],
      l01ReplayBindings,
    )).toEqual({ eligible: false, mode: 'prototype', reasons: ['UNSUPPORTED_LESSON'] });
  });

  it('labels the assumption as a prototype allowance and always rejects the current release state', () => {
    expect(evaluatePrototypeEligibility()).toEqual({ eligible: true, mode: 'prototype', reasons: ['UNVALIDATED_PROTOTYPE'] });
    expect(evaluateReleaseEligibility(undefined)).toMatchObject({ eligible: false, mode: 'release' });
  });

  it('validates the complete replay binding and rejects malformed payloads with a stable reason', () => {
    const replay: ReplayIdentity = { ...l01ReplayBindings, seed: 'test', ordered_input_log: [] };
    expect(validateL01ReplayPayload(replay).eligible).toBe(true);
    expect(validateL01ReplayPayload({ ...replay, comparison_policy_version: 'other' })).toEqual({ eligible: false, mode: 'prototype', reasons: ['REPLAY_IDENTITY_INCOMPATIBLE'] });
    expect(validateL01ReplayPayload({ legacy: true })).toEqual({ eligible: false, mode: 'prototype', reasons: ['REPLAY_IDENTITY_MISSING'] });
  });
});
