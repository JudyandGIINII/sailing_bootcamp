export type L02SyntheticTrimAction = 'main_trim' | 'jib_trim';

export interface L02SyntheticTrimObservation {
  readonly main_trim_adjusted: boolean;
  readonly jib_trim_adjusted: boolean;
  readonly last_accepted_trim: L02SyntheticTrimAction | null;
  readonly last_accepted_tick: number | null;
  readonly causal_state: 'none' | 'main_only' | 'jib_only' | 'both';
}

export interface L02SyntheticTrimInput {
  readonly action: L02SyntheticTrimAction;
  readonly logical_tick: number;
  readonly sequence: number;
}

function freeze<T>(value: T): Readonly<T> { return Object.freeze(value); }

function causalState(main: boolean, jib: boolean): L02SyntheticTrimObservation['causal_state'] {
  if (main && jib) return 'both';
  if (main) return 'main_only';
  if (jib) return 'jib_only';
  return 'none';
}

export function createInitialL02SyntheticTrimObservation(): L02SyntheticTrimObservation {
  return freeze({ main_trim_adjusted: false, jib_trim_adjusted: false, last_accepted_trim: null, last_accepted_tick: null, causal_state: 'none' });
}

/** Pure, immutable acknowledgment-only reducer. */
export function reduceL02SyntheticTrimObservation(
  previous: L02SyntheticTrimObservation,
  input: L02SyntheticTrimInput,
): L02SyntheticTrimObservation {
  if ((input.action !== 'main_trim' && input.action !== 'jib_trim') ||
    !Number.isSafeInteger(input.logical_tick) || input.logical_tick < 0 ||
    !Number.isSafeInteger(input.sequence) || input.sequence < 0) return previous;
  const main = previous.main_trim_adjusted || input.action === 'main_trim';
  const jib = previous.jib_trim_adjusted || input.action === 'jib_trim';
  return freeze({
    main_trim_adjusted: main,
    jib_trim_adjusted: jib,
    last_accepted_trim: input.action,
    last_accepted_tick: input.logical_tick,
    causal_state: causalState(main, jib),
  });
}
