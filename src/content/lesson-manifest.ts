import type { ReplayIdentity } from '../contracts/replay.js';
import { l01Manifest, type L01Manifest, type L01SemanticAction } from './l01.js';
import { l02Manifest, l03Manifest, l04Manifest, l05Manifest, type DraftLessonManifest, type LessonAction } from './l02-l05.js';

export type LessonId = 'L01' | 'L02' | 'L03' | 'L04' | 'L05';
export type DeclaredLessonAction = L01SemanticAction | LessonAction;
export type LessonManifest = L01Manifest | DraftLessonManifest;
export type LessonPolicyIdentity = Omit<ReplayIdentity, 'seed' | 'ordered_input_log'>;

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

/** Resolves policy only when the complete lesson binding is recognized. */
export function resolveLessonActionPolicy(identity: LessonPolicyIdentity): readonly DeclaredLessonAction[] | undefined {
  const manifest = Object.values(lessonManifestRegistry).find((candidate) => matchesBindings(identity, candidate));
  return manifest?.permitted_actions as readonly DeclaredLessonAction[] | undefined;
}

export function isLessonActionAllowed(identity: LessonPolicyIdentity, action: unknown): action is DeclaredLessonAction {
  return typeof action === 'string' && (resolveLessonActionPolicy(identity)?.includes(action as DeclaredLessonAction) ?? false);
}
