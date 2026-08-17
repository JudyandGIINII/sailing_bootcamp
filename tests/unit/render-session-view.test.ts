import { describe, expect, it } from 'vitest';
import { advanceLogicalTick, createSession, type DeterministicSession } from '../../src/sim/session.js';
import { l04ReplayBindings, l02ReplayBindings } from '../../src/content/l02-l05.js';
import { l06ReplayBindings } from '../../src/content/l06-polar.js';
import { projectSessionWorldView } from '../../src/render/session-view.js';

function polarSession(bindings: Record<string, unknown>, seed: string): DeterministicSession {
  return createSession({ ...bindings, seed, ordered_input_log: [] } as never);
}

describe('session world view derivation', () => {
  it('reports the boat position and heading for a polar lesson', () => {
    const view = projectSessionWorldView(polarSession(l04ReplayBindings, 'view-l04'));
    expect(view).toBeDefined();
    expect(typeof view!.position.x).toBe('number');
    expect(typeof view!.position.y).toBe('number');
    expect(typeof view!.heading_rad).toBe('number');
  });

  it('grows the trail by one point per advanced tick, ending at the current position', () => {
    let session = polarSession(l06ReplayBindings, 'view-trail');
    const before = projectSessionWorldView(session)!.trail.length;
    session = advanceLogicalTick(advanceLogicalTick(advanceLogicalTick(session)));
    const view = projectSessionWorldView(session)!;
    expect(view.trail.length).toBe(before + 3);
    expect(view.trail.at(-1)).toEqual(view.position);
  });

  it('moves the boat between ticks, so the trail is not a single repeated point', () => {
    let session = polarSession(l06ReplayBindings, 'view-moves');
    for (let tick = 0; tick < 5; tick += 1) session = advanceLogicalTick(session);
    const trail = projectSessionWorldView(session)!.trail;
    expect(new Set(trail.map((point) => `${point.x},${point.y}`)).size).toBe(trail.length);
  });

  it('exposes the declared course mark and its arrival radius for L04', () => {
    const view = projectSessionWorldView(polarSession(l04ReplayBindings, 'view-mark'))!;
    expect(view.mark).toEqual({ label: 'W1', position: { x: 0, y: 600 }, arrival_radius_m: 25 });
  });

  it('declares no mark for a lesson that has none', () => {
    expect(projectSessionWorldView(polarSession(l06ReplayBindings, 'view-nomark'))!.mark).toBeUndefined();
  });

  it('returns undefined for a lesson that declares no world position', () => {
    expect(projectSessionWorldView(polarSession(l02ReplayBindings, 'view-l02'))).toBeUndefined();
  });

  it('never mutates the session it reads', () => {
    const session = polarSession(l04ReplayBindings, 'view-immutable');
    const before = structuredClone({ raw: session.raw, ledger: session.ledger });
    projectSessionWorldView(session);
    expect({ raw: session.raw, ledger: session.ledger }).toEqual(before);
  });
});
