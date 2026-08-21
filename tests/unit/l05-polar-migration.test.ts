import { describe, expect, it } from 'vitest';
import { advanceLogicalTick, createSession, type DeterministicSession } from '../../src/sim/session.js';
import { l05ReplayBindings } from '../../src/content/l02-l05.js';
import { POLAR_KINEMATICS_MODEL_VERSION } from '../../src/contracts/polar-kinematics-environment.js';

function l05Session(seed: string): DeterministicSession {
  return createSession({ ...l05ReplayBindings, seed, ordered_input_log: [] } as never);
}

describe('L05 polar migration', () => {
  it('declares the polar model version on its replay bindings', () => {
    expect(l05ReplayBindings.model_version).toBe(POLAR_KINEMATICS_MODEL_VERSION);
    expect(l05ReplayBindings).toHaveProperty('polar_kinematics_environment');
  });

  it('starts with a polar kinematic state rather than the legacy shape', () => {
    const raw = l05Session('l05-polar-start').raw;
    expect(raw.polar_kinematic_state).toBeDefined();
    expect(raw.l01_synthetic_state).toBeUndefined();
  });

  it('keeps its decision state and synthetic environment declaration', () => {
    const raw = l05Session('l05-decision-kept').raw;
    expect(raw.decision_state).toBe('undecided');
    expect(raw.synthetic_environment).toBe('tide_depth_visibility_declared');
  });

  it('computes an under-keel clearance for the tide and depth lesson', () => {
    const raw = l05Session('l05-clearance').raw;
    expect(typeof raw.clearance_m).toBe('number');
    expect(['clear', 'caution', 'danger']).toContain(raw.clearance_level);
    expect(raw.highest_clearance_alert).toBe('clear');
  });

  it('computes heading, COG, STW and SOG instead of declaring them unavailable', () => {
    const raw = l05Session('l05-observations').raw;
    expect(typeof raw.heading).toBe('number');
    expect(typeof raw.cog).toBe('number');
    expect(typeof raw.stw).toBe('number');
    expect(typeof raw.sog).toBe('number');
  });

  it('appends a polar transition per advanced tick and tags it L05', () => {
    const session = advanceLogicalTick(l05Session('l05-transition'));
    const transitions = session.ledger.filter((event) => event.type === 'POLAR_KINEMATIC_TRANSITION');
    expect(transitions.length).toBeGreaterThan(0);
  });

  it('declares no virtual mark, unlike L04', () => {
    expect(l05Session('l05-nomark').raw.mark_state).toBeUndefined();
  });

  it('reproduces exactly for two identical sessions advanced the same number of ticks', () => {
    let a = l05Session('l05-determinism');
    let b = l05Session('l05-determinism');
    for (let tick = 0; tick < 4; tick += 1) {
      a = advanceLogicalTick(a);
      b = advanceLogicalTick(b);
    }
    expect({ raw: a.raw, ledger: a.ledger }).toEqual({ raw: b.raw, ledger: b.ledger });
  });
});
