import { isReleaseEligible, type ValidationRecord } from '../contracts/release.js';
import { resolveStoredReplay, type ReplayIdentity } from '../contracts/replay.js';
import { TRAINING_SLOOP_PROFILE_ID, l01Manifest, l01ReplayBindings } from '../content/l01.js';
import { executableLessonManifests } from '../content/l02-l05.js';

export type GateReason =
  | 'UNSUPPORTED_LESSON'
  | 'UNSUPPORTED_PROFILE'
  | 'UNSUPPORTED_ACTION'
  | 'INCOMPATIBLE_BINDING'
  | 'REPLAY_IDENTITY_MISSING'
  | 'REPLAY_IDENTITY_INCOMPATIBLE'
  | 'REPLAY_PAYLOAD_CORRUPT'
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

/**
 * AP-0B has one executable runtime path only: the L01 vertical slice.
 * Any other lesson identifier fails closed and has no manifest or binding.
 */
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
  if (!exactBinding(identity, l01ReplayBindings)) {
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
  if (lessonId === 'L01') return evaluateL01Load(lessonId, profileId, actions, identity);
  const lesson = executableLessonManifests.find((candidate) => candidate.lesson_id === lessonId);
  const reasons: GateReason[] = [];
  if (!lesson) reasons.push('UNSUPPORTED_LESSON');
  if (profileId !== TRAINING_SLOOP_PROFILE_ID) reasons.push('UNSUPPORTED_PROFILE');
  if (lesson && !actions.every((action) => typeof action === 'string' && lesson.permitted_actions.includes(action as never))) reasons.push('UNSUPPORTED_ACTION');
  if (lesson && !exactBinding(identity, lesson)) reasons.push('INCOMPATIBLE_BINDING');
  return { eligible: reasons.length === 0, mode: 'prototype', reasons };
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
      ['helm_port', 'helm_starboard', 'pause', 'reset', 'resume'].includes((candidate as { action?: unknown }).action as string);
  });
  return exactBinding(binding, l01ReplayBindings) && validActions
    ? { eligible: true, mode: 'prototype', reasons: [] }
    : { eligible: false, mode: 'prototype', reasons: [validActions ? 'REPLAY_IDENTITY_INCOMPATIBLE' : 'REPLAY_PAYLOAD_CORRUPT'] };
}
