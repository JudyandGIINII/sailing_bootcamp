# World Renderer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the training world actually render — a boat that moves and turns, the drift trail it leaves, and the mark it is sailing to — instead of the static decorative canvas that exists today.

**Architecture:** Split the work into two pure modules and one thin PixiJS adapter. `camera.ts` does world→screen projection for a boat-following camera; `session-view.ts` derives the boat state, the trail and the mark from a session; `world-projection.ts` draws them. The pure modules carry the tests, because Pixi drawing is not meaningfully unit-testable.

**Tech Stack:** TypeScript 5.9 (strict), PixiJS 8 (already a dependency), Vitest 4.1, Playwright. No new dependencies.

## Global Constraints

- **No new simulation state.** The trail is derived from the ledger, which already records a position every tick. Do not add fields to `RawSimulationState` or to any replay identity. `git diff --name-only tests/fixtures/` must be empty at the end of every task.
- **Purity.** `src/render/camera.ts` and `src/render/session-view.ts` must not use `Date.now`, `performance.now`, `Math.random`, `window`, `document`, `localStorage`, `sessionStorage`, `fetch`, `XMLHttpRequest`, `WebSocket`, or `EventSource`. (Note: `tests/contracts/sim-boundary.test.ts` scans `src/sim` only, so this is not enforced automatically — keep it by discipline.)
- **Coordinate contract** (`docs/contracts/coordinate-contract.md`): `+x = east`, `+y = north`, angles north-zero clockwise-positive in radians. Screen y increases downward, so the projection flips y.
- **Canonicalization.** Any float stored or compared must go through `canonicalizeL01Number` from `src/contracts/l01-synthetic-environment.js`. Pixel values passed to Pixi are display-only and need not be canonicalized.
- **Boundary language.** Every rendered label and every text alternative must read as synthetic and unvalidated — never as a real chart, sounding, bearing, or navigational display. This is the project's central constraint.
- **Accessibility.** The canvas stays `aria-hidden="true"`; the information it conveys must also exist as text. Never convey state by colour alone.
- **Relative imports use the `.js` extension.**
- **Baseline:** `npm run typecheck` clean, `npm test` = 32 files / 321 tests, `npm run build` clean, `npm run test:smoke` = 23/23.

---

### Task 1: Camera projection (pure)

**Files:**
- Create: `src/render/camera.ts`
- Test: `tests/unit/render-camera.test.ts`

**Interfaces:**
- Consumes: nothing (dependency-free)
- Produces:
  - `interface Viewport { readonly width_px: number; readonly height_px: number; readonly metres_per_pixel: number }`
  - `interface WorldPoint { readonly x: number; readonly y: number }`
  - `interface ScreenPoint { readonly x: number; readonly y: number }`
  - `DEFAULT_VIEWPORT: Readonly<Viewport>`
  - `projectToScreen(viewport: Viewport, centre: WorldPoint, world: WorldPoint): Readonly<ScreenPoint>`
  - `isOnScreen(viewport: Viewport, screen: ScreenPoint, marginPx?: number): boolean`
  - `edgeIndicator(viewport: Viewport, screen: ScreenPoint): Readonly<{ position: ScreenPoint; angle_rad: number }>`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/render-camera.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_VIEWPORT,
  edgeIndicator,
  isOnScreen,
  projectToScreen,
  type Viewport,
} from '../../src/render/camera.js';

const viewport: Viewport = { width_px: 520, height_px: 360, metres_per_pixel: 0.6 };

describe('follow-boat camera projection', () => {
  it('puts the camera centre at the middle of the canvas', () => {
    expect(projectToScreen(viewport, { x: 12, y: -8 }, { x: 12, y: -8 })).toEqual({ x: 260, y: 180 });
  });

  it('maps east to the right and north to UP, flipping the screen y axis', () => {
    const centre = { x: 0, y: 0 };
    const east = projectToScreen(viewport, centre, { x: 60, y: 0 });
    const north = projectToScreen(viewport, centre, { x: 0, y: 60 });
    expect(east.x).toBeGreaterThan(260);
    expect(east.y).toBe(180);
    expect(north.y).toBeLessThan(180);
    expect(north.x).toBe(260);
  });

  it('scales by metres per pixel', () => {
    const projected = projectToScreen(viewport, { x: 0, y: 0 }, { x: 60, y: 0 });
    expect(projected.x).toBe(260 + 60 / 0.6);
  });

  it('reports whether a projected point is inside the canvas', () => {
    expect(isOnScreen(viewport, { x: 260, y: 180 })).toBe(true);
    expect(isOnScreen(viewport, { x: -40, y: 180 })).toBe(false);
    expect(isOnScreen(viewport, { x: 260, y: 900 })).toBe(false);
    // A margin pulls the accepted region inward.
    expect(isOnScreen(viewport, { x: 5, y: 180 }, 20)).toBe(false);
  });

  it('clamps an off-screen point to the canvas edge and reports its direction', () => {
    // Far north: the indicator sits on the top edge, pointing up (-PI/2 on screen).
    const indicator = edgeIndicator(viewport, { x: 260, y: -5000 });
    expect(indicator.position.y).toBeGreaterThanOrEqual(0);
    expect(indicator.position.y).toBeLessThan(40);
    expect(indicator.position.x).toBeCloseTo(260, 6);
    expect(Math.cos(indicator.angle_rad)).toBeCloseTo(0, 6);
    expect(Math.sin(indicator.angle_rad)).toBeCloseTo(-1, 6);
  });

  it('keeps the edge indicator inside the canvas for a diagonal off-screen point', () => {
    const indicator = edgeIndicator(viewport, { x: 9000, y: -9000 });
    expect(indicator.position.x).toBeGreaterThanOrEqual(0);
    expect(indicator.position.x).toBeLessThanOrEqual(viewport.width_px);
    expect(indicator.position.y).toBeGreaterThanOrEqual(0);
    expect(indicator.position.y).toBeLessThanOrEqual(viewport.height_px);
  });

  it('ships a default viewport whose visible span is a few hundred metres', () => {
    const spanX = DEFAULT_VIEWPORT.width_px * DEFAULT_VIEWPORT.metres_per_pixel;
    expect(spanX).toBeGreaterThan(100);
    expect(spanX).toBeLessThan(1000);
  });

  it('rejects non-finite inputs', () => {
    expect(() => projectToScreen(viewport, { x: 0, y: 0 }, { x: Number.NaN, y: 0 })).toThrow(TypeError);
    expect(() => edgeIndicator(viewport, { x: Number.POSITIVE_INFINITY, y: 0 })).toThrow(TypeError);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/render-camera.test.ts`
Expected: FAIL — `Failed to resolve import "../../src/render/camera.js"`

- [ ] **Step 3: Write the implementation**

Create `src/render/camera.ts`:

```ts
/**
 * Pure world-to-screen projection for a camera that follows the boat. It draws
 * nothing and holds no state; it exists so the geometry can be tested without
 * a renderer. Every value it produces is a synthetic display coordinate, never
 * a chart position or a navigational bearing.
 */
export interface Viewport {
  readonly width_px: number;
  readonly height_px: number;
  readonly metres_per_pixel: number;
}

export interface WorldPoint {
  readonly x: number;
  readonly y: number;
}

export interface ScreenPoint {
  readonly x: number;
  readonly y: number;
}

/** 520x360 px at 0.6 m/px shows roughly 312 x 216 m of synthetic water. */
export const DEFAULT_VIEWPORT: Readonly<Viewport> = Object.freeze({
  width_px: 520,
  height_px: 360,
  metres_per_pixel: 0.6,
});

function assertFinitePoint(point: WorldPoint | ScreenPoint): void {
  if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) {
    throw new TypeError('Camera points must be finite.');
  }
}

function assertViewport(viewport: Viewport): void {
  if (!Number.isFinite(viewport.width_px) || viewport.width_px <= 0 ||
    !Number.isFinite(viewport.height_px) || viewport.height_px <= 0 ||
    !Number.isFinite(viewport.metres_per_pixel) || viewport.metres_per_pixel <= 0) {
    throw new TypeError('Viewport dimensions and scale must be finite and positive.');
  }
}

/**
 * The coordinate contract is +x east, +y north; the screen's y axis points
 * down, so north maps to a smaller screen y.
 */
export function projectToScreen(viewport: Viewport, centre: WorldPoint, world: WorldPoint): Readonly<ScreenPoint> {
  assertViewport(viewport);
  assertFinitePoint(centre);
  assertFinitePoint(world);
  return Object.freeze({
    x: viewport.width_px / 2 + (world.x - centre.x) / viewport.metres_per_pixel,
    y: viewport.height_px / 2 - (world.y - centre.y) / viewport.metres_per_pixel,
  });
}

export function isOnScreen(viewport: Viewport, screen: ScreenPoint, marginPx = 0): boolean {
  assertViewport(viewport);
  assertFinitePoint(screen);
  if (!Number.isFinite(marginPx) || marginPx < 0) throw new TypeError('Screen margin must be finite and non-negative.');
  return screen.x >= marginPx && screen.x <= viewport.width_px - marginPx &&
    screen.y >= marginPx && screen.y <= viewport.height_px - marginPx;
}

/**
 * Where to draw a pointer for something outside the canvas: the intersection of
 * the centre-to-target ray with the canvas edge, plus the screen-space angle of
 * that ray so the caller can rotate an arrow.
 */
export function edgeIndicator(viewport: Viewport, screen: ScreenPoint): Readonly<{ position: ScreenPoint; angle_rad: number }> {
  assertViewport(viewport);
  assertFinitePoint(screen);
  const centreX = viewport.width_px / 2;
  const centreY = viewport.height_px / 2;
  const dx = screen.x - centreX;
  const dy = screen.y - centreY;
  const angle_rad = Math.atan2(dy, dx);
  if (dx === 0 && dy === 0) {
    return Object.freeze({ position: Object.freeze({ x: centreX, y: centreY }), angle_rad: 0 });
  }
  const inset = 12;
  const halfWidth = Math.max(0, centreX - inset);
  const halfHeight = Math.max(0, centreY - inset);
  // Scale the ray so it just touches the inset rectangle on whichever axis binds first.
  const scaleX = dx === 0 ? Number.POSITIVE_INFINITY : halfWidth / Math.abs(dx);
  const scaleY = dy === 0 ? Number.POSITIVE_INFINITY : halfHeight / Math.abs(dy);
  const scale = Math.min(scaleX, scaleY);
  return Object.freeze({
    position: Object.freeze({ x: centreX + dx * scale, y: centreY + dy * scale }),
    angle_rad,
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/render-camera.test.ts`
Expected: PASS — 8 tests

- [ ] **Step 5: Confirm no fixture moved and commit**

```bash
npm run typecheck
git diff --name-only tests/fixtures/   # must print nothing
git add src/render/camera.ts tests/unit/render-camera.test.ts
git commit -m "feat(render): add pure follow-boat camera projection"
```

---

### Task 2: Session view derivation (pure)

Derives everything the renderer needs from a session, without touching simulation state.

**Files:**
- Create: `src/render/session-view.ts`
- Test: `tests/unit/render-session-view.test.ts`

**Interfaces:**
- Consumes: `WorldPoint` from `./camera.js`; `DeterministicSession` type from `../sim/session.js`; `COURSE_TEMPLATES` from `../contracts/scenario.js`; `L04_MARK_ARRIVAL_RADIUS_M` from `../content/l02-l05.js`
- Produces:
  - `interface WorldMark { readonly label: string; readonly position: WorldPoint; readonly arrival_radius_m: number }`
  - `interface SessionWorldView { readonly position: WorldPoint; readonly heading_rad: number; readonly cog_rad: number | 'declared-unavailable'; readonly trail: readonly WorldPoint[]; readonly mark: WorldMark | undefined; readonly clearance_level: 'clear' | 'caution' | 'danger' | undefined }`
  - `projectSessionWorldView(session: DeterministicSession): SessionWorldView | undefined`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/render-session-view.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { advanceLogicalTick, createSession, type DeterministicSession } from '../../src/sim/session.js';
import { l04ReplayBindings, l02ReplayBindings } from '../../src/content/l02-l05.js';
import { l06ReplayBindings } from '../../src/content/l06-polar.js';
import { projectSessionWorldView } from '../../src/render/session-view.js';

function polarSession(bindings: Record<string, unknown>, seed: string): DeterministicSession {
  return createSession({ ...bindings, seed, ordered_input_log: [] } as never);
}

describe('session world view derivation', () => {
  it('reports the boat position and heading for a polar lesson', () => {
    const view = projectSessionWorldView(polarSession(l04ReplayBindings, 'view-l04'));
    expect(view).toBeDefined();
    expect(typeof view!.position.x).toBe('number');
    expect(typeof view!.position.y).toBe('number');
    expect(typeof view!.heading_rad).toBe('number');
  });

  it('grows the trail by one point per advanced tick, ending at the current position', () => {
    let session = polarSession(l06ReplayBindings, 'view-trail');
    const before = projectSessionWorldView(session)!.trail.length;
    session = advanceLogicalTick(advanceLogicalTick(advanceLogicalTick(session)));
    const view = projectSessionWorldView(session)!;
    expect(view.trail.length).toBe(before + 3);
    expect(view.trail.at(-1)).toEqual(view.position);
  });

  it('moves the boat between ticks, so the trail is not a single repeated point', () => {
    let session = polarSession(l06ReplayBindings, 'view-moves');
    for (let tick = 0; tick < 5; tick += 1) session = advanceLogicalTick(session);
    const trail = projectSessionWorldView(session)!.trail;
    expect(new Set(trail.map((point) => `${point.x},${point.y}`)).size).toBe(trail.length);
  });

  it('exposes the declared course mark and its arrival radius for L04', () => {
    const view = projectSessionWorldView(polarSession(l04ReplayBindings, 'view-mark'))!;
    expect(view.mark).toEqual({ label: 'W1', position: { x: 0, y: 600 }, arrival_radius_m: 25 });
  });

  it('declares no mark for a lesson that has none', () => {
    expect(projectSessionWorldView(polarSession(l06ReplayBindings, 'view-nomark'))!.mark).toBeUndefined();
  });

  it('returns undefined for a lesson that declares no world position', () => {
    expect(projectSessionWorldView(polarSession(l02ReplayBindings, 'view-l02'))).toBeUndefined();
  });

  it('never mutates the session it reads', () => {
    const session = polarSession(l04ReplayBindings, 'view-immutable');
    const before = structuredClone({ raw: session.raw, ledger: session.ledger });
    projectSessionWorldView(session);
    expect({ raw: session.raw, ledger: session.ledger }).toEqual(before);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/render-session-view.test.ts`
Expected: FAIL — `Failed to resolve import "../../src/render/session-view.js"`

- [ ] **Step 3: Write the implementation**

Create `src/render/session-view.ts`:

```ts
/**
 * Derives everything the world renderer needs from a session, reading only.
 * The trail comes from the immutable ledger, which already records a position
 * every tick, so no simulation state is added for display. Every value is a
 * synthetic training value and none of it is chart, sounding, or route data.
 */
import { L04_MARK_ARRIVAL_RADIUS_M, L04_TARGET_MARK } from '../content/l02-l05.js';
import type { DeterministicSession } from '../sim/session.js';
import type { WorldPoint } from './camera.js';

export interface WorldMark {
  readonly label: string;
  readonly position: WorldPoint;
  readonly arrival_radius_m: number;
}

export interface SessionWorldView {
  readonly position: WorldPoint;
  readonly heading_rad: number;
  readonly cog_rad: number | 'declared-unavailable';
  readonly trail: readonly WorldPoint[];
  readonly mark: WorldMark | undefined;
  readonly clearance_level: 'clear' | 'caution' | 'danger' | undefined;
}

function frozenPoint(point: Readonly<{ x: number; y: number }>): WorldPoint {
  return Object.freeze({ x: point.x, y: point.y });
}

/** Ordered positions the boat has occupied, oldest first. */
function trailFromLedger(session: DeterministicSession, current: WorldPoint): readonly WorldPoint[] {
  const points: WorldPoint[] = [];
  for (const event of session.ledger) {
    const transition = event.polar_transition ?? event.l01_transition;
    if (!transition) continue;
    if (points.length === 0) points.push(frozenPoint(transition.prior_state.position_m));
    points.push(frozenPoint(transition.next_state.position_m));
  }
  if (points.length === 0) points.push(current);
  return Object.freeze(points);
}

export function projectSessionWorldView(session: DeterministicSession): SessionWorldView | undefined {
  const kinematic = session.raw.polar_kinematic_state ?? session.raw.l01_synthetic_state;
  if (!kinematic) return undefined;
  const position = frozenPoint(kinematic.position_m);
  const isL04 = session.raw.lesson_id === 'L04';
  return Object.freeze({
    position,
    heading_rad: kinematic.heading_rad,
    cog_rad: session.raw.cog,
    trail: trailFromLedger(session, position),
    mark: isL04
      ? Object.freeze({
          label: L04_TARGET_MARK.label,
          position: Object.freeze({ x: L04_TARGET_MARK.x_m, y: L04_TARGET_MARK.y_m }),
          arrival_radius_m: L04_MARK_ARRIVAL_RADIUS_M,
        })
      : undefined,
    clearance_level: session.raw.clearance_level,
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/render-session-view.test.ts`
Expected: PASS — 7 tests

**Likely typecheck snag:** `event.polar_transition ?? event.l01_transition` is a union of two
differently-typed payloads. Both carry `prior_state.position_m` and `next_state.position_m`,
but TypeScript may refuse the property access on the union. If `npm run typecheck` complains,
read each branch separately rather than widening a type:

```ts
    const positions = event.polar_transition
      ? { prior: event.polar_transition.prior_state.position_m, next: event.polar_transition.next_state.position_m }
      : event.l01_transition
        ? { prior: event.l01_transition.prior_state.position_m, next: event.l01_transition.next_state.position_m }
        : undefined;
    if (!positions) continue;
    if (points.length === 0) points.push(frozenPoint(positions.prior));
    points.push(frozenPoint(positions.next));
```

If the trail-length test fails because the initial session already carries a transition event, adjust the expectation to the ACTUAL observed count rather than changing the implementation — read the failure output and use its number.

- [ ] **Step 5: Confirm no fixture moved and commit**

```bash
npm run typecheck
git diff --name-only tests/fixtures/   # must print nothing
git add src/render/session-view.ts tests/unit/render-session-view.test.ts
git commit -m "feat(render): derive boat, trail and mark from a session"
```

---

### Task 3: Draw the world

Replaces the decorative stub with a renderer that uses the two pure modules.

**Files:**
- Modify: `src/render/world-projection.ts` (full rewrite of the drawing body)
- Modify: `src/main.ts` (text alternative element and its update)
- Test: `tests/smoke/app.spec.ts` (add cases)

**Interfaces:**
- Consumes: `DEFAULT_VIEWPORT`, `projectToScreen`, `isOnScreen`, `edgeIndicator` from `./camera.js`; `projectSessionWorldView` from `./session-view.js`
- Produces: `createWorldProjection(container: HTMLElement): Promise<{ render(session: DeterministicSession): void }>` — unchanged signature, so `src/main.ts:636` keeps working

- [ ] **Step 1: Rewrite the renderer**

Replace the whole body of `src/render/world-projection.ts` with:

```ts
import { Application, Graphics, Text } from 'pixi.js';
import type { DeterministicSession } from '../sim/session.js';
import { DEFAULT_VIEWPORT, edgeIndicator, isOnScreen, projectToScreen } from './camera.js';
import { projectSessionWorldView } from './session-view.js';

/**
 * A read-only PixiJS world projection adapter. It has no callbacks into
 * simulation and renders only synthetic, non-navigational shapes: a declared
 * boat glyph, the track it has left, and a declared virtual mark. It is not a
 * chart, a plotter, or a navigational display.
 */
export async function createWorldProjection(container: HTMLElement): Promise<{ render(session: DeterministicSession): void }> {
  const viewport = DEFAULT_VIEWPORT;
  const application = new Application();
  await application.init({
    width: viewport.width_px,
    height: viewport.height_px,
    autoStart: false,
    backgroundAlpha: 0,
    preference: 'webgl',
  });

  const canvas = application.canvas;
  canvas.setAttribute('aria-hidden', 'true');
  canvas.className = 'world-canvas';
  container.replaceChildren(canvas);

  const water = new Graphics().rect(0, 0, viewport.width_px, viewport.height_px).fill(0x082f49);
  const border = new Graphics();
  const trail = new Graphics();
  const markLayer = new Graphics();
  const boat = new Graphics();
  const cogRay = new Graphics();
  const title = new Text({ position: { x: 14, y: 12 }, style: { fill: 0xe2e8f0, fontFamily: 'system-ui', fontSize: 13 } });
  const markLabel = new Text({ style: { fill: 0xfde68a, fontFamily: 'system-ui', fontSize: 12 } });
  application.stage.addChild(water, trail, markLayer, cogRay, boat, border, title, markLabel);

  const clearanceColour = (level: string | undefined) =>
    level === 'danger' ? 0xf87171 : level === 'caution' ? 0xfbbf24 : 0x1e3a5f;

  return {
    render(session) {
      const view = projectSessionWorldView(session);
      trail.clear();
      markLayer.clear();
      boat.clear();
      cogRay.clear();
      border.clear();
      markLabel.text = '';

      if (!view) {
        title.text = `Synthetic ${session.raw.lesson_id ?? 'L01'} • this lesson declares no world position`;
        application.render();
        return;
      }

      const centre = view.position;
      border.rect(0, 0, viewport.width_px, viewport.height_px).stroke({ width: 3, color: clearanceColour(view.clearance_level) });

      // Track left behind: the drift trail (PRD 6.1).
      const points = view.trail.map((point) => projectToScreen(viewport, centre, point));
      if (points.length > 1) {
        trail.moveTo(points[0]!.x, points[0]!.y);
        for (const point of points.slice(1)) trail.lineTo(point.x, point.y);
        trail.stroke({ width: 2, color: 0x38bdf8, alpha: 0.9 });
      }

      if (view.mark) {
        const markScreen = projectToScreen(viewport, centre, view.mark.position);
        if (isOnScreen(viewport, markScreen)) {
          markLayer.circle(markScreen.x, markScreen.y, Math.max(3, view.mark.arrival_radius_m / viewport.metres_per_pixel)).stroke({ width: 2, color: 0xfde68a });
          markLayer.circle(markScreen.x, markScreen.y, 4).fill(0xfde68a);
          markLabel.position.set(markScreen.x + 8, markScreen.y - 8);
          markLabel.text = view.mark.label;
        } else {
          const indicator = edgeIndicator(viewport, markScreen);
          const arrow = 9;
          markLayer
            .moveTo(indicator.position.x + Math.cos(indicator.angle_rad) * arrow, indicator.position.y + Math.sin(indicator.angle_rad) * arrow)
            .lineTo(indicator.position.x + Math.cos(indicator.angle_rad + 2.5) * arrow, indicator.position.y + Math.sin(indicator.angle_rad + 2.5) * arrow)
            .lineTo(indicator.position.x + Math.cos(indicator.angle_rad - 2.5) * arrow, indicator.position.y + Math.sin(indicator.angle_rad - 2.5) * arrow)
            .fill(0xfde68a);
          const distance = Math.hypot(view.mark.position.x - centre.x, view.mark.position.y - centre.y);
          markLabel.position.set(Math.min(viewport.width_px - 90, Math.max(4, indicator.position.x - 20)), Math.min(viewport.height_px - 18, Math.max(4, indicator.position.y + 12)));
          markLabel.text = `${view.mark.label} ${distance.toFixed(0)} m`;
        }
      }

      // Course over ground, drawn from the boat so its angle against the hull
      // heading is the declared drift.
      if (view.cog_rad !== 'declared-unavailable') {
        const rayLength = 42;
        cogRay
          .moveTo(viewport.width_px / 2, viewport.height_px / 2)
          .lineTo(
            viewport.width_px / 2 + Math.sin(view.cog_rad) * rayLength,
            viewport.height_px / 2 - Math.cos(view.cog_rad) * rayLength,
          )
          .stroke({ width: 2, color: 0x86efac, alpha: 0.9 });
      }

      // The boat glyph is deliberately far larger than 10 m at this scale so it
      // stays legible; it is a symbol, not a scale drawing.
      const bx = viewport.width_px / 2;
      const by = viewport.height_px / 2;
      const heading = view.heading_rad;
      const nose = { x: bx + Math.sin(heading) * 14, y: by - Math.cos(heading) * 14 };
      const portSide = { x: bx + Math.sin(heading + 2.4) * 9, y: by - Math.cos(heading + 2.4) * 9 };
      const starboardSide = { x: bx + Math.sin(heading - 2.4) * 9, y: by - Math.cos(heading - 2.4) * 9 };
      boat.moveTo(nose.x, nose.y).lineTo(portSide.x, portSide.y).lineTo(starboardSide.x, starboardSide.y).fill(0xf8fafc);

      title.text = `Synthetic ${session.raw.lesson_id ?? 'L01'} • tick ${session.raw.logical_tick} • helm ${session.raw.helm_command}`;
      application.render();
    },
  };
}
```

- [ ] **Step 2: Verify it compiles and nothing regressed**

```bash
npm run typecheck
npm test
npm run build
```
Expected: typecheck and build clean; 34 files / 336 tests (the 321 baseline plus Task 1's 8 and Task 2's 7).

- [ ] **Step 3: Add the text alternative to `src/main.ts`**

The canvas is `aria-hidden`, so the same information must exist as text.

Find the world section markup at `src/main.ts:57`:

```
<section aria-labelledby="world-heading"><h2 id="world-heading">Synthetic training water</h2><div id="world"></div></section>
```

Replace it with:

```
<section aria-labelledby="world-heading"><h2 id="world-heading">Synthetic training water</h2><div id="world"></div><p id="world-text" role="note"></p></section>
```

Next to the existing `const world = requiredElement<HTMLElement>('#world');` (around `src/main.ts:99`) add:

```ts
const worldText = requiredElement<HTMLElement>('#world-text');
```

Then, in the same place the render loop calls `projection.render(session)`, add the text update. Import the derivation at the top of `src/main.ts`:

```ts
import { projectSessionWorldView } from './render/session-view.js';
```

and write the text alternative:

```ts
const worldView = projectSessionWorldView(session);
worldText.textContent = worldView === undefined
  ? 'This lesson declares no synthetic world position, so no track is drawn.'
  : `Synthetic track: ${worldView.trail.length} recorded positions. ` +
    (worldView.mark
      ? `Declared mark ${worldView.mark.label} is ${Math.hypot(worldView.mark.position.x - worldView.position.x, worldView.mark.position.y - worldView.position.y).toFixed(0)} m away, arrival radius ${worldView.mark.arrival_radius_m} m. `
      : 'This lesson declares no virtual mark. ') +
    `Declared under-keel clearance state: ${worldView.clearance_level ?? 'not computed for this lesson'}. ` +
    'Synthetic and unvalidated — not a chart, sounding, bearing, or navigational display.';
```

- [ ] **Step 4: Add smoke coverage**

Add to `tests/smoke/app.spec.ts`:

```ts
test('renders a moving synthetic track and a declared mark distance for L04', async ({ page }) => {
  await page.goto('/');
  await startSession(page, 'L04');
  const worldText = page.locator('#world-text');
  await expect(worldText).toContainText('Synthetic track:');
  await expect(worldText).toContainText('Declared mark W1');
  await expect(worldText).toContainText('not a chart, sounding, bearing, or navigational display');
  const before = await worldText.textContent();
  for (let index = 0; index < 12; index += 1) await page.keyboard.press('ArrowRight');
  await page.waitForTimeout(800);
  // The recorded-position count and the mark distance both move as the boat sails.
  await expect(worldText).not.toHaveText(before ?? '');
});

test('says plainly when a lesson declares no world position', async ({ page }) => {
  await page.goto('/');
  await startSession(page, 'L02');
  await expect(page.locator('#world-text')).toContainText('declares no synthetic world position');
});
```

- [ ] **Step 5: Run the full verification**

```bash
npm run typecheck
npm test
npm run build
npm run test:smoke
git diff --name-only tests/fixtures/   # must print nothing
```
Expected: all green; smoke 25/25.

- [ ] **Step 6: Commit**

```bash
git add src/render/world-projection.ts src/main.ts tests/smoke/app.spec.ts
git commit -m "feat(render): draw the boat, its drift trail and the declared mark"
```

---

### Task 4: Record the renderer in the status documents

**Files:**
- Modify: `docs/PROJECT_STATUS.md`
- Modify: `docs/architecture/training-ground-completion-matrix.md`

- [ ] **Step 1: Capture the real numbers**

```bash
npm run typecheck
npm test
npm run build
npm run test:smoke
```
Write down the observed counts; use those, not the ones this plan predicts.

- [ ] **Step 2: Update `docs/PROJECT_STATUS.md`**

- Refresh the verification table with the observed counts.
- In the "what this work does not close" list, remove the claim that the drift trail is unvisualised if it is present there, and add what the renderer still does not draw: waves, wind, current arrows, depth terrain, coastline, hazard zones, camera zoom or pan.
- Note that the canvas remains `aria-hidden` with a text alternative, and that the boat glyph is a symbol rather than a scale drawing.

- [ ] **Step 3: Update the completion matrix**

Add the renderer to the L04 and L06 rows' debrief/visual facets: the boat is drawn at its declared position rotated to its declared heading, the trail is the recorded position history, and the mark carries its declared arrival radius. Keep the `DECLARED_SYNTHETIC_ONLY` status — drawing a value does not validate it. Do not touch the L01, L02, L03 or L05 rows.

- [ ] **Step 4: Verify and commit**

```bash
npm test
git diff --name-only    # only the two documentation files
git add docs/PROJECT_STATUS.md docs/architecture/training-ground-completion-matrix.md
git commit -m "docs: record the world renderer"
```

---

## Completion criteria

- [ ] `npm run typecheck`, `npm test`, `npm run build`, `npm run test:smoke` all pass
- [ ] `git diff --name-only tests/fixtures/` is empty across every task — the renderer reads simulation state and never changes it
- [ ] The boat moves and rotates on screen as ticks advance
- [ ] The trail lengthens by one point per tick and its last point is the boat's current position
- [ ] The mark shows an edge indicator with a distance while off-screen, and a circle with its arrival radius once on-screen
- [ ] Every rendered label and the text alternative read as synthetic and unvalidated
- [ ] The canvas stays `aria-hidden` and its information is available as text
