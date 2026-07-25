import { createP4Attempt, type P4AttemptState } from './in-memory-attempt.js';

/** Retry intentionally has no persistence side effect and never mutates its prior attempt. */
export function retryP4Attempt(previous: P4AttemptState): P4AttemptState {
  return createP4Attempt(previous.seed);
}
