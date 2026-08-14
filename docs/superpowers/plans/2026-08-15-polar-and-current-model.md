# 폴라 기반 보트 모델과 조류 벡터 합성 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** L01의 고정 선속(2 m/s)을 `(상대풍각, 풍속) → 목표 선속` 폴라 조회로 대체하고, 조류 벡터를 합성해 STW/SOG/COG/drift를 분리한다.

**Architecture:** 기존 `l01-synthetic-model.ts`를 건드리지 않고 새 model_version(`polar-kinematics-v1`)을 병행 추가한다. 폴라는 8×6 격자 테이블 + 이중선형 보간이며, 폴라 입력의 순환 의존은 **직전 tick의 상대풍 벡터**를 사용해 끊는다. 조류는 이미 존재하지만 배선되지 않은 `composeGroundRelativeVelocity`를 연결해 합성한다.

**Tech Stack:** TypeScript 5.9 (strict), Vitest 4.1, Vite 8.1. 런타임 의존성 추가 없음.

## Global Constraints

- **결정론:** `src/sim` 아래 모든 코드는 순수해야 한다. `Date.now`, `performance.now`, `Math.random`, `window`, `document`, `localStorage`, `sessionStorage`, `fetch`, `XMLHttpRequest`, `WebSocket`, `EventSource` 사용 금지. `tests/contracts/sim-boundary.test.ts`가 자동 검사한다.
- **수치 정규화:** 모든 부동소수 결과는 `canonicalizeL01Number`(6자리)로 정규화한다.
- **불변성:** 모든 반환 객체는 `Object.freeze`한다. 입력을 변형하지 않는다.
- **에러 관례:** 비유한 입력은 `TypeError`를 던진다. 가드는 `assertXxx(value): asserts value is Xxx` 형태.
- **도메인 경계:** 모든 신규 파일 상단에 합성·미검증 주석을 단다. 실제 항해·안전·항법 값을 주장하지 않는다. `validation_disposition`은 `assumption`을 유지한다.
- **import 확장자:** 상대 import는 반드시 `.js` 확장자를 쓴다(예: `'../contracts/polar-profile.js'`).
- **커밋 정책:** 이 저장소는 Mode A다. 각 Task의 커밋 단계는 **사용자가 명시로 커밋을 승인한 경우에만** 실행한다. 승인이 없으면 커밋 단계를 건너뛰고 다음 Task로 진행한다.
- **검증 기준선:** 작업 시작 시점 `main`은 `npm run typecheck` PASS, `npm test` 22 files / 232 tests PASS다.

---

### Task 1: 폴라 프로필 계약과 조회 함수

**Files:**
- Create: `src/contracts/polar-profile.ts`
- Create: `src/sim/polar.ts`
- Test: `tests/unit/polar.test.ts`

**Interfaces:**
- Consumes: `canonicalizeL01Number` from `src/contracts/l01-synthetic-environment.js`
- Produces:
  - `PolarProfileV1` — `{ polar_id, polar_version, validation_record_id, validation_disposition, awa_axis_rad, tws_axis_mps, target_stw_mps }`
  - `trainingSloopPolarV1: Readonly<PolarProfileV1>`
  - `isPolarProfileV1(value: unknown): value is PolarProfileV1`
  - `assertPolarProfileV1(value: unknown): asserts value is PolarProfileV1`
  - `lookupTargetSpeedMps(profile: PolarProfileV1, awaRad: number, twsMps: number): number`

- [ ] **Step 1: 폴라 계약과 데이터 작성**

Create `src/contracts/polar-profile.ts`:

```ts
/**
 * Synthetic polar table for the training sloop. Every number is an explicit
 * educational assumption for browser-local training, not a vessel, weather,
 * route, or safety value. No real hull performance is asserted.
 */
export interface PolarProfileV1 {
  readonly polar_id: 'training-sloop-synthetic-polar';
  readonly polar_version: 1;
  readonly validation_record_id: 'VR-POLAR-v0';
  readonly validation_disposition: 'assumption';
  /** Apparent wind angle grid, folded to [0, PI], strictly ascending. */
  readonly awa_axis_rad: readonly number[];
  /** True wind speed grid in m/s, strictly ascending, starting at 0. */
  readonly tws_axis_mps: readonly number[];
  /** target_stw_mps[awaIndex][twsIndex] in m/s. */
  readonly target_stw_mps: readonly (readonly number[])[];
}

const DEG = Math.PI / 180;

export const trainingSloopPolarV1: Readonly<PolarProfileV1> = Object.freeze({
  polar_id: 'training-sloop-synthetic-polar',
  polar_version: 1,
  validation_record_id: 'VR-POLAR-v0',
  validation_disposition: 'assumption',
  awa_axis_rad: Object.freeze([0, 30 * DEG, 45 * DEG, 60 * DEG, 90 * DEG, 120 * DEG, 150 * DEG, 180 * DEG]),
  tws_axis_mps: Object.freeze([0, 2, 4, 6, 8, 10]),
  target_stw_mps: Object.freeze([
    Object.freeze([0, 0.0, 0.0, 0.0, 0.0, 0.0]),
    Object.freeze([0, 0.6, 1.3, 1.9, 2.3, 2.5]),
    Object.freeze([0, 0.9, 1.9, 2.7, 3.2, 3.5]),
    Object.freeze([0, 1.1, 2.3, 3.2, 3.8, 4.1]),
    Object.freeze([0, 1.2, 2.5, 3.5, 4.2, 4.6]),
    Object.freeze([0, 1.1, 2.4, 3.3, 4.0, 4.4]),
    Object.freeze([0, 0.9, 1.9, 2.7, 3.3, 3.6]),
    Object.freeze([0, 0.7, 1.5, 2.2, 2.7, 3.0]),
  ]),
});

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isAscending(axis: readonly unknown[]): boolean {
  return axis.every((value, index) => isFiniteNumber(value) && (index === 0 || value > (axis[index - 1] as number)));
}

/** Strict, dependency-free guard for persisted polar profile data. */
export function isPolarProfileV1(value: unknown): value is PolarProfileV1 {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const candidate = value as Record<string, unknown>;
  const keys = ['polar_id', 'polar_version', 'validation_record_id', 'validation_disposition', 'awa_axis_rad', 'tws_axis_mps', 'target_stw_mps'];
  if (Object.keys(candidate).length !== keys.length || !keys.every((key) => Object.hasOwn(candidate, key))) return false;
  const awa = candidate.awa_axis_rad;
  const tws = candidate.tws_axis_mps;
  const table = candidate.target_stw_mps;
  if (!Array.isArray(awa) || !Array.isArray(tws) || !Array.isArray(table)) return false;
  if (awa.length < 2 || tws.length < 2 || !isAscending(awa) || !isAscending(tws)) return false;
  if (awa[0] !== 0 || (awa.at(-1) as number) > Math.PI || tws[0] !== 0) return false;
  if (table.length !== awa.length) return false;
  return candidate.polar_id === 'training-sloop-synthetic-polar' &&
    candidate.polar_version === 1 &&
    candidate.validation_record_id === 'VR-POLAR-v0' &&
    candidate.validation_disposition === 'assumption' &&
    table.every((row) => Array.isArray(row) && row.length === tws.length && row.every((cell) => isFiniteNumber(cell) && cell >= 0));
}

export function assertPolarProfileV1(value: unknown): asserts value is PolarProfileV1 {
  if (!isPolarProfileV1(value)) throw new TypeError('Invalid synthetic polar profile.');
}
```

- [ ] **Step 2: 실패하는 테스트 작성**

Create `tests/unit/polar.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { assertPolarProfileV1, trainingSloopPolarV1 } from '../../src/contracts/polar-profile.js';
import { lookupTargetSpeedMps } from '../../src/sim/polar.js';

const DEG = Math.PI / 180;

describe('synthetic polar lookup', () => {
  it('returns declared grid values exactly at grid intersections', () => {
    expect(lookupTargetSpeedMps(trainingSloopPolarV1, 90 * DEG, 10)).toBe(4.6);
    expect(lookupTargetSpeedMps(trainingSloopPolarV1, 45 * DEG, 4)).toBe(1.9);
    expect(lookupTargetSpeedMps(trainingSloopPolarV1, 180 * DEG, 6)).toBe(2.2);
  });

  it('returns zero at head-to-wind and at zero wind speed', () => {
    expect(lookupTargetSpeedMps(trainingSloopPolarV1, 0, 10)).toBe(0);
    expect(lookupTargetSpeedMps(trainingSloopPolarV1, 90 * DEG, 0)).toBe(0);
  });

  it('interpolates bilinearly between grid points', () => {
    // AWA 75deg is midway between 60deg (3.2) and 90deg (3.5) at TWS 6.
    expect(lookupTargetSpeedMps(trainingSloopPolarV1, 75 * DEG, 6)).toBeCloseTo(3.35, 6);
    // TWS 5 is midway between 4 (2.5) and 6 (3.5) at AWA 90deg.
    expect(lookupTargetSpeedMps(trainingSloopPolarV1, 90 * DEG, 5)).toBeCloseTo(3.0, 6);
  });

  it('folds negative and reflex apparent wind angles symmetrically', () => {
    expect(lookupTargetSpeedMps(trainingSloopPolarV1, -90 * DEG, 6)).toBe(lookupTargetSpeedMps(trainingSloopPolarV1, 90 * DEG, 6));
    expect(lookupTargetSpeedMps(trainingSloopPolarV1, 270 * DEG, 6)).toBe(lookupTargetSpeedMps(trainingSloopPolarV1, 90 * DEG, 6));
  });

  it('clamps wind speed outside the declared grid', () => {
    expect(lookupTargetSpeedMps(trainingSloopPolarV1, 90 * DEG, 99)).toBe(4.6);
  });

  it('never decreases as wind speed increases at a fixed angle', () => {
    for (const awaDeg of [30, 45, 60, 90, 120, 150, 180]) {
      let previous = -1;
      for (const tws of [0, 2, 4, 6, 8, 10]) {
        const speed = lookupTargetSpeedMps(trainingSloopPolarV1, awaDeg * DEG, tws);
        expect(speed).toBeGreaterThanOrEqual(previous);
        previous = speed;
      }
    }
  });

  it('rejects non-finite inputs and invalid profiles', () => {
    expect(() => lookupTargetSpeedMps(trainingSloopPolarV1, Number.NaN, 6)).toThrow(TypeError);
    expect(() => lookupTargetSpeedMps(trainingSloopPolarV1, 0, Number.POSITIVE_INFINITY)).toThrow(TypeError);
    expect(() => assertPolarProfileV1({ polar_id: 'training-sloop-synthetic-polar' })).toThrow(TypeError);
  });
});
```

- [ ] **Step 3: 테스트 실패 확인**

Run: `npx vitest run tests/unit/polar.test.ts`
Expected: FAIL — `Failed to resolve import "../../src/sim/polar.js"`

- [ ] **Step 4: 조회 함수 구현**

Create `src/sim/polar.ts`:

```ts
import { canonicalizeL01Number } from '../contracts/l01-synthetic-environment.js';
import { assertPolarProfileV1, type PolarProfileV1 } from '../contracts/polar-profile.js';

const TAU = Math.PI * 2;

/** Folds any angle to the [0, PI] magnitude used by the symmetric polar grid. */
function foldApparentWindAngle(awaRad: number): number {
  const normalized = ((awaRad % TAU) + TAU) % TAU;
  return normalized > Math.PI ? TAU - normalized : normalized;
}

/** Returns the lower grid index and the [0,1] fraction toward the next index. */
function bracket(axis: readonly number[], value: number): { index: number; fraction: number } {
  const last = axis.length - 1;
  if (value <= (axis[0] as number)) return { index: 0, fraction: 0 };
  if (value >= (axis[last] as number)) return { index: last - 1, fraction: 1 };
  let index = 0;
  while (index < last - 1 && value >= (axis[index + 1] as number)) index += 1;
  const lower = axis[index] as number;
  const upper = axis[index + 1] as number;
  return { index, fraction: (value - lower) / (upper - lower) };
}

/**
 * Bilinear lookup of the declared synthetic target speed through water.
 * This asserts no real sailing performance; values are unvalidated assumptions.
 */
export function lookupTargetSpeedMps(profile: PolarProfileV1, awaRad: number, twsMps: number): number {
  assertPolarProfileV1(profile);
  if (!Number.isFinite(awaRad) || !Number.isFinite(twsMps)) {
    throw new TypeError('Polar lookup inputs must be finite.');
  }
  const awa = bracket(profile.awa_axis_rad, foldApparentWindAngle(awaRad));
  const tws = bracket(profile.tws_axis_mps, Math.max(0, twsMps));
  const rowLow = profile.target_stw_mps[awa.index] as readonly number[];
  const rowHigh = profile.target_stw_mps[awa.index + 1] as readonly number[];
  const lowLow = rowLow[tws.index] as number;
  const lowHigh = rowLow[tws.index + 1] as number;
  const highLow = rowHigh[tws.index] as number;
  const highHigh = rowHigh[tws.index + 1] as number;
  const low = lowLow + (lowHigh - lowLow) * tws.fraction;
  const high = highLow + (highHigh - highLow) * tws.fraction;
  return canonicalizeL01Number(low + (high - low) * awa.fraction);
}
```

- [ ] **Step 5: 테스트 통과 확인**

Run: `npx vitest run tests/unit/polar.test.ts`
Expected: PASS — 7 tests

- [ ] **Step 6: 커밋** *(Mode A — 사용자 승인 시에만)*

```bash
git add src/contracts/polar-profile.ts src/sim/polar.ts tests/unit/polar.test.ts
git commit -m "feat(sim): add synthetic polar profile and bilinear lookup"
```

---

### Task 2: helm control 검증 로직 공유 모듈로 추출

기존 `l01-synthetic-model.ts`의 private `validatedControls`를 새 모델에서도 써야 한다. 복제 대신 추출한다. 동작은 바뀌지 않으므로 기존 테스트가 회귀를 보장한다.

**Files:**
- Create: `src/sim/helm-controls.ts`
- Modify: `src/sim/l01-synthetic-model.ts` (private `validatedControls` 제거, 새 모듈 import)
- Test: 기존 `tests/unit/l01-synthetic-model.test.ts` (변경 없음)

**Interfaces:**
- Consumes: 없음 (의존성 없는 신규 모듈)
- Produces: `HelmCommand`, `HelmControl` types, and `validateHelmControls(priorLogicalTick: number, controls: readonly HelmControl[]): readonly HelmControl[]`

`HelmControl`은 기존 `L01HelmControl`과 구조가 동일하므로 TypeScript 구조적 타이핑에 의해
서로 호환된다. `l01-synthetic-model.ts`의 `L01HelmControl`·`L01HelmCommand` 선언은
그대로 두고 제거하지 않는다 — 외부에서 import하고 있을 수 있다.

**참고:** 이 Task는 스펙 §3의 파일 목록에 없다. 구현 계획 수립 중 Task 4가 동일한 control
검증 로직을 필요로 한다는 점이 드러나 복제를 피하기 위해 추가했다.

- [ ] **Step 1: 공유 모듈 작성**

Create `src/sim/helm-controls.ts`:

```ts
/** Shared, renderer-independent helm control ordering rules. No sailing behaviour is implied. */
export type HelmCommand = 'neutral' | 'port' | 'starboard';

export interface HelmControl {
  readonly logical_tick: number;
  readonly sequence: number;
  readonly helm_command: HelmCommand;
}

/**
 * Sorts by (logical_tick, sequence) and rejects controls that do not belong to
 * the prior tick or that collide on an identical ordering key.
 */
export function validateHelmControls(
  priorLogicalTick: number,
  controls: readonly HelmControl[],
): readonly HelmControl[] {
  const ordered = [...controls].sort((left, right) => left.logical_tick - right.logical_tick || left.sequence - right.sequence);
  for (let index = 0; index < ordered.length; index += 1) {
    const control = ordered[index];
    const previous = ordered[index - 1];
    if (!control || control.logical_tick !== priorLogicalTick || !Number.isSafeInteger(control.sequence) || control.sequence < 0 ||
      !['neutral', 'port', 'starboard'].includes(control.helm_command) ||
      (previous !== undefined && previous.logical_tick === control.logical_tick && previous.sequence === control.sequence)) {
      throw new TypeError('Helm controls must have unique ordered logical tick and sequence values.');
    }
  }
  return Object.freeze(ordered.map((control) => Object.freeze({ ...control })));
}
```

- [ ] **Step 2: 기존 모델을 공유 모듈로 전환**

In `src/sim/l01-synthetic-model.ts`:

1. Add to the imports at the top:

```ts
import { validateHelmControls } from './helm-controls.js';
```

2. Delete the entire private `function validatedControls(...)` block (the function beginning `function validatedControls(prior: L01SyntheticState, controls: readonly L01HelmControl[]): readonly L01HelmControl[] {`).

3. In `transitionL01SyntheticState`, replace:

```ts
  const controls = validatedControls(priorState, orderedControls);
```

with:

```ts
  const controls = validateHelmControls(priorState.logical_tick, orderedControls);
```

- [ ] **Step 3: 기존 테스트로 무변경 확인**

Run: `npx vitest run tests/unit/l01-synthetic-model.test.ts tests/unit/sim-session.test.ts`
Expected: PASS — 기존 테스트가 모두 통과해야 한다. 하나라도 실패하면 추출이 동작을 바꾼 것이므로 되돌린다.

- [ ] **Step 4: 전체 테스트로 회귀 확인**

Run: `npm test`
Expected: PASS — 23 files / 239 tests (기존 22/232 + Task 1의 1 file/7 tests)

- [ ] **Step 5: 커밋** *(Mode A — 사용자 승인 시에만)*

```bash
git add src/sim/helm-controls.ts src/sim/l01-synthetic-model.ts
git commit -m "refactor(sim): extract shared helm control validation"
```

---

### Task 3: 폴라 운동학 환경 계약

**Files:**
- Create: `src/contracts/polar-kinematics-environment.ts`
- Test: `tests/unit/polar-kinematics-environment.test.ts`

**Interfaces:**
- Consumes: `isPolarProfileV1` from `src/contracts/polar-profile.js`
- Produces:
  - `PolarKinematicsEnvironmentV1` — `{ environment_id, environment_version, model_id, model_version, logical_step_seconds, initial_position_m, initial_heading_rad, polar_profile_id, true_wind_from_rad, true_wind_speed_mps, current_to_rad, current_speed_mps, full_helm_turn_rad_per_step, canonical_precision_version }`
  - `polarKinematicsEnvironmentV1: Readonly<PolarKinematicsEnvironmentV1>`
  - `POLAR_KINEMATICS_MODEL_VERSION = 'polar-kinematics-v1'`
  - `assertPolarKinematicsEnvironmentV1(value: unknown): asserts value is PolarKinematicsEnvironmentV1`

- [ ] **Step 1: 실패하는 테스트 작성**

Create `tests/unit/polar-kinematics-environment.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  assertPolarKinematicsEnvironmentV1,
  polarKinematicsEnvironmentV1,
  POLAR_KINEMATICS_MODEL_VERSION,
} from '../../src/contracts/polar-kinematics-environment.js';

describe('polar kinematics environment contract', () => {
  it('declares a distinct model version from the retained L01 kinematics model', () => {
    expect(POLAR_KINEMATICS_MODEL_VERSION).toBe('polar-kinematics-v1');
    expect(polarKinematicsEnvironmentV1.model_id).toBe('polar-kinematics');
    expect(polarKinematicsEnvironmentV1.polar_profile_id).toBe('training-sloop-synthetic-polar');
  });

  it('declares a current vector and no fixed forward speed', () => {
    expect(polarKinematicsEnvironmentV1.current_speed_mps).toBeGreaterThanOrEqual(0);
    expect(Object.hasOwn(polarKinematicsEnvironmentV1, 'forward_speed_mps')).toBe(false);
  });

  it('accepts the declared profile and rejects malformed profiles', () => {
    expect(() => assertPolarKinematicsEnvironmentV1(polarKinematicsEnvironmentV1)).not.toThrow();
    expect(() => assertPolarKinematicsEnvironmentV1({ ...polarKinematicsEnvironmentV1, current_speed_mps: -1 })).toThrow(TypeError);
    expect(() => assertPolarKinematicsEnvironmentV1({ ...polarKinematicsEnvironmentV1, model_id: 'other' })).toThrow(TypeError);
    expect(() => assertPolarKinematicsEnvironmentV1(null)).toThrow(TypeError);
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run tests/unit/polar-kinematics-environment.test.ts`
Expected: FAIL — `Failed to resolve import ".../polar-kinematics-environment.js"`

- [ ] **Step 3: 계약 구현**

Create `src/contracts/polar-kinematics-environment.ts`:

```ts
import { trainingSloopPolarV1 } from './polar-profile.js';

/**
 * Synthetic environment fixture for the polar kinematics model. Every number is
 * an explicit educational assumption, not a vessel, weather, route, or safety
 * value. The current vector is declared synthetic and non-navigational.
 */
export const POLAR_KINEMATICS_MODEL_VERSION = 'polar-kinematics-v1' as const;

export interface PolarKinematicsEnvironmentV1 {
  readonly environment_id: 'polar-kinematics-training-ground';
  readonly environment_version: 1;
  readonly model_id: 'polar-kinematics';
  readonly model_version: typeof POLAR_KINEMATICS_MODEL_VERSION;
  readonly logical_step_seconds: number;
  readonly initial_position_m: Readonly<{ x: number; y: number }>;
  readonly initial_heading_rad: number;
  readonly polar_profile_id: typeof trainingSloopPolarV1.polar_id;
  readonly true_wind_from_rad: number;
  readonly true_wind_speed_mps: number;
  /** Declared synthetic current, stored as a `to` direction per the coordinate contract. */
  readonly current_to_rad: number;
  readonly current_speed_mps: number;
  readonly full_helm_turn_rad_per_step: number;
  readonly canonical_precision_version: 'l01-precision-v1';
}

export const polarKinematicsEnvironmentV1: Readonly<PolarKinematicsEnvironmentV1> = Object.freeze({
  environment_id: 'polar-kinematics-training-ground',
  environment_version: 1,
  model_id: 'polar-kinematics',
  model_version: POLAR_KINEMATICS_MODEL_VERSION,
  logical_step_seconds: 1,
  initial_position_m: Object.freeze({ x: 12, y: -8 }),
  initial_heading_rad: 0,
  polar_profile_id: trainingSloopPolarV1.polar_id,
  true_wind_from_rad: Math.PI / 2,
  true_wind_speed_mps: 6,
  current_to_rad: 0,
  current_speed_mps: 0,
  full_helm_turn_rad_per_step: Math.PI / 8,
  canonical_precision_version: 'l01-precision-v1',
});

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

export function isPolarKinematicsEnvironmentV1(value: unknown): value is PolarKinematicsEnvironmentV1 {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const candidate = value as Record<string, unknown>;
  const keys = [
    'environment_id', 'environment_version', 'model_id', 'model_version',
    'logical_step_seconds', 'initial_position_m', 'initial_heading_rad',
    'polar_profile_id', 'true_wind_from_rad', 'true_wind_speed_mps',
    'current_to_rad', 'current_speed_mps', 'full_helm_turn_rad_per_step',
    'canonical_precision_version',
  ];
  if (Object.keys(candidate).length !== keys.length || !keys.every((key) => Object.hasOwn(candidate, key))) return false;
  const position = candidate.initial_position_m;
  return candidate.environment_id === 'polar-kinematics-training-ground' &&
    candidate.environment_version === 1 &&
    candidate.model_id === 'polar-kinematics' &&
    candidate.model_version === POLAR_KINEMATICS_MODEL_VERSION &&
    candidate.polar_profile_id === trainingSloopPolarV1.polar_id &&
    candidate.canonical_precision_version === 'l01-precision-v1' &&
    isFiniteNumber(candidate.logical_step_seconds) && candidate.logical_step_seconds > 0 &&
    typeof position === 'object' && position !== null && !Array.isArray(position) &&
    Object.keys(position).length === 2 && Object.hasOwn(position, 'x') && Object.hasOwn(position, 'y') &&
    isFiniteNumber((position as Record<string, unknown>).x) && isFiniteNumber((position as Record<string, unknown>).y) &&
    isFiniteNumber(candidate.initial_heading_rad) &&
    isFiniteNumber(candidate.true_wind_from_rad) &&
    isFiniteNumber(candidate.true_wind_speed_mps) && candidate.true_wind_speed_mps >= 0 &&
    isFiniteNumber(candidate.current_to_rad) &&
    isFiniteNumber(candidate.current_speed_mps) && candidate.current_speed_mps >= 0 &&
    isFiniteNumber(candidate.full_helm_turn_rad_per_step) && candidate.full_helm_turn_rad_per_step > 0;
}

export function assertPolarKinematicsEnvironmentV1(value: unknown): asserts value is PolarKinematicsEnvironmentV1 {
  if (!isPolarKinematicsEnvironmentV1(value)) throw new TypeError('Invalid polar kinematics environment profile.');
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run tests/unit/polar-kinematics-environment.test.ts`
Expected: PASS — 3 tests

- [ ] **Step 5: 커밋** *(Mode A — 사용자 승인 시에만)*

```bash
git add src/contracts/polar-kinematics-environment.ts tests/unit/polar-kinematics-environment.test.ts
git commit -m "feat(contracts): add polar kinematics environment contract"
```

---

### Task 4: 폴라 운동학 전이 모델 (핵심)

1-tick lag 상대풍으로 순환을 끊고, 조류를 합성한다.

**Files:**
- Create: `src/sim/polar-kinematics-model.ts`
- Test: `tests/unit/polar-kinematics-model.test.ts`

**Interfaces:**
- Consumes: `validateHelmControls`, `HelmCommand`, `HelmControl` (Task 2); `lookupTargetSpeedMps` (Task 1); `assertPolarKinematicsEnvironmentV1`, `PolarKinematicsEnvironmentV1` (Task 3); `composeGroundRelativeVelocity` from `src/sim/vector.js`; `l01DirectionVector`, `l01DirectionFromVector`, `normalizeL01Heading` from `src/sim/l01-synthetic-model.js`
- Produces:
  - `PolarKinematicState` — `{ logical_tick, position_m, heading_rad, helm_command, apparent_wind_from_rad, apparent_wind_speed_mps }`
  - `PolarKinematicTransition` — `{ prior_state, next_state, accepted_helm_command, controls, stw_mps, water_velocity_mps, current_velocity_mps, ground_velocity_mps, displacement_m }`
  - `createInitialPolarKinematicState(profile): PolarKinematicState`
  - `transitionPolarKinematicState(profile, priorState, orderedControls): PolarKinematicTransition`

- [ ] **Step 1: 실패하는 테스트 작성**

Create `tests/unit/polar-kinematics-model.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { polarKinematicsEnvironmentV1 } from '../../src/contracts/polar-kinematics-environment.js';
import { createInitialPolarKinematicState, transitionPolarKinematicState } from '../../src/sim/polar-kinematics-model.js';

const noCurrent = polarKinematicsEnvironmentV1;
const withCurrent = Object.freeze({ ...polarKinematicsEnvironmentV1, current_to_rad: Math.PI / 2, current_speed_mps: 1.5 });

describe('polar kinematics model', () => {
  it('seeds the initial apparent wind from true wind at zero boat speed', () => {
    const initial = createInitialPolarKinematicState(noCurrent);
    expect(initial.apparent_wind_from_rad).toBe(noCurrent.true_wind_from_rad);
    expect(initial.apparent_wind_speed_mps).toBe(noCurrent.true_wind_speed_mps);
    expect(initial.logical_tick).toBe(0);
  });

  it('derives speed through water from the polar instead of a fixed constant', () => {
    const initial = createInitialPolarKinematicState(noCurrent);
    const transition = transitionPolarKinematicState(noCurrent, initial, []);
    // Heading 0 (north) with wind from PI/2 (east) gives a 90deg apparent wind angle.
    expect(transition.stw_mps).toBeGreaterThan(0);
    expect(transition.stw_mps).not.toBe(2);
  });

  it('makes ground velocity equal water velocity when there is no current', () => {
    const initial = createInitialPolarKinematicState(noCurrent);
    const transition = transitionPolarKinematicState(noCurrent, initial, []);
    expect(transition.ground_velocity_mps).toEqual(transition.water_velocity_mps);
    expect(transition.current_velocity_mps).toEqual({ x: 0, y: 0 });
  });

  it('composes ground velocity as water velocity plus the current vector', () => {
    const initial = createInitialPolarKinematicState(withCurrent);
    const transition = transitionPolarKinematicState(withCurrent, initial, []);
    expect(transition.ground_velocity_mps.x).toBeCloseTo(transition.water_velocity_mps.x + transition.current_velocity_mps.x, 6);
    expect(transition.ground_velocity_mps.y).toBeCloseTo(transition.water_velocity_mps.y + transition.current_velocity_mps.y, 6);
    expect(transition.current_velocity_mps.x).toBeCloseTo(1.5, 6);
    expect(transition.current_velocity_mps.y).toBeCloseTo(0, 6);
  });

  it('stops without throwing when the boat points head to wind and there is no current', () => {
    const headToWind = Object.freeze({ ...noCurrent, true_wind_from_rad: 0 });
    const initial = createInitialPolarKinematicState(headToWind);
    const transition = transitionPolarKinematicState(headToWind, initial, []);
    expect(transition.stw_mps).toBe(0);
    expect(transition.displacement_m).toEqual({ x: 0, y: 0 });
    expect(transition.next_state.position_m).toEqual(initial.position_m);
  });

  it('applies helm within the same tick so steering changes speed immediately', () => {
    const initial = createInitialPolarKinematicState(noCurrent);
    const straight = transitionPolarKinematicState(noCurrent, initial, []);
    const turned = transitionPolarKinematicState(noCurrent, initial, [
      { logical_tick: 0, sequence: 0, helm_command: 'starboard' as const },
    ]);
    expect(turned.next_state.heading_rad).not.toBe(straight.next_state.heading_rad);
    expect(turned.stw_mps).not.toBe(straight.stw_mps);
  });

  it('is deterministic and does not mutate its inputs', () => {
    const initial = createInitialPolarKinematicState(withCurrent);
    const controls = [{ logical_tick: 0, sequence: 0, helm_command: 'port' as const }];
    const before = structuredClone(initial);
    const first = transitionPolarKinematicState(withCurrent, initial, controls);
    const second = transitionPolarKinematicState(withCurrent, initial, controls);
    expect(first).toEqual(second);
    expect(initial).toEqual(before);
  });

  it('rejects invalid states and controls', () => {
    const initial = createInitialPolarKinematicState(noCurrent);
    expect(() => transitionPolarKinematicState(noCurrent, { ...initial, heading_rad: Number.NaN }, [])).toThrow(TypeError);
    expect(() => transitionPolarKinematicState(noCurrent, initial, [
      { logical_tick: 5, sequence: 0, helm_command: 'port' as const },
    ])).toThrow(TypeError);
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run tests/unit/polar-kinematics-model.test.ts`
Expected: FAIL — `Failed to resolve import ".../polar-kinematics-model.js"`

- [ ] **Step 3: 전이 모델 구현**

Create `src/sim/polar-kinematics-model.ts`:

```ts
import { canonicalizeL01Number } from '../contracts/l01-synthetic-environment.js';
import {
  assertPolarKinematicsEnvironmentV1,
  type PolarKinematicsEnvironmentV1,
} from '../contracts/polar-kinematics-environment.js';
import { trainingSloopPolarV1 } from '../contracts/polar-profile.js';
import { validateHelmControls, type HelmCommand, type HelmControl } from './helm-controls.js';
import { l01DirectionFromVector, l01DirectionVector, normalizeL01Heading } from './l01-synthetic-model.js';
import { lookupTargetSpeedMps } from './polar.js';
import { composeGroundRelativeVelocity } from './vector.js';

export interface PolarKinematicState {
  readonly logical_tick: number;
  readonly position_m: Readonly<{ x: number; y: number }>;
  readonly heading_rad: number;
  readonly helm_command: HelmCommand;
  /** Carries the previous tick's apparent wind so the polar input stays acyclic. */
  readonly apparent_wind_from_rad: number;
  readonly apparent_wind_speed_mps: number;
}

export interface PolarKinematicTransition {
  readonly prior_state: PolarKinematicState;
  readonly next_state: PolarKinematicState;
  readonly accepted_helm_command: HelmCommand;
  readonly controls: readonly HelmControl[];
  readonly stw_mps: number;
  readonly water_velocity_mps: Readonly<{ x: number; y: number }>;
  readonly current_velocity_mps: Readonly<{ x: number; y: number }>;
  readonly ground_velocity_mps: Readonly<{ x: number; y: number }>;
  readonly displacement_m: Readonly<{ x: number; y: number }>;
}

function frozenPoint(x: number, y: number): Readonly<{ x: number; y: number }> {
  const snap = (value: number) => Math.abs(value) < 0.000001 ? 0 : value;
  return Object.freeze({ x: canonicalizeL01Number(snap(x)), y: canonicalizeL01Number(snap(y)) });
}

function assertFiniteState(state: PolarKinematicState): void {
  if (!Number.isSafeInteger(state.logical_tick) || state.logical_tick < 0 ||
    !Number.isFinite(state.position_m.x) || !Number.isFinite(state.position_m.y) ||
    !Number.isFinite(state.heading_rad) ||
    !Number.isFinite(state.apparent_wind_from_rad) ||
    !Number.isFinite(state.apparent_wind_speed_mps) ||
    !['neutral', 'port', 'starboard'].includes(state.helm_command)) {
    throw new TypeError('Polar kinematic state must contain finite canonical values.');
  }
}

/** Signed difference between a wind `from` direction and the boat heading, in [-PI, PI]. */
function apparentWindAngle(apparentFromRad: number, headingRad: number): number {
  const difference = normalizeL01Heading(apparentFromRad - headingRad);
  return difference > Math.PI ? difference - Math.PI * 2 : difference;
}

export function createInitialPolarKinematicState(profile: PolarKinematicsEnvironmentV1): PolarKinematicState {
  assertPolarKinematicsEnvironmentV1(profile);
  return Object.freeze({
    logical_tick: 0,
    position_m: frozenPoint(profile.initial_position_m.x, profile.initial_position_m.y),
    heading_rad: normalizeL01Heading(profile.initial_heading_rad),
    helm_command: 'neutral',
    // Declared initial condition: boat speed is zero, so apparent wind equals true wind.
    apparent_wind_from_rad: normalizeL01Heading(profile.true_wind_from_rad),
    apparent_wind_speed_mps: canonicalizeL01Number(profile.true_wind_speed_mps),
  });
}

/**
 * One renderer-independent fixed logical step. The polar is indexed by the
 * PREVIOUS tick's apparent wind vector combined with the CURRENT heading, which
 * keeps the computation acyclic while preserving immediate steering response.
 */
export function transitionPolarKinematicState(
  profile: PolarKinematicsEnvironmentV1,
  priorState: PolarKinematicState,
  orderedControls: readonly HelmControl[],
): PolarKinematicTransition {
  assertPolarKinematicsEnvironmentV1(profile);
  assertFiniteState(priorState);
  const controls = validateHelmControls(priorState.logical_tick, orderedControls);
  const acceptedHelm = controls.at(-1)?.helm_command ?? priorState.helm_command;
  const turn = acceptedHelm === 'port' ? -profile.full_helm_turn_rad_per_step : acceptedHelm === 'starboard' ? profile.full_helm_turn_rad_per_step : 0;
  const heading = normalizeL01Heading(priorState.heading_rad + turn);

  const awa = apparentWindAngle(priorState.apparent_wind_from_rad, heading);
  const stw = lookupTargetSpeedMps(trainingSloopPolarV1, awa, profile.true_wind_speed_mps);

  const waterVelocity = stw === 0 ? frozenPoint(0, 0) : l01DirectionVector(heading, stw);
  const currentVelocity = profile.current_speed_mps === 0
    ? frozenPoint(0, 0)
    : l01DirectionVector(normalizeL01Heading(profile.current_to_rad), profile.current_speed_mps);
  const groundVelocityRaw = composeGroundRelativeVelocity(waterVelocity, currentVelocity);
  const groundVelocity = frozenPoint(groundVelocityRaw.x, groundVelocityRaw.y);
  const displacement = frozenPoint(
    groundVelocity.x * profile.logical_step_seconds,
    groundVelocity.y * profile.logical_step_seconds,
  );

  // Apparent wind is measured against ground velocity: the air sits in the ground frame.
  const trueFlowTo = l01DirectionVector(normalizeL01Heading(profile.true_wind_from_rad + Math.PI), profile.true_wind_speed_mps);
  const apparentFlowTo = frozenPoint(trueFlowTo.x - groundVelocity.x, trueFlowTo.y - groundVelocity.y);
  const apparentSpeed = canonicalizeL01Number(Math.hypot(apparentFlowTo.x, apparentFlowTo.y));
  const apparentFrom = apparentSpeed === 0
    ? priorState.apparent_wind_from_rad
    : l01DirectionFromVector({ x: -apparentFlowTo.x, y: -apparentFlowTo.y });

  const nextState: PolarKinematicState = Object.freeze({
    logical_tick: priorState.logical_tick + 1,
    position_m: frozenPoint(priorState.position_m.x + displacement.x, priorState.position_m.y + displacement.y),
    heading_rad: heading,
    helm_command: acceptedHelm,
    apparent_wind_from_rad: apparentFrom,
    apparent_wind_speed_mps: apparentSpeed,
  });

  return Object.freeze({
    prior_state: Object.freeze({ ...priorState, position_m: frozenPoint(priorState.position_m.x, priorState.position_m.y) }),
    next_state: nextState,
    accepted_helm_command: acceptedHelm,
    controls,
    stw_mps: canonicalizeL01Number(stw),
    water_velocity_mps: waterVelocity,
    current_velocity_mps: currentVelocity,
    ground_velocity_mps: groundVelocity,
    displacement_m: displacement,
  });
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run tests/unit/polar-kinematics-model.test.ts`
Expected: PASS — 8 tests

- [ ] **Step 5: 순수성 경계 확인**

Run: `npx vitest run tests/contracts/sim-boundary.test.ts`
Expected: PASS — 신규 `src/sim` 파일이 금지 패턴을 쓰지 않음을 확인

- [ ] **Step 6: 커밋** *(Mode A — 사용자 승인 시에만)*

```bash
git add src/sim/polar-kinematics-model.ts tests/unit/polar-kinematics-model.test.ts
git commit -m "feat(sim): add polar kinematics transition with current composition"
```

---

### Task 5: STW/SOG/COG/drift 관측 프로젝터 (FR-04)

**Files:**
- Create: `src/sim/polar-observation.ts`
- Test: `tests/unit/polar-observation.test.ts`

기존 `src/sim/l01-observation.ts`는 **수정하지 않는다.** 구 모델 전용으로 남으며 회귀 픽스처가 그 throw 동작에 의존한다(스펙 §7).

**스펙과의 차이:** 스펙 §3은 "`l01-observation.ts`에 프로젝터 **추가**"라고 적었으나,
계획에서는 별도 파일 `polar-observation.ts`로 분리한다. 신규 프로젝터는 다른 상태
타입(`PolarKinematicTransition`)과 다른 에러 정책(zero-velocity sentinel)을 쓰므로 같은
파일에 두면 두 모델의 관심사가 섞인다. 스펙의 의도("기존 함수 불변")는 그대로 지켜진다.

**Interfaces:**
- Consumes: `PolarKinematicTransition` (Task 4), `canonicalizeL01Number`, `l01DirectionFromVector`, `normalizeL01Heading`
- Produces:
  - `type UnavailableObservation = 'declared-unavailable'`
  - `PolarObservations` — `{ heading_rad, stw_mps, sog_mps, cog_rad: number | UnavailableObservation, drift_angle_rad: number | UnavailableObservation, true_wind_from_rad, true_wind_speed_mps, apparent_wind_from_rad, apparent_wind_speed_mps }`
  - `projectPolarObservations(profile: PolarKinematicsEnvironmentV1, transition: PolarKinematicTransition): PolarObservations`

- [ ] **Step 1: 실패하는 테스트 작성**

Create `tests/unit/polar-observation.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { polarKinematicsEnvironmentV1 } from '../../src/contracts/polar-kinematics-environment.js';
import { createInitialPolarKinematicState, transitionPolarKinematicState } from '../../src/sim/polar-kinematics-model.js';
import { projectPolarObservations } from '../../src/sim/polar-observation.js';

const noCurrent = polarKinematicsEnvironmentV1;
const withCurrent = Object.freeze({ ...polarKinematicsEnvironmentV1, current_to_rad: Math.PI / 2, current_speed_mps: 1.5 });

function observe(profile: typeof polarKinematicsEnvironmentV1) {
  const initial = createInitialPolarKinematicState(profile);
  return projectPolarObservations(profile, transitionPolarKinematicState(profile, initial, []));
}

describe('polar observations (FR-04)', () => {
  it('collapses SOG onto STW and COG onto heading when there is no current', () => {
    const observations = observe(noCurrent);
    expect(observations.sog_mps).toBe(observations.stw_mps);
    expect(observations.cog_rad).toBe(observations.heading_rad);
    expect(observations.drift_angle_rad).toBe(0);
  });

  it('separates SOG from STW and COG from heading when a current is present', () => {
    const observations = observe(withCurrent);
    expect(observations.sog_mps).not.toBe(observations.stw_mps);
    expect(observations.cog_rad).not.toBe(observations.heading_rad);
    expect(observations.drift_angle_rad).not.toBe(0);
  });

  it('matches the declared vector composition for SOG', () => {
    const initial = createInitialPolarKinematicState(withCurrent);
    const transition = transitionPolarKinematicState(withCurrent, initial, []);
    const observations = projectPolarObservations(withCurrent, transition);
    const expected = Math.hypot(transition.ground_velocity_mps.x, transition.ground_velocity_mps.y);
    expect(observations.sog_mps).toBeCloseTo(expected, 6);
  });

  it('declares COG and drift unavailable when the boat is stopped over ground', () => {
    const headToWind = Object.freeze({ ...noCurrent, true_wind_from_rad: 0 });
    const initial = createInitialPolarKinematicState(headToWind);
    const transition = transitionPolarKinematicState(headToWind, initial, []);
    const observations = projectPolarObservations(headToWind, transition);
    expect(observations.sog_mps).toBe(0);
    expect(observations.cog_rad).toBe('declared-unavailable');
    expect(observations.drift_angle_rad).toBe('declared-unavailable');
  });

  it('exposes true and apparent wind without mutating the transition', () => {
    const initial = createInitialPolarKinematicState(noCurrent);
    const transition = transitionPolarKinematicState(noCurrent, initial, []);
    const before = structuredClone(transition);
    const observations = projectPolarObservations(noCurrent, transition);
    expect(observations.true_wind_from_rad).toBe(noCurrent.true_wind_from_rad);
    expect(observations.true_wind_speed_mps).toBe(noCurrent.true_wind_speed_mps);
    expect(observations.apparent_wind_speed_mps).toBe(transition.next_state.apparent_wind_speed_mps);
    expect(transition).toEqual(before);
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run tests/unit/polar-observation.test.ts`
Expected: FAIL — `Failed to resolve import ".../polar-observation.js"`

- [ ] **Step 3: 프로젝터 구현**

Create `src/sim/polar-observation.ts`:

```ts
import { canonicalizeL01Number } from '../contracts/l01-synthetic-environment.js';
import {
  assertPolarKinematicsEnvironmentV1,
  type PolarKinematicsEnvironmentV1,
} from '../contracts/polar-kinematics-environment.js';
import { l01DirectionFromVector, normalizeL01Heading } from './l01-synthetic-model.js';
import type { PolarKinematicTransition } from './polar-kinematics-model.js';

/** Reuses the existing sentinel so a stopped boat reports no course instead of throwing. */
export type UnavailableObservation = 'declared-unavailable';

export interface PolarObservations {
  readonly heading_rad: number;
  readonly stw_mps: number;
  readonly sog_mps: number;
  readonly cog_rad: number | UnavailableObservation;
  readonly drift_angle_rad: number | UnavailableObservation;
  readonly true_wind_from_rad: number;
  readonly true_wind_speed_mps: number;
  readonly apparent_wind_from_rad: number;
  readonly apparent_wind_speed_mps: number;
}

/** Projects immutable, synthetic-only observations. No navigational claim is made. */
export function projectPolarObservations(
  profile: PolarKinematicsEnvironmentV1,
  transition: PolarKinematicTransition,
): PolarObservations {
  assertPolarKinematicsEnvironmentV1(profile);
  const ground = transition.ground_velocity_mps;
  if (!Number.isFinite(ground.x) || !Number.isFinite(ground.y)) {
    throw new TypeError('Polar observation ground velocity must be finite.');
  }
  const heading = transition.next_state.heading_rad;
  const sog = canonicalizeL01Number(Math.hypot(ground.x, ground.y));
  const stopped = sog === 0;
  const cog = stopped ? 'declared-unavailable' : l01DirectionFromVector(ground);
  const drift = stopped ? 'declared-unavailable' : canonicalizeL01Number(normalizeL01Heading(cog - heading));
  return Object.freeze({
    heading_rad: heading,
    stw_mps: transition.stw_mps,
    sog_mps: sog,
    cog_rad: cog,
    drift_angle_rad: drift,
    true_wind_from_rad: canonicalizeL01Number(normalizeL01Heading(profile.true_wind_from_rad)),
    true_wind_speed_mps: canonicalizeL01Number(profile.true_wind_speed_mps),
    apparent_wind_from_rad: transition.next_state.apparent_wind_from_rad,
    apparent_wind_speed_mps: transition.next_state.apparent_wind_speed_mps,
  });
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run tests/unit/polar-observation.test.ts`
Expected: PASS — 5 tests

**주의:** "no current" 케이스에서 `drift_angle_rad`가 `0`이어야 한다. `normalizeL01Heading`은 `[0, 2π)`를 반환하므로 `cog === heading`일 때 정확히 `0`이 나온다. 만약 부동소수 오차로 `2π`에 근접한 값이 나오면 `normalizeL01Heading`이 이미 `TAU`를 `0`으로 매핑하므로 문제없다.

- [ ] **Step 5: 커밋** *(Mode A — 사용자 승인 시에만)*

```bash
git add src/sim/polar-observation.ts tests/unit/polar-observation.test.ts
git commit -m "feat(sim): project STW/SOG/COG/drift observations"
```

---

### Task 6: 도메인 검증 레지스터에 VR-POLAR-v0 등록

**Files:**
- Modify: `docs/content/domain-validation-registry.yaml`

- [ ] **Step 1: 기존 레코드 형식 확인**

Run: `head -40 docs/content/domain-validation-registry.yaml`

기존 레코드의 필드 순서와 들여쓰기를 그대로 따라야 한다. PRD §12.1이 요구하는 필드는
`validation_record_id`, claim/assumption, source 또는 근거 부재 사유, 각 version binding,
reviewer, review_date, disposition이다.

- [ ] **Step 2: VR-POLAR-v0 레코드 추가**

기존 레코드와 동일한 필드 순서·들여쓰기로 다음 내용을 추가한다. 필드명이 기존 파일과
다르면 **기존 파일의 필드명을 따른다**:

```yaml
  - validation_record_id: VR-POLAR-v0
    claim: >-
      Synthetic 8x6 polar table mapping (apparent wind angle, true wind speed)
      to a target speed through water for training-sloop-v1.
    source: >-
      No external source. Values are invented educational assumptions chosen for
      monotonicity in wind speed and a mid-angle maximum. They assert no real
      hull performance, weather, route, or safety behaviour.
    model_version: polar-kinematics-v1
    boat_profile_version: training-sloop-v1
    reviewer: none
    review_date: null
    disposition: assumption
```

- [ ] **Step 3: 콘텐츠 테스트 확인**

Run: `npm test`
Expected: PASS — 레지스터를 파싱하는 테스트가 있다면 통과해야 한다. 실패하면 필드명이
기존 스키마와 어긋난 것이므로 Step 1의 형식에 맞춘다.

- [ ] **Step 4: 커밋** *(Mode A — 사용자 승인 시에만)*

```bash
git add docs/content/domain-validation-registry.yaml
git commit -m "docs(content): register VR-POLAR-v0 polar assumption"
```

---

### Task 7: L01·L04 manifest 이행과 골든 픽스처 재생성

이 Task는 L01·L04 픽스처 4종을 재생성한다. L02·L03·L05 픽스처 6종은 불변이어야 한다.

**Files:**
- Modify: `src/content/l01.ts` (L01 `model_version`)
- Modify: `src/content/l02-l05.ts` (L04 `model_version`)
- Modify: `tests/fixtures/l01-raw-golden.json`, `l01-score-debrief-golden.json`, `l04-raw-golden.json`, `l04-score-debrief-golden.json`

**Interfaces:**
- Consumes: `POLAR_KINEMATICS_MODEL_VERSION` (Task 3)

- [ ] **Step 1: 이행 전 기준선 기록**

Run: `npm test 2>&1 | tail -5`
Expected: PASS. 파일 수와 테스트 수를 기록해 둔다. 이 시점 기준선은 **26 files / 255 tests**여야 한다(기존 22/232 + Task 1의 7 + Task 3의 3 + Task 4의 8 + Task 5의 5 = 4 files / 23 tests).

- [ ] **Step 2: L01 manifest의 model_version 교체**

In `src/content/l01.ts`:

1. Add the import:

```ts
import { POLAR_KINEMATICS_MODEL_VERSION } from '../contracts/polar-kinematics-environment.js';
```

2. In `l01Manifest`, replace:

```ts
  model_version: 'l01-synthetic-kinematics-v1',
```

with:

```ts
  model_version: POLAR_KINEMATICS_MODEL_VERSION,
```

**주의:** 현재 값은 `'l01-synthetic-kinematics-v1'`이다. 파일을 열어 실제 문자열을 확인한
뒤 교체한다.

- [ ] **Step 3: L04 manifest의 model_version 교체**

In `src/content/l02-l05.ts`, the `common` object is shared by L02–L05, so L04 must
override it individually. Add the import:

```ts
import { POLAR_KINEMATICS_MODEL_VERSION } from '../contracts/polar-kinematics-environment.js';
```

Then in `l04Manifest`, add an explicit override **after** the `...common` spread:

```ts
export const l04Manifest: DraftLessonManifest = Object.freeze({
  ...common, lesson_id: 'L04', scenario_version: 'l04-scenario-v0-draft', validation_record_id: 'VR-L04-v0',
  model_version: POLAR_KINEMATICS_MODEL_VERSION,
  initial_state: 'training-sloop-v1 synthetic declared current-to vector and declared virtual mark',
```

L02, L03, L05는 `common`의 `model_version`을 그대로 쓰므로 **건드리지 않는다.**

- [ ] **Step 4: 실패를 확인해 영향 범위 파악**

Run: `npm test 2>&1 | tail -30`
Expected: FAIL — L01·L04 관련 픽스처 테스트가 identity 불일치로 실패한다.
L02·L03·L05 테스트는 계속 통과해야 한다. L02/L03/L05가 실패하면 Step 3에서 `common`을
잘못 건드린 것이므로 되돌린다.

- [ ] **Step 5: L01·L04 픽스처의 model_version 갱신**

각 픽스처 JSON의 `identity.model_version`을 `"polar-kinematics-v1"`로 바꾼다:

```bash
cd /Users/hipgiinii/.hermes/projects/Sailing_training
for f in tests/fixtures/l01-raw-golden.json tests/fixtures/l01-score-debrief-golden.json \
         tests/fixtures/l04-raw-golden.json tests/fixtures/l04-score-debrief-golden.json; do
  python3 - "$f" <<'PY'
import json, sys
path = sys.argv[1]
with open(path) as handle:
    data = json.load(handle)
if isinstance(data, dict) and isinstance(data.get('identity'), dict):
    data['identity']['model_version'] = 'polar-kinematics-v1'
    with open(path, 'w') as handle:
        json.dump(data, handle, indent=2)
        handle.write('\n')
    print(f'updated {path}')
else:
    print(f'NO identity key in {path} - inspect manually')
PY
done
```

`NO identity key` 가 출력된 파일은 직접 열어 구조를 확인하고 해당 위치의
`model_version`을 수동으로 갱신한다.

- [ ] **Step 6: 기대값 재생성 여부 판단**

Run: `npm test 2>&1 | tail -30`

- 통과하면 identity 갱신만으로 충분했던 것이므로 Step 7로 간다.
- 여전히 실패하면 기대 궤적(`expected.raw`, `expected.ledger`, `score`)이 구 모델의 고정
  2 m/s 기준이라 새 폴라 결과와 다른 것이다. 이 경우 실패 출력의 `actual` 값을 픽스처의
  기대값에 반영한다. **반드시 실패 출력에 찍힌 실제 값을 그대로 옮겨 적고, 임의의 숫자를
  지어내지 않는다.**

- [ ] **Step 7: 전체 검증**

```bash
npm run typecheck
npm test
npm run build
```

Expected: 세 명령 모두 PASS.

- [ ] **Step 8: L02·L03·L05 픽스처 불변 확인**

```bash
git diff --name-only tests/fixtures/
```

Expected: `l01-*` 와 `l04-*` 4개 파일만 나열되어야 한다. `l02-*`, `l03-*`, `l05-*`가
나오면 `common`을 잘못 건드린 것이므로 Step 3을 재검토한다.

- [ ] **Step 9: 구 모델 회귀 증거 확인**

Run: `npx vitest run tests/unit/l01-synthetic-model.test.ts`
Expected: PASS — 변경 없이 통과. 이것이 구 모델이 온전하다는 증거다.

- [ ] **Step 10: 커밋** *(Mode A — 사용자 승인 시에만)*

```bash
git add src/content/l01.ts src/content/l02-l05.ts tests/fixtures/
git commit -m "feat(content): migrate L01 and L04 to polar kinematics model"
```

---

### Task 8: 완료 매트릭스와 PROJECT_STATUS 갱신

저장소는 구현 상태를 문서로 추적한다. 코드만 바꾸고 문서를 안 고치면 감사 근거가 어긋난다.

**Files:**
- Modify: `docs/architecture/training-ground-completion-matrix.md`
- Modify: `docs/PROJECT_STATUS.md`

- [ ] **Step 1: 완료 매트릭스의 L01·L04 행 갱신**

`docs/architecture/training-ground-completion-matrix.md`에서 L01과 L04의
"Required observations" 칸을 갱신한다. 현재 두 행은 관측값이
`declared_unavailable`이며 물리가 `NOT_IMPLEMENTED`라고 적혀 있다.

- L01 행: true/apparent wind와 heading/COG가 이제 폴라 기반으로 **계산됨**을 반영하고,
  근거로 `src/sim/polar-kinematics-model.ts`, `src/sim/polar-observation.ts`,
  `tests/unit/polar-observation.test.ts`를 인용한다.
- L04 행: STW/SOG/drift가 이제 조류 벡터 합성으로 **계산됨**을 반영하고, 같은 근거와
  `tests/unit/polar-kinematics-model.test.ts`를 인용한다.
- 두 행 모두 `DECLARED_SYNTHETIC_ONLY` 표기를 유지한다. 값은 계산되지만 여전히 미검증
  합성 가정이며 실제 항해·안전 값이 아니다.
- L02·L03·L05 행은 **건드리지 않는다.**

- [ ] **Step 2: 매트릭스 하단 Limits 절 확인**

`## Limits` 절의 문장은 그대로 유지한다. 이 작업은 실제 세일링 물리·안전·항법 권위·인증을
확립하지 않으며 모든 disposition은 `assumption`으로 남는다.

- [ ] **Step 3: PROJECT_STATUS 갱신**

`docs/PROJECT_STATUS.md`의 "1. Current position"에 폴라·조류 작업 항목을 추가하고,
"2. Current verification" 표의 테스트 수를 Task 7 Step 7에서 실제로 관측한 값으로
갱신한다. **추정치를 쓰지 말고 실제 출력값을 쓴다.**

- [ ] **Step 4: 최종 전체 검증**

```bash
npm run typecheck
npm test
npm run build
```

Expected: 세 명령 모두 PASS.

- [ ] **Step 5: 커밋** *(Mode A — 사용자 승인 시에만)*

```bash
git add docs/architecture/training-ground-completion-matrix.md docs/PROJECT_STATUS.md
git commit -m "docs: record polar and current model implementation"
```

---

## 완료 기준

- [ ] `npm run typecheck`, `npm test`, `npm run build` 모두 PASS
- [ ] `lookupTargetSpeedMps`가 격자 꼭짓점에서 정확히 선언값을 반환하고 대칭·클램프·단조성을 만족
- [ ] 조류 0에서 `sog === stw` 且 `cog === heading` (FR-04 수용 기준)
- [ ] 조류 존재 시 `groundVel === waterVel + currentTo`
- [ ] 맞바람 정지에서 throw 없이 COG/drift가 `'declared-unavailable'`
- [ ] `tests/unit/l01-synthetic-model.test.ts`가 변경 없이 통과 (구 모델 회귀 증거)
- [ ] `tests/fixtures/`의 변경이 `l01-*`·`l04-*` 4개 파일로 한정
- [ ] 모든 `validation_disposition`이 `assumption` 유지, UI의 synthetic·non-navigation 라벨 불변
