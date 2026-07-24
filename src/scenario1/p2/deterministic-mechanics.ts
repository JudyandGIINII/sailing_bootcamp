export const SYNTHETIC_TICKS_PER_LOGICAL_SECOND = 10 as const;
export const SYNTHETIC_STABILITY_TICKS = 100 as const;
export const SYNTHETIC_TARGET_PROFILE_VERSION = 1 as const;

export const TICKS_PER_SECOND = SYNTHETIC_TICKS_PER_LOGICAL_SECOND;
export const STABILITY_TICKS = SYNTHETIC_STABILITY_TICKS;
export const PROFILE_VERSION = SYNTHETIC_TARGET_PROFILE_VERSION;

export const P2_TICKS_PER_SECOND = TICKS_PER_SECOND;
export const P2_STABILITY_TICKS = STABILITY_TICKS;
export const P2_PROFILE_VERSION = PROFILE_VERSION;

export interface P2TargetProfile {
  readonly profileVersion: typeof SYNTHETIC_TARGET_PROFILE_VERSION;
  readonly scenarioSeed: number;
  readonly ordinal: number;
  readonly headingCentidegrees: number;
  readonly mainTrim: number;
  readonly jibTrim: number;
  readonly mainReefLevel: number;
  readonly jibReefLevel: number;
}

export interface P2Controls {
  readonly headingCentidegrees: number;
  readonly engineOutput: number;
  readonly mainDeployed: boolean;
  readonly jibDeployed: boolean;
  readonly mainTrim: number;
  readonly jibTrim: number;
  readonly mainReefLevel: number;
  readonly jibReefLevel: number;
  readonly autopilotEnabled: boolean;
}

export interface P2State {
  readonly status: 'running' | 'paused';
  readonly logicalTick: number;
  readonly seed: number;
  readonly targetOrdinal: number;
  readonly target: P2TargetProfile;
  readonly controls: P2Controls;
  readonly consecutiveMatchingTicks: number;
}

export type P2Action =
  | { readonly type: 'reset' }
  | { readonly type: 'pause' }
  | { readonly type: 'resume' }
  | { readonly type: 'advance' }
  | { readonly type: 'set_heading_centidegrees'; readonly heading_centidegrees: number }
  | { readonly type: 'set_engine_output'; readonly engine_output: number }
  | { readonly type: 'set_main_deployed'; readonly main_deployed: boolean }
  | { readonly type: 'set_jib_deployed'; readonly jib_deployed: boolean }
  | { readonly type: 'set_main_trim'; readonly main_trim: number }
  | { readonly type: 'set_jib_trim'; readonly jib_trim: number }
  | { readonly type: 'set_main_reef_level'; readonly main_reef_level: number }
  | { readonly type: 'set_jib_reef_level'; readonly jib_reef_level: number }
  | { readonly type: 'set_autopilot_enabled'; readonly autopilot_enabled: boolean };

type ParsedAction = P2Action;

function mix32(input: number): number {
  let x = input >>> 0;
  x = (x ^ (x >>> 16)) >>> 0;
  x = Math.imul(x, 0x7feb352d) >>> 0;
  x = (x ^ (x >>> 15)) >>> 0;
  x = Math.imul(x, 0x846ca68b) >>> 0;
  return (x ^ (x >>> 16)) >>> 0;
}

function assertUInt32(value: number, name: string): void {
  if (!Number.isSafeInteger(value) || Object.is(value, -0) || value < 0 || value > 0xffffffff) {
    throw new RangeError(`P2_INVALID_UINT32_${name}`);
  }
}

/** Version-1 local target schedule. It consumes no mutable RNG state. */
export function profileFor(seed: number, ordinal: number): P2TargetProfile {
  assertUInt32(seed, 'SEED');
  assertUInt32(ordinal, 'ORDINAL');
  const base = mix32((seed + Math.imul(ordinal, 0x9e3779b9)) >>> 0);
  return Object.freeze({
    profileVersion: SYNTHETIC_TARGET_PROFILE_VERSION,
    scenarioSeed: seed,
    ordinal,
    headingCentidegrees: mix32(base ^ 0xa341316c) % 36000,
    mainTrim: mix32(base ^ 0xc8013ea4) % 10001,
    jibTrim: mix32(base ^ 0xad90777d) % 10001,
    mainReefLevel: mix32(base ^ 0x7e95761e) % 3,
    jibReefLevel: mix32(base ^ 0x4cf5ad43) % 3,
  });
}

function initialControls(): P2Controls {
  return Object.freeze({
    headingCentidegrees: 0,
    engineOutput: 0,
    mainDeployed: true,
    jibDeployed: true,
    mainTrim: 0,
    jibTrim: 0,
    mainReefLevel: 0,
    jibReefLevel: 0,
    autopilotEnabled: false,
  });
}

/** Creates the canonical, history-free attempt state for a UInt32 seed. */
export function createP2State(seed: number): P2State {
  assertUInt32(seed, 'SEED');
  return Object.freeze({
    status: 'running',
    logicalTick: 0,
    seed,
    targetOrdinal: 0,
    target: profileFor(seed, 0),
    controls: initialControls(),
    consecutiveMatchingTicks: 0,
  });
}

function matches(controls: P2Controls, target: P2TargetProfile): boolean {
  return controls.headingCentidegrees === target.headingCentidegrees &&
    controls.engineOutput === 0 &&
    controls.mainDeployed &&
    controls.jibDeployed &&
    controls.mainTrim === target.mainTrim &&
    controls.jibTrim === target.jibTrim &&
    controls.mainReefLevel === target.mainReefLevel &&
    controls.jibReefLevel === target.jibReefLevel;
}

/** Autopilot is stored for later wiring but deliberately has no P2 effect. */
export function matchesActiveTarget(state: P2State): boolean {
  return matches(state.controls, state.target);
}

function isIntegerInRange(value: unknown, minimum: number, maximum: number): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= minimum && value <= maximum;
}

function exactAction(value: unknown, expectedKeys: readonly string[]): Record<string, unknown> | undefined {
  try {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) return undefined;
    const object = value as object;
    const ownKeys = Reflect.ownKeys(object);
    if (ownKeys.length !== expectedKeys.length || ownKeys.some((key) => typeof key !== 'string' || !expectedKeys.includes(key))) return undefined;
    const copied: Record<string, unknown> = {};
    for (const key of expectedKeys) {
      const descriptor = Object.getOwnPropertyDescriptor(object, key);
      if (!descriptor || !Object.hasOwn(descriptor, 'value')) return undefined;
      copied[key] = descriptor.value;
    }
    return copied;
  } catch {
    return undefined;
  }
}

function parseAction(action: unknown): ParsedAction | undefined {
  const base = exactAction(action, ['type']);
  if (base && (base.type === 'reset' || base.type === 'pause' || base.type === 'resume' || base.type === 'advance')) return base as ParsedAction;

  const candidates: readonly [P2Action['type'], string, (value: unknown) => boolean][] = [
    ['set_heading_centidegrees', 'heading_centidegrees', (value) => isIntegerInRange(value, 0, 35999)],
    ['set_engine_output', 'engine_output', (value) => isIntegerInRange(value, -10000, 10000)],
    ['set_main_deployed', 'main_deployed', (value) => typeof value === 'boolean'],
    ['set_jib_deployed', 'jib_deployed', (value) => typeof value === 'boolean'],
    ['set_main_trim', 'main_trim', (value) => isIntegerInRange(value, 0, 10000)],
    ['set_jib_trim', 'jib_trim', (value) => isIntegerInRange(value, 0, 10000)],
    ['set_main_reef_level', 'main_reef_level', (value) => isIntegerInRange(value, 0, 2)],
    ['set_jib_reef_level', 'jib_reef_level', (value) => isIntegerInRange(value, 0, 2)],
    ['set_autopilot_enabled', 'autopilot_enabled', (value) => typeof value === 'boolean'],
  ];
  for (const [type, key, valid] of candidates) {
    const candidate = exactAction(action, ['type', key]);
    if (candidate?.type === type && valid(candidate[key])) return candidate as ParsedAction;
  }
  return undefined;
}

function withControls(state: P2State, controls: P2Controls): P2State {
  const nextCount = matches(controls, state.target) ? state.consecutiveMatchingTicks : 0;
  return Object.freeze({ ...state, controls: Object.freeze(controls), consecutiveMatchingTicks: nextCount });
}

function setControl<K extends keyof P2Controls>(state: P2State, key: K, value: P2Controls[K]): P2State {
  if (state.controls[key] === value) return state;
  return withControls(state, { ...state.controls, [key]: value });
}

/** Reduces one strictly validated action without browser, timer, or random input. */
export function reduceP2State(state: P2State, action: unknown): P2State {
  const parsed = parseAction(action);
  if (!parsed) return state;
  switch (parsed.type) {
    case 'reset':
      return createP2State(state.seed);
    case 'pause':
      return state.status === 'paused' ? state : Object.freeze({ ...state, status: 'paused' as const });
    case 'resume':
      return state.status === 'running' ? state : Object.freeze({ ...state, status: 'running' as const });
    case 'advance': {
      if (state.status === 'paused') return state;
      const logicalTick = (state.logicalTick + 1) >>> 0;
      if (!matchesActiveTarget(state)) return Object.freeze({ ...state, logicalTick, consecutiveMatchingTicks: 0 });
      const consecutiveMatchingTicks = state.consecutiveMatchingTicks + 1;
      if (consecutiveMatchingTicks < STABILITY_TICKS) return Object.freeze({ ...state, logicalTick, consecutiveMatchingTicks });
      const targetOrdinal = (state.targetOrdinal + 1) >>> 0;
      return Object.freeze({ ...state, logicalTick, targetOrdinal, target: profileFor(state.seed, targetOrdinal), consecutiveMatchingTicks: 0 });
    }
    case 'set_heading_centidegrees':
      return setControl(state, 'headingCentidegrees', parsed.heading_centidegrees);
    case 'set_engine_output':
      return setControl(state, 'engineOutput', parsed.engine_output);
    case 'set_main_deployed':
      return setControl(state, 'mainDeployed', parsed.main_deployed);
    case 'set_jib_deployed':
      return setControl(state, 'jibDeployed', parsed.jib_deployed);
    case 'set_main_trim':
      return setControl(state, 'mainTrim', parsed.main_trim);
    case 'set_jib_trim':
      return setControl(state, 'jibTrim', parsed.jib_trim);
    case 'set_main_reef_level':
      return setControl(state, 'mainReefLevel', parsed.main_reef_level);
    case 'set_jib_reef_level':
      return setControl(state, 'jibReefLevel', parsed.jib_reef_level);
    case 'set_autopilot_enabled':
      return setControl(state, 'autopilotEnabled', parsed.autopilot_enabled);
  }
}
