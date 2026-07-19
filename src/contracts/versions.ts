/**
 * Prototype binding values are intentionally draft-only. A release validator
 * treats drafts as ineligible; this module does not describe sailing behaviour.
 */
export const prototypeVersionBindings = {
  scenario_version: 'scenario-v1-draft',
  model_version: 'model-v1-draft',
  boat_profile_version: 'boat-profile-v1-draft',
  contract_version: 'lesson-contract-model-interface-v1-draft',
  coordinate_contract_version: 'coordinate-contract-v1-draft',
  determinism_contract_version: 'determinism-contract-v1-draft',
  comparison_policy_version: 'comparison-policy-v1-draft',
} as const;

/**
 * contract_version names the lesson-contract schema and model-interface bundle.
 * Coordinate, determinism, and comparison policies keep independent bindings.
 */
export const contractVersionDefinition =
  'lesson-contract schema plus model-interface bundle';
