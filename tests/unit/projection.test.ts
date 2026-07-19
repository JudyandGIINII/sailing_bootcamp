import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { createSession, replayInputs, type CanonicalInput, type LedgerEvent } from '../../src/sim/session.js';
import { projectDebrief, projectL02RuntimeTrace, projectL03RuntimeTrace, projectL04RuntimeTrace, projectScore } from '../../src/scoring/projection.js';

const rawFixture = JSON.parse(readFileSync('tests/fixtures/l01-raw-golden.json', 'utf8')) as { identity: Parameters<typeof createSession>[0]; inputs: []; terminal_ticks: number };
const scoreFixture = JSON.parse(readFileSync('tests/fixtures/l01-score-debrief-golden.json', 'utf8')) as { score: unknown; debrief_fact_kinds: unknown };
const l02RawFixture = JSON.parse(readFileSync('tests/fixtures/l02-raw-golden.json', 'utf8')) as { identity: Parameters<typeof createSession>[0]; inputs: CanonicalInput[]; terminal_ticks: number };
const l03RawFixture = JSON.parse(readFileSync('tests/fixtures/l03-raw-golden.json', 'utf8')) as { identity: Parameters<typeof createSession>[0]; inputs: CanonicalInput[]; terminal_ticks: number };
const l03ScoreFixture = JSON.parse(readFileSync('tests/fixtures/l03-score-debrief-golden.json', 'utf8')) as { score: unknown; l03_runtime_trace: unknown };
const l04RawFixture = JSON.parse(readFileSync('tests/fixtures/l04-raw-golden.json', 'utf8')) as { identity: Parameters<typeof createSession>[0]; inputs: CanonicalInput[]; terminal_ticks: number };
const l04ScoreFixture = JSON.parse(readFileSync('tests/fixtures/l04-score-debrief-golden.json', 'utf8')) as { score: unknown };

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

  it('keeps initial L02 static declarations separate from explicitly unavailable runtime evidence', () => {
    const session = createSession(l02RawFixture.identity);
    const trace = projectL02RuntimeTrace(session.raw, session.ledger);

    expect(trace).toEqual(expect.objectContaining({
      static_declaration: expect.objectContaining({ heading: 'L02 static lesson-manifest declarations', status: 'declared_synthetic' }),
      runtime_evidence: expect.objectContaining({ heading: 'L02 browser-local synthetic recorded evidence' }),
    }));
    expect(trace?.runtime_evidence.main_action).toEqual({ label: 'Recorded main trim action evidence', status: 'unavailable_no_runtime_record' });
    expect(trace?.runtime_evidence.jib_action).toEqual({ label: 'Recorded jib trim action evidence', status: 'unavailable_no_runtime_record' });
    expect(trace?.runtime_evidence.checkpoint).toEqual({ label: 'Recorded synthetic trim causality evidence', status: 'unavailable_no_runtime_record' });
  });

  it('recognizes exact L02 main, jib, and checkpoint records independently', () => {
    const raw = createSession(l02RawFixture.identity).raw;
    const main: LedgerEvent = { id: 'main-only', tick: 4, sequence: 8, type: 'ACTION_ACCEPTED', action: 'main_trim' };
    const jib: LedgerEvent = { id: 'jib-only', tick: 5, sequence: 1, type: 'ACTION_ACCEPTED', action: 'jib_trim' };
    const checkpoint: LedgerEvent = { id: 'checkpoint-only', tick: 6, sequence: 2, type: 'LESSON_CHECKPOINT', lesson_id: 'L02', cause: 'main/jib synthetic trim causality recorded' };

    const mainOnly = projectL02RuntimeTrace(raw, [main]);
    const jibOnly = projectL02RuntimeTrace(raw, [jib]);
    const checkpointOnly = projectL02RuntimeTrace(raw, [checkpoint]);
    const complete = projectL02RuntimeTrace(raw, [main, jib, checkpoint]);

    expect(mainOnly?.runtime_evidence.main_action).toEqual({ label: 'Recorded main trim action evidence', status: 'recorded', record_ids: ['main-only'] });
    expect(mainOnly?.runtime_evidence.jib_action.status).toBe('unavailable_no_runtime_record');
    expect(jibOnly?.runtime_evidence.jib_action).toEqual({ label: 'Recorded jib trim action evidence', status: 'recorded', record_ids: ['jib-only'] });
    expect(jibOnly?.runtime_evidence.main_action.status).toBe('unavailable_no_runtime_record');
    expect(checkpointOnly?.runtime_evidence.checkpoint).toEqual({ label: 'Recorded synthetic trim causality evidence', status: 'recorded', record_ids: ['checkpoint-only'], recorded_cause: 'main/jib synthetic trim causality recorded' });
    expect(checkpointOnly?.runtime_evidence.main_action.status).toBe('unavailable_no_runtime_record');
    expect(complete?.runtime_evidence.main_action.status).toBe('recorded');
    expect(complete?.runtime_evidence.jib_action.status).toBe('recorded');
    expect(complete?.runtime_evidence.checkpoint.status).toBe('recorded');
  });

  it('rejects near-match L02 causes and unrelated records, while preserving duplicate records independently', () => {
    const raw = createSession(l02RawFixture.identity).raw;
    const mainA: LedgerEvent = { id: 'main-a', tick: 0, sequence: 9, type: 'ACTION_ACCEPTED', action: 'main_trim' };
    const mainB: LedgerEvent = { id: 'main-b', tick: 0, sequence: 1, type: 'ACTION_ACCEPTED', action: 'main_trim' };
    const nearCheckpoint: LedgerEvent = { id: 'near', tick: 0, sequence: 2, type: 'LESSON_CHECKPOINT', lesson_id: 'L02', cause: 'main/jib synthetic trim causality recorded ' };
    const unrelated: LedgerEvent = { id: 'unrelated', tick: 0, sequence: 3, type: 'ACTION_ACCEPTED', action: 'reef' };
    const ledger = [mainB, nearCheckpoint, unrelated, mainA];

    const trace = projectL02RuntimeTrace(raw, ledger);
    expect(trace?.runtime_evidence.main_action).toEqual({ label: 'Recorded main trim action evidence', status: 'recorded', record_ids: ['main-a', 'main-b'] });
    expect(trace?.runtime_evidence.jib_action.status).toBe('unavailable_no_runtime_record');
    expect(trace?.runtime_evidence.checkpoint.status).toBe('unavailable_no_runtime_record');
    expect(projectL02RuntimeTrace(raw, [...ledger].reverse())).toEqual(trace);
  });

  it('is deterministic and does not mutate L02 raw state, ledger, score, or replay payload', () => {
    const replayPayload = structuredClone({ ...l02RawFixture.identity, ordered_input_log: l02RawFixture.inputs });
    const session = replayInputs(l02RawFixture.identity, l02RawFixture.inputs, l02RawFixture.terminal_ticks);
    const before = structuredClone({ raw: session.raw, ledger: session.ledger, identity: session.identity, replayPayload });
    const first = projectL02RuntimeTrace(session.raw, session.ledger);
    const second = projectL02RuntimeTrace(session.raw, session.ledger);
    const replayAgain = replayInputs(l02RawFixture.identity, l02RawFixture.inputs, l02RawFixture.terminal_ticks);

    expect(first).toEqual(second);
    expect(projectL02RuntimeTrace(replayAgain.raw, replayAgain.ledger)).toEqual(first);
    expect(first?.runtime_evidence.main_action).toEqual(expect.objectContaining({ record_ids: ['0:1:1'] }));
    expect(first?.runtime_evidence.jib_action).toEqual(expect.objectContaining({ record_ids: ['0:2:2'] }));
    expect(first?.runtime_evidence.checkpoint).toEqual(expect.objectContaining({ record_ids: ['0:2:3'], recorded_cause: 'main/jib synthetic trim causality recorded' }));
    expect({ raw: session.raw, ledger: session.ledger, identity: session.identity, replayPayload }).toEqual(before);
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

  it('keeps L04 static declarations separate from absent runtime evidence', () => {
    const session = createSession(l04RawFixture.identity);
    const trace = projectL04RuntimeTrace(session.raw, session.ledger);

    expect(trace).toEqual(expect.objectContaining({
      static_declaration: expect.objectContaining({ heading: 'L04 static lesson-manifest declarations', status: 'declared_synthetic' }),
      runtime_evidence: expect.objectContaining({ heading: 'L04 runtime evidence' }),
    }));
    expect(trace?.runtime_evidence.miss).toEqual({ label: 'Recoverable synthetic mark miss runtime evidence', status: 'unavailable_no_runtime_record' });
    expect(trace?.runtime_evidence.correction).toEqual({ label: 'Slower valid synthetic correction runtime evidence', status: 'unavailable_no_runtime_record' });
  });

  it('recognizes L04 miss and correction evidence independently from their explicit checkpoint causes', () => {
    const missOnly = replayInputs(l04RawFixture.identity, [l04RawFixture.inputs[0]!], 1);
    const missOnlyTrace = projectL04RuntimeTrace(missOnly.raw, missOnly.ledger);
    const correctionOnly: LedgerEvent = {
      id: 'explicit-correction-only', tick: 0, sequence: 9, type: 'LESSON_CHECKPOINT', lesson_id: 'L04', cause: 'slower valid synthetic correction recorded',
    };
    const correctionOnlyTrace = projectL04RuntimeTrace(createSession(l04RawFixture.identity).raw, [correctionOnly]);

    expect(missOnlyTrace?.runtime_evidence.miss).toEqual(expect.objectContaining({ event_id: '0:1:2', recorded_cause: 'recoverable synthetic mark miss recorded' }));
    expect(missOnlyTrace?.runtime_evidence.correction.status).toBe('unavailable_no_runtime_record');
    expect(correctionOnlyTrace?.runtime_evidence.miss.status).toBe('unavailable_no_runtime_record');
    expect(correctionOnlyTrace?.runtime_evidence.correction).toEqual(expect.objectContaining({ event_id: 'explicit-correction-only', recorded_cause: 'slower valid synthetic correction recorded' }));
  });

  it('projects both L04 checkpoint records repeatedly without mutating canonical state, ledger, score, or replay payload', () => {
    const replayPayload = structuredClone({ ...l04RawFixture.identity, ordered_input_log: l04RawFixture.inputs });
    const session = replayInputs(l04RawFixture.identity, l04RawFixture.inputs, l04RawFixture.terminal_ticks);
    const before = structuredClone({ raw: session.raw, ledger: session.ledger, identity: session.identity, replayPayload });
    const firstTrace = projectL04RuntimeTrace(session.raw, session.ledger);
    const secondTrace = projectL04RuntimeTrace(session.raw, session.ledger);

    expect(projectScore(session.raw, session.ledger)).toEqual(l04ScoreFixture.score);
    expect(firstTrace).toEqual(secondTrace);
    expect(firstTrace?.runtime_evidence.miss).toEqual(expect.objectContaining({ event_id: '0:1:2', recorded_cause: 'recoverable synthetic mark miss recorded' }));
    expect(firstTrace?.runtime_evidence.correction).toEqual(expect.objectContaining({ event_id: '0:2:4', recorded_cause: 'slower valid synthetic correction recorded' }));
    expect({ raw: session.raw, ledger: session.ledger, identity: session.identity, replayPayload }).toEqual(before);
  });

  it('returns identical L04 runtime evidence for identical deterministic replays', () => {
    const one = replayInputs(l04RawFixture.identity, l04RawFixture.inputs, l04RawFixture.terminal_ticks);
    const two = replayInputs(l04RawFixture.identity, l04RawFixture.inputs, l04RawFixture.terminal_ticks);

    expect(projectL04RuntimeTrace(two.raw, two.ledger)).toEqual(projectL04RuntimeTrace(one.raw, one.ledger));
  });
});
