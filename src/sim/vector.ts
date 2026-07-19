/**
 * Canonical Cartesian vector composition from the coordinate contract:
 * ground-relative velocity is water-relative velocity plus current-to velocity.
 * This is unit-agnostic arithmetic and introduces no sailing performance value.
 */
export interface CanonicalVector {
  x: number;
  y: number;
}

export function composeGroundRelativeVelocity(
  waterRelative: CanonicalVector,
  currentTo: CanonicalVector,
): Readonly<CanonicalVector> {
  return Object.freeze({
    x: waterRelative.x + currentTo.x,
    y: waterRelative.y + currentTo.y,
  });
}
