import { TRAINING_SLOOP_PROFILE_ID, type L01Manifest } from './l01.js';

export const L02_SEMANTIC_ACTIONS = ['helm_port', 'helm_starboard', 'main_trim', 'jib_trim', 'pause', 'resume', 'reset'] as const;
export const L03_SEMANTIC_ACTIONS = ['helm_port', 'helm_starboard', 'main_trim', 'jib_trim', 'reef', 'pause', 'resume', 'reset'] as const;
export const L04_SEMANTIC_ACTIONS = ['helm_port', 'helm_starboard', 'main_trim', 'jib_trim', 'pause', 'resume', 'reset'] as const;
export const L05_SEMANTIC_ACTIONS = ['helm_port', 'helm_starboard', 'decision_pass', 'decision_wait', 'decision_return', 'pause', 'resume', 'reset'] as const;

type LessonId = 'L02' | 'L03' | 'L04' | 'L05';
export type LessonAction = (typeof L02_SEMANTIC_ACTIONS)[number] | (typeof L03_SEMANTIC_ACTIONS)[number] | (typeof L04_SEMANTIC_ACTIONS)[number] | (typeof L05_SEMANTIC_ACTIONS)[number];

export interface DraftLessonManifest extends Omit<L01Manifest, 'lesson_id' | 'validation_record_id' | 'initial_state' | 'permitted_actions'> {
  lesson_id: LessonId;
  validation_record_id: 'VR-L02-v0' | 'VR-L03-v0' | 'VR-L04-v0' | 'VR-L05-v0';
  initial_state: string;
  permitted_actions: readonly LessonAction[];
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
  initial_state: 'training-sloop-v1 steady-wind synthetic main/jib trim fixture',
  required_observations: ['apparent_wind_angle', 'declared_trim_feedback', 'main_sheet', 'jib_sheet', 'declared_speed_response', 'control_stability'],
  permitted_actions: L02_SEMANTIC_ACTIONS, checkpoints: ['identify_initial_trim', 'record_main_jib_adjustment', 'reach_declared_stable_trim'],
  pass_semantics: 'Draft-only stable-trim causality; no speed or safety metric is asserted.', fail_semantics: 'Draft-only unexplained response or declared terminal boundary.',
  safe_recovery_semantics: 'Draft-only: return controls to a declared recoverable state; prior instability stays recorded.',
  hint_and_debrief: 'Connect main/jib control actions with declared trim feedback without revealing a hidden numeric answer.',
  retry_comparison: ['sheet_inputs', 'apparent_wind_state', 'declared_speed_stability_trajectory', 'safety_event', 'score_cause'],
  failure_or_boundary_acceptance: 'VR-L02-v0 assumption; slower synthetic valid control is not rejected for speed alone.',
});
export const l03Manifest: DraftLessonManifest = Object.freeze({
  ...common, lesson_id: 'L03', scenario_version: 'l03-scenario-v0-draft', validation_record_id: 'VR-L03-v0',
  initial_state: 'training-sloop-v1 deterministic synthetic gust/wave episode before its declared checkpoint',
  required_observations: ['gust_wave_cue', 'apparent_wind', 'sail_reef_state', 'declared_control_indicator'],
  permitted_actions: L03_SEMANTIC_ACTIONS, checkpoints: ['observe_episode', 'record_conservative_mitigation', 'reach_declared_post_episode_control'],
  pass_semantics: 'Draft-only: conservative synthetic mitigation can satisfy the declared checkpoint.', fail_semantics: 'Draft-only ignored episode, omitted mitigation, or declared terminal boundary.',
  safe_recovery_semantics: 'Draft-only recoverable episode may be mitigated; this is not real-world reef timing advice.',
  hint_and_debrief: 'Connect deterministic gust/wave cues, reef configuration, control action, and declared outcome.',
  retry_comparison: ['episode_observation_order', 'reef_control_events', 'state_trajectory', 'boundary_event', 'safety_first_cause'],
  failure_or_boundary_acceptance: 'VR-L03-v0 assumption; all episode and reef meanings remain synthetic.',
});
export const l04Manifest: DraftLessonManifest = Object.freeze({
  ...common, lesson_id: 'L04', scenario_version: 'l04-scenario-v0-draft', validation_record_id: 'VR-L04-v0',
  initial_state: 'training-sloop-v1 synthetic declared current-to vector and declared virtual mark',
  required_observations: ['heading', 'cog', 'stw', 'sog', 'drift', 'declared_mark_relation'],
  permitted_actions: L04_SEMANTIC_ACTIONS, checkpoints: ['identify_declared_vector_difference', 'record_correction', 'reach_declared_mark_acceptance'],
  pass_semantics: 'Draft-only declared synthetic mark acceptance; a slower valid correction remains valid.', fail_semantics: 'Draft-only ignored synthetic current or declared terminal boundary.',
  safe_recovery_semantics: 'Draft-only recoverable miss stays recorded before a later valid correction.',
  hint_and_debrief: 'Show declared heading/COG/STW/SOG/drift concepts without prescribing a real bearing.',
  retry_comparison: ['heading_cog_stw_sog', 'correction_input', 'drift', 'mark_result', 'score_cause'],
  failure_or_boundary_acceptance: 'VR-L04-v0 assumption; values are declared synthetic and non-navigational.',
});
export const l05Manifest: DraftLessonManifest = Object.freeze({
  ...common, lesson_id: 'L05', scenario_version: 'l05-scenario-v0-draft', validation_record_id: 'VR-L05-v0',
  initial_state: 'training-sloop-v1 synthetic tide/depth/visibility timeline and decision gate',
  required_observations: ['synthetic_tide_state', 'scenario_depth', 'synthetic_depth_datum', 'declared_clearance', 'visibility', 'route_state'],
  permitted_actions: L05_SEMANTIC_ACTIONS, checkpoints: ['observe_declared_environment', 'make_decision_before_boundary', 'record_pass_wait_return_outcome'],
  pass_semantics: 'Draft-only: a declared conservative pass, wait, or return may be accepted; transit is not mastery.', fail_semantics: 'Draft-only proceeding without observation or declared terminal boundary.',
  safe_recovery_semantics: 'Draft-only wait or return can be a valid result before the declared terminal boundary.',
  hint_and_debrief: 'Label tide/depth/visibility concepts as synthetic and not actual route or under-keel guidance.',
  retry_comparison: ['observation_completeness', 'decision_tick_kind', 'synthetic_clearance_visibility_event', 'route_trajectory', 'score_cause'],
  failure_or_boundary_acceptance: 'VR-L05-v0 assumption; no actual route, depth, or clearance claim is made.',
});

export const l02ReplayBindings = Object.freeze(bindings(l02Manifest));
export const l03ReplayBindings = Object.freeze(bindings(l03Manifest));
export const l04ReplayBindings = Object.freeze(bindings(l04Manifest));
export const l05ReplayBindings = Object.freeze(bindings(l05Manifest));

function bindings(manifest: DraftLessonManifest) {
  const { scenario_version, model_version, boat_profile_version, contract_version, coordinate_contract_version, determinism_contract_version, comparison_policy_version } = manifest;
  return { scenario_version, model_version, boat_profile_version, contract_version, coordinate_contract_version, determinism_contract_version, comparison_policy_version };
}

export const executableLessonManifests = Object.freeze([l02Manifest, l03Manifest, l04Manifest, l05Manifest]);
