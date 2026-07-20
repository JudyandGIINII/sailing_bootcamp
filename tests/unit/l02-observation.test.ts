import { describe, expect, it } from 'vitest';
import { projectL02SyntheticTrimObservation } from '../../src/sim/l02-observation.js';
import { createInitialL02SyntheticTrimObservation, reduceL02SyntheticTrimObservation } from '../../src/sim/l02-synthetic-model.js';

describe('L02 synthetic trim acknowledgment observation', () => {
  it('projects only the immutable acknowledgment fields', () => {
    const state = reduceL02SyntheticTrimObservation(createInitialL02SyntheticTrimObservation(), { action: 'jib_trim', logical_tick: 4, sequence: 7 });
    const observation = projectL02SyntheticTrimObservation(state);
    expect(observation).toEqual({ main_trim_adjusted: false, jib_trim_adjusted: true, last_accepted_trim: 'jib_trim', last_accepted_tick: 4, causal_state: 'jib_only' });
    expect(Object.keys(observation).sort()).toEqual(['causal_state', 'jib_trim_adjusted', 'last_accepted_tick', 'last_accepted_trim', 'main_trim_adjusted']);
    expect(Object.isFrozen(observation)).toBe(true);
    expect(observation).not.toBe(state);
  });
});
