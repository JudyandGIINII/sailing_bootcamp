# Scenario 1 Corrected Seed — Decision and QA Record

**Date:** 2026-07-24 KST
**Interview:** `interview_20260723_111744`
**Original generated Seed:** `seed_d5fffe901d94`
**Corrected planning Seed:** `seeds/scenario1-first-playable-planning-v1.yaml`
**Status:** User-approved documentation correction with complete synthetic score contract; **no source implementation authority**.

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

## Resolved: deliberately simple propulsion rule

The product owner chose a minimal synthetic rule rather than a detailed engine model. In `marina`, `low_speed`, or neutral output, propulsion penalty is zero. Otherwise the mutually exclusive engine-only and sails-deployed formulas, their caps, and the deterministic linear conversion into the fixed 20-point contributor are recorded in `docs/design/scenario1-synthetic-score-calibration-v2.md` and the planning Seed.

The `sails-deployed` cap remains an authored synthetic configuration even if the normalized 0..10000 input range does not reach it with this intentionally simple rule. Nothing is inferred from physical sailing behavior.

## QA result

The initial corrected planning Seed passed independent structural QA at **0.96/1.00** (threshold `0.90`) after the brownfield/target-heading correction. The later simple-propulsion documentation pass verified YAML parsing, formula boundary arithmetic, contract structure, and `git diff --check` locally. Its independent evaluator remained **REVISE, 0.66/1.00** because it required a complete Replay event-kind/payload/state-transition schema beyond the user-approved engine-calibration scope. The user explicitly chose to keep the deliberately simple propulsion rule and defer that whole-Replay expansion to the separately authorized implementation phase. This checkpoint makes no source-authority claim.

## QA scope for this checkpoint

The required check is documentation/Seed consistency only:

1. YAML parses.
2. Corrected Seed contains all recorded approval values and brownfield boundaries.
3. Calibration contract and Seed agree on the target-heading, score, propulsion, local-only, and non-claim constraints.
4. Git diff contains documentation/Seed artifacts only.

No application source, dependencies, runtime contract, code-level scoring, worktree created for source implementation, deployment, tag, release, or access-policy change is authorized by this record.

## Next user decision

The scoring contract is now complete. A separate explicit bounded code-implementation authorization is required before creating or changing application source; it must name the intended Scenario 1 slice and retain the exact fixture categories in this Seed.