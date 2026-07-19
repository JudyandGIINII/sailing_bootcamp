import type { LedgerEvent, RawSimulationState } from '../sim/session.js';

export interface ScoreProjection {
  status: 'unavailable_pending_validation' | 'blocked_by_safety_contract';
  safety: 'clear' | 'blocked';
  total_points: 0;
  causal_event_ids: readonly string[];
}

export interface DebriefFact {
  id: string;
  kind: 'action_recorded' | 'contract_status' | 'safety_blocked';
  cause_event_id?: string;
  contract_status?: RawSimulationState['contract_status'];
}

/** Pure projections: no values are written back to the canonical state or ledger. */
export function projectScore(_raw: RawSimulationState, ledger: readonly LedgerEvent[]): ScoreProjection {
  const safetyEvent = ledger.find((event) => event.type === 'SAFETY_BLOCKED');
  if (safetyEvent) {
    return Object.freeze({
      status: 'blocked_by_safety_contract',
      safety: 'blocked',
      total_points: 0,
      causal_event_ids: Object.freeze([safetyEvent.id]),
    });
  }
  return Object.freeze({
    status: 'unavailable_pending_validation',
    safety: 'clear',
    total_points: 0,
      causal_event_ids: Object.freeze(ledger.filter((event) => event.type === 'ACTION_ACCEPTED').map((event) => event.id)),
  });
}

export function projectDebrief(raw: RawSimulationState, ledger: readonly LedgerEvent[]): readonly DebriefFact[] {
  const facts: DebriefFact[] = [
    { id: 'contract-status', kind: 'contract_status', contract_status: raw.contract_status },
  ];
  const seen = new Set<string>();
  for (const event of ledger) {
    if (seen.has(event.id)) continue;
    seen.add(event.id);
    if (event.type === 'SAFETY_BLOCKED') facts.push({ id: `safety:${event.id}`, kind: 'safety_blocked', cause_event_id: event.id });
    if (event.type === 'ACTION_ACCEPTED') facts.push({ id: `action:${event.id}`, kind: 'action_recorded', cause_event_id: event.id });
  }
  return Object.freeze(facts.map((fact) => Object.freeze(fact)));
}
