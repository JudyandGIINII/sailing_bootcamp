import { describe, expect, it } from 'vitest';
import { createInitialL02SyntheticTrimObservation, reduceL02SyntheticTrimObservation } from '../../src/sim/l02-synthetic-model.js';

describe('L02 synthetic trim-input acknowledgment reducer', () => {
  it.each([
    ['main-only', [{ action: 'main_trim' as const, logical_tick: 2, sequence: 1 }], { main_trim_adjusted: true, jib_trim_adjusted: false, last_accepted_trim: 'main_trim', last_accepted_tick: 2, causal_state: 'main_only' }],
    ['jib-only', [{ action: 'jib_trim' as const, logical_tick: 2, sequence: 1 }], { main_trim_adjusted: false, jib_trim_adjusted: true, last_accepted_trim: 'jib_trim', last_accepted_tick: 2, causal_state: 'jib_only' }],
    ['main then jib', [{ action: 'main_trim' as const, logical_tick: 2, sequence: 1 }, { action: 'jib_trim' as const, logical_tick: 3, sequence: 1 }], { main_trim_adjusted: true, jib_trim_adjusted: true, last_accepted_trim: 'jib_trim', last_accepted_tick: 3, causal_state: 'both' }],
    ['jib then main', [{ action: 'jib_trim' as const, logical_tick: 2, sequence: 1 }, { action: 'main_trim' as const, logical_tick: 3, sequence: 1 }], { main_trim_adjusted: true, jib_trim_adjusted: true, last_accepted_trim: 'main_trim', last_accepted_tick: 3, causal_state: 'both' }],
  ])('records %s without physical values', (_label, inputs, expected) => {
    const initial = createInitialL02SyntheticTrimObservation();
    const result = inputs.reduce(reduceL02SyntheticTrimObservation, initial);
    expect(result).toEqual(expected);
    expect(Object.isFrozen(result)).toBe(true);
    expect(initial).toEqual(createInitialL02SyntheticTrimObservation());
  });

  it('keeps repeated accepted actions ordered while preserving the acknowledgment state', () => {
    const first = reduceL02SyntheticTrimObservation(createInitialL02SyntheticTrimObservation(), { action: 'main_trim', logical_tick: 1, sequence: 1 });
    const repeated = reduceL02SyntheticTrimObservation(first, { action: 'main_trim', logical_tick: 1, sequence: 2 });
    expect(repeated).toEqual({ main_trim_adjusted: true, jib_trim_adjusted: false, last_accepted_trim: 'main_trim', last_accepted_tick: 1, causal_state: 'main_only' });
    expect(repeated).not.toBe(first);
  });

  it('leaves invalid or non-trim inputs untouched', () => {
    const initial = createInitialL02SyntheticTrimObservation();
    expect(reduceL02SyntheticTrimObservation(initial, { action: 'reef' as never, logical_tick: 0, sequence: 1 })).toBe(initial);
    expect(reduceL02SyntheticTrimObservation(initial, { action: 'main_trim', logical_tick: -1, sequence: 1 })).toBe(initial);
  });
});
