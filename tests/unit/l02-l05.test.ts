import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { replayInputs, type CanonicalInput, type DeterministicSession } from '../../src/sim/session.js';
import { projectDebrief, projectScore } from '../../src/scoring/projection.js';

for (const lesson of ['l02', 'l03', 'l04', 'l05']) {
  describe(`${lesson.toUpperCase()} draft deterministic contract`, () => {
    it('matches its full identity raw ledger and causal score/debrief fixture', () => {
      const fixture = JSON.parse(readFileSync(`tests/fixtures/${lesson}-raw-golden.json`, 'utf8')) as { identity: Parameters<typeof replayInputs>[0]; inputs: CanonicalInput[]; terminal_ticks: number; expected: { raw: unknown; ledger: unknown } };
      const session = replayInputs(fixture.identity, fixture.inputs, fixture.terminal_ticks);
      const projectionFixture = JSON.parse(readFileSync(`tests/fixtures/${lesson}-score-debrief-golden.json`, 'utf8')) as { score: unknown; debrief_fact_kinds: unknown };
      expect({ raw: session.raw, ledger: session.ledger }).toEqual(fixture.expected);
      expect(projectScore(session.raw, session.ledger)).toEqual(projectionFixture.score);
      expect(projectDebrief(session.raw, session.ledger).map((fact) => fact.kind)).toEqual(projectionFixture.debrief_fact_kinds);
      expect(replayInputs(fixture.identity, fixture.inputs, fixture.terminal_ticks)).toEqual(session as DeterministicSession);
    });
  });
}
