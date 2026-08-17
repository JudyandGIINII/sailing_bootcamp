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
