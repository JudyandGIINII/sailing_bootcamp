import type { LessonBindingV2, ReplayIdentity } from '../contracts/replay.js';
import { l01Manifest, type L01Manifest, type L01SemanticAction, type RequiredObservation, type SyntheticSafetyEventDeclaration } from './l01.js';
import { l02Manifest, l03Manifest, l04Manifest, l05Manifest, type DraftLessonManifest, type LessonAction } from './l02-l05.js';

export type LessonId = 'L01' | 'L02' | 'L03' | 'L04' | 'L05';
export type DeclaredLessonAction = L01SemanticAction | LessonAction;
export type LessonManifest = L01Manifest | DraftLessonManifest;
export type LessonPolicyIdentity = Omit<ReplayIdentity, 'seed' | 'ordered_input_log'>;
export interface LessonObservationProjection {
  readonly key: string;
  readonly accessible_label: string;
  readonly status: RequiredObservation['status'];
}

export interface ResolvedLessonPolicy {
  readonly permitted_actions: readonly DeclaredLessonAction[];
  readonly synthetic_safety_event?: SyntheticSafetyEventDeclaration<DeclaredLessonAction>;
}

/**
 * The lesson declarations are the single authority for executable actions.
 * This registry contains no inferred sailing behaviour or additional actions.
 */
export const lessonManifestRegistry: Readonly<Record<LessonId, LessonManifest>> = Object.freeze({
  L01: l01Manifest,
  L02: l02Manifest,
  L03: l03Manifest,
  L04: l04Manifest,
  L05: l05Manifest,
});

export function getLessonManifest(lessonId: unknown): LessonManifest | undefined {
  return typeof lessonId === 'string'
    ? lessonManifestRegistry[lessonId as LessonId]
    : undefined;
}

function matchesBindings(identity: LessonPolicyIdentity, manifest: LessonManifest): boolean {
  return identity.scenario_version === manifest.scenario_version &&
    identity.model_version === manifest.model_version &&
    identity.boat_profile_version === manifest.boat_profile_version &&
    identity.contract_version === manifest.contract_version &&
    identity.coordinate_contract_version === manifest.coordinate_contract_version &&
    identity.determinism_contract_version === manifest.determinism_contract_version &&
    identity.comparison_policy_version === manifest.comparison_policy_version;
}

/**
 * Validates only the declaration shape. It does not register a manifest or
 * authorize a runtime identity, so callers cannot use it to inject policy.
 */
export function resolveDeclaredSyntheticSafetyEvent(
  permittedActions: readonly string[],
  declaration: unknown,
): SyntheticSafetyEventDeclaration<DeclaredLessonAction> | undefined {
  if (typeof declaration !== 'object' || declaration === null || Array.isArray(declaration)) return undefined;
  const candidate = declaration as Record<string, unknown>;
  if (
    candidate.status !== 'declared_synthetic' ||
    candidate.validation_status !== 'unvalidated' ||
    typeof candidate.action !== 'string' ||
    !permittedActions.includes(candidate.action)
  ) return undefined;
  return Object.freeze({
    action: candidate.action as DeclaredLessonAction,
    status: 'declared_synthetic',
    validation_status: 'unvalidated',
  });
}

/** Resolves policy only when the complete lesson binding is recognized in the trusted registry. */
export function projectLessonObservations(lessonId: unknown): readonly LessonObservationProjection[] | undefined {
  const observations = getLessonManifest(lessonId)?.required_observations;
  return observations && Object.freeze(observations.map((observation) => Object.freeze({ ...observation })));
}

/** Resolves only explicit manifest declarations; absent, empty, or unknown safety actions deny by default. */
export function resolveLessonPolicy(
  identity: LessonPolicyIdentity,
): ResolvedLessonPolicy | undefined {
  const manifest = Object.values(lessonManifestRegistry).find((candidate) => matchesBindings(identity, candidate));
  if (!manifest) return undefined;
  const syntheticSafetyEvent = resolveDeclaredSyntheticSafetyEvent(manifest.permitted_actions, manifest.synthetic_safety_event);
  return Object.freeze({
    permitted_actions: Object.freeze([...manifest.permitted_actions]) as readonly DeclaredLessonAction[],
    ...(syntheticSafetyEvent ? { synthetic_safety_event: syntheticSafetyEvent } : {}),
  });
}

export function resolveLessonActionPolicy(identity: LessonPolicyIdentity): readonly DeclaredLessonAction[] | undefined {
  return resolveLessonPolicy(identity)?.permitted_actions;
}

export function isLessonActionAllowed(identity: LessonPolicyIdentity, action: unknown): action is DeclaredLessonAction {
  return typeof action === 'string' && (resolveLessonActionPolicy(identity)?.includes(action as DeclaredLessonAction) ?? false);
}

/** V2 deliberately binds actions to the registered lesson only; scenario values never authorize an action. */
export function isLessonActionAllowedV2(binding: LessonBindingV2, action: unknown): action is DeclaredLessonAction {
  const manifest = getLessonManifest(binding.lesson_id);
  if (!manifest || typeof action !== 'string') return false;
  return manifest.model_version === binding.model_version && manifest.boat_profile_version === binding.boat_profile_version &&
    manifest.contract_version === binding.contract_version && manifest.coordinate_contract_version === binding.coordinate_contract_version &&
    manifest.determinism_contract_version === binding.determinism_contract_version && manifest.comparison_policy_version === binding.comparison_policy_version &&
    manifest.permitted_actions.some((permittedAction) => permittedAction === action);
}
