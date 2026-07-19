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
- [x] Local Git documentation checkpoint created; `origin` configured (push pending)

## Blocked / Waiting

- [ ] Domain review evidence and reviewer/authority acceptance — release blocker only
- [ ] Concrete model/contract/coordinate/determinism/comparison-policy version bindings — required before validation can become `validated`
- [ ] Versioned P1 browser/accessibility/pilot/operations/replay-compatibility/privacy artifact manifest and approvals — release blocker only
- [ ] AP-0B/C user approval to extend bounded prototype scope

## Next

1. On explicit AP-0B approval, implement Task 1 gate evaluator only after preserving the AP-0A checkpoint boundary.
2. Under AP-0B, implement Task 2A raw deterministic ledger/golden replay, then Task 2B score/debrief causality; do not begin L01 UI unless the ceiling still permits it.
3. Keep release check fail-closed while registry remains `assumption`.
