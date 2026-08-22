import { POLAR_KINEMATICS_MODEL_VERSION, polarKinematicsEnvironmentV1 } from '../contracts/polar-kinematics-environment.js';
import { COURSE_TEMPLATES } from '../contracts/scenario.js';
import { TRAINING_SLOOP_PROFILE_ID, type L01Manifest, type SyntheticSafetyEventDeclaration } from './l01.js';

/**
 * L04's target mark is the declared course-template geometry, not an invented
 * coordinate: `scenario.ts` pins these templates by exact canonical JSON.
 */
export const L04_TARGET_MARK = COURSE_TEMPLATES['windward-return-v1'].ordered_marks[0]!;

export const L02_SEMANTIC_ACTIONS = ['helm_port', 'helm_starboard', 'main_trim', 'jib_trim', 'pause', 'resume', 'reset'] as const;
export const L03_SEMANTIC_ACTIONS = ['helm_port', 'helm_starboard', 'main_trim', 'jib_trim', 'reef', 'pause', 'resume', 'reset'] as const;
export const L04_SEMANTIC_ACTIONS = ['helm_port', 'helm_starboard', 'main_trim', 'jib_trim', 'reef', 'pause', 'resume', 'reset'] as const;
export const L05_SEMANTIC_ACTIONS = ['helm_port', 'helm_starboard', 'decision_pass', 'decision_wait', 'decision_return', 'pause', 'resume', 'reset'] as const;

/**
 * The L03 V2 identity binds this narrow synthetic acknowledgment record. It
 * contains no environmental measurement, operating guidance, or physics.
 */
export interface L03SyntheticAcknowledgmentProfileV2 {
  profile_id: 'l03-synthetic-acknowledgment-profile-v2';
  lesson_id: 'L03';
  cue_state: 'gust_wave_observed';
  terminal_episode: 'complete';
  terminal_selection: 'selected';
  acknowledgment_action: 'reef';
}

export const l03SyntheticAcknowledgmentProfileV2: L03SyntheticAcknowledgmentProfileV2 = Object.freeze({
  profile_id: 'l03-synthetic-acknowledgment-profile-v2',
  lesson_id: 'L03',
  cue_state: 'gust_wave_observed',
  terminal_episode: 'complete',
  terminal_selection: 'selected',
  acknowledgment_action: 'reef',
});

export function isL03SyntheticAcknowledgmentProfileV2(value: unknown): value is L03SyntheticAcknowledgmentProfileV2 {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const candidate = value as Record<string, unknown>;
  const keys = ['profile_id', 'lesson_id', 'cue_state', 'terminal_episode', 'terminal_selection', 'acknowledgment_action'];
  return Object.keys(candidate).length === keys.length && keys.every((key) => Object.hasOwn(candidate, key)) &&
    candidate.profile_id === l03SyntheticAcknowledgmentProfileV2.profile_id &&
    candidate.lesson_id === l03SyntheticAcknowledgmentProfileV2.lesson_id &&
    candidate.cue_state === l03SyntheticAcknowledgmentProfileV2.cue_state &&
    candidate.terminal_episode === l03SyntheticAcknowledgmentProfileV2.terminal_episode &&
    candidate.terminal_selection === l03SyntheticAcknowledgmentProfileV2.terminal_selection &&
    candidate.acknowledgment_action === l03SyntheticAcknowledgmentProfileV2.acknowledgment_action;
}

type LessonId = 'L02' | 'L03' | 'L04' | 'L05';
export type LessonAction = (typeof L02_SEMANTIC_ACTIONS)[number] | (typeof L03_SEMANTIC_ACTIONS)[number] | (typeof L04_SEMANTIC_ACTIONS)[number] | (typeof L05_SEMANTIC_ACTIONS)[number];

export interface DraftLessonManifest extends Omit<L01Manifest, 'lesson_id' | 'validation_record_id' | 'initial_state' | 'permitted_actions' | 'synthetic_safety_event'> {
  lesson_id: LessonId;
  validation_record_id: 'VR-L02-v0' | 'VR-L03-v0' | 'VR-L04-v0' | 'VR-L05-v0';
  initial_state: string;
  permitted_actions: readonly LessonAction[];
  synthetic_safety_event?: SyntheticSafetyEventDeclaration<LessonAction>;
}

const common = {
  model_version: 'training-sloop-model-v0-draft',
  boat_profile_version: TRAINING_SLOOP_PROFILE_ID,
  contract_version: 'lesson-model-contract-v0-draft',
  coordinate_contract_version: 'coordinate-contract-v1-draft',
  determinism_contract_version: 'determinism-replay-contract-v1-draft',
  comparison_policy_version: 'comparison-policy-v1-draft',
  validation_disposition: 'assumption' as const,
};

/** Contracts are synthetic semantic declarations, not sailing thresholds or advice. */
export const l02Manifest: DraftLessonManifest = Object.freeze({
  ...common, lesson_id: 'L02', scenario_version: 'l02-scenario-v0-draft', validation_record_id: 'VR-L02-v0',
  model_version: POLAR_KINEMATICS_MODEL_VERSION,
  initial_state: 'training-sloop-v1 synthetic main/jib control-input acknowledgment fixture',
  required_observations: [
    { key: 'apparent_wind_angle', accessible_label: 'Apparent wind angle / 체감 바람 각도', status: 'declared_synthetic' },
    { key: 'declared_trim_feedback', accessible_label: 'Declared trim feedback / 선언된 트림 피드백', status: 'declared_synthetic' },
    { key: 'main_sheet', accessible_label: 'Main sheet / 메인 시트', status: 'declared_synthetic' },
    { key: 'jib_sheet', accessible_label: 'Jib sheet / 집 시트', status: 'declared_synthetic' },
    { key: 'declared_speed_response', accessible_label: 'Declared speed response / 선언된 속도 반응', status: 'declared_synthetic' },
    { key: 'control_stability', accessible_label: 'Control stability / 제어 안정성', status: 'declared_unavailable' },
  ] as const,
  permitted_actions: L02_SEMANTIC_ACTIONS, checkpoints: ['identify_initial_trim', 'record_main_jib_adjustment', 'reach_declared_stable_trim'],
  pass_semantics: 'Synthetic control-input acknowledgment plus a declared synthetic speed response: trim adjusts the declared speed through water by an invented educational factor. No real sail performance, boat handling, or safety metric is asserted.', fail_semantics: 'Only the declared replay terminal boundary is represented.',
  safe_recovery_semantics: 'Synthetic control-input acknowledgment only; no physical recovery is represented.',
  hint_and_debrief: 'Record main/jib control inputs and compare the resulting declared synthetic speed response. The invented educational factor implies no real sail performance, boat handling, stability, safety, or navigation guidance.',
  retry_comparison: ['ordered_trim_inputs', 'trim_acknowledgment', 'score_cause'],
  failure_or_boundary_acceptance: 'VR-L02-v0 assumption; this records no physical or safety outcome.',
});
export const l03Manifest: DraftLessonManifest = Object.freeze({
  ...common, lesson_id: 'L03', scenario_version: 'l03-scenario-v0-draft', validation_record_id: 'VR-L03-v0',
  initial_state: 'training-sloop-v1 deterministic synthetic cue before its declared acknowledgment checkpoint',
  required_observations: [
    { key: 'gust_wave_cue', accessible_label: 'Synthetic gust/wave cue / 합성 돌풍·파도 신호', status: 'declared_synthetic' },
    { key: 'synthetic_acknowledgment', accessible_label: 'Synthetic acknowledgment / 합성 확인', status: 'declared_synthetic' },
    { key: 'declared_checkpoint', accessible_label: 'Declared synthetic checkpoint / 선언된 합성 체크포인트', status: 'declared_synthetic' },
  ] as const,
  permitted_actions: L03_SEMANTIC_ACTIONS, checkpoints: ['observe_synthetic_cue', 'record_synthetic_acknowledgment', 'reach_declared_synthetic_checkpoint'],
  pass_semantics: 'Synthetic acknowledgment records only; no operational result is asserted.', fail_semantics: 'Only the declared terminal record boundary is represented.',
  safe_recovery_semantics: 'Synthetic acknowledgment records only; no operational recovery is represented.',
  hint_and_debrief: 'Record the declared synthetic cue and its declared synthetic checkpoint only.',
  retry_comparison: ['synthetic_cue_record', 'acknowledgment_record', 'checkpoint_record'],
  failure_or_boundary_acceptance: 'VR-L03-v0 assumption; all cue and acknowledgment meanings remain synthetic.',
});
/**
 * The declared synthetic arrival tolerance around the course template's mark.
 * It is an unvalidated educational assumption chosen so the lesson is playable;
 * it is not a real navigational tolerance, safety margin, or rounding rule.
 */
export const L04_MARK_ARRIVAL_RADIUS_M = 25 as const;

/** Shared by the session emitter and the debrief matcher so the string is declared once. */
export const L04_MARK_ARRIVAL_CAUSE = 'synthetic declared mark arrival recorded' as const;

/**
 * L04 runs the polar-and-current kinematics model so its declared objective —
 * reading the COG/heading difference and correcting for drift to reach a mark —
 * is actually simulated rather than declared. This manifest and `l05Manifest`
 * both override the shared `common` model_version; L02 and L03 stay on the
 * legacy draft model.
 */
export const l04Manifest: DraftLessonManifest = Object.freeze({
  ...common, lesson_id: 'L04', scenario_version: 'l04-scenario-v0-draft', validation_record_id: 'VR-L04-v0',
  model_version: POLAR_KINEMATICS_MODEL_VERSION,
  initial_state: 'training-sloop-v1 synthetic polar-and-current fixture with a declared virtual mark',
  required_observations: [
    { key: 'heading', accessible_label: 'Heading / 선수 방향', status: 'declared_synthetic' },
    { key: 'cog', accessible_label: 'Course over ground / 지상 항로', status: 'declared_synthetic' },
    { key: 'stw', accessible_label: 'Speed through water / 대수 속력', status: 'declared_synthetic' },
    { key: 'sog', accessible_label: 'Speed over ground / 대지 속력', status: 'declared_synthetic' },
    { key: 'drift', accessible_label: 'Drift / 표류', status: 'declared_synthetic' },
    { key: 'declared_mark_relation', accessible_label: 'Declared virtual mark relation / 선언된 가상 마크 관계', status: 'declared_synthetic' },
  ] as const,
  permitted_actions: L04_SEMANTIC_ACTIONS, checkpoints: ['identify_declared_vector_difference', 'record_correction', 'reach_declared_mark_acceptance'],
  pass_semantics: 'Draft-only declared synthetic mark arrival within the declared arrival radius; a slower corrected approach remains valid.', fail_semantics: 'Draft-only uncorrected synthetic drift or declared terminal boundary without a recorded arrival.',
  safe_recovery_semantics: 'Draft-only: a drifted approach stays recorded and may be corrected before the declared terminal boundary.',
  hint_and_debrief: 'Compare declared heading against polar-derived COG and drift, and connect the recorded helm correction to the declared mark arrival. Reefing reduces the declared speed through water, so it trades arrival time for a smaller declared sail. No real bearing, reefing threshold, or safety guidance is prescribed.',
  retry_comparison: ['heading_cog_stw_sog', 'correction_input', 'drift', 'mark_result', 'score_cause'],
  failure_or_boundary_acceptance: 'VR-L04-v0 assumption; values are declared synthetic and non-navigational.',
});
export const l05Manifest: DraftLessonManifest = Object.freeze({
  ...common, lesson_id: 'L05', scenario_version: 'l05-scenario-v0-draft', validation_record_id: 'VR-L05-v0',
  model_version: POLAR_KINEMATICS_MODEL_VERSION,
  initial_state: 'training-sloop-v1 synthetic tide/depth/visibility timeline and decision gate',
  required_observations: [
    { key: 'synthetic_tide_state', accessible_label: 'Synthetic tide state / 합성 조류 상태', status: 'declared_synthetic' },
    { key: 'scenario_depth', accessible_label: 'Scenario depth / 시나리오 수심', status: 'declared_synthetic' },
    { key: 'synthetic_depth_datum', accessible_label: 'Synthetic depth datum / 합성 수심 기준', status: 'declared_synthetic' },
    { key: 'declared_clearance', accessible_label: 'Declared clearance / 선언된 여유', status: 'declared_synthetic' },
    { key: 'visibility', accessible_label: 'Visibility / 시계', status: 'declared_unavailable' },
    { key: 'route_state', accessible_label: 'Route state / 경로 상태', status: 'declared_unavailable' },
  ] as const,
  permitted_actions: L05_SEMANTIC_ACTIONS, checkpoints: ['observe_declared_environment', 'make_decision_before_boundary', 'record_pass_wait_return_outcome'],
  pass_semantics: 'Draft-only: a declared conservative pass, wait, or return may be accepted; transit is not mastery.', fail_semantics: 'Draft-only proceeding without observation or declared terminal boundary.',
  safe_recovery_semantics: 'Draft-only wait or return can be a valid result before the declared terminal boundary.',
  hint_and_debrief: 'Label tide/depth/visibility concepts as synthetic and not actual route or under-keel guidance.',
  retry_comparison: ['observation_completeness', 'decision_tick_kind', 'synthetic_clearance_visibility_event', 'route_trajectory', 'score_cause'],
  failure_or_boundary_acceptance: 'VR-L05-v0 assumption; no actual route, depth, or clearance claim is made.',
});

export const l02ReplayBindings = Object.freeze({ ...bindings(l02Manifest), polar_kinematics_environment: polarKinematicsEnvironmentV1 });
export const l03ReplayBindings = Object.freeze(bindings(l03Manifest));
/** L04 carries the polar environment directly so its replay is self-describing. */
export const l04ReplayBindings = Object.freeze({ ...bindings(l04Manifest), polar_kinematics_environment: polarKinematicsEnvironmentV1 });
export const l05ReplayBindings = Object.freeze({ ...bindings(l05Manifest), polar_kinematics_environment: polarKinematicsEnvironmentV1 });

function bindings(manifest: DraftLessonManifest) {
  const { scenario_version, model_version, boat_profile_version, contract_version, coordinate_contract_version, determinism_contract_version, comparison_policy_version } = manifest;
  return { scenario_version, model_version, boat_profile_version, contract_version, coordinate_contract_version, determinism_contract_version, comparison_policy_version };
}

export const executableLessonManifests = Object.freeze([l02Manifest, l03Manifest, l04Manifest, l05Manifest]);
