# Scenario 1 Synthetic Score Calibration v2

> **Status:** User-approved planning contract — **not implementation authority**.
> **Approval record:** 2026-07-23–24 KST; synthetic calibration and course-control baseline confirmed.
> **Boundary:** All targets, weights, thresholds, curves, and penalties in this document are synthetic game calibration only. They are not sailing, navigation, performance, safety, certification, or real-world operating guidance.

## 1. Product-visible score behavior

- The HUD shows one integer **0–100 composite score** during play.
- Detailed contributors are debrief-only.
- `End Voyage` is canonical `end_voyage` input at logical tick `T`. Inputs/events at a tick are processed in ascending canonical sequence; `end_voyage` computes the valid score/contributors after every lower-sequence event at `T`, freezes that snapshot as terminal debrief state without another tick, and makes any higher-sequence score-affecting input/event post-terminal/rejected. Replay must reproduce the same terminal tick, sequence, and snapshot.
- A deterministic environment event or a stability pacing trigger may change canonical scenario state and its named target profile, but neither event occurrence nor stability itself adds/removes score.
- Equivalent replay identity must reproduce event order, target-profile changes, score timeline, and debrief independently of renderer cadence.

## 2. Approved synthetic component allocation

Each canonical scoring tick uses three integer-basis-point components. Their weights must total exactly `10000` and may never be defaulted, omitted, or redistributed.

| Component | Weight | Synthetic meaning |
|---|---:|---|
| `sail_wind_fit` | `5000` (50%) | Fit against explicit authored sail/deployment/trim targets in the active profile. |
| `course_control` | `3000` (30%) | Heading error against the active profile's synthetic target heading only. |
| `propulsion_context` | `2000` (20%) | The approved simple synthetic engine-context rule in §4. |

For fully authored scoring ticks, `sail_wind_fit_q` is the active profile's authored/canonical contributor quality, while `course_q` and `propulsion_q` are derived-only by §§3–4 and must not be accepted as independent inputs. All three `q_i(t) ∈ 0..10000`:

```text
N(t)     = Σ(weight_i × q_i(t))
score(t) = clamp(0, 100, floor((N(t) + 500000) / 1000000))
```

`score(t)` is therefore a canonical integer in `0..100`. Missing, unregistered, invalid, or out-of-range contributor quality prevents score creation for that tick/debrief; it is never substituted with a default or redistributed weight. The deterministic result is `score_status = unavailable_invalid_input` with one stable reason from `{invalid_replay_input, invalid_fixture_identity, invalid_profile, invalid_heading, invalid_context, invalid_contributor}`; the HUD/debrief show that non-numeric status, and replay comparison requires the same status/reason instead of a numeric score. The formula reads only canonical state at logical tick `t`. It must not read wall time, renderer frames, browser event timestamps, raw pointer count, or prior score/history.

## 3. Approved target-heading course rule

Every active `target_profile_id` must resolve to an immutable, versioned synthetic target profile containing at least:

```text
profile_id
profile_version
synthetic_target_heading_degrees
sail/deployment/trim targets
propulsion-context rule identifier
```

`course_control` is calculated **only** from the absolute angular error between canonical current heading and `synthetic_target_heading_degrees`. Both headings are canonical integer centidegrees normalized to `0..35999` (`0..359.99°`); malformed, missing, or out-of-range headings fail closed. Let `d = abs(current_heading_centidegrees - target_heading_centidegrees)` and `error = min(d, 36000 - d)`.

```text
course_q = 10000                                           when error <= 200
course_q = floor((3000 - error) * 10000 / 2800)             when 201 <= error <= 2999
course_q = 0                                               when error >= 3000
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

### Context outcome table

| `context` / output | Sail state | Result |
|---|---|---|
| `marina`, any `o` | any | `p=0`, `propulsion_q=10000` |
| `low_speed`, any `o` | any | `p=0`, `propulsion_q=10000` |
| `sailing_capable`, `o=0` | any | `p=0`, `propulsion_q=10000` |
| `sailing_capable`, `o>0` | both sails false | engine-only branch, `cap=6000` |
| `sailing_capable`, `o>0` | either sail true | sails-deployed branch, `cap=8000` |

### Canonical replay record rule

A score-affecting replay record is `{ logical_tick: nonnegative integer, sequence: nonnegative integer, kind: declared input/event kind, payload: canonical payload }`. The pair `(logical_tick, sequence)` is globally unique. Records are sorted lexicographically by that pair; sequence gaps are allowed and never imply a missing action, while duplicate pairs, malformed integers, or an out-of-order supplied log produce `invalid_replay_input` and no numeric score. The validation order in §4 checks replay-record shape/ordering first, then fixture identity when applicable.

### Canonical propulsion inputs

- `context` is the active profile's authored enum: `marina`, `low_speed`, or `sailing_capable`; it is not a measured speed, location, weather, or inferred classification. Unknown/missing context fails closed.
- `o` is required `integer(normalized_engine_magnitude)` in `0..10000`, equal to `abs(canonical_engine_output)`; fractions, negatives before normalization, missing, non-numeric, and out-of-range values are invalid context. `0` is neutral. Forward and reverse therefore share the same synthetic magnitude.
- `main_deployed` and `jib_deployed` are canonical booleans. Engine-only means both are `false`; sails-deployed means at least one is `true`.
- For `marina`, `low_speed`, or neutral, `p=0`, `cap` is not evaluated, and `propulsion_q=10000`. Otherwise the active branch binds its own `cap` before the conversion.

### Deterministic validation order

Validate in this exact order and emit only the first failure: (1) replay record shape/ordering, (2) fixture registry identity, (3) active profile registration/version, (4) current/target heading shape/range, (5) propulsion context, `o`, and sail-boolean shape/range, (6) authored `sail_wind_fit_q` shape/range. The corresponding reasons are `invalid_replay_input`, `invalid_fixture_identity`, `invalid_profile`, `invalid_heading`, `invalid_context`, and `invalid_contributor` respectively. A valid non-fixture runtime tick skips step 2 and starts at active profile registration after replay-record validation.

### Approved simple propulsion rule

This is deliberately minimal synthetic game calibration, not a physical/operating model. Let `o` be canonical normalized engine output and `p` the active penalty.

```text
if context in {marina, low_speed} or o == 0:
  p = 0; propulsion_q = 10000
else if main_deployed == false and jib_deployed == false:  # engine-only
  cap = 6000
  p = min(cap, max(0, o - 500))
  propulsion_q = 10000 - floor((p * 10000 + cap / 2) / cap)
else:                                                       # at least one sail deployed
  cap = 8000
  p = min(cap, max(0, o - 6500))
  propulsion_q = 10000 - floor((p * 10000 + cap / 2) / cap)
```

The penalty cases are mutually exclusive. Every active branch maps `p=0` to `propulsion_q=10000`, `p=cap` to `propulsion_q=0`, and intermediate values linearly with deterministic half-up integer rounding. Within the normalized `0..10000` range, the sails-deployed formula may not reach its configured `8000` cap; the configured cap remains part of the simple synthetic rule and must not be inferred from real-world behavior.

The composite formula in §2 applies the already approved `2000` basis-point propulsion weight; it is the same formula that combines the three `0..10000` contributor qualities into the HUD's `0..100` integer. No defaulting, interpolation beyond the formula above, context inference, weight redistribution, or real-world claim is allowed.

## 5. Normative future fixtures after separate implementation approval

Fixtures are data-only, versioned by `profile_id`, `profile_version`, and the scoring-contract version, and use canonical logical-tick inputs only. The registry key is the unique tuple `(profile_id, profile_version, scoring_contract_version, fixture_id)`; zero matches, more than one match, or any profile/contract mismatch produces `invalid_fixture_identity`. Fixtures must be ordered by fixture id and replayed through the pure simulation; no renderer, wall time, browser timestamp, storage, or network value is an input.

### Propulsion fixture table

| Fixture | Canonical context / output / sail state | `expected_p` | `expected_propulsion_q` |
|---|---|---:|---:|
| `marina-zero-penalty` | `marina`, `o=8500`, `main=false`, `jib=false` | `0` | `10000` |
| `low-speed-zero-penalty` | `low_speed`, `o=10000`, `main=false`, `jib=false` | `0` | `10000` |
| `neutral-zero-penalty` | `sailing_capable`, `o=0`, `main=false`, `jib=false` | `0` | `10000` |
| `engine-start` | `sailing_capable`, `o=500`, `main=false`, `jib=false` | `0` | `10000` |
| `engine-first-step` | `sailing_capable`, `o=501`, `main=false`, `jib=false` | `1` | `9998` |
| `engine-cap` | `sailing_capable`, `o=6500`, `main=false`, `jib=false` | `6000` | `0` |
| `sail-start` | `sailing_capable`, `o=6500`, `main=true`, `jib=false` | `0` | `10000` |
| `sail-first-step` | `sailing_capable`, `o=6501`, `main=true`, `jib=false` | `1` | `9999` |
| `sail-range-max` | `sailing_capable`, `o=10000`, `main=false`, `jib=true` | `3500` | `5625` |

### Course and composite fixtures

1. Named profile/heading pairs prove centidegree errors `0` (`0°`), `200` (`2°`), `201`, `1600` (`16°`), `2999`, `3000` (`30°`), and shortest-angle wraparound `35900 → 100`, with expected `course_q` `10000`, `10000`, `9996`, `5000`, `3`, `0`, and `10000` respectively. Missing/malformed/out-of-range headings fail closed.
2. Each fixture supplies explicit `sail_wind_fit_q`, `course_q`, and `propulsion_q` in `0..10000`; expected HUD score is exactly `floor((5000*sail_wind_fit_q + 3000*course_q + 2000*propulsion_q + 500000) / 1000000)`.
3. Missing/unregistered/unversioned target profile, context, or fixture identity prevents numeric score/debrief creation and yields `unavailable_invalid_input` plus its stable reason without mutating a numeric score/contributor checkpoint.
4. At the same canonical tick/state, score is independent of renderer cadence, event history, and browser timestamps. Event-profile changes are deterministic and replay-visible; no environment field infers a new target heading.
5. Canonical `end_voyage` at logical tick `T` is processed in ascending sequence after lower-sequence events, computes `T`, and freezes the visible integer score/contributor snapshot without another tick; higher-sequence score-affecting inputs/events are rejected as post-terminal, and replay reproduces terminal tick/sequence/snapshot. UI labels state that this is synthetic game calibration and make no real-world navigation, safety, performance, or certification claim.

## 6. Scope and authority

This contract changes no source, dependency, registry, replay format, backend, analytics, authentication, sharing, access control, deployment, release, or public-access policy. It is a durable planning input only. A separate explicit user authorization is required before any Scenario 1 source implementation worktree is created.