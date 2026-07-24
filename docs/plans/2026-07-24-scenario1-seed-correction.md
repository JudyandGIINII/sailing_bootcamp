# Scenario 1 Corrected Seed — Decision and QA Record

**Date:** 2026-07-24 KST
**Interview:** `interview_20260723_111744`
**Original generated Seed:** `seed_d5fffe901d94`
**Corrected planning Seed:** `seeds/scenario1-first-playable-planning-v1.yaml`
**Status:** User-approved documentation correction; **no source implementation authority**.

## Decision record

The product owner confirmed the course-control baseline and then approved applying the complete correction set. The correction contains only recorded decisions and brownfield facts; it does not create gameplay, scoring, deployment, or access behavior.

### Recorded decisions now represented exactly

- `sail_wind_fit` / `course_control` / `propulsion_context` allocation is **50% / 30% / 20%** (`5000/3000/2000` basis points).
- Each immutable versioned target profile defines a synthetic target heading.
- Course control uses **only** absolute shortest current-heading error to that target: full score at `<= 2°`, linear decline until `30°`, and zero at `>= 30°`.
- Propulsion calibration uses normalized `0..10000` output: engine-only threshold `500`; sails-deployed high-output threshold strictly above `6500`; maximum penalties `6000` and `8000`.
- Environmental events may select only an explicitly named replay-visible target-profile replacement. They do not infer navigation, safety, performance, or other real-world rules.
- The repository is a brownfield Strict TypeScript/Vite/Pixi browser project with pure canonical simulation, logical tick/sequence input authority, Replay V2 fail-closed behavior, and browser-local storage only.

## Initial Seed QA finding and correction

Initial Seed QA returned **REVISE, 0.42/1.00** because the generated Seed incorrectly declared a greenfield project and omitted the approved calibration/target-heading contract. The correction resolves those omissions by moving the artifact to a planning Seed and attaching the normative calibration contract.

## Deliberately unresolved: propulsion curve/composition

The approved thresholds and caps do **not** state the penalty progression between threshold and cap or whether both penalties combine, choose one, or follow another authored rule. This correction intentionally does not invent one.

Before a future code authorization can claim a complete composite score, the product owner must approve one versioned synthetic propulsion curve/composition rule and its boundary fixtures. Until then, source must fail closed for any profile needing that unavailable contributor; it may not interpolate/default/reweight the 20% component.

## QA result

The corrected planning Seed passed independent structural QA at **0.96/1.00** (threshold `0.90`). The final small observability clarification names the paired artifact paths directly in the first acceptance criterion; it does not expand scope or create source authority.

## QA scope for this checkpoint

The required check is documentation/Seed consistency only:

1. YAML parses.
2. Corrected Seed contains all recorded approval values and brownfield boundaries.
3. Calibration contract and Seed agree on the target-heading, score, propulsion, local-only, and non-claim constraints.
4. Git diff contains documentation/Seed artifacts only.

No application source, dependencies, runtime contract, code-level scoring, worktree created for source implementation, deployment, tag, release, or access-policy change is authorized by this record.

## Next user decision

After this documentation checkpoint, the next material decision is not an automatic code start: define and approve the synthetic propulsion penalty curve/composition rule (or explicitly narrow Scenario 1 to score-unavailable while that component is absent), then separately authorize a bounded implementation scope.