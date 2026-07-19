# Next-Session Handoff — Personal Prototype Continuation

> **Prepared:** 2026-07-19 22:53 KST
> **Baseline:** `14d10bc0fda51f45be62e049e0677c7e4f030c8b` on `main` and `origin/main`
> **Active scope:** personal, browser-local, synthetic training prototype.

## 1. Current truth

- AP-0A–AP-0E implementation is integrated and pushed.
- The project is assumption-only: `VR-L01-v0`–`VR-L05-v0` remain `assumption`; no registry promotion, factual domain validation, safety authority, or release claim exists.
- External reviewer qualification, authority, controlled apply, G1/G2/G3, P1, and public-release evidence are **archived non-operational references**. They cannot block, wait for, require input from, or automatically resume personal work.
- The only authorization needed for a new personal prototype increment is the user's explicit bounded scope (target, files, and verification).

## 2. Verified baseline

At the preceding documentation checkpoint:

```text
npm run typecheck   PASS
npm test            PASS — 13 files / 102 tests
npm run test:smoke  PASS — Chromium 8 tests
npm run build       PASS
git diff --check    PASS
```

The modified YAML archival templates parsed successfully. No source, test, registry, release-tooling, artifact, deployment, or release-state change was made by the documentation policy work.

## 3. Working-tree hygiene

Expected `git status --short` output includes only historical `.agent/plans/ALF-*` directories as untracked coordination artifacts. Do **not** stage `.agent/plans/` unless the user explicitly changes that policy.

Before any work, run:

```bash
git status --short --branch
git rev-parse HEAD origin/main
```

If tracked diffs or remote divergence exist, inspect and reconcile before proceeding.

## 4. Next-session decision

Do not start code automatically. Ask for or act only on an explicit bounded personal-prototype scope.

A candidate (not authorized) next increment is to make one existing assumption-labelled lesson's local state → causal event → HUD/debrief trace more visible, without adding sailing values, scoring, real-world guidance, network calls, registry changes, or release work. A fresh plan must name exact files and tests before implementation.

## 5. Non-negotiable product boundaries

- Keep visible synthetic / assumption-only / non-navigation notices.
- Keep replay and telemetry browser-local; do not add backend, account, analytics, live marine data, or external transport.
- Do not invent sailing thresholds, polar data, safety limits, weather/current/tide/depth values, or real-world operating advice.
- Do not use absence of formal gates to claim expert validation, certification, authority, registry promotion, or release readiness.

## 6. Required reading for a new bounded implementation

1. `AGENTS.md`
2. `prd.md`
3. `docs/PROJECT_STATUS.md`
4. `docs/KANBAN.md`
5. `docs/quality/prototype-and-release-gates.md`
6. `docs/content/domain-validation-registry.yaml`
7. `docs/content/personal-use-g1-self-review-record-v1.md`
8. `docs/contracts/coordinate-contract.md`
9. `docs/contracts/determinism-replay-contract.md`

## 7. Verification after any authorized code change

```bash
npm run typecheck
npm test
npm run test:smoke
npm run build
git diff --check
git status --short --branch
```
