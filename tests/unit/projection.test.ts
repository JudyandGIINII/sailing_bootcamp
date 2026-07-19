import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { createSession, replayInputs, type CanonicalInput, type LedgerEvent } from '../../src/sim/session.js';
import { projectDebrief, projectL03RuntimeTrace, projectScore } from '../../src/scoring/projection.js';

const rawFixture = JSON.parse(readFileSync('tests/fixtures/l01-raw-golden.json', 'utf8')) as { identity: Parameters<typeof createSession>[0]; inputs: []; terminal_ticks: number };
const scoreFixture = JSON.parse(readFileSync('tests/fixtures/l01-score-debrief-golden.json', 'utf8')) as { score: unknown; debrief_fact_kinds: unknown };
const l03RawFixture = JSON.parse(readFileSync('tests/fixtures/l03-raw-golden.json', 'utf8')) as { identity: Parameters<typeof createSession>[0]; inputs: CanonicalInput[]; terminal_ticks: number };
const l03ScoreFixture = JSON.parse(readFileSync('tests/fixtures/l03-score-debrief-golden.json', 'utf8')) as { score: unknown; l03_runtime_trace: unknown };

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

  it('keeps the initial L03 declaration separate from explicit absent runtime records', () => {
    const session = createSession(l03RawFixture.identity);
    const trace = projectL03RuntimeTrace(session.raw, session.ledger);

    expect(trace).toEqual(expect.objectContaining({
      static_declaration: expect.objectContaining({ heading: 'Static lesson-manifest declaration', status: 'declared_synthetic' }),
      runtime_trace: expect.objectContaining({ heading: 'Current runtime trace' }),
    }));
    expect(trace?.runtime_trace.episode).toEqual({ label: 'Synthetic episode evidence', status: 'unavailable_no_runtime_record' });
    expect(trace?.runtime_trace.reef_action).toEqual({ label: 'Registered reef action evidence', status: 'unavailable_no_runtime_record' });
    expect(trace?.runtime_trace.checkpoint).toEqual({ label: 'Declared checkpoint evidence', status: 'unavailable_no_runtime_record' });
  });

  it('projects recorded L03 evidence without mutating canonical state, ledger, score, or replay payload', () => {
    const replayPayload = structuredClone({ ...l03RawFixture.identity, ordered_input_log: l03RawFixture.inputs });
    const session = replayInputs(l03RawFixture.identity, l03RawFixture.inputs, l03RawFixture.terminal_ticks);
    const before = structuredClone({ raw: session.raw, ledger: session.ledger, identity: session.identity, replayPayload });
    const score = projectScore(session.raw, session.ledger);
    const trace = projectL03RuntimeTrace(session.raw, session.ledger);

    expect(score).toEqual(l03ScoreFixture.score);
    expect(trace).toEqual(l03ScoreFixture.l03_runtime_trace);
    expect(trace?.runtime_trace.episode).toEqual(expect.objectContaining({ event_id: '0:0:1', recorded_cause: 'deterministic synthetic gust/wave cue' }));
    expect(trace?.runtime_trace.reef_action).toEqual(expect.objectContaining({ event_id: '1:1:2', status: 'recorded' }));
    expect(trace?.runtime_trace.checkpoint).toEqual(expect.objectContaining({ event_id: '1:1:3', recorded_cause: 'conservative synthetic reef mitigation recorded' }));
    expect({ raw: session.raw, ledger: session.ledger, identity: session.identity, replayPayload }).toEqual(before);
  });

  it('does not derive L03 runtime evidence or causal links from raw state or event order', () => {
    const completed = replayInputs(l03RawFixture.identity, l03RawFixture.inputs, l03RawFixture.terminal_ticks);
    const trace = projectL03RuntimeTrace(completed.raw, completed.ledger.slice(0, 1));

    expect(completed.raw.synthetic_episode).toBe('complete');
    expect(trace?.runtime_trace.episode.status).toBe('unavailable_no_runtime_record');
    expect(trace?.runtime_trace.reef_action.status).toBe('unavailable_no_runtime_record');
    expect(trace?.runtime_trace.checkpoint.status).toBe('unavailable_no_runtime_record');
  });

  it('returns an identical L03 display projection for identical replays without physical-unit presentation', () => {
    const one = replayInputs(l03RawFixture.identity, l03RawFixture.inputs, l03RawFixture.terminal_ticks);
    const two = replayInputs(l03RawFixture.identity, l03RawFixture.inputs, l03RawFixture.terminal_ticks);
    const oneTrace = projectL03RuntimeTrace(one.raw, one.ledger);

    expect(projectL03RuntimeTrace(two.raw, two.ledger)).toEqual(oneTrace);
    expect(JSON.stringify(oneTrace)).not.toMatch(/\b(?:knot|meter|mile|degree|second|minute|hour|bearing|threshold)\b/i);
  });
});
