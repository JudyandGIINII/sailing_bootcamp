import {
  SYNTHETIC_TARGET_PROFILE_VERSION,
  profileFor,
  type P2Controls,
  type P2State,
  type P2TargetProfile,
} from '../p2/deterministic-mechanics.js';
import {
  P3_SCORING_CONTRACT_VERSION,
  type P3TargetProfile,
} from '../p3/deterministic-scoring.js';

export const P4_BINDING_DISCRIMINATOR = 'scenario1-p2-p3-binding-v1' as const;
export const P4_BINDING_PROFILE_VERSION = 1 as const;

export interface P4BindingProfile {
  readonly binding_discriminator: typeof P4_BINDING_DISCRIMINATOR;
  readonly profile_id: string;
  readonly profile_version: typeof P4_BINDING_PROFILE_VERSION;
  readonly scoring_contract_version: typeof P3_SCORING_CONTRACT_VERSION;
  readonly scenario_seed: number;
  readonly ordinal: number;
  readonly synthetic_target_heading_centidegrees: number;
  readonly propulsion_context: 'sailing_capable';
  readonly sail_targets: Readonly<{
    readonly main_deployed: true;
    readonly jib_deployed: true;
    readonly main_trim: number;
    readonly jib_trim: number;
    readonly main_reef_level: number;
    readonly jib_reef_level: number;
  }>;
}

function isUInt32(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && !Object.is(value, -0) && value >= 0 && value <= 0xffffffff;
}

function exactObject(value: unknown, keys: readonly string[]): Record<string, unknown> | undefined {
  try {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) return undefined;
    const object = value as object;
    const ownKeys = Reflect.ownKeys(object);
    if (ownKeys.length !== keys.length || ownKeys.some((key) => typeof key !== 'string' || !keys.includes(key))) return undefined;
    const copy: Record<string, unknown> = {};
    for (const key of keys) {
      const descriptor = Object.getOwnPropertyDescriptor(object, key);
      if (!descriptor || !Object.hasOwn(descriptor, 'value')) return undefined;
      copy[key] = descriptor.value;
    }
    return copy;
  } catch {
    return undefined;
  }
}

function validTarget(target: P2TargetProfile, seed: number, ordinal: number): boolean {
  const candidate = exactObject(target, ['profileVersion', 'scenarioSeed', 'ordinal', 'headingCentidegrees', 'mainTrim', 'jibTrim', 'mainReefLevel', 'jibReefLevel']);
  if (!candidate || candidate.profileVersion !== SYNTHETIC_TARGET_PROFILE_VERSION || candidate.scenarioSeed !== seed || candidate.ordinal !== ordinal) return false;
  const expected = profileFor(seed, ordinal);
  return Object.keys(expected).every((key) => candidate[key] === expected[key as keyof P2TargetProfile]);
}

/** Derives the sole P4-only P2 -> P3 binding. Invalid or tampered P2 state fails closed. */
export function deriveP4BindingProfile(state: P2State): P4BindingProfile {
  const candidate = exactObject(state, ['status', 'logicalTick', 'seed', 'targetOrdinal', 'target', 'controls', 'consecutiveMatchingTicks']);
  if (!candidate || (candidate.status !== 'running' && candidate.status !== 'paused') || !isUInt32(candidate.seed) || !isUInt32(candidate.targetOrdinal)) {
    throw new RangeError('P4_BINDING_INVALID_P2_STATE');
  }
  if (!validTarget(candidate.target as P2TargetProfile, candidate.seed, candidate.targetOrdinal)) throw new RangeError('P4_BINDING_TARGET_MISMATCH');
  const target = candidate.target as P2TargetProfile;
  const seedHex = candidate.seed.toString(16).padStart(8, '0');
  const ordinalHex = candidate.targetOrdinal.toString(16).padStart(8, '0');
  return Object.freeze({
    binding_discriminator: P4_BINDING_DISCRIMINATOR,
    profile_id: `scenario1-p2-target-v1-${seedHex}-${ordinalHex}`,
    profile_version: P4_BINDING_PROFILE_VERSION,
    scoring_contract_version: P3_SCORING_CONTRACT_VERSION,
    scenario_seed: candidate.seed,
    ordinal: candidate.targetOrdinal,
    synthetic_target_heading_centidegrees: target.headingCentidegrees,
    propulsion_context: 'sailing_capable',
    sail_targets: Object.freeze({
      main_deployed: true,
      jib_deployed: true,
      main_trim: target.mainTrim,
      jib_trim: target.jibTrim,
      main_reef_level: target.mainReefLevel,
      jib_reef_level: target.jibReefLevel,
    }),
  });
}

/** The strictly defined six-field P4 contributor; no wind or physical inference is made. */
export function sailWindFitQuality(controls: P2Controls, binding: P4BindingProfile): number {
  const actual = exactObject(controls, ['headingCentidegrees', 'engineOutput', 'mainDeployed', 'jibDeployed', 'mainTrim', 'jibTrim', 'mainReefLevel', 'jibReefLevel', 'autopilotEnabled']);
  if (!actual || typeof actual.mainDeployed !== 'boolean' || typeof actual.jibDeployed !== 'boolean' ||
    !Number.isSafeInteger(actual.mainTrim) || !Number.isSafeInteger(actual.jibTrim) || !Number.isSafeInteger(actual.mainReefLevel) || !Number.isSafeInteger(actual.jibReefLevel)) {
    throw new RangeError('P4_BINDING_INVALID_CONTROLS');
  }
  const mainTrim = actual.mainTrim as number;
  const jibTrim = actual.jibTrim as number;
  const mainReefLevel = actual.mainReefLevel as number;
  const jibReefLevel = actual.jibReefLevel as number;
  const target = binding.sail_targets;
  const qualities = [
    actual.mainDeployed === target.main_deployed ? 10000 : 0,
    actual.jibDeployed === target.jib_deployed ? 10000 : 0,
    10000 - Math.abs(mainTrim - target.main_trim),
    10000 - Math.abs(jibTrim - target.jib_trim),
    10000 - 5000 * Math.abs(mainReefLevel - target.main_reef_level),
    10000 - 5000 * Math.abs(jibReefLevel - target.jib_reef_level),
  ].map((quality) => Math.max(0, Math.min(10000, quality)));
  return Math.floor(qualities.reduce((sum, quality) => sum + quality, 0) / 6);
}

export function p3ProfileFromBinding(binding: P4BindingProfile): P3TargetProfile {
  return Object.freeze({
    profile_id: binding.profile_id,
    profile_version: binding.profile_version,
    scoring_contract_version: binding.scoring_contract_version,
    synthetic_target_heading_centidegrees: binding.synthetic_target_heading_centidegrees,
    propulsion_context: binding.propulsion_context,
  });
}
