import { prototypeVersionBindings } from '../contracts/versions.js';
import { POLAR_KINEMATICS_MODEL_VERSION, polarKinematicsEnvironmentV1 } from '../contracts/polar-kinematics-environment.js';
import { TRAINING_SLOOP_PROFILE_ID, type RequiredObservation, type SyntheticSafetyEventDeclaration } from './l01.js';

export const L06_ID = 'L06' as const;

export const L06_SEMANTIC_ACTIONS = ['helm_port', 'helm_starboard', 'pause', 'resume', 'reset'] as const;
export type L06SemanticAction = (typeof L06_SEMANTIC_ACTIONS)[number];

export interface L06Manifest {
  lesson_id: typeof L06_ID;
  scenario_version: string;
  model_version: typeof POLAR_KINEMATICS_MODEL_VERSION;
  boat_profile_version: typeof TRAINING_SLOOP_PROFILE_ID;
  contract_version: string;
  coordinate_contract_version: string;
  determinism_contract_version: string;
  comparison_policy_version: string;
  validation_record_id: 'VR-POLAR-v0';
  validation_disposition: 'assumption';
  initial_state: string;
  required_observations: readonly RequiredObservation[];
  permitted_actions: readonly L06SemanticAction[];
  synthetic_safety_event?: SyntheticSafetyEventDeclaration<L06SemanticAction>;
  checkpoints: readonly string[];
  pass_semantics: string;
  fail_semantics: string;
  safe_recovery_semantics: string;
  hint_and_debrief: string;
  retry_comparison: readonly string[];
  failure_or_boundary_acceptance: string;
}

/**
 * L06 is the first lesson to register the polar-and-current kinematics model
 * (`polar-kinematics-v5`), which was built and wired across earlier tasks but
 * had no lesson declaring it. L01 was deliberately left on its legacy model
 * instead of being migrated: its replay bindings are derived live from its
 * manifest and consumed at many call sites, so flipping its model_version
 * would have silently reinterpreted every one of them. L06 exercises the
 * polar model additively, without touching L01-L05. It is a non-mandatory
 * demonstration lesson beyond the PRD's fixed L01-L05 MVP set.
 */
export const l06Manifest: L06Manifest = Object.freeze({
  lesson_id: L06_ID,
  scenario_version: 'l06-polar-scenario-v0-draft',
  model_version: POLAR_KINEMATICS_MODEL_VERSION,
  boat_profile_version: TRAINING_SLOOP_PROFILE_ID,
  contract_version: 'lesson-model-contract-v0-draft',
  coordinate_contract_version: prototypeVersionBindings.coordinate_contract_version,
  determinism_contract_version: 'determinism-replay-contract-v1-draft',
  comparison_policy_version: prototypeVersionBindings.comparison_policy_version,
  validation_record_id: 'VR-POLAR-v0',
  validation_disposition: 'assumption',
  initial_state: 'training-sloop-v1 synthetic polar-and-current fixture',
  required_observations: [
    { key: 'true_wind_from', accessible_label: 'True wind / 실제 바람', status: 'declared_synthetic' },
    { key: 'apparent_wind', accessible_label: 'Apparent wind / 체감 바람', status: 'declared_synthetic' },
    { key: 'heading', accessible_label: 'Heading / 선수 방향', status: 'declared_synthetic' },
    { key: 'cog', accessible_label: 'Course over ground / 지상 항로', status: 'declared_synthetic' },
    { key: 'stw', accessible_label: 'Speed through water / 대수 속력', status: 'declared_synthetic' },
    { key: 'sog', accessible_label: 'Speed over ground / 대지 속력', status: 'declared_synthetic' },
    { key: 'drift', accessible_label: 'Drift / 표류', status: 'declared_synthetic' },
    { key: 'current', accessible_label: 'Current / 조류', status: 'declared_synthetic' },
    { key: 'clearance', accessible_label: 'Under-keel clearance / 용골 아래 여유', status: 'declared_synthetic' },
  ] as const,
  permitted_actions: L06_SEMANTIC_ACTIONS,
  checkpoints: ['observe_declared_polar_signals', 'record_helm_correction', 'reach_declared_course_state'],
  pass_semantics: 'Draft-only: declared checkpoints complete with no unresolved simulated boundary event.',
  fail_semantics: 'Draft-only: missing required observation, unmet declared objective, or declared terminal boundary.',
  safe_recovery_semantics: 'Draft-only: a non-terminal deviation remains recorded and may be corrected.',
  hint_and_debrief: 'Compare declared true/apparent wind and polar-derived STW/SOG/drift against heading/COG, and connect the recorded helm action to its result.',
  retry_comparison: ['heading_cog_trajectory', 'stw_sog_drift', 'correction_order', 'checkpoint_result', 'boundary_event', 'score_cause'],
  failure_or_boundary_acceptance: 'VR-POLAR-v0 assumption; no navigation or safety threshold is asserted.',
});

/**
 * Mirrors `l01ReplayBindings`: this identity carries the polar environment
 * carrier directly (unlike the L02-L05 `bindings()` helper), so an L06 replay
 * is self-describing without consulting the manifest registry.
 */
export const l06ReplayBindings = Object.freeze({
  scenario_version: l06Manifest.scenario_version,
  model_version: l06Manifest.model_version,
  boat_profile_version: l06Manifest.boat_profile_version,
  contract_version: l06Manifest.contract_version,
  coordinate_contract_version: l06Manifest.coordinate_contract_version,
  determinism_contract_version: l06Manifest.determinism_contract_version,
  comparison_policy_version: l06Manifest.comparison_policy_version,
  polar_kinematics_environment: polarKinematicsEnvironmentV1,
});
