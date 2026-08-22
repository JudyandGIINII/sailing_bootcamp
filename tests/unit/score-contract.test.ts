import { describe, expect, it } from 'vitest';
import {
  COMPONENT_MAX_POINTS,
  CONTROL_PENALTY_PER_REVERSAL,
  JUDGMENT_POINTS_PER_CORRECTION,
  LESSON_SCORE_PROFILES,
  SAFETY_CAP_RATIO,
  SAFETY_COMPONENT_POINTS,
  SAFETY_RECOVERY_REPRESENTATION,
  SCORE_BOUNDARY_TEXT,
  SCORE_CONTRACT_VERSION,
} from '../../src/scoring/score-contract.js';

describe('declared scoring contract', () => {
  it('declares a draft contract version', () => {
    expect(SCORE_CONTRACT_VERSION).toBe('score-contract-v0-draft');
  });

  it('gives every component the same declared maximum', () => {
    expect(COMPONENT_MAX_POINTS).toEqual({
      observation: 25, judgment: 25, control_stability: 25, safety: 25, goal: 25,
    });
  });

  it('declares integer component rules', () => {
    expect(Number.isInteger(JUDGMENT_POINTS_PER_CORRECTION)).toBe(true);
    expect(Number.isInteger(CONTROL_PENALTY_PER_REVERSAL)).toBe(true);
    for (const points of Object.values(SAFETY_COMPONENT_POINTS)) {
      expect(Number.isInteger(points)).toBe(true);
    }
  });

  it('makes the safety cap strictly tighter as severity rises', () => {
    expect(SAFETY_CAP_RATIO.danger).toBeLessThan(SAFETY_CAP_RATIO.caution);
    expect(SAFETY_CAP_RATIO.caution).toBeLessThan(1);
    expect(SAFETY_CAP_RATIO.danger).toBeGreaterThan(0);
  });

  it('declares a scoring profile per scored lesson', () => {
    expect(LESSON_SCORE_PROFILES.L04).toEqual({ unavailable: ['observation'], judgment_evidence: 'helm_correction' });
    expect(LESSON_SCORE_PROFILES.L05).toEqual({ unavailable: ['observation', 'goal'], judgment_evidence: 'decision_record' });
    expect(LESSON_SCORE_PROFILES.L06).toEqual({ unavailable: ['observation', 'goal'], judgment_evidence: 'helm_correction' });
  });

  it('declares safety recovery unrepresented rather than inventing it', () => {
    expect(SAFETY_RECOVERY_REPRESENTATION).toBe('not-represented-in-this-draft');
  });

  it('carries boundary copy that denies real-competence meaning', () => {
    expect(SCORE_BOUNDARY_TEXT).toMatch(/synthetic/i);
    expect(SCORE_BOUNDARY_TEXT).toMatch(/unvalidated/i);
    expect(SCORE_BOUNDARY_TEXT).toMatch(/not an assessment/i);
  });

  it('freezes every declared table', () => {
    expect(Object.isFrozen(COMPONENT_MAX_POINTS)).toBe(true);
    expect(Object.isFrozen(SAFETY_COMPONENT_POINTS)).toBe(true);
    expect(Object.isFrozen(SAFETY_CAP_RATIO)).toBe(true);
  });
});
