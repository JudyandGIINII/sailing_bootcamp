import { describe, expect, it } from 'vitest';
import { canonicalizeL01Number } from '../../src/contracts/l01-synthetic-environment.js';
import { polarKinematicsEnvironmentV1 } from '../../src/contracts/polar-kinematics-environment.js';
import { trainingSloopPolarV1 } from '../../src/contracts/polar-profile.js';
import { normalizeL01Heading } from '../../src/sim/l01-synthetic-model.js';
import { createInitialPolarKinematicState, transitionPolarKinematicState } from '../../src/sim/polar-kinematics-model.js';
import { lookupTargetSpeedMps } from '../../src/sim/polar.js';
import { INITIAL_SAIL_TRIM, sailCorrectionFactor } from '../../src/sim/sail-trim.js';
import { SEMIDIURNAL_PERIOD_MS } from '../../src/sim/tidal-current.js';

const noCurrent = polarKinematicsEnvironmentV1;
// A quarter period gives sin(phase) === 1 exactly: current_speed_mps === MAX_CURRENT_MPS
// (1.5) and current_to_rad === FLOOD_TO_RAD (PI/2), matching this suite's prior
// hardcoded current fixture without changing any downstream expected value below.
const withCurrent = Object.freeze({ ...polarKinematicsEnvironmentV1, current_epoch_ms: SEMIDIURNAL_PERIOD_MS / 4 });

/**
 * Independently reconstructs the signed apparent-wind-angle formula (not imported
 * from the module under test) so the lag test can pin the SUT's polar input to a
 * specific stored apparent-wind vector, rather than merely restating its output.
 */
function signedApparentWindAngle(apparentFromRad: number, headingRad: number): number {
  const difference = normalizeL01Heading(apparentFromRad - headingRad);
  return difference > Math.PI ? difference - Math.PI * 2 : difference;
}

describe('polar kinematics model', () => {
  it('seeds the initial apparent wind from true wind at zero boat speed', () => {
    const initial = createInitialPolarKinematicState(noCurrent);
    // State is always canonicalized (6 decimals), including the tick-0 seed, so this
    // pins the precision contract rather than comparing to the raw, full-precision literal.
    expect(initial.apparent_wind_from_rad).toBe(canonicalizeL01Number(noCurrent.true_wind_from_rad));
    expect(initial.apparent_wind_speed_mps).toBe(canonicalizeL01Number(noCurrent.true_wind_speed_mps));
    expect(initial.logical_tick).toBe(0);
  });

  it('derives speed through water from the polar instead of a fixed constant', () => {
    const initial = createInitialPolarKinematicState(noCurrent);
    const transition = transitionPolarKinematicState(noCurrent, initial, []);
    // Heading 0 (north) with wind from PI/2 (east) gives a 90deg apparent wind angle,
    // which lands exactly on the polar's awa=90deg/tws=6 grid cell: 3.5 m/s.
    expect(transition.stw_mps).toBeGreaterThan(0);
    expect(transition.stw_mps).toBeCloseTo(3.5, 6);
  });

  it('makes ground velocity equal water velocity when there is no current', () => {
    const initial = createInitialPolarKinematicState(noCurrent);
    const transition = transitionPolarKinematicState(noCurrent, initial, []);
    expect(transition.ground_velocity_mps).toEqual(transition.water_velocity_mps);
    expect(transition.current_velocity_mps).toEqual({ x: 0, y: 0 });
  });

  it('composes ground velocity as water velocity plus the current vector', () => {
    const initial = createInitialPolarKinematicState(withCurrent);
    const transition = transitionPolarKinematicState(withCurrent, initial, []);
    // Independently derived expected ground vector (not restating the SUT's own
    // arithmetic): heading 0 + apparent wind from PI/2 at TWS 6 gives stw 3.5 m/s due
    // north (water = {x:0, y:3.5}); current is 1.5 m/s due east ({x:1.5, y:0}); their
    // sum is {x:1.5, y:3.5}.
    expect(transition.ground_velocity_mps.x).toBeCloseTo(1.5, 6);
    expect(transition.ground_velocity_mps.y).toBeCloseTo(3.5, 6);
    expect(transition.current_velocity_mps.x).toBeCloseTo(1.5, 6);
    expect(transition.current_velocity_mps.y).toBeCloseTo(0, 6);
  });

  it('stops without throwing when the boat points head to wind and there is no current', () => {
    const headToWind = Object.freeze({ ...noCurrent, true_wind_from_rad: 0 });
    const initial = createInitialPolarKinematicState(headToWind);
    const transition = transitionPolarKinematicState(headToWind, initial, []);
    expect(transition.stw_mps).toBe(0);
    expect(transition.displacement_m).toEqual({ x: 0, y: 0 });
    expect(transition.next_state.position_m).toEqual(initial.position_m);
  });

  it('applies helm within the same tick so steering changes speed immediately', () => {
    const initial = createInitialPolarKinematicState(noCurrent);
    const straight = transitionPolarKinematicState(noCurrent, initial, []);
    const turned = transitionPolarKinematicState(noCurrent, initial, [
      { logical_tick: 0, sequence: 0, helm_command: 'starboard' as const },
    ]);
    expect(turned.next_state.heading_rad).not.toBe(straight.next_state.heading_rad);
    expect(turned.stw_mps).not.toBe(straight.stw_mps);
    // Pin the turned case to its expected polar value: heading advances by one full
    // helm step to starboard (PI/8) and the AWA is measured against the tick-0 seed
    // apparent wind (still PI/2, since this is still the first transition), landing
    // between the 60deg and 90deg grid rows at TWS 6.
    // 3.275 is the raw polar value at AWA 67.5deg / TWS 6; the declared trim
    // correction for the initial half-hauled sheets scales it down from there.
    expect(turned.stw_mps).toBeCloseTo(3.275 * sailCorrectionFactor(INITIAL_SAIL_TRIM, signedApparentWindAngle(
      initial.apparent_wind_from_rad,
      turned.next_state.heading_rad,
    )), 6);
  });

  it('indexes the polar by the PREVIOUS tick\'s stored apparent wind vector, not a freshly recomputed one', () => {
    // Turn every tick so heading keeps changing, which makes the two candidate lag
    // semantics (previous-tick apparent wind vs. same-tick freshly recomputed
    // apparent wind) diverge numerically -- a test that never turns would pass under
    // either semantics and prove nothing.
    const tick0 = createInitialPolarKinematicState(noCurrent);
    const tick1 = transitionPolarKinematicState(noCurrent, tick0, [
      { logical_tick: 0, sequence: 0, helm_command: 'starboard' as const },
    ]);
    const tick2 = transitionPolarKinematicState(noCurrent, tick1.next_state, [
      { logical_tick: 1, sequence: 0, helm_command: 'starboard' as const },
    ]);

    // The apparent wind stored after tick 1 must be recomputed from ground velocity,
    // not simply carried through from the tick-0 seed.
    expect(tick1.next_state.apparent_wind_from_rad).not.toBe(tick0.apparent_wind_from_rad);

    // Pin tick 2's stw_mps to the value produced by looking up the polar with the
    // angle between tick 1's STORED apparent_wind_from_rad and tick 2's heading --
    // i.e. the specific one-tick-lag semantics the design claims, not a same-tick
    // recomputation.
    const expectedAwaFromLaggedVector = signedApparentWindAngle(
      tick1.next_state.apparent_wind_from_rad,
      tick2.next_state.heading_rad,
    );
    const expectedStwFromLaggedVector = lookupTargetSpeedMps(
      trainingSloopPolarV1,
      expectedAwaFromLaggedVector,
      noCurrent.true_wind_speed_mps,
    ) * sailCorrectionFactor(tick1.next_state.sail_trim, expectedAwaFromLaggedVector);
    expect(tick2.stw_mps).toBeCloseTo(expectedStwFromLaggedVector, 6);

    // Contrast case: if the polar were instead indexed by tick 2's OWN freshly
    // recomputed apparent wind against tick 2's own heading, it would give a
    // different number given the heading changed across ticks. Confirms this test
    // actually discriminates between the two semantics.
    const awaFromFreshVector = signedApparentWindAngle(
      tick2.next_state.apparent_wind_from_rad,
      tick2.next_state.heading_rad,
    );
    const stwFromFreshVector = lookupTargetSpeedMps(
      trainingSloopPolarV1,
      awaFromFreshVector,
      noCurrent.true_wind_speed_mps,
    ) * sailCorrectionFactor(tick2.next_state.sail_trim, awaFromFreshVector);
    expect(stwFromFreshVector).not.toBeCloseTo(tick2.stw_mps, 6);
  });

  it('is deterministic and does not mutate its inputs', () => {
    const initial = createInitialPolarKinematicState(withCurrent);
    const controls = [{ logical_tick: 0, sequence: 0, helm_command: 'port' as const }];
    const before = structuredClone(initial);
    const first = transitionPolarKinematicState(withCurrent, initial, controls);
    const second = transitionPolarKinematicState(withCurrent, initial, controls);
    expect(first).toEqual(second);
    expect(initial).toEqual(before);
  });

  it('rejects invalid states and controls', () => {
    const initial = createInitialPolarKinematicState(noCurrent);
    expect(() => transitionPolarKinematicState(noCurrent, { ...initial, heading_rad: Number.NaN }, [])).toThrow(TypeError);
    expect(() => transitionPolarKinematicState(noCurrent, initial, [
      { logical_tick: 5, sequence: 0, helm_command: 'port' as const },
    ])).toThrow(TypeError);
  });
});
