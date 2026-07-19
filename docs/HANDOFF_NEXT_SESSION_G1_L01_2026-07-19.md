# Next-Session Handoff — G1 L01 Domain Review Preparation

> **Handoff date:** 2026-07-19 KST
>
> **Session stop point:** user requested the current task be terminated after the G1 L01 packet preparation. Do not resume mutation automatically; await an explicit new user instruction.
>
> **Product state:** AP-0E G0 prototype hardening is integrated and pushed. Release remains **`BLOCKED`**.

## 1. Repository and Git baseline

```text
repository: /Users/hipgiinii/.hermes/projects/Sailing_training
branch: main
HEAD: 457221af0fb970772e6c564468df65f14bca9cfc
origin/main: 457221af0fb970772e6c564468df65f14bca9cfc
```

The code integration sequence now in shared history is:

```text
5c7ea5d  feat: harden prototype observability boundaries
b4a3dc1  merge: integrate AP-0E G0 hardening
038aece  docs: record AP-0E integration evidence
457221a  docs: mark AP-0E main integration
```

No deployment, domain validation, registry promotion, release-evidence generation, or release was performed.

## 2. Completed implementation state

AP-0E G0 is complete in `main`:

- manifest-backed typed L01–L05 observation HUD;
- registry-bound, fail-closed action/safety policy for direct/replay paths;
- browser cadence restricted to 125/250/500 ms without changing canonical logical progression;
- runtime pre-dispatch denial of fetch, XHR, WebSocket, and beacon active transport;
- local-only, deterministic prototype boundary remains intact.

Final fresh integration controller evidence was:

```text
npm run typecheck      PASS
npm test               PASS — 13 files / 102 tests
npm run test:smoke     PASS — Chromium 8 tests
npm run build          PASS
git diff --check       PASS
historical AP-0C evidence hashes unchanged
```

Independent source-level re-review approved the AP-0E correction loop. Chromium-only remains the current supported prototype baseline; Firefox/WebKit remain unverified/inconclusive.

## 3. Current G1 L01 document-only work

### New uncommitted packet

```text
docs/content/l01-domain-review-packet-v0.md
SHA-1 at handoff: 608bc0d07f9bea0cd0c054c4c416396e516f706e
status: untracked, reviewed, not committed
```

This packet was authorized as **document preparation only**. It:

- preserves `VR-L01-v0: assumption`;
- distinguishes draft non-profile bindings from `boat_profile_version: training-sloop-v1`;
- converts draft L01 concepts into source-bound future review questions only;
- keeps reviewer identity/qualification/authority/evidence/signature/approval unresolved (`UNSELECTED`, `NOT PROVIDED`, `NOT REQUESTED`, or `PENDING_AT_FREEZE` as applicable);
- requires the future exact-snapshot canonical-source digests for `prd.md`, lesson specification, and registry;
- explicitly blocks reviewer outreach, qualification acceptance, controlled apply, registry changes, code changes, P1/release activity, commit/push/deploy/release.

### Planning and review artifacts

These are coordination artifacts and must remain untracked unless the user explicitly changes that policy:

```text
.agent/plans/ALF-20260719-1935-sailing-g1-l01-review-packet/request.json
.agent/plans/ALF-20260719-1935-sailing-g1-l01-review-packet/alfred-response.md
.agent/plans/ALF-20260719-1935-sailing-g1-l01-review-packet/hermes-plan-review.md
```

- Alfred response validator: `PASS READY_FOR_HERMES_REVIEW`
- Hermes plan score: `50/50`, `PLAN_APPROVED` for document preparation only.
- First independent review found two packet defects:
  1. missing `prd.md` in the three canonical future source-digest requirements;
  2. inaccurate header claiming every binding was draft despite `training-sloop-v1` profile.
- Correction loop 1/2 added the canonical `prd.md` digest requirement and corrected the non-profile/profile wording.
- Final independent re-review: **APPROVE**.

## 4. Current working-tree inventory

At handoff, `main` has no tracked modifications. Deliberately untracked items are:

- `.agent/plans/` coordination artifacts from AP-0D, AP-0E, and G1 packet planning;
- `docs/content/l01-domain-review-packet-v0.md`;
- this handoff document.

Before any Git action, rerun:

```bash
git status --short --branch
git diff --check
git diff --name-status
git ls-files --others --exclude-standard
```

Do not assume untracked content is part of a normal `git diff`.

## 5. Non-negotiable boundaries

- `docs/content/domain-validation-registry.yaml` records L01–L05 all remain `assumption`.
- Do not invent or add sailing thresholds, polar data, safety limits, navigation guidance, real weather/current/tide/depth values, citations, reviewer identity, qualifications, signatures, dates, authority approval, or dispositions.
- No reviewer outreach, qualification acceptance, evidence freeze, submission, controlled apply, registry promotion, semantic code implementation, P1 approval, release evidence regeneration, deployment, or release without fresh explicit authority and required external evidence.
- Do not treat a review packet, test pass, or future review recommendation as a registry disposition or release authority.
- Secrets must never be printed.

## 6. Required reading before continuation

1. `AGENTS.md`
2. `docs/PROJECT_STATUS.md`
3. `docs/quality/prototype-and-release-gates.md`
4. `docs/content/domain-validation-registry.yaml`
5. `docs/content/l01-domain-review-packet-v0.md`
6. `docs/content/sailing-coach-domain-review-packet-v1.md`
7. `docs/content/sailing-coach-domain-review-qualification-controlled-apply-runbook-v1.md`
8. `docs/content/mandatory-lessons-l01-l05.md`
9. `docs/contracts/coordinate-contract.md`
10. `docs/contracts/determinism-replay-contract.md`

## 7. Next decision gates

### A. Safe immediate option — commit the reviewed packet

Requires explicit user authorization for commit, and separately for push/integration. Stage only:

```text
docs/content/l01-domain-review-packet-v0.md
[optionally this handoff document and explicit status/Kanban updates after review]
```

Do not stage `.agent/plans/` unless the user explicitly changes the coordination-artifact policy.

### B. G1 evidence/reviewer workflow — blocked pending external authority

Before any actual review/submission/apply:

1. identify a qualified reviewer and evidence source outside the repository;
2. obtain explicit scope/qualification/independence and authority decision evidence;
3. freeze exact snapshots and SHA-256 values for the three canonical sources;
4. prepare a complete all-L01–L05 submission only when authorized;
5. keep `VR-L01-v0` as `assumption` unless a separate controlled-apply request and authority approval satisfy the runbook.

This packet alone is intentionally insufficient for a submission or apply.

### C. G2 / G3 remain later gates

P1 browser/accessibility/pilot/operations/replay-compatibility/privacy artifacts and an explicit release authority are separate requirements. Do not start release work from the G1 packet.

## 8. Standard verification when code changes are later authorized

```bash
npm run typecheck
npm test
npm run test:smoke
npm run build
git diff --check
# Optional no-write provenance validation; requires a pre-generated explicit artifact
# and its existing 40-character subject revision.
node scripts/build-release-evidence.mjs --validate \
  --input <generated-or-external-artifact.json> \
  --subject-revision <40-character-commit>
git status --short --branch
```

Do not use a no-argument `--validate` invocation. The tracked AP-0C report is a preserved historical artifact and lacks the hardened `source_revision` provenance field; it is neither valid under the new validator nor current-HEAD release proof. Generate a new report only in a clean exact-subject checkout and only for an authorized evidence workflow.

For document-only continuation, verify scope/integrity instead:

```bash
git diff --check
git diff --name-only
git ls-files --others --exclude-standard
shasum docs/content/l01-domain-review-packet-v0.md
```

## 9. Closure state

This session deliberately stops after a reviewed, uncommitted G1 L01 preparation packet and handoff. The next session must begin with status discovery and a fresh user-authorized scope decision.
