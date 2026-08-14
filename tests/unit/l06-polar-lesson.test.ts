import { describe, expect, it } from 'vitest';
import { l06Manifest, l06ReplayBindings } from '../../src/content/l06-polar.js';
import { POLAR_KINEMATICS_MODEL_VERSION, polarKinematicsEnvironmentV1 } from '../../src/contracts/polar-kinematics-environment.js';
import { advanceLogicalTick, applyCanonicalInput, createSession, type CanonicalInput } from '../../src/sim/session.js';
import { projectDebrief } from '../../src/scoring/projection.js';

const MANIFEST_FIELDS = [
  'lesson_id', 'scenario_version', 'model_version', 'boat_profile_version', 'contract_version',
  'coordinate_contract_version', 'determinism_contract_version', 'comparison_policy_version',
  'validation_record_id', 'validation_disposition', 'initial_state', 'required_observations',
  'permitted_actions', 'checkpoints', 'pass_semantics', 'fail_semantics', 'safe_recovery_semantics',
  'hint_and_debrief', 'retry_comparison', 'failure_or_boundary_acceptance',
] as const;

describe('L06 polar-kinematics lesson', () => {
  it('declares the polar model version and every non-empty lesson-contract field', () => {
    expect(l06Manifest.model_version).toBe('polar-kinematics-v1');
    expect(l06Manifest.model_version).toBe(POLAR_KINEMATICS_MODEL_VERSION);
    for (const field of MANIFEST_FIELDS) {
      const value = l06Manifest[field];
      expect(value).toBeDefined();
      if (typeof value === 'string') expect(value.length).toBeGreaterThan(0);
      if (Array.isArray(value)) expect(value.length).toBeGreaterThan(0);
    }
  });

  it('reports numeric stw/sog/drift_angle at tick 0', () => {
    const identity = { ...l06ReplayBindings, seed: 'l06-initial', ordered_input_log: [] };
    const session = createSession(identity);
    expect(session.raw.stw).toEqual(expect.any(Number));
    expect(session.raw.sog).toEqual(expect.any(Number));
    expect(session.raw.drift_angle).toEqual(expect.any(Number));
    expect(session.raw.polar_kinematic_state).toBeDefined();
  });

  it('appends a POLAR_KINEMATIC_TRANSITION ledger event on advance', () => {
    const identity = { ...l06ReplayBindings, seed: 'l06-advance', ordered_input_log: [] };
    const advanced = advanceLogicalTick(createSession(identity));
    const transition = advanced.ledger.find((event) => event.type === 'POLAR_KINEMATIC_TRANSITION');
    expect(transition).toEqual(expect.objectContaining({
      lesson_id: 'L06',
      synthetic: true,
      polar_transition: expect.objectContaining({
        environment_id: polarKinematicsEnvironmentV1.environment_id,
        model_version: POLAR_KINEMATICS_MODEL_VERSION,
        causal_controls: [],
      }),
    }));
  });

  it('accepts helm input on the L06 path and populates causal_controls in the resulting transition', () => {
    const identity = { ...l06ReplayBindings, seed: 'l06-helm', ordered_input_log: [] };
    const afterHelm = applyCanonicalInput(createSession(identity), { logical_tick: 0, sequence: 1, input: { action: 'helm_port' } });
    const action = afterHelm.ledger.find((event) => event.type === 'ACTION_ACCEPTED');
    const checkpoint = afterHelm.ledger.find((event) => event.type === 'LESSON_CHECKPOINT');
    expect(action).toBeDefined();
    expect(checkpoint).toEqual(expect.objectContaining({ lesson_id: 'L06', cause: 'declared helm correction recorded', action_event_id: action!.id }));

    const advanced = advanceLogicalTick(afterHelm);
    const transition = advanced.ledger.find((event) => event.type === 'POLAR_KINEMATIC_TRANSITION');
    expect(transition).toEqual(expect.objectContaining({
      polar_transition: expect.objectContaining({
        accepted_helm_command: 'port',
        causal_controls: [{ logical_tick: 0, sequence: 1, helm_command: 'port', action_event_id: action!.id, checkpoint_event_id: checkpoint!.id }],
      }),
    }));
  });

  it('projects one synthetic_transition debrief fact per polar transition, pointing at its ledger event', () => {
    const identity = { ...l06ReplayBindings, seed: 'l06-debrief', ordered_input_log: [] };
    let session = createSession(identity);
    session = advanceLogicalTick(session);
    session = advanceLogicalTick(session);
    const transitions = session.ledger.filter((event) => event.type === 'POLAR_KINEMATIC_TRANSITION');
    expect(transitions).toHaveLength(2);
    const facts = projectDebrief(session.raw, session.ledger).filter((fact) => fact.kind === 'synthetic_transition');
    expect(facts).toHaveLength(2);
    expect(facts.map((fact) => fact.cause_event_id)).toEqual(transitions.map((event) => event.id));
  });

  it('reports sog === stw and cog === heading once the declared current is zero (FR-04, end to end)', () => {
    expect(polarKinematicsEnvironmentV1.current_speed_mps).toBe(0);
    const identity = { ...l06ReplayBindings, seed: 'l06-fr04', ordered_input_log: [] };
    const advanced = advanceLogicalTick(createSession(identity));
    expect(typeof advanced.raw.sog).toBe('number');
    expect(advanced.raw.sog).toBe(advanced.raw.stw);
    expect(advanced.raw.cog).toBe(advanced.raw.heading);
  });

  it('produces deep-equal raw state and ledger for two identical L06 sessions advanced the same number of ticks', () => {
    const identity = { ...l06ReplayBindings, seed: 'l06-determinism', ordered_input_log: [] };
    let one = createSession(identity);
    let two = createSession(identity);
    for (let tick = 0; tick < 3; tick += 1) {
      one = advanceLogicalTick(applyCanonicalInput(one, { logical_tick: tick, sequence: 1, input: { action: 'helm_starboard' } } satisfies CanonicalInput));
      two = advanceLogicalTick(applyCanonicalInput(two, { logical_tick: tick, sequence: 1, input: { action: 'helm_starboard' } } satisfies CanonicalInput));
    }
    expect(one.raw).toEqual(two.raw);
    expect(one.ledger).toEqual(two.ledger);
  });
});
