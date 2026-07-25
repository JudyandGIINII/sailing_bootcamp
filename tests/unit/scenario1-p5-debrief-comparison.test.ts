import { describe, expect, it } from 'vitest';
import { createP4Attempt, reduceP4Attempt, type P4AttemptState } from '../../src/scenario1/p4/in-memory-attempt.js';
import {
  captureP5TerminalAttempt,
  createP5ComparisonHistory,
  snapshotP5TerminalAttempt,
  type P5ComparisonHistory,
} from '../../src/scenario1/p5/debrief-comparison.js';

function terminalAttempt(actions: readonly unknown[] = []): P4AttemptState {
  let attempt = createP4Attempt();
  let sequence = 1;
  for (const action of actions) {
    const reduction = reduceP4Attempt(attempt, { logical_tick: sequence, sequence, kind: 'p2_action', payload: action });
    expect(reduction.status).toBe('accepted');
    if (reduction.status !== 'accepted') throw new Error('fixture action rejected');
    attempt = reduction.state;
    sequence += 3;
  }
  const terminal = reduceP4Attempt(attempt, { logical_tick: sequence, sequence, kind: 'end_voyage', payload: {} });
  expect(terminal.status).toBe('accepted');
  if (terminal.status !== 'accepted') throw new Error('fixture end rejected');
  return terminal.state;
}

function captured(history: P5ComparisonHistory, attempt: P4AttemptState) {
  const result = captureP5TerminalAttempt(history, attempt);
  expect(result.status).toBe('captured');
  if (result.status !== 'captured') throw new Error('fixture capture rejected');
  return result;
}

function frozenScore(attempt: P4AttemptState): number {
  const score = attempt.p3_state.terminal?.score;
  if (!score || score.score_status !== 'available') throw new Error('fixture score unavailable');
  return score.score;
}

describe('Scenario 1 P5 debrief comparison', () => {
  it('captures a baseline and compares the immediate previous and current terminal snapshots', () => {
    const first = terminalAttempt();
    const baseline = captured(createP5ComparisonHistory(), first);
    expect(baseline.debrief.comparison).toEqual({ status: 'no_prior_same_condition' });
    expect(baseline.history.attempts).toHaveLength(1);

    const second = terminalAttempt([{ type: 'set_engine_output', engine_output: 100 }]);
    const compared = captured(baseline.history, second);
    expect(compared.history.attempts).toHaveLength(2);
    expect(compared.debrief.comparison.status).toBe('available');
    if (compared.debrief.comparison.status !== 'available') return;
    expect(compared.debrief.comparison.previous.score).toEqual(first.p3_state.terminal?.score);
    expect(compared.debrief.comparison.current.score).toEqual(second.p3_state.terminal?.score);
    expect(compared.debrief.comparison.difference.score).toBe(
      frozenScore(second) - frozenScore(first),
    );
  });

  it('keeps only two eligible attempts and compares the third with the second', () => {
    const first = captured(createP5ComparisonHistory(), terminalAttempt());
    const secondAttempt = terminalAttempt([{ type: 'set_engine_output', engine_output: 100 }]);
    const second = captured(first.history, secondAttempt);
    const thirdAttempt = terminalAttempt([{ type: 'set_engine_output', engine_output: 200 }]);
    const third = captured(second.history, thirdAttempt);
    expect(third.history.attempts).toHaveLength(2);
    expect(third.history.attempts[0]?.terminal_sequence).toBe(secondAttempt.p3_state.terminal?.terminal_sequence);
    expect(third.history.attempts[1]?.terminal_sequence).toBe(thirdAttempt.p3_state.terminal?.terminal_sequence);
    expect(third.debrief.comparison.status).toBe('available');
  });

  it('only admits verified terminal attempts and ignores rejected, paused, cancelled, and post-terminal inputs', () => {
    const active = createP4Attempt();
    expect(captureP5TerminalAttempt(createP5ComparisonHistory(), active)).toEqual(expect.objectContaining({ status: 'rejected_not_terminal' }));
    const paused = reduceP4Attempt(active, { logical_tick: 1, sequence: 1, kind: 'p2_action', payload: { type: 'pause' } });
    expect(paused.status).toBe('accepted');
    if (paused.status === 'accepted') expect(captureP5TerminalAttempt(createP5ComparisonHistory(), paused.state)).toEqual(expect.objectContaining({ status: 'rejected_not_terminal' }));
    const finished = terminalAttempt();
    const rejected = reduceP4Attempt(finished, { logical_tick: 2, sequence: 2, kind: 'p2_action', payload: { type: 'set_engine_output', engine_output: 1 } });
    expect(rejected.status).toBe('rejected_post_terminal');
    const result = captured(createP5ComparisonHistory(), finished);
    expect(result.debrief.current.action_trace).toEqual(finished.records.filter((record) => record.kind === 'p2_action' || record.kind === 'end_voyage'));
  });

  it('fails closed for malformed, mismatched, or inconsistent identity, retained target, controls, and trace data', () => {
    const terminal = terminalAttempt();
    const malformed = structuredClone(terminal) as P4AttemptState;
    (malformed.binding as { binding_discriminator: string }).binding_discriminator = 'unexpected';
    expect(captureP5TerminalAttempt(createP5ComparisonHistory(), malformed)).toEqual(expect.objectContaining({ status: 'rejected_ineligible' }));

    const baseline = captured(createP5ComparisonHistory(), terminal);
    const corruptHistory = structuredClone(baseline.history) as P5ComparisonHistory;
    (corruptHistory.attempts[0]?.target as { headingCentidegrees: number }).headingCentidegrees += 1;
    expect(captureP5TerminalAttempt(corruptHistory, terminalAttempt())).toEqual(expect.objectContaining({ status: 'rejected_incompatible_history' }));

    const retainedDataCorruptions: Array<(history: P5ComparisonHistory) => void> = [
      (history) => { (history.attempts[0]!.target as { profileVersion: number }).profileVersion += 1; },
      (history) => { (history.attempts[0]!.controls as { engineOutput: number }).engineOutput = 100; },
      (history) => { (history.attempts[0]!.action_trace[0]!.payload as { heading_centidegrees?: number }).heading_centidegrees = 200; },
    ];
    for (const corrupt of retainedDataCorruptions) {
      const history = structuredClone(baseline.history) as P5ComparisonHistory;
      corrupt(history);
      expect(captureP5TerminalAttempt(history, terminalAttempt())).toEqual(expect.objectContaining({ status: 'rejected_incompatible_history' }));
    }

    const bindingIncompatibleHistory = structuredClone(baseline.history) as P5ComparisonHistory;
    (bindingIncompatibleHistory.attempts[0]?.binding as { profile_id: string }).profile_id = 'target-compatible-but-wrong-binding';
    expect(captureP5TerminalAttempt(bindingIncompatibleHistory, terminalAttempt())).toEqual(expect.objectContaining({ status: 'rejected_incompatible_history' }));
  });

  it('fails closed for malformed retained P3 score, contributor, and weight values', () => {
    const baseline = captured(createP5ComparisonHistory(), terminalAttempt());
    const corruptions: Array<(history: P5ComparisonHistory) => void> = [
      (history) => { (history.attempts[0]!.score as unknown as { score: unknown }).score = Number.NaN; },
      (history) => { (history.attempts[0]!.score as unknown as { score: unknown }).score = '100'; },
      (history) => { (history.attempts[0]!.score as unknown as { score: unknown }).score = 101; },
      (history) => { (history.attempts[0]!.score as unknown as { contributors: { course_q: unknown } }).contributors.course_q = '100'; },
      (history) => { (history.attempts[0]!.contributors as unknown as { propulsion_q: unknown }).propulsion_q = 10001; },
      (history) => { (history.attempts[0]!.score as unknown as { contributors: { weights: { sail_wind_fit: unknown } } }).contributors.weights.sail_wind_fit = 4999; },
    ];
    for (const corrupt of corruptions) {
      const history = structuredClone(baseline.history) as P5ComparisonHistory;
      corrupt(history);
      expect(captureP5TerminalAttempt(history, terminalAttempt())).toEqual(expect.objectContaining({ status: 'rejected_incompatible_history' }));
    }
  });

  it('preserves immutable terminal values and makes action traces associations, not score inputs', () => {
    const terminal = terminalAttempt([{ type: 'set_engine_output', engine_output: 100 }, { type: 'set_engine_output', engine_output: 200 }]);
    const snapshot = snapshotP5TerminalAttempt(terminal);
    expect(snapshot.status).toBe('eligible');
    if (snapshot.status !== 'eligible') return;
    const score = snapshot.snapshot.score;
    expect(score.score_status).toBe('available');
    if (score.score_status !== 'available') return;
    expect(Object.isFrozen(snapshot.snapshot)).toBe(true);
    expect(Object.isFrozen(snapshot.snapshot.binding)).toBe(true);
    expect(Object.isFrozen(snapshot.snapshot.binding.sail_targets)).toBe(true);
    expect(Object.isFrozen(snapshot.snapshot.target)).toBe(true);
    expect(Object.isFrozen(snapshot.snapshot.controls)).toBe(true);
    expect(Object.isFrozen(snapshot.snapshot.score)).toBe(true);
    expect(Object.isFrozen(score.contributors)).toBe(true);
    expect(Object.isFrozen(snapshot.snapshot.contributors)).toBe(true);
    expect(Object.isFrozen(snapshot.snapshot.action_trace)).toBe(true);
    expect(Object.isFrozen(snapshot.snapshot.action_trace[0])).toBe(true);
    expect(Object.isFrozen(snapshot.snapshot.action_trace[0]?.payload)).toBe(true);
    expect(snapshot.snapshot.binding).not.toBe(terminal.binding);
    expect(snapshot.snapshot.binding.sail_targets).not.toBe(terminal.binding.sail_targets);
    expect(snapshot.snapshot.target).not.toBe(terminal.p2_state.target);
    expect(snapshot.snapshot.controls).not.toBe(terminal.p2_state.controls);
    expect(snapshot.snapshot.score).not.toBe(terminal.p3_state.terminal?.score);
    expect(score.contributors).not.toBe(terminal.p3_state.terminal?.score.score_status === 'available' ? terminal.p3_state.terminal.score.contributors : undefined);
    expect(snapshot.snapshot.contributors).not.toBe(score.contributors);
    expect(snapshot.snapshot.action_trace[0]?.payload).not.toBe(terminal.records.find((record) => record.kind === 'p2_action')?.payload);
    expect(snapshot.snapshot.score).toEqual(terminal.p3_state.terminal?.score);
    expect(snapshot.snapshot.contributors).toEqual(terminal.p3_state.terminal?.contributors);
    expect(snapshot.snapshot.action_trace.map((record) => [record.logical_tick, record.sequence])).toEqual([[1, 1], [4, 4], [7, 7]]);
    expect(JSON.stringify(snapshot.snapshot)).not.toContain('scoring_input');
  });
});
