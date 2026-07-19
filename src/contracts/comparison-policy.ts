/**
 * This draft locks only which replay outputs are compared. It intentionally
 * contains no domain thresholds, safety limits, or real-world sailing values.
 */
export const comparisonPolicyV1Draft = {
  version: 'comparison-policy-v1-draft',
  canonical_outputs: ['state', 'event', 'score', 'debrief'],
  comparison: 'exact-structural',
} as const;

export type CanonicalComparisonOutput =
  (typeof comparisonPolicyV1Draft.canonical_outputs)[number];
