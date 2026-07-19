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

## Integration candidate verified

- [x] AP-0D P0 remediation committed on isolated source branch as `00c34b3` and merged into fresh integration worktree as `0e84d85`. Integration verification passed: typecheck, **87 Vitest**, **7 Chromium smokes**, production build, diff check, and unchanged historical evidence hashes.
- [ ] The shared `main` checkout intentionally remains untouched because it contains pre-existing uncommitted audit/documentation changes. Classify and commit those documents separately before moving `main`; do not force the verified code commit into the dirty checkout.


## Blocked / Waiting

- [ ] Domain review evidence and reviewer/authority acceptance — release blocker only
- [ ] Concrete model/contract/coordinate/determinism/comparison-policy version bindings — required before validation can become `validated`
- [ ] Versioned P1 browser/accessibility/pilot/operations/replay-compatibility/privacy artifact manifest and approvals — release blocker only
- [ ] Concrete domain validation, P1 approval artifacts, release authority, and WebKit/Firefox candidate configuration — release blocker

## Next

1. Keep release check fail-closed while registry remains `assumption`.
2. Complete independent review of the isolated AP-0D P0 diff, then obtain explicit integration/commit authority before any main-branch change.
3. Domain validation and P1 artifact approval remain independent release gates; do not treat the P0 hygiene work as release authority.
