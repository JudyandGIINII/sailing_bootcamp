# Sailing Bootcamp Kanban — Local Snapshot

> Hermes Kanban tool은 이 세션에 노출되어 있지 않아, 이 파일을 프로젝트 내부의 durable fallback board로 사용한다. 향후 Kanban 도구가 이용 가능해지면 이 상태를 동기화한다.

## Done

- [x] 2026-07-20 historical P1/P1B synthetic scenario/catalog code-feature baseline `92a8613`: strict ScenarioPackage/hash/Replay V2, deterministic variation, directions, dominant wave period, visibility, synthetic datum water level/tide phase, and exact synthetic course templates. It is an ancestor of this work’s capture-time/pre-reconciliation `646ac19` `HEAD`/`origin/main`, not a current-tip claim after the uncommitted diff. Historical verification at `92a8613`: typecheck, 127 Vitest tests, 14 Playwright smoke tests, production build, diff check, and independent source review.
- [x] Historical GitHub prerelease `v0.1.0-p1b` points to `92a8613`. It is a synthetic prototype source milestone only, not deployment or release readiness.

- [x] Product discovery, benchmark evidence, PRD v0.3
- [x] D1–D6 and C1 MVP scope decisions
- [x] L01–L05 content contracts and validation registry draft
- [x] Coach/instructor review, qualification, controlled-apply documentation
- [x] Browser technical option research and architecture recommendation
- [x] Coordinate/determinism/replay/prototype-release technical contracts
- [x] MVP implementation plan and documentation handoff
- [x] Handoff P0/P1 hardening: bootstrap-before-contract tests, canonical full replay identity, bounded AP-0 ceilings, input/storage lifecycle, P1 artifact-manifest requirements
- [x] Claude Opus independent review P1/P2 remediation: comparison-policy required binding and draft policy, explicit `contract_version` bundle meaning, non-draft validated-release invariant, immediate scheduler stop on focus/visibility loss, sim-boundary static check, Task 2A/2B split
- [x] AP-0A integrated: Vite/strict TypeScript/Vitest/Playwright bootstrap plus fail-closed replay/release/determinism contract tests; independent verification passed (15 unit tests, Chromium smoke, build)
- [x] AP-0B integrated: L01 deterministic prototype, readonly PixiJS/DOM projection, local IndexedDB replay lifecycle, 36 unit/contract tests and 3 Chromium smokes
- [x] AP-0C integrated: L02–L05 assumption-only extension, replay/storage resilience, release evidence `BLOCKED`, 61 unit/contract tests and 6 Chromium smokes
- [x] Historical post-trace capture recorded `origin/main` `0f34184` → L03 `37aac44` record-only runtime trace → L04 `ed83927` recoverable-correction record trace → L02 `f98f611` synthetic trim record trace → L05 `6004911` safety-sensitive decision-ledger record visibility only.
- [x] Historical integrated code and candidate-QA baseline `782707954c8ed711395c0ee5572de3be9f9fd256` (`7827079`) contains that lineage and the earlier documentation reconciliation. Recorded candidate QA on exact `7827079` passed strict typecheck, 13 Vitest files / 118 tests, 12 Chromium Playwright tests, production build, and diff check; this is local/browser synthetic prototype evidence only, not domain validation, navigation/safety truth, release, certification, deployment, or supported-browser evidence.
- [x] `76bf5b6` is a historical post-main documentation capture; it did not rerun or extend the recorded candidate QA and is not the current tip.
- [x] L05 is decision-ledger visibility only: `pass`/`wait`/`return` are record labels, not recommendations, correctness judgments, outcomes, or route/depth/tide/visibility/clearance/timing/order/safety evidence.
- [x] 2026-07-19 controller + validated Alfred implementation audit and approval-aware next-step plan: current suite re-run (61 Vitest, 6 Chromium smoke, typecheck/build/release-evidence validation); plan recorded at `docs/plans/2026-07-19-prototype-audit-and-next-steps.md`
- [x] Historical local Git documentation checkpoint created; `origin` configured (push was pending at that historical checkpoint)

## AP-0E G0 integrated and pushed on shared main

- [x] Source commit `5c7ea5d` was merged into fresh Orca integration worktree as `b4a3dc1`; fresh integration verification passed strict typecheck, **102 Vitest**, **8 Chromium** smokes, production build, diff check, and AP-0C historical evidence hash invariants.
- [x] User-authorized shared-main synchronization placed candidate `038aece` on `main`, then `origin/main` was pushed and fetched back at the same SHA.
- [x] AP-0E runtime boundaries remain: registry-bound manifest action/safety policy, manifest-only observation HUD, validated browser cadence, and pre-dispatch active transport denial.
- [ ] Release/domain validation/deployment remain out of scope and `BLOCKED`.

## Integrated on shared main

- [x] AP-0D P0 remediation was committed on isolated source branch as `00c34b3`, merged into fresh integration worktree as `0e84d85`, and user-authorized shared `main` synchronization placed the verified documentation/code candidate at `20148a1`.
- [x] Shared-main controller verification passed: typecheck, **87 Vitest**, **7 Chromium smokes**, production build, diff check, unchanged historical evidence hashes, and preserved `.agent` coordination-artifact hashes.
- [x] AP-0D P0 and AP-0E G0 are pushed to `origin/main`; personal prototype work is not blocked by external G1/G2/G3, authority, or release-evidence requirements. Those prior materials are archived and non-operational.


## Archived / Non-operational external materials

- [x] Personal-use limitation acknowledgement is retained at `docs/content/personal-use-g1-self-review-record-v1.md`; it is not a gate or prerequisite.
- [x] L01 external-review packet and all reviewer/qualification/authority/controlled-apply materials are archived references. They cannot block, wait for, or automatically resume personal prototype work.
- [x] Personal-use external-gate retirement documented and pushed at `14d10bc`; current next-session handoff: `docs/HANDOFF_NEXT_SESSION_PERSONAL_PROTOTYPE_2026-07-19.md`.

## Evidence closure — Training Ground documentation

- [x] This working tree contains `docs/architecture/training-ground-completion-matrix.md`, reconciling L01–L05 against prototype evidence facets. This is evidence closure only: it is not product, domain, safety, navigation, browser-support, certification, deployment, or release completion.
- [x] `ALF-20260720-2240-l01-synthetic-semantic-slice` produced a reviewed L01 synthetic wind/course semantic-slice plan. Its repository handoff is `docs/plans/2026-07-20-l01-synthetic-semantic-slice-plan.md`; it is planning-only and does not authorize source implementation.
- [x] 2026-07-21 L01 versioned synthetic wind/course semantic slice integrated at `f55877d`: deterministic synthetic observations, immutable causal ledger, strict Replay V2 terminal authority, browser-local HUD/debrief, 16 Vitest files / 163 tests, and 15 Chromium smokes. This is not physical sailing, safety, navigation, release, or deployment evidence.
- [x] 2026-07-21 L02 synthetic trim-input acknowledgment integrated at `89ab655`: accepted main/jib control acknowledgment only, immutable paired-trim causality, strict L02 V2 replay profile/terminal authority, legacy L02 helm compatibility retained, 18 Vitest files / 177 tests, and 15 Chromium smokes. It does not model sail shape, sheets, speed, stability, performance, safety, or navigation.
- [x] 2026-07-22 L03 bounded synthetic cue/checkpoint acknowledgment repair complete. The scope remained `pending → gust_wave_observed → complete/selected`; no wind/wave values, reef timing/advice, thresholds, safety, physics, navigation, scoring, performance, L04/L05, registry, backend, or analytics semantics were added. `60202d8` was independently reviewed (**APPROVE**, no P0/P1), fresh-integrated, fast-forwarded, and pushed.
- [x] Strict final evidence: typecheck, **18 Vitest files / 193 tests**, **16 Chromium smokes**, Vite build, and diff check all pass. Coverage includes delayed L03 acknowledgment save/resolve/reload, exact paused tick-0 local persistence, interactive cue-to-ack trace, legacy checkpoint provenance, and restored L02 scenario UI.
- [x] Vercel static configuration `561d011` is integrated and `sailing-training` is deployed. Vercel reported the created deployment as public **production** target; URL/HTTP/browser basic surface were verified. This is still synthetic/unvalidated prototype hosting, not release or domain/safety/navigation evidence.
- [x] 2026-07-24 Scenario 1 corrected planning Seed committed: brownfield context, local-only/replay boundaries, the approved 50/30/20 synthetic score allocation, versioned target-heading-only course control (`<=2°` full, linear to `30°`, then zero), and normalized propulsion thresholds/caps plus the deliberately simple mutually exclusive penalty and 20-point linear-conversion rule are recorded. This is documentation/Seed planning only; it adds no source implementation authority.

## Next — Training Ground first

1. Keep the completed evidence matrix and L01/L02 synthetic slices within their documented non-physical boundaries; any further source work must begin with a new evidence-backed bounded plan.
2. Preserve personal-use boundaries: all records remain `assumption`; synthetic/non-navigation/local-only notices remain mandatory.
3. P1/P1B environment values remain scenario/replay/UI-only. Do not add physical core coupling, historical source import, date/place reconstruction, live marine/weather access, or a distinct Main Game mode before the Training Ground is completed and the user authorizes a separate scope.
4. Any next implementation requires a new bounded plan and isolated-worktree QA. User-authorized automatic continuation may execute non-gated planned work but cannot turn archived external-review/release materials into a blocker, waiting state, or required input.
5. Do not treat the GitHub prerelease, absence of formal gates, passing prototype tests, or public static hosting as expert validation, registry promotion, navigation/safety correctness, product release, or deployed-service readiness.
6. L03 is complete for its bounded acknowledgment-only repair. Do not automatically begin L04–L05 or computed trim-effect proposals; each needs a fresh evidence-backed plan and explicit authorization. Any public/protected/preview-only access change is a separate deployment-policy decision.
7. Scenario 1's complete planning contract now includes its deliberately simple synthetic propulsion rule and fixed 20% conversion. Source work still requires a separate bounded isolated-worktree implementation authorization; do not treat the planning checkpoint as code authorization or infer any real-world behavior.
