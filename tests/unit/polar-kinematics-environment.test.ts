import { describe, expect, it } from 'vitest';
import {
  assertPolarKinematicsEnvironmentV1,
  polarKinematicsEnvironmentV1,
  POLAR_KINEMATICS_MODEL_VERSION,
} from '../../src/contracts/polar-kinematics-environment.js';

describe('polar kinematics environment contract', () => {
  it('declares a distinct model version from the retained L01 kinematics model', () => {
    expect(POLAR_KINEMATICS_MODEL_VERSION).toBe('polar-kinematics-v1');
    expect(polarKinematicsEnvironmentV1.model_id).toBe('polar-kinematics');
    expect(polarKinematicsEnvironmentV1.polar_profile_id).toBe('training-sloop-synthetic-polar');
  });

  it('declares a current vector and no fixed forward speed', () => {
    expect(polarKinematicsEnvironmentV1.current_speed_mps).toBeGreaterThanOrEqual(0);
    expect(Object.hasOwn(polarKinematicsEnvironmentV1, 'forward_speed_mps')).toBe(false);
  });

  it('accepts the declared profile and rejects malformed profiles', () => {
    expect(() => assertPolarKinematicsEnvironmentV1(polarKinematicsEnvironmentV1)).not.toThrow();
    expect(() => assertPolarKinematicsEnvironmentV1({ ...polarKinematicsEnvironmentV1, current_speed_mps: -1 })).toThrow(TypeError);
    expect(() => assertPolarKinematicsEnvironmentV1({ ...polarKinematicsEnvironmentV1, model_id: 'other' })).toThrow(TypeError);
    expect(() => assertPolarKinematicsEnvironmentV1(null)).toThrow(TypeError);
  });
});
