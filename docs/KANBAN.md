# Sailing Bootcamp Kanban — Local Snapshot

> Hermes Kanban tool은 이 세션에 노출되어 있지 않아, 이 파일을 프로젝트 내부의 durable fallback board로 사용한다. 향후 Kanban 도구가 이용 가능해지면 이 상태를 동기화한다.

## Done

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
- [x] 2026-07-19 controller + validated Alfred implementation audit and approval-aware next-step plan: current suite re-run (61 Vitest, 6 Chromium smoke, typecheck/build/release-evidence validation); plan recorded at `docs/plans/2026-07-19-prototype-audit-and-next-steps.md`
- [x] Local Git documentation checkpoint created; `origin` configured (push pending)

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

## Next

1. Preserve personal-use boundaries: all records remain `assumption`; non-navigation/local-only notices remain mandatory.
2. Any next personal prototype implementation requires only an explicit user-approved bounded scope, with no external-review/qualification/authority/controlled-apply prerequisite. Begin from `docs/HANDOFF_NEXT_SESSION_PERSONAL_PROTOTYPE_2026-07-19.md`.
3. Archived external-release materials cannot become a blocker, waiting state, required input, or automatic next step.
4. Do not treat absence of formal gates as expert validation, registry promotion, or release authority.
