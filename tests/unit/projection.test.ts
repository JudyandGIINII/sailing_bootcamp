import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { createSession, replayInputs, type LedgerEvent } from '../../src/sim/session.js';
import { projectDebrief, projectScore } from '../../src/scoring/projection.js';

const rawFixture = JSON.parse(readFileSync('tests/fixtures/l01-raw-golden.json', 'utf8')) as { identity: Parameters<typeof createSession>[0]; inputs: []; terminal_ticks: number };
const scoreFixture = JSON.parse(readFileSync('tests/fixtures/l01-score-debrief-golden.json', 'utf8')) as { score: unknown; debrief_fact_kinds: unknown };

describe('score/debrief pure causality projections', () => {
  it('matches its dedicated golden fixture without changing the raw baseline', () => {
    const session = replayInputs(rawFixture.identity, rawFixture.inputs, rawFixture.terminal_ticks);
    const rawBefore = structuredClone({ raw: session.raw, ledger: session.ledger });
    expect(projectScore(session.raw, session.ledger)).toEqual(scoreFixture.score);
    expect(projectDebrief(session.raw, session.ledger).map((fact) => fact.kind)).toEqual(scoreFixture.debrief_fact_kinds);
    expect({ raw: session.raw, ledger: session.ledger }).toEqual(rawBefore);
  });

  it('deduplicates repeated causes and makes a safety block non-offsettable', () => {
    const session = createSession(rawFixture.identity);
    const safety: LedgerEvent = { id: 'safety-1', tick: 0, sequence: 9, type: 'SAFETY_BLOCKED', cause: 'explicit contract status' };
    const ledger = [...session.ledger, safety, safety];
    expect(projectScore(session.raw, ledger)).toEqual({ status: 'blocked_by_safety_contract', safety: 'blocked', total_points: 0, causal_event_ids: ['safety-1'] });
    expect(projectDebrief(session.raw, ledger).filter((fact) => fact.kind === 'safety_blocked')).toHaveLength(1);
  });
});
