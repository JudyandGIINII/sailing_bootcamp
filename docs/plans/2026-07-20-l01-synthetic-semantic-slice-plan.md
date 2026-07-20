# L01 Synthetic Wind/Course Semantic Slice — Implementation Plan

> **For Hermes:** Execute only through an isolated Orca/Codex worktree after a new explicit user source-slice approval. Use a Claude Code read-only review and Hermes independent QA before any commit.

- **Plan ID:** `ALF-20260720-2240-l01-synthetic-semantic-slice`
- **Planning disposition:** `PLAN_REQUIRES_USER_APPROVAL`
- **Planning base:** `56b13c6584cc32b1cf700f05f29d6abe0e02534c`
- **Goal:** Replace L01’s four `declared_unavailable` observation gaps—true wind, apparent wind, heading, and COG—with one deterministic, versioned, **synthetic-only** educational model and replayable causal evidence.

**Architecture:** Add a pure TypeScript L01 synthetic-kinematics model beneath the existing session/ledger/replay architecture. Inputs are a versioned immutable synthetic profile and canonical `logical_tick + sequence` controls; the model produces immutable state and observations, session records causal ledger events, and the existing renderer/HUD only projects those results.

**Tech stack:** TypeScript, existing Vite/Vitest/Playwright/PixiJS/DOM/IndexedDB stack; no new dependency.

---

## Scope and non-negotiable boundary

### In scope

- Versioned immutable L01 synthetic environment/model identity.
- Pure fixed-step heading, Cartesian displacement, COG, true-wind and apparent-wind vector calculation.
- Immutable transition ledger and ledger-derived L01 debrief facts.
- Complete replay identity, round-trip replay, and fail-closed incompatibility handling.
- Accessible browser presentation of the four synthetic observations and a persistent non-navigation boundary.

### Out of scope

- Real sailing physics, hull dynamics, polar tables, trim, heel, leeway, current, wave response, collision, coastline, geography, live data, historical packages, or advice.
- P1/P1B scenario values as simulation authority.
- L02–L05, multiple boats, backend/account/analytics, deployment, release, registry promotion, PRD or contract revision.
- Real-world performance, safety, navigation, certification, browser-support, or release claims.

### Synthetic fixture rule

The model profile may use numeric values only as versioned test-fixture assumptions. They must be visibly labelled synthetic and must never be represented as vessel performance, environmental truth, or a safety threshold.

---

## Required approval before implementation

A future source-change authorization must name this exact bounded slice:

> Approve source implementation of **L01 versioned synthetic wind/course semantic slice** according to `ALF-20260720-2240-l01-synthetic-semantic-slice` and this plan. Scope is limited to L01 synthetic state/observations/replay/ledger/HUD/test work. It does not authorize registry changes, P1/P1B core coupling, L02–L05, release, deployment, real-world navigation/safety claims, or external data.

Without that explicit approval, this document is planning only.

---

## Acceptance criteria

1. Only L01 true wind, apparent wind, heading, and COG transition from unavailable to explicitly **synthetic computed observations**.
2. Same complete replay identity and ordered logical controls produce byte-stable canonical state/observations/ledger/checkpoint/debrief outputs under the versioned comparison policy.
3. Heading normalizes to the coordinate contract convention; COG derives from displacement, not copied heading; apparent wind derives from relative vectors.
4. Missing, unknown, changed, or incompatible model/environment identity fails closed before replay execution; legacy incomplete records remain preserved and unsupported.
5. The simulation core imports no renderer, DOM, storage, network, wall-clock, or unseeded-random dependency.
6. Existing L01 helm-correction checkpoint remains immutable and is causally linked to the transition record rather than replaced.
7. P1/P1B values remain scenario/replay/UI-only and do not enter authoritative L01 calculations.
8. HUD/debrief display synthetic, unvalidated, non-navigation wording and semantic text labels without color-only meaning.
9. Typecheck, full Vitest, Chromium smoke, production build, and `git diff --check` pass. Registry assumptions and release-negative behavior remain unchanged.

---

## Task 0: Baseline and approval gate

**Objective:** Prevent scope or baseline drift before any mutation.

**Files:**
- Read: `AGENTS.md`, `prd.md`, `docs/contracts/coordinate-contract.md`, `docs/contracts/determinism-replay-contract.md`, `docs/content/domain-validation-registry.yaml`
- Read: `src/content/l01.ts`, `src/sim/session.ts`, `src/scoring/projection.ts`, `src/contracts/replay.ts`

**Steps:**
1. Verify the explicit source-slice approval and pin the new Orca worktree to the approved current `origin/main` revision.
2. Record `git status --short --branch`, `git diff --stat`, `git log -3 --oneline --decorate`.
3. Run the untouched baseline:

```bash
npm run typecheck
npm test
npm run test:smoke
npm run build
git diff --check
```

**Expected:** Green baseline; otherwise stop and return a drift/failure report rather than modifying source.

---

## Task 1: Versioned synthetic profile and replay identity (RED → GREEN)

**Objective:** Define one immutable L01-only synthetic model profile without letting scenario UI data become authoritative.

**Files:**
- Create: `src/contracts/l01-synthetic-environment.ts`
- Modify: `src/content/l01.ts`
- Modify: `src/contracts/replay.ts`
- Test: `tests/contracts/replay.test.ts`
- Test: `tests/contracts/sim-boundary.test.ts`

**Step 1 — failing tests**

Add tests that reject a profile or replay with:
- missing model/environment ID or version;
- omitted profile field;
- unknown version;
- non-finite numeric input;
- non-positive synthetic forward speed;
- mutable profile/input object;
- altered profile, initial state, or ordered controls.

Add a boundary test proving `src/contracts/l01-synthetic-environment.ts` and its imports have no browser/renderer/persistence/network/clock/random dependency.

**Step 2 — minimal contract**

Create an immutable typed profile with, at minimum:

```ts
interface L01SyntheticEnvironmentV1 {
  readonly environment_id: 'l01-synthetic-training-ground';
  readonly environment_version: 1;
  readonly model_id: 'l01-synthetic-kinematics';
  readonly model_version: 1;
  readonly logical_step_seconds: number;
  readonly initial_position_m: Readonly<{ x: number; y: number }>;
  readonly initial_heading_rad: number;
  readonly forward_speed_mps: number;
  readonly true_wind_from_rad: number;
  readonly true_wind_speed_mps: number;
  readonly full_helm_turn_rad_per_step: number;
  readonly canonical_precision_version: 'l01-precision-v1';
}
```

Keep fixture constants in one frozen profile. Every UI/debrief use of the profile must carry synthetic/unvalidated terminology.

**Step 3 — replay binding**

Add the complete environment/profile identity to the existing canonical replay path. No legacy defaulting, V1 fallback, or P1/P1B field substitution is permitted.

**Step 4 — focused verification**

```bash
npm test -- tests/contracts/replay.test.ts tests/contracts/sim-boundary.test.ts
npm run typecheck
```

**Expected:** Invalid/incomplete identity fails before execution; valid identity remains immutable.

---

## Task 2: Pure L01 transition and observations (RED → GREEN)

**Objective:** Implement only deterministic synthetic Cartesian kinematics and relative-wind observation math.

**Files:**
- Create: `src/sim/l01-synthetic-model.ts`
- Create: `src/sim/l01-observation.ts`
- Test: `tests/unit/l01-synthetic-model.test.ts`
- Test: `tests/unit/l01-observation.test.ts`

**Step 1 — failing tests**

Cover:
- north/east/south/west headings and `[0, 2π)` angle wrap;
- `logical_tick + sequence` ordered helm input application;
- positive-forward-speed Cartesian displacement;
- COG derived from displacement;
- wind-**from** to flow-vector conversion;
- apparent wind = true flow-to vector − boat water-relative velocity;
- finite numeric rejection;
- canonical numeric precision;
- repeated deep equality and no mutation of input/state objects.

**Step 2 — minimal pure implementation**

Implement functions with these boundaries:

```ts
transitionL01SyntheticState(profile, priorState, orderedControls): L01SyntheticTransition
projectL01SyntheticObservations(profile, transition): L01SyntheticObservations
```

Rules:
- canonical heading uses north-zero/clockwise-positive internal radians;
- velocity is derived from positive forward speed and heading;
- `x` advances east and `y` advances north using fixed logical seconds;
- COG comes from displacement vector;
- true wind retains wind-from convention;
- apparent wind derives from relative flow vector and is converted back to wind-from representation;
- canonicalize only with the versioned precision rule before authoritative serialization.

**Step 3 — focused verification**

```bash
npm test -- tests/unit/l01-synthetic-model.test.ts tests/unit/l01-observation.test.ts
npm run typecheck
```

**Expected:** Equal profile/state/controls produce equal canonical state and observations independent of renderer cadence.

---

## Task 3: Session, immutable ledger, and debrief (RED → GREEN)

**Objective:** Integrate the pure L01 model while preserving current action policy and existing checkpoint semantics.

**Files:**
- Modify: `src/sim/session.ts`
- Modify: `src/scoring/projection.ts`
- Modify: `src/content/l01.ts`
- Test: `tests/unit/sim-session.test.ts`

**Step 1 — failing tests**

Add assertions for:
- one deterministic transition event per authoritative L01 logical tick;
- event order follows logical tick then sequence;
- event includes model/environment identity, prior/next state, accepted helm value, and resulting observations;
- direct/canonical denied actions cause no transition/event/checkpoint mutation;
- existing `declared helm correction recorded` checkpoint remains immutable and references the corresponding transition event;
- score/debrief facts are calculated from ledger events, not renderer/HUD state;
- all L01 semantic wording remains qualified as synthetic.

**Step 2 — minimal integration**

Call pure transition/observation code only from authoritative L01 session progression. Append frozen causal ledger records. Do not replace the existing checkpoint. Add only ledger-derived debrief projection; do not create correctness, route, performance, or safety outcomes.

**Step 3 — focused verification**

```bash
npm test -- tests/unit/sim-session.test.ts
npm run typecheck
```

---

## Task 4: Replay round-trip and fail-closed rejection (RED → GREEN)

**Objective:** Prove model outputs are replayable only when the entire identity remains compatible.

**Files:**
- Modify: `src/contracts/replay.ts`
- Modify: `tests/contracts/replay.test.ts`
- Modify: `tests/unit/sim-session.test.ts`
- Update/create only necessary golden fixtures under `tests/fixtures/`

**Steps:**
1. Add a complete record/serialize/load/replay equality test over final state, observations, transition ledger, helm checkpoint, score/debrief.
2. Test missing identity, unknown version, reordered controls, altered environment field, altered initial state, and incomplete legacy record.
3. Require rejection before playback with a stable non-sensitive reason and preservation of original local payload.
4. Add/update golden fixtures only after review of changed contract/version fields.

**Verification:**

```bash
npm test -- tests/contracts/replay.test.ts tests/unit/sim-session.test.ts
```

---

## Task 5: Projection and accessibility (RED → GREEN)

**Objective:** Present immutable synthetic observations without making the UI authoritative.

**Files:**
- Modify: `src/main.ts`
- Modify only required readonly projection code under `src/`
- Test: `tests/smoke/app.spec.ts`

**Steps:**
1. Render true wind, apparent wind, heading, and COG exclusively from immutable session observations.
2. Render adjacent, persistent text: **“Synthetic educational model — unvalidated — not for navigation or safety guidance.”**
3. Use semantic text labels/readable values; keep keyboard controls and non-color-only status semantics.
4. Add Chromium tests for initial observation display, helm-driven synthetic change, causal debrief, local replay restoration, and no unexpected network access.
5. Confirm no presentational rounding or UI state changes canonical values.

**Verification:**

```bash
npm run test:smoke
```

---

## Task 6: Full QA, scope audit, and review

**Objective:** Prove the bounded slice without converting prototype evidence into release evidence.

**Steps:**
1. Inspect changed files against the permitted L01 allow-list.
2. Search diff for P1/P1B authoritative imports, real-world claims, registry changes, L02–L05 changes, and prohibited dependencies.
3. Run:

```bash
npm run typecheck
npm test
npm run test:smoke
npm run build
git diff --check
git status --short --branch
```

4. Request a Claude Code **read-only** review focused on formulas, coordinate/wind-from direction, replay identity, ledger provenance, accessibility disclosure, and unchanged registry/release gates.
5. Hermes independently validates all tests and the browser surface before any future commit decision.

**Stop immediately if:** a real-world value/threshold is needed; P1/P1B coupling is required; replay needs silent defaulting; an observation depends on renderer/wall-clock/network/storage/randomness; deterministic equality fails; accessibility disclosure cannot be proven; or the baseline itself fails.

---

## Rollback

Keep the implementation as one isolated source/test increment. If it regresses, revert state/profile/replay/ledger/HUD changes together and restore the declared-unavailable L01 projection; do not preserve partial semantic claims. Incompatible local replays remain preserved and explicitly unsupported. No deployment, registry, release, or production-data rollback is relevant.
