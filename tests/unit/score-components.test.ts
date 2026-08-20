import { describe, expect, it } from 'vitest';
import type { LedgerEvent, RawSimulationState } from '../../src/sim/session.js';
import { HELM_CORRECTION_CAUSE } from '../../src/sim/session.js';
import { L04_MARK_ARRIVAL_CAUSE } from '../../src/content/l02-l05.js';
import { computeL04Components, countHelmReversals, type ScoreComponent } from '../../src/scoring/components.js';
import type { ScoreComponentKey } from '../../src/scoring/score-contract.js';

function event(partial: Partial<LedgerEvent> & { id: string; type: LedgerEvent['type'] }): LedgerEvent {
  return { tick: 0, sequence: 0, ...partial } as LedgerEvent;
}

function componentBy(components: readonly ScoreComponent[], key: ScoreComponentKey): ScoreComponent {
  const found = components.find((component) => component.key === key);
  if (!found) throw new Error(`missing component ${key}`);
  return found;
}

const cleanRaw = { lesson_id: 'L04', highest_clearance_alert: 'clear' } as unknown as RawSimulationState;

describe('helm reversal counting', () => {
  it('counts a direction change as one reversal', () => {
    expect(countHelmReversals([
      event({ id: 'a', type: 'ACTION_ACCEPTED', action: 'helm_port' }),
      event({ id: 'b', type: 'ACTION_ACCEPTED', action: 'helm_starboard' }),
    ])).toBe(1);
  });

  it('does not count repeats of the same direction', () => {
    expect(countHelmReversals([
      event({ id: 'a', type: 'ACTION_ACCEPTED', action: 'helm_port' }),
      event({ id: 'b', type: 'ACTION_ACCEPTED', action: 'helm_port' }),
      event({ id: 'c', type: 'ACTION_ACCEPTED', action: 'helm_port' }),
    ])).toBe(0);
  });

  it('ignores non-helm actions between helm actions', () => {
    expect(countHelmReversals([
      event({ id: 'a', type: 'ACTION_ACCEPTED', action: 'helm_port' }),
      event({ id: 'b', type: 'ACTION_ACCEPTED', action: 'reef' }),
      event({ id: 'c', type: 'ACTION_ACCEPTED', action: 'helm_port' }),
    ])).toBe(0);
  });
});

describe('L04 component derivation', () => {
  it('declares observation unavailable because nothing records it', () => {
    const observation = componentBy(computeL04Components(cleanRaw, []), 'observation');
    expect(observation.status).toBe('declared-unavailable');
    expect(observation.points).toBe(0);
    expect(observation.points_possible).toBe(0);
  });

  it('credits ten judgment points per recorded correction and points at their events', () => {
    const judgment = componentBy(computeL04Components(cleanRaw, [
      event({ id: 'c1', type: 'LESSON_CHECKPOINT', lesson_id: 'L04', cause: HELM_CORRECTION_CAUSE, tick: 0 }),
      event({ id: 'c2', type: 'LESSON_CHECKPOINT', lesson_id: 'L04', cause: HELM_CORRECTION_CAUSE, tick: 1 }),
    ]), 'judgment');
    expect(judgment.points).toBe(20);
    expect(judgment.causal_event_ids).toEqual(['c1', 'c2']);
  });

  it('saturates judgment at the declared maximum', () => {
    const ledger = [0, 1, 2, 3, 4].map((tick) =>
      event({ id: `c${tick}`, type: 'LESSON_CHECKPOINT', lesson_id: 'L04', cause: HELM_CORRECTION_CAUSE, tick }));
    expect(componentBy(computeL04Components(cleanRaw, ledger), 'judgment').points).toBe(25);
  });

  it('counts two corrections recorded on the same tick as one', () => {
    const judgment = componentBy(computeL04Components(cleanRaw, [
      event({ id: 'c1', type: 'LESSON_CHECKPOINT', lesson_id: 'L04', cause: HELM_CORRECTION_CAUSE, tick: 3 }),
      event({ id: 'c2', type: 'LESSON_CHECKPOINT', lesson_id: 'L04', cause: HELM_CORRECTION_CAUSE, tick: 3 }),
    ]), 'judgment');
    expect(judgment.points).toBe(10);
  });

  it('gives full control-stability credit to a session that never reverses the helm', () => {
    expect(componentBy(computeL04Components(cleanRaw, []), 'control_stability').points).toBe(25);
  });

  it('subtracts five control-stability points per reversal and floors at zero', () => {
    const oscillating: LedgerEvent[] = [];
    for (let index = 0; index < 8; index += 1) {
      oscillating.push(event({
        id: `h${index}`, type: 'ACTION_ACCEPTED', tick: index,
        action: index % 2 === 0 ? 'helm_port' : 'helm_starboard',
      }));
    }
    expect(componentBy(computeL04Components(cleanRaw, oscillating), 'control_stability').points).toBe(0);
  });

  it('scores safety from the most severe recorded clearance level', () => {
    const cautionRaw = { lesson_id: 'L04', highest_clearance_alert: 'caution' } as unknown as RawSimulationState;
    const dangerRaw = { lesson_id: 'L04', highest_clearance_alert: 'danger' } as unknown as RawSimulationState;
    expect(componentBy(computeL04Components(cleanRaw, []), 'safety').points).toBe(25);
    expect(componentBy(computeL04Components(cautionRaw, []), 'safety').points).toBe(12);
    expect(componentBy(computeL04Components(dangerRaw, []), 'safety').points).toBe(0);
  });

  it('points the safety component at the clearance episodes that caused it', () => {
    const cautionRaw = { lesson_id: 'L04', highest_clearance_alert: 'caution' } as unknown as RawSimulationState;
    const safety = componentBy(computeL04Components(cautionRaw, [
      event({ id: 'e1', type: 'ENVIRONMENT_EPISODE', lesson_id: 'L04', cause: 'synthetic under-keel clearance caution threshold crossed' }),
    ]), 'safety');
    expect(safety.causal_event_ids).toEqual(['e1']);
  });

  it('awards the goal only when a mark arrival was recorded', () => {
    expect(componentBy(computeL04Components(cleanRaw, []), 'goal').points).toBe(0);
    const arrived = componentBy(computeL04Components(cleanRaw, [
      event({ id: 'm1', type: 'LESSON_CHECKPOINT', lesson_id: 'L04', cause: L04_MARK_ARRIVAL_CAUSE }),
    ]), 'goal');
    expect(arrived.points).toBe(25);
    expect(arrived.causal_event_ids).toEqual(['m1']);
  });

  it('returns all five components in a stable order', () => {
    expect(computeL04Components(cleanRaw, []).map((component) => component.key))
      .toEqual(['observation', 'judgment', 'control_stability', 'safety', 'goal']);
  });

  it('never mutates the ledger it reads', () => {
    const ledger = [event({ id: 'm1', type: 'LESSON_CHECKPOINT', lesson_id: 'L04', cause: L04_MARK_ARRIVAL_CAUSE })];
    const before = structuredClone(ledger);
    computeL04Components(cleanRaw, ledger);
    expect(ledger).toEqual(before);
  });
});
