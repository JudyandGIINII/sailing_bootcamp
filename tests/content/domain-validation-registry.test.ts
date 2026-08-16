import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { POLAR_KINEMATICS_MODEL_VERSION, polarKinematicsEnvironmentV1 } from '../../src/contracts/polar-kinematics-environment.js';
import { MIN_TRIM_EFFICIENCY, REEF_SPEED_FACTOR, TRIM_STEP } from '../../src/sim/sail-trim.js';
import { CLEARANCE_CAUTION_M, CLEARANCE_DANGER_M, TIDE_AMPLITUDE_M } from '../../src/sim/depth-clearance.js';
import { MAX_CURRENT_MPS } from '../../src/sim/tidal-current.js';

/**
 * Nothing in the app loads this registry, so it can silently drift from the code
 * it is supposed to govern — which is exactly what happened when the model
 * version moved on and the record kept naming an older one. These assertions
 * are the only thing tying the two together.
 */
const registry = readFileSync('docs/content/domain-validation-registry.yaml', 'utf8');
const polarRecord = registry.slice(registry.indexOf('validation_record_id: VR-POLAR-v0'));

describe('domain validation registry', () => {
  it('binds VR-POLAR-v0 to the model version actually shipped', () => {
    expect(polarRecord).toContain(`model_version: ${POLAR_KINEMATICS_MODEL_VERSION}`);
  });

  it('keeps VR-POLAR-v0 an unapproved assumption', () => {
    expect(polarRecord).toContain('disposition: assumption');
    expect(polarRecord).toContain('reviewer: null');
  });

  it('declares every invented constant the polar model ships', () => {
    for (const value of [
      String(MIN_TRIM_EFFICIENCY),
      String(REEF_SPEED_FACTOR),
      String(TRIM_STEP),
      String(TIDE_AMPLITUDE_M),
      String(CLEARANCE_CAUTION_M),
      String(CLEARANCE_DANGER_M),
      String(MAX_CURRENT_MPS),
      String(polarKinematicsEnvironmentV1.seabed_depth_m),
      String(polarKinematicsEnvironmentV1.draft_m),
    ]) {
      expect(polarRecord).toContain(value);
    }
  });

  it('names every lesson bound to the polar model', () => {
    expect(polarRecord.slice(0, polarRecord.indexOf('claim_or_assumption'))).toContain('- L04');
    expect(polarRecord.slice(0, polarRecord.indexOf('claim_or_assumption'))).toContain('- L06');
  });

  it('never claims real-world tidal, depth or navigational authority', () => {
    for (const forbidden of ['not real tide data', 'harmonic constants', 'charted depth', 'navigational prediction']) {
      expect(polarRecord).toContain(forbidden);
    }
  });
});
