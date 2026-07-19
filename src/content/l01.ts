import { prototypeVersionBindings } from '../contracts/versions.js';

export const TRAINING_SLOOP_PROFILE_ID = 'training-sloop-v1' as const;
export const L01_ID = 'L01' as const;

export const L01_SEMANTIC_ACTIONS = ['helm_port', 'helm_starboard', 'pause', 'resume', 'reset'] as const;
export type L01SemanticAction = (typeof L01_SEMANTIC_ACTIONS)[number];

export interface L01Manifest {
  lesson_id: typeof L01_ID;
  scenario_version: string;
  model_version: string;
  boat_profile_version: typeof TRAINING_SLOOP_PROFILE_ID;
  contract_version: string;
  coordinate_contract_version: string;
  determinism_contract_version: string;
  comparison_policy_version: string;
  validation_record_id: 'VR-L01-v0';
  validation_disposition: 'assumption';
  initial_state: 'training-sloop-v1 steady-wind synthetic fixture';
  required_observations: readonly string[];
  permitted_actions: readonly L01SemanticAction[];
  checkpoints: readonly string[];
  pass_semantics: string;
  fail_semantics: string;
  safe_recovery_semantics: string;
  hint_and_debrief: string;
  retry_comparison: readonly string[];
  failure_or_boundary_acceptance: string;
}

/**
 * L01 is the only executable AP-0B slice. These bindings are from the content
 * draft and do not assert sailing-domain behaviour.
 */
export const l01Manifest: L01Manifest = Object.freeze({
  lesson_id: L01_ID,
  scenario_version: 'l01-scenario-v0-draft',
  model_version: 'training-sloop-model-v0-draft',
  boat_profile_version: TRAINING_SLOOP_PROFILE_ID,
  contract_version: 'lesson-model-contract-v0-draft',
  coordinate_contract_version: prototypeVersionBindings.coordinate_contract_version,
  determinism_contract_version: 'determinism-replay-contract-v1-draft',
  comparison_policy_version: prototypeVersionBindings.comparison_policy_version,
  validation_record_id: 'VR-L01-v0',
  validation_disposition: 'assumption',
  initial_state: 'training-sloop-v1 steady-wind synthetic fixture',
  required_observations: ['true_wind_from', 'apparent_wind', 'heading', 'cog'],
  permitted_actions: L01_SEMANTIC_ACTIONS,
  checkpoints: ['observe_declared_signals', 'record_helm_correction', 'reach_declared_course_state'],
  pass_semantics: 'Draft-only: declared checkpoints complete with no unresolved simulated boundary event.',
  fail_semantics: 'Draft-only: missing required observation, unmet declared objective, or declared terminal boundary.',
  safe_recovery_semantics: 'Draft-only: a non-terminal deviation remains recorded and may be corrected.',
  hint_and_debrief: 'Compare declared true/apparent wind with heading/COG and connect recorded action to result.',
  retry_comparison: ['heading_cog_trajectory', 'correction_order', 'checkpoint_result', 'boundary_event', 'score_cause'],
  failure_or_boundary_acceptance: 'VR-L01-v0 assumption; no navigation or safety threshold is asserted.',
});

export const l01ReplayBindings = Object.freeze({
  scenario_version: l01Manifest.scenario_version,
  model_version: l01Manifest.model_version,
  boat_profile_version: l01Manifest.boat_profile_version,
  contract_version: l01Manifest.contract_version,
  coordinate_contract_version: l01Manifest.coordinate_contract_version,
  determinism_contract_version: l01Manifest.determinism_contract_version,
  comparison_policy_version: l01Manifest.comparison_policy_version,
});
