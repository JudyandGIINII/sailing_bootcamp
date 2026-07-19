import { isReleaseEligible, type ValidationRecord } from '../contracts/release.js';
import { resolveStoredReplay, type ReplayIdentity } from '../contracts/replay.js';
import { TRAINING_SLOOP_PROFILE_ID, l01Manifest, l01ReplayBindings } from '../content/l01.js';
import { getLessonManifest, isLessonActionAllowed } from '../content/lesson-manifest.js';

export type GateReason =
  | 'UNSUPPORTED_LESSON'
  | 'UNSUPPORTED_PROFILE'
  | 'UNSUPPORTED_ACTION'
  | 'INCOMPATIBLE_BINDING'
  | 'REPLAY_IDENTITY_MISSING'
  | 'REPLAY_IDENTITY_INCOMPATIBLE'
  | 'REPLAY_PAYLOAD_CORRUPT'
  | 'REPLAY_ACTION_DISALLOWED'
  | 'UNVALIDATED_PROTOTYPE'
  | 'RELEASE_VALIDATION_NOT_APPROVED'
  | 'RELEASE_P1_ARTIFACTS_MISSING'
  | 'RELEASE_AUTHORITY_MISSING';

export interface Eligibility {
  eligible: boolean;
  mode: 'prototype' | 'release';
  reasons: readonly GateReason[];
}

function exactBinding(
  identity: Omit<ReplayIdentity, 'seed' | 'ordered_input_log'>,
  expected: Omit<ReplayIdentity, 'seed' | 'ordered_input_log'>,
): boolean {
  const expectedKeys = Object.keys(expected);
  return Object.keys(identity).length === expectedKeys.length &&
    expectedKeys.every((key) => identity[key as keyof typeof expected] === expected[key as keyof typeof expected]);
}

function bindingsForManifest(manifest: ReturnType<typeof getLessonManifest>): Omit<ReplayIdentity, 'seed' | 'ordered_input_log'> | undefined {
  if (!manifest) return undefined;
  const {
    scenario_version,
    model_version,
    boat_profile_version,
    contract_version,
    coordinate_contract_version,
    determinism_contract_version,
    comparison_policy_version,
  } = manifest;
  return {
    scenario_version,
    model_version,
    boat_profile_version,
    contract_version,
    coordinate_contract_version,
    determinism_contract_version,
    comparison_policy_version,
  };
}

/** Legacy L01 entry point retains its L01-only compatibility contract. */
export function evaluateL01Load(
  lessonId: unknown,
  profileId: unknown,
  actions: readonly unknown[],
  identity: Omit<ReplayIdentity, 'seed' | 'ordered_input_log'>,
): Eligibility {
  const reasons: GateReason[] = [];
  if (lessonId !== l01Manifest.lesson_id) reasons.push('UNSUPPORTED_LESSON');
  if (profileId !== TRAINING_SLOOP_PROFILE_ID) reasons.push('UNSUPPORTED_PROFILE');
  if (!actions.every((action) => typeof action === 'string' && l01Manifest.permitted_actions.includes(action as never))) {
    reasons.push('UNSUPPORTED_ACTION');
  }
  if (!exactBinding(identity, l01ReplayBindings)) reasons.push('INCOMPATIBLE_BINDING');
  return { eligible: reasons.length === 0, mode: 'prototype', reasons };
}

function evaluateManifestLoad(
  lessonId: unknown,
  profileId: unknown,
  actions: readonly unknown[],
  identity: Omit<ReplayIdentity, 'seed' | 'ordered_input_log'>,
): Eligibility {
  const lesson = getLessonManifest(lessonId);
  const reasons: GateReason[] = [];
  if (!lesson) reasons.push('UNSUPPORTED_LESSON');
  if (profileId !== TRAINING_SLOOP_PROFILE_ID) reasons.push('UNSUPPORTED_PROFILE');
  if (lesson && !actions.every((action) => typeof action === 'string' && lesson.permitted_actions.includes(action as never))) {
    reasons.push('UNSUPPORTED_ACTION');
  }
  const bindings = bindingsForManifest(lesson);
  if (bindings && !exactBinding(identity, bindings)) {
    reasons.push('INCOMPATIBLE_BINDING');
  }
  return { eligible: reasons.length === 0, mode: 'prototype', reasons };
}

export function evaluateLessonLoad(
  lessonId: unknown,
  profileId: unknown,
  actions: readonly unknown[],
  identity: Omit<ReplayIdentity, 'seed' | 'ordered_input_log'>,
): Eligibility {
  return evaluateManifestLoad(lessonId, profileId, actions, identity);
}

/** Assumption content is allowed only as visibly-labelled prototype content. */
export function evaluatePrototypeEligibility(): Eligibility {
  return {
    eligible: l01Manifest.validation_disposition === 'assumption',
    mode: 'prototype',
    reasons: ['UNVALIDATED_PROTOTYPE'],
  };
}

/** Current registry/P1/release-authority state deliberately fails closed. */
export function evaluateReleaseEligibility(record: ValidationRecord | undefined): Eligibility {
  const reasons: GateReason[] = [];
  if (!record || !isReleaseEligible(record)) reasons.push('RELEASE_VALIDATION_NOT_APPROVED');
  reasons.push('RELEASE_P1_ARTIFACTS_MISSING', 'RELEASE_AUTHORITY_MISSING');
  return { eligible: false, mode: 'release', reasons };
}

export function validateL01ReplayPayload(payload: unknown): Eligibility {
  const resolution = resolveStoredReplay(payload, l01ReplayBindings);
  if (resolution.outcome === 'rejected') return { eligible: false, mode: 'prototype', reasons: [resolution.reason_code] };
  const accepted = resolution.replay;
  const { seed: _seed, ordered_input_log: _log, ...binding } = accepted;
  const validActions = accepted.ordered_input_log.every((entry) => {
    const candidate = entry.input;
    return typeof candidate === 'object' && candidate !== null &&
      'action' in candidate &&
      isLessonActionAllowed(accepted, (candidate as { action?: unknown }).action);
  });
  return exactBinding(binding, l01ReplayBindings) && validActions
    ? { eligible: true, mode: 'prototype', reasons: [] }
    : { eligible: false, mode: 'prototype', reasons: [validActions ? 'REPLAY_IDENTITY_INCOMPATIBLE' : 'REPLAY_PAYLOAD_CORRUPT'] };
}
