import { createP4Attempt, reduceP4Attempt, type P4AttemptState } from './in-memory-attempt.js';

export type P4Verification =
  | Readonly<{ readonly status: 'verified'; readonly state: P4AttemptState }>
  | Readonly<{ readonly status: 'invalid'; readonly reason: 'P4_INVALID_ATTEMPT' | 'P4_DERIVED_RECORD_MISMATCH' }>;

function invalidAttempt(): P4Verification {
  return Object.freeze({ status: 'invalid', reason: 'P4_INVALID_ATTEMPT' });
}

/** Replays only P4's in-memory derived ledger and rejects every mismatch. */
export function verifyP4Attempt(value: unknown): P4Verification {
  try {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) return invalidAttempt();
    const candidate = value as Partial<P4AttemptState>;
    if (typeof candidate.seed !== 'number' || !Array.isArray(candidate.records)) return invalidAttempt();
    let replay = createP4Attempt(candidate.seed);
    let index = 0;
    while (index < candidate.records.length) {
      const record = candidate.records[index];
      if (!record || record.kind !== 'p2_action' && record.kind !== 'end_voyage') return Object.freeze({ status: 'invalid', reason: 'P4_DERIVED_RECORD_MISMATCH' });
      const reduced = reduceP4Attempt(replay, record);
      if (reduced.status !== 'accepted') return Object.freeze({ status: 'invalid', reason: 'P4_DERIVED_RECORD_MISMATCH' });
      const expected = reduced.state.records.slice(replay.records.length);
      const actual = candidate.records.slice(index, index + expected.length);
      if (JSON.stringify(actual) !== JSON.stringify(expected)) return Object.freeze({ status: 'invalid', reason: 'P4_DERIVED_RECORD_MISMATCH' });
      replay = reduced.state;
      index += expected.length;
    }
    if (JSON.stringify(candidate.p2_state) !== JSON.stringify(replay.p2_state) || JSON.stringify(candidate.binding) !== JSON.stringify(replay.binding) || JSON.stringify(candidate.p3_state) !== JSON.stringify(replay.p3_state)) {
      return Object.freeze({ status: 'invalid', reason: 'P4_DERIVED_RECORD_MISMATCH' });
    }
    return Object.freeze({ status: 'verified', state: replay });
  } catch {
    return invalidAttempt();
  }
}
