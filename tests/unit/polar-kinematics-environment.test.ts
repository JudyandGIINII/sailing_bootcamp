import { describe, expect, it } from 'vitest';
import {
  assertPolarKinematicsEnvironmentV1,
  polarKinematicsEnvironmentV1,
  POLAR_KINEMATICS_MODEL_VERSION,
} from '../../src/contracts/polar-kinematics-environment.js';

describe('polar kinematics environment contract', () => {
  it('declares a distinct model version from the retained L01 kinematics model', () => {
    expect(POLAR_KINEMATICS_MODEL_VERSION).toBe('polar-kinematics-v2');
    expect(polarKinematicsEnvironmentV1.model_id).toBe('polar-kinematics');
    expect(polarKinematicsEnvironmentV1.polar_profile_id).toBe('training-sloop-synthetic-polar');
  });

  it('declares a current-derivation epoch and no fixed forward speed', () => {
    expect(Number.isSafeInteger(polarKinematicsEnvironmentV1.current_epoch_ms)).toBe(true);
    expect(polarKinematicsEnvironmentV1.current_epoch_ms).toBeGreaterThanOrEqual(0);
    expect(Object.hasOwn(polarKinematicsEnvironmentV1, 'forward_speed_mps')).toBe(false);
  });

  it('accepts the declared profile and rejects malformed profiles', () => {
    expect(() => assertPolarKinematicsEnvironmentV1(polarKinematicsEnvironmentV1)).not.toThrow();
    expect(() => assertPolarKinematicsEnvironmentV1({ ...polarKinematicsEnvironmentV1, current_epoch_ms: -1 })).toThrow(TypeError);
    expect(() => assertPolarKinematicsEnvironmentV1({ ...polarKinematicsEnvironmentV1, model_id: 'other' })).toThrow(TypeError);
    expect(() => assertPolarKinematicsEnvironmentV1(null)).toThrow(TypeError);
  });

  it('rejects profiles with a missing key or an extra unknown key', () => {
    const { current_epoch_ms, ...missingKey } = polarKinematicsEnvironmentV1;
    void current_epoch_ms;
    expect(() => assertPolarKinematicsEnvironmentV1(missingKey)).toThrow(TypeError);

    const extraKey = { ...polarKinematicsEnvironmentV1, unexpected_field: 1 };
    expect(() => assertPolarKinematicsEnvironmentV1(extraKey)).toThrow(TypeError);
  });

  it('enforces a non-negative safe integer for current_epoch_ms and > 0 for logical_step_seconds', () => {
    expect(() => assertPolarKinematicsEnvironmentV1({ ...polarKinematicsEnvironmentV1, current_epoch_ms: 0 })).not.toThrow();
    expect(() => assertPolarKinematicsEnvironmentV1({ ...polarKinematicsEnvironmentV1, current_epoch_ms: -1 })).toThrow(TypeError);
    expect(() => assertPolarKinematicsEnvironmentV1({ ...polarKinematicsEnvironmentV1, current_epoch_ms: 1.5 })).toThrow(TypeError);
    expect(() => assertPolarKinematicsEnvironmentV1({ ...polarKinematicsEnvironmentV1, logical_step_seconds: 0 })).toThrow(TypeError);
  });
});
