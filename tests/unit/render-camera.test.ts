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
