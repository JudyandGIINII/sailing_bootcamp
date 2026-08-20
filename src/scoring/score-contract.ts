/**
 * The declared scoring contract for PRD §7.3. Every number here is an invented
 * educational constant chosen for a synthetic training prototype. None of it is
 * an assessment scale, a competence standard, or a safety threshold, and none of
 * it rests on a validated domain record — `VR-POLAR-v0` is `disposition: assumption`.
 *
 * This module declares values only. All logic lives in `components.ts`.
 */
export const SCORE_CONTRACT_VERSION = 'score-contract-v0-draft' as const;

export type ScoreComponentKey =
  | 'observation'
  | 'judgment'
  | 'control_stability'
  | 'safety'
  | 'goal';

export type SafetySeverity = 'clear' | 'caution' | 'danger';

/** Declared maximum for each component when it applies to a lesson. */
export const COMPONENT_MAX_POINTS: Readonly<Record<ScoreComponentKey, number>> = Object.freeze({
  observation: 25,
  judgment: 25,
  control_stability: 25,
  safety: 25,
  goal: 25,
});

/** Each recorded helm correction earns this much judgment credit, saturating at the maximum. */
export const JUDGMENT_POINTS_PER_CORRECTION = 10;

/** Each helm direction reversal costs this much control-stability credit, floored at zero. */
export const CONTROL_PENALTY_PER_REVERSAL = 5;

/** Component credit for the most severe under-keel clearance level recorded. */
export const SAFETY_COMPONENT_POINTS: Readonly<Record<SafetySeverity, number>> = Object.freeze({
  clear: 25,
  caution: 12,
  danger: 0,
});

/**
 * A recorded clearance crossing caps the whole total at this fraction of what was
 * possible. A cap is used rather than a deduction because a deduction can be
 * offset by scoring well elsewhere, which PRD §7.3 forbids outright.
 */
export const SAFETY_CAP_RATIO: Readonly<Record<'caution' | 'danger', number>> = Object.freeze({
  caution: 0.7,
  danger: 0.4,
});

/**
 * L04 records no observation action, so the observation component has no evidence
 * to read. It is declared unavailable rather than scored zero, because zero would
 * read as "did badly" instead of "not scored".
 */
export const L04_UNAVAILABLE_COMPONENTS: readonly ScoreComponentKey[] = Object.freeze(['observation'] as const);

/**
 * PRD §7.3 requires the contract to declare how safety recovery is handled. The
 * current model never records a recovery — `shouldRecordClearanceCrossing` fires
 * only when severity rises — so this draft declares it unrepresented rather than
 * claiming a recovery that was never recorded.
 */
export const SAFETY_RECOVERY_REPRESENTATION = 'not-represented-in-this-draft' as const;

export const SCORE_BOUNDARY_TEXT =
  'Synthetic educational score, unvalidated — not an assessment of real sailing competence, qualification, or safety.' as const;
