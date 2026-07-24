# Scenario 1 Synthetic Score Calibration v2

> **Status:** User-approved planning contract — **not implementation authority**.
> **Approval record:** 2026-07-23–24 KST; synthetic calibration and course-control baseline confirmed.
> **Boundary:** All targets, weights, thresholds, curves, and penalties in this document are synthetic game calibration only. They are not sailing, navigation, performance, safety, certification, or real-world operating guidance.

## 1. Product-visible score behavior

- The HUD shows one integer **0–100 composite score** during play.
- Detailed contributors are debrief-only.
- `End Voyage` is available at any time. The debrief freezes the exact score already visible at that logical instant; it does not advance another tick.
- A deterministic environment event or a stability pacing trigger may change canonical scenario state and its named target profile, but neither event occurrence nor stability itself adds/removes score.
- Equivalent replay identity must reproduce event order, target-profile changes, score timeline, and debrief independently of renderer cadence.

## 2. Approved synthetic component allocation

Each canonical scoring tick uses three integer-basis-point components. Their weights must total exactly `10000` and may never be defaulted, omitted, or redistributed.

| Component | Weight | Synthetic meaning |
|---|---:|---|
| `sail_wind_fit` | `5000` (50%) | Fit against explicit authored sail/deployment/trim targets in the active profile. |
| `course_control` | `3000` (30%) | Heading error against the active profile's synthetic target heading only. |
| `propulsion_context` | `2000` (20%) | Explicit authored engine-context rule, subject to the unresolved curve gate below. |

For present and fully authored contributors `q_i(t) ∈ 0..10000`:

```text
N(t)     = Σ(weight_i × q_i(t))
score(t) = clamp(0, 100, floor((N(t) + 500000) / 1000000))
```

The formula reads only canonical state at logical tick `t`. It must not read wall time, renderer frames, browser event timestamps, raw pointer count, or prior score/history.

## 3. Approved target-heading course rule

Every active `target_profile_id` must resolve to an immutable, versioned synthetic target profile containing at least:

```text
profile_id
profile_version
synthetic_target_heading_degrees
sail/deployment/trim targets
propulsion-context rule identifier
```

`course_control` is calculated **only** from the absolute angular error between canonical current heading and `synthetic_target_heading_degrees`:

```text
error = absoluteShortestAngle(current_heading, synthetic_target_heading_degrees)
course_q = 10000                                when error <= 2°
course_q = linear fall from 10000 to 0          when 2° < error < 30°
course_q = 0                                    when error >= 30°
```

No wind, wave, current, weather, gust, route, location, or inferred real-world rule may change the course target or course score. An environment event may replace the target profile only when its deterministic replay-visible payload names that replacement profile.

## 4. Approved propulsion calibration parameters

All values use a normalized canonical engine-output scale of `0..10000`:

| Parameter | Approved synthetic value |
|---|---:|
| Engine-only penalty start | `500` |
| Sails-deployed high-output penalty start | `6500` (strictly above) |
| Engine-only maximum penalty | `6000` |
| Sails-deployed high-output maximum penalty | `8000` |

The approved qualitative contexts are:

1. In authored `sailing_capable` context, engine-only use is penalized after its approved start threshold.
2. In authored `marina` or `low_speed` context, propulsion receives no engine penalty.
3. In authored `sailing_capable` context, output strictly above `6500` while main or jib is deployed is penalized.
4. Forward and reverse use the same absolute synthetic magnitude; neutral is not an engine-use penalty.

### Explicit implementation hold — no invented engine curve

The approvals fix thresholds and caps but **do not define how a penalty progresses between a threshold and its cap**, nor whether the two penalties combine, choose one, or use another explicitly authored policy. A future code scope must first add a versioned, user-approved propulsion curve/composition rule plus boundary fixtures.

Until that decision is made, an implementation must fail closed for a profile lacking the required propulsion rule: it must not infer, interpolate, default, redistribute the 20% weight, or claim a complete composite score. This hold is a planning/implementation boundary, not a real-world safety conclusion.

## 5. Required future verification after separate implementation approval

1. Course fixtures prove `0°`, `2°`, `>2°`, `<30°`, `30°`, and `>30°` errors against a named profile, including shortest-angle wraparound.
2. Missing/unregistered/unversioned target profiles fail closed before score/debrief output and do not mutate ledger/checkpoint state.
3. At the same canonical tick/state, score is independent of renderer cadence, event history, and browser timestamps.
4. Event-profile changes are deterministic and replay-visible; no environment field infers a new target heading.
5. Propulsion fixtures cover both thresholds, `marina`, `low_speed`, neutral, forward, reverse, deployed/non-deployed sail state, and the eventual explicitly approved curve/composition rule.
6. `End Voyage` freezes the visible integer score/contributor snapshot without another tick; replay reproduces the same result.
7. UI labels state that this is synthetic game calibration and make no real-world navigation, safety, performance, or certification claim.

## 6. Scope and authority

This contract changes no source, dependency, registry, replay format, backend, analytics, authentication, sharing, access control, deployment, release, or public-access policy. It is a durable planning input only. A separate explicit user authorization is required before any Scenario 1 source implementation worktree is created.