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
