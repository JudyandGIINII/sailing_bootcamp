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
    const positions = event.polar_transition
      ? { prior: event.polar_transition.prior_state.position_m, next: event.polar_transition.next_state.position_m }
      : event.l01_transition
        ? { prior: event.l01_transition.prior_state.position_m, next: event.l01_transition.next_state.position_m }
        : undefined;
    if (!positions) continue;
    if (points.length === 0) points.push(frozenPoint(positions.prior));
    points.push(frozenPoint(positions.next));
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
