import { describe, expect, it } from 'vitest';
import { advanceLogicalTick, applyCanonicalInput, createSession, type DeterministicSession } from '../../src/sim/session.js';
import { l02ReplayBindings } from '../../src/content/l02-l05.js';

function l02Session(seed: string): DeterministicSession {
  return createSession({ ...l02ReplayBindings, seed, ordered_input_log: [] } as never);
}

// Sequence must strictly increase within one logical tick (see the collision
// guard in src/sim/session.ts), so the caller passes it explicitly.
function trim(session: DeterministicSession, action: 'main_trim' | 'jib_trim', sequence: number): DeterministicSession {
  return applyCanonicalInput(session, { logical_tick: session.raw.logical_tick, sequence, input: { action } });
}

describe('L02 polar migration', () => {
  it('starts with a polar kinematic state rather than the legacy shape', () => {
    const raw = l02Session('l02-polar-start').raw;
    expect(raw.polar_kinematic_state).toBeDefined();
    expect(raw.l01_synthetic_state).toBeUndefined();
  });

  it('keeps the synthetic trim acknowledgment record', () => {
    expect(l02Session('l02-ack-kept').raw.l02_trim_acknowledgment).toBeDefined();
  });

  it('makes trimming change the declared speed through water', () => {
    let session = advanceLogicalTick(l02Session('l02-trim-effect'));
    const before = session.raw.stw;
    session = advanceLogicalTick(trim(session, 'main_trim', 1));
    expect(typeof before).toBe('number');
    expect(session.raw.stw).not.toBe(before);
  });

  it('still records the trim causality checkpoint after both sheets move', () => {
    let session = trim(l02Session('l02-causality'), 'main_trim', 1);
    session = trim(session, 'jib_trim', 2);
    expect(session.ledger.some((event) => event.cause === 'main/jib synthetic trim causality recorded')).toBe(true);
  });

  it('declares no virtual mark', () => {
    expect(l02Session('l02-nomark').raw.mark_state).toBeUndefined();
  });

  it('reproduces exactly for two identical sessions advanced the same number of ticks', () => {
    let a = l02Session('l02-determinism');
    let b = l02Session('l02-determinism');
    for (let tick = 0; tick < 4; tick += 1) { a = advanceLogicalTick(a); b = advanceLogicalTick(b); }
    expect({ raw: a.raw, ledger: a.ledger }).toEqual({ raw: b.raw, ledger: b.ledger });
  });
});
