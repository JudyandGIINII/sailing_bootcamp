# Sailing Bootcamp Prototype Audit & Next-Step Plan

> **For Hermes:** 이 계획의 구현 단계는 `orca-codex-primary-hermes-qa`를 따라 독립 Orca worktree에서 Codex primary lane으로 수행한다. **이 문서는 구현·release·배포·Git 권한이 아니다.**
>
> 작성일: 2026-07-19 KST · 기준 커밋: `aaf1db8` (`main`, clean at audit start)

**Goal:** 현재 `training-sloop-v1` L01–L05 assumption-only prototype의 실제 구현 범위를 PRD와 분리해 확정하고, 도메인 검증 → P1 품질 근거 → 제한적 release 후보 평가로 이어지는 승인-의존 후속 경로를 만든다.

**Architecture:** 현 구현은 Strict TypeScript/Vite 기반의 renderer-independent deterministic core, PixiJS projection, DOM HUD/debrief, IndexedDB local replay로 구성된 **교육용 prototype shell**이다. 실제 항해/안전/항법 수치가 아닌 선언형 synthetic state와 versioned replay identity를 다루며, release gate는 fail-closed여야 한다.

**Tech Stack:** TypeScript 5.9, Vite 8, PixiJS 8, Vitest 4, Playwright 1.61, IndexedDB.

---

## 0. 2026-07-19 Controller Audit Snapshot

### Verified now

| Area | Evidence | Verdict |
|---|---|---|
| Build integrity | `npm run typecheck`, `npm test` (**61 passed**), `npm run build`, `git diff --check` all passed on `main` | Pass |
| Chromium prototype flow | `npm run test:smoke`: **6 passed**; keyboard-only L01, L02–L05 selection/controls, local replay delete/preservation, focus/reduced-motion, no beacon/WebSocket check | Pass for the stated prototype target only |
| Deterministic/replay boundary | `src/sim/session.ts`, `src/contracts/replay.ts`, `tests/contracts/replay.test.ts`, `tests/contracts/sim-boundary.test.ts` | Implemented as a contract/prototype mechanism |
| Local-only persistence | `src/storage/replays.ts`, smoke tests, no backend/account/analytics dependencies | Implemented for the tested browser flow |
| Release fail-closed behavior | `src/contracts/release.ts`, `src/gates/eligibility.ts`, `artifacts/release-evidence/ap-0c.json`, `node scripts/build-release-evidence.mjs --validate` | Correctly **BLOCKED** |

### Documentation reconciliation completed during this audit

- `docs/PROJECT_STATUS.md` now distinguishes the implemented/verified AP-0C prototype load/prototype gates from the separately **blocked** release gate.
- `prd.md` remains Draft v0.3 because its domain-validation and P1 approval decisions are deliberately unresolved; draft status is not a claim that the prototype code is absent.
- Independent Alfred read-only audit `ALF-20260719-1405-sailing-code-status-plan` validated this coverage and ranked domain review, release authority, and P1 approvals as the first three blockers.

### Known functional limits — do not over-claim

1. `src/sim/session.ts` deliberately exposes `heading`, `COG`, true/apparent wind as `declared-unavailable` and L02–L05 as named synthetic checkpoints. It is not yet an executable environmental/boat model for PRD FR-02, FR-04, or FR-05.
2. `src/scoring/projection.ts` returns zero points and has no normal runtime producer of `SAFETY_BLOCKED`; it verifies non-offsettable-score *shape*, not a validated safety scoring system.
3. The current L02–L05 UI is an assumption-labelled interaction path, not evidence that trim/gust/current/tide/depth/visibility values or real safety semantics are correct.
4. Chromium is a prototype-development baseline only. `playwright.config.ts` has no named WebKit/Firefox projects; current evidence records both as `inconclusive`, never supported.
5. All five registry records in `docs/content/domain-validation-registry.yaml` are `assumption` with draft version bindings; no release decision is permitted.
6. The existing release-evidence artifact validates structurally but records base `ac9b43f`, not current `aaf1db8`; it is evidence of a fail-closed mechanism, not a current-HEAD release proof.
7. `tests/contracts/release-evidence.test.ts` regenerates a tracked artifact during ordinary `npm test`; release/CI evidence generation must be split from a no-write validation lane before it can serve as audit-grade evidence.

## 0.1 AP-0D P0 execution update (2026-07-19)

The user authorized the bounded G0 P0 remediation. It was committed as `00c34b3` and fresh-integrated as `0e84d85`, with controller evidence of strict typecheck, 87 Vitest tests, 7 Chromium smokes, production build, diff check, unchanged historical evidence hashes, and an independent re-review approval. The worktree implementation enforces manifest action authority across keyboard/direct/replay paths and uses explicit subject-revision evidence commands with external or ignored generated output. It does **not** alter registry dispositions, release authority, domain values, or release status. Shared `main`/remote integration is a separate Git operation.

## Approval Map

| Gate | Required authority | What becomes allowed | What remains forbidden |
|---|---|---|---|
| G0 — prototype maintenance | Explicit AP-0D scope from user | Only the bounded source/tests stated in the approval | Release, deployment, force override, unreviewed domain values |
| G1 — controlled domain apply | Qualified reviewer + documented controlled-apply decision | Replace specific assumptions only with evidence-bound validated content | Inferred thresholds, real navigation claims |
| G2 — P1 quality artifacts | Named approvers for browser/accessibility/pilot/operations/replay/privacy evidence | Candidate support matrix and quality validation | Release claim before all artifacts are valid |
| G3 — release candidate | Separate explicit release authority | Regenerate release evidence and perform bounded release QA | Release if any validator/P1 binding is missing, draft, stale, rejected, or incompatible |

## Phase 1 — Preserve and tighten the prototype contract (G0 authorization required)

**Objective:** Close prototype-level product/contract gaps without upgrading its safety or navigation authority.

**Files to inspect/modify only after approval:**
- `src/sim/session.ts`
- `src/app/input.ts`
- `src/main.ts`
- `src/content/l02-l05.ts`
- `src/gates/eligibility.ts`
- `tests/unit/sim-session.test.ts`
- `tests/unit/l02-l05.test.ts`
- `tests/contracts/eligibility.test.ts`
- `tests/smoke/app.spec.ts`

### Task 1.1 — Manifest-driven action enforcement

1. Write failing contract tests proving a lesson rejects every action outside its own `permitted_actions`, including keyboard actions globally known by `normalizeKeyboardAction`.
2. Confirm the test fails because the current UI calls `evaluateLessonLoad(..., [])` for L02–L05 and `applyCanonicalInput` can ledger a globally recognized, lesson-inapplicable action.
3. Refactor input dispatch so the active manifest is authoritative; unsupported actions must be ignored/blocked with a stable prototype-safe reason and not become `ACTION_ACCEPTED` ledger events.
4. Test L02–L05 allowed paths and negative action cases.
5. Run: `npm test -- tests/contracts/eligibility.test.ts tests/unit/l02-l05.test.ts tests/unit/input.test.ts`.

**Acceptance:** No keyboard/control path can claim a lesson action that its manifest forbids; replayed input has the same protection.

### Task 1.2 — Make the declared prototype state visibly complete, not falsely numeric

1. Write UI/unit tests requiring each lesson to expose its manifest’s required observations as either a versioned synthetic value or an explicit unavailable declaration.
2. Add a single typed observation projection rather than duplicating labels in `src/main.ts`.
3. Preserve the visible `Simulation-only`, `Unvalidated`, and non-navigation status; do not add real-world units, thresholds, or advice.
4. Run: `npm run typecheck && npm test && npm run test:smoke`.

**Acceptance:** FR-02/FR-04/FR-05 are either explicitly shown as *unimplemented prototype observations* or represented by traceable synthetic content; no empty label is mistaken for a working model.

### Task 1.3 — Separate safety-score scaffolding from scoring claims

1. Add failing tests proving the prototype only emits `SAFETY_BLOCKED` when a lesson contract explicitly authorizes a synthetic safety event.
2. Keep `total_points: 0` and a `pending validation` status until G1; prohibit speed/score promotion in unvalidated lessons.
3. Add a causal event/debrief assertion for the blocked synthetic branch without selecting a real-world safety threshold.
4. Run: `npm test -- tests/unit/projection.test.ts tests/unit/sim-session.test.ts`.

**Acceptance:** The app neither fabricates safety scoring nor leaves an unreachable `SAFETY_BLOCKED` path presented as implemented safety behavior.

### Task 1.4 — Test/evidence hygiene and remaining NFR baseline

1. Split `scripts/build-release-evidence.mjs` into an explicit artifact-generation command and a no-write validation command; ordinary `npm test` must not update a tracked release-evidence artifact.
2. Add the exact Git revision and evidence-generation timestamp to generated release evidence, then assert validation rejects stale/mismatched revision evidence for a release candidate.
3. Add a declared prototype speed-control UI or explicitly narrow the current prototype acceptance boundary; the current scheduler cadence is fixed and does not meet the PRD's stated speed-control NFR.
4. Add tests that the local-only network policy denies unexpected same-origin API calls too, not only cross-origin/beacon/WebSocket calls.
5. Run the standard verification bundle, then verify a clean `git status --short` after every no-write test lane.

**Acceptance:** Controller/CI validation is reproducible, writes no evidence artifact unless explicitly requested, and never treats historical-base evidence as proof for the current revision.

## Phase 2 — Domain validation and controlled content apply (G1; non-code first)

**Objective:** Turn selected simulation assumptions into auditable educational claims only after qualified review.

**Required inputs:** `docs/content/domain-validation-registry.yaml`, `docs/content/mandatory-lessons-l01-l05.md`, the controlled-apply runbook, reviewer qualification evidence, source snapshots, and a dated review record.

1. Prepare one review packet per L01–L05 that lists every model/score/threshold/polar/depth/reef assumption, evidence source, intended educational claim, and explicit non-navigation limitation.
2. Have the identified qualified reviewer record `validated`, `partially_validated`, or `rejected` disposition for each exact version binding. Do not mass-promote records.
3. For each accepted change, record concrete scenario/model/boat-profile/contract/coordinate/determinism/comparison-policy version values and stale/expiry rules.
4. Apply only approved changes through the documented controlled-apply process; rejected or unresolved lessons stay assumption-only or are omitted from a later candidate.
5. Add regression fixtures for every approved semantic change before changing UI/model behavior.

**Acceptance:** A registry record is never changed from `assumption` merely because a test passes; it has reviewer, source/evidence, concrete compatible bindings, disposition, date, and stale rule.

## Phase 3 — Implement validated learning behavior incrementally (G0 + G1, one lesson at a time)

**Objective:** Replace semantic placeholders with deterministic educational behavior, retaining replay compatibility and safety limits.

Order: L01 → L02 → L03 → L04 → L05. Do not combine all lessons into one diff.

For each lesson:
1. Create a domain-approved scenario fixture and failing deterministic simulation test.
2. Implement the smallest pure simulation state transition in `src/sim/`; keep DOM/Pixi/storage/network/wall-clock/randomness outside it.
3. Add a raw state/event golden fixture, then a score/debrief causality fixture.
4. Project the approved synthetic observation and debrief into `src/main.ts` without presenting it as real sailing guidance.
5. Add a keyboard/accessibility and local-replay smoke case.
6. Run `npm run typecheck`, focused Vitest, full `npm test`, `npm run test:smoke`, `npm run build`, and `git diff --check`.

**Acceptance:** Each lesson has a separately traceable domain-record binding, deterministic replay equality, causal debrief, and no safety/score rule that can be offset by speed.

## Phase 4 — P1 release-quality evidence (G2; no release yet)

**Objective:** Produce approval-ready evidence artifacts, not merely more test files.

### Task 4.1 — Browser and accessibility matrix

- Add named Playwright projects only for browser/OS targets that the team intends to support.
- Install/configure the required browser engines in the isolated worktree; run keyboard-only, visible-focus, non-color, reduced-motion, storage, and local-only network checks per named target.
- Record pass/inconclusive/failure truthfully. A configured-but-failing engine blocks its claimed support.

### Task 4.2 — Performance and input-latency budget

- Define a reviewed, hardware/viewport-specific prototype measurement procedure; do not invent generic thresholds.
- Collect repeatable local evidence with model/content versions, device class, test time, and method.

### Task 4.3 — Pilot, operations, replay-compatibility, privacy

- Create versioned P1 manifests with `artifact_id`, scope, evidence reference, approver/disposition/date, expiry/stale rule, and rollback/incompatibility references.
- Keep replay/telemetry local-only unless a separately approved consent/retention/deletion/export policy exists.
- Rehearse model/content rollback and incompatible replay handling on disposable local records.

**Acceptance:** P1 documents carry actual approval/evidence data; a file’s presence alone cannot satisfy a release gate.

## Phase 5 — Release candidate decision (G3 explicit release authority required)

1. Re-run all validation and release checks in a clean isolated worktree.
2. Regenerate and validate `artifacts/release-evidence/ap-0c.json` (or its versioned successor) from current evidence, not a historical result.
3. Verify all target lessons have `validated`, non-draft, mutually compatible version bindings and every P1 manifest is approved/current.
4. Have Hermes perform independent typecheck, full unit/contract suite, named-browser smoke suite, production build, diff check, and release-gate verification.
5. Stop and report `BLOCKED` on the first unmet prerequisite. No force override exists.
6. Only after a separate user release instruction may commit/push/deploy procedures be considered.

**Acceptance:** `release_eligible:true` can exist only with complete G1/G2/G3 evidence; it must never be created by code-only changes.

## Standard Verification Bundle

```bash
npm run typecheck
npm test
npm run test:smoke
npm run build
git diff --check
node scripts/build-release-evidence.mjs --validate
git status --short --branch
```

For any declared multi-browser support, additionally run the exact named Playwright projects and record their actual outcomes.

## Current Next Decision

No implementation should start automatically. Choose one:

1. **Keep prototype frozen:** only retain/monitor the fail-closed release gate.
2. **Authorize AP-0D prototype maintenance:** begin Phase 1 only in an Orca worktree; no domain-value/release work.
3. **Start domain-review preparation:** begin Phase 2 documents/reviewer workflow, with no promotion to `validated` until controlled review completes.
