# L01 Domain Review Packet v0 — Preparation Only

> **Packet status:** `PREPARATION_ONLY` · **not a review submission** · **not frozen**
>
> **Registry status:** `VR-L01-v0 = assumption` · all listed **non-profile version bindings** remain `-draft`; `boat_profile_version` remains `training-sloop-v1`
>
> **Product limitation:** browser-local, synthetic training prototype only. This packet does not provide navigation, safety, weather, seamanship, certification, or real-world operating guidance.

## 1. Authority and scope

This document prepares an evidence-grounded handoff for a future qualified-reviewer process. It is authorized only to inventory the present L01 draft, state unanswered review questions, and specify what a later submission would need.

It does **not**:

- select, contact, qualify, or accept a reviewer;
- assert that any sailing-domain statement is true;
- attach or infer external evidence, source citations, thresholds, polar data, safety limits, or numerical values;
- change `docs/content/domain-validation-registry.yaml`, any version binding, code, tests, P1 artifact, or release gate;
- constitute a qualification decision, reviewer outcome, controlled-apply request, authority approval, registry disposition, release approval, commit, push, deployment, or release.

The only current outcome is preparation of this document. Until a separate controlled process is completed, `VR-L01-v0` remains `assumption` and release remains blocked.

## 2. Current record snapshot — copy, do not promote

| Field | Current repository value | Status in this packet |
|---|---|---|
| `validation_record_id` | `VR-L01-v0` | current registry value; unchanged |
| `lesson_id` | `L01` | current registry value; unchanged |
| `disposition` | `assumption` | unchanged; not a reviewer outcome |
| `scenario_version` | `l01-scenario-v0-draft` | draft; not concrete approved binding |
| `model_version` | `training-sloop-model-v0-draft` | draft; not concrete approved binding |
| `boat_profile_version` | `training-sloop-v1` | current prototype profile identifier; not a validation result |
| `contract_version` | `lesson-model-contract-v0-draft` | draft; not concrete approved binding |
| `coordinate_contract_version` | `coordinate-contract-v1-draft` | draft technical contract; not domain approval |
| `determinism_contract_version` | `determinism-replay-contract-v1-draft` | draft technical contract; not domain approval |
| `comparison_policy_version` | `comparison-policy-v1-draft` | draft policy; not domain approval |

Source: `docs/content/domain-validation-registry.yaml` → `records` → `VR-L01-v0`.

### 2.1 Prototype representation boundary

The current executable prototype must be read as a labelled technical representation only:

- `src/content/l01.ts` declares the initial state as a steady-wind **synthetic fixture**.
- Its L01 HUD declarations mark true wind, apparent wind, heading, and COG as `declared_unavailable`.
- Its action, checkpoint, pass/fail, recovery, debrief, and boundary text is draft-only or assumption-labelled.
- The prototype/release gate model permits this labelled `assumption` prototype but explicitly blocks release while the record and bindings remain assumption/draft.

These facts establish the present software/document state, not the correctness of any nautical or safety meaning.

## 3. Source-bound claim ledger and review questions

Each row separates a **current draft statement** from a reviewer question. “Required external evidence” is deliberately `PENDING_AT_FREEZE`; none has been collected, selected, or evaluated by this packet.

| ID | Current draft statement — source anchor | Review question for a future qualified process | Required external evidence at future freeze | Current status |
|---|---|---|---|---|
| L01-RQ-01 | Registry coverage lists `true/apparent-wind relationship`; lesson spec L01 lists true wind `from` and apparent-wind state; manifest exposes both as unavailable. `domain-validation-registry.yaml` → `VR-L01-v0.coverage`; `mandatory-lessons-l01-l05.md` → `### L01 — 상대풍과 침로`; `src/content/l01.ts` → `required_observations`. | Is the wording, conceptual relationship, and any future educational representation suitable for the intended non-navigation training scope? | `PENDING_AT_FREEZE` — source/evidence reference, scope/limitation, reviewer rationale. | review question only; registry remains `assumption` |
| L01-RQ-02 | Registry coverage lists `heading/COG/course objective semantics`; lesson spec asks for heading/COG relationship; manifest marks heading/COG unavailable. Same anchors as L01-RQ-01. | Is the current terminology and proposed learning distinction appropriate, and what explicit limitation is required to prevent navigation guidance interpretation? | `PENDING_AT_FREEZE` — source/evidence reference, limitation wording, reviewer rationale. | review question only; registry remains `assumption` |
| L01-RQ-03 | Registry coverage lists `helm correction and recoverable deviation`; lesson spec names helm correction, recoverable deviation, and recorded debrief. `domain-validation-registry.yaml` → `VR-L01-v0.coverage`; `mandatory-lessons-l01-l05.md` → L01 `checkpoints`, `safe_recovery_semantics`, `hint_and_debrief`. | Are the educational semantics and any future deterministic representation defensible as a synthetic exercise without implying real maneuvering advice? | `PENDING_AT_FREEZE` — source/evidence reference, scope caveat, reviewer rationale. | review question only; registry remains `assumption` |
| L01-RQ-04 | Registry coverage lists `course boundary and score/retry semantics`; lesson spec calls boundary acceptance and terminality pre-validation assumptions; manifest says no navigation or safety threshold is asserted. `domain-validation-registry.yaml` → `VR-L01-v0.coverage`; `mandatory-lessons-l01-l05.md` → L01 `failure_or_boundary_acceptance`; `src/content/l01.ts` → `failure_or_boundary_acceptance`. | What evidence would be needed before any boundary, terminality, pass/fail, or retry semantics could be described beyond a draft synthetic state? | `PENDING_AT_FREEZE` — source/evidence reference, review finding, explicit unresolved gap if not supported. | review question only; registry remains `assumption` |
| L01-RQ-05 | The content specification says speed/progress cannot offset a simulation safety violation, while L01 boundary acceptance is still an assumption. `mandatory-lessons-l01-l05.md` → `### 2.3 공통 점수·안전 불변식` and `### L01 — 상대풍과 침로`; registry claim includes score/retry comparison semantics. | Is the separation of score/retry causality from any real safety claim sufficient, and what evidence or wording changes would be necessary before semantic validation? | `PENDING_AT_FREEZE` — source/evidence reference, reviewer rationale, gap statement. | review question only; registry remains `assumption` |
| L01-RQ-06 | Coordinate and replay documents declare synthetic coordinate, direction, identity, and deterministic comparison conventions. `coordinate-contract.md` → `canonical simulation convention`; `determinism-replay-contract.md` → `replay identity`, `comparison policy`. | Are the technical declarations traceable enough for review, while remaining distinct from physical/navigational validation? | `PENDING_AT_FREEZE` — evidence reference or explicit technical/domain boundary finding. | technical traceability question; no domain approval implied |

## 4. Evidence manifest — collection instructions only

The preparation packet does not freeze source files or invent SHA-256 values. A future authorized submission must first collect the **three canonical source digests** required by the review packet/runbook — `prd.md`, `docs/content/mandatory-lessons-l01-l05.md`, and `docs/content/domain-validation-registry.yaml` — from the exact submission snapshot. It must then collect every additional manifest source below and bind the packet/submission to actual digests according to the controlled-apply runbook.

| Evidence ID | Repository source and stable anchor | Present in repository now | External evidence status | Freeze-time action |
|---|---|---|---|---|
| L01-SRC-00 | `prd.md` → current L01/review-governance context | present | `PENDING_AT_FREEZE` | collect one of the three canonical source SHA-256 values; verify the future submission snapshot uses the exact same bytes |
| L01-SRC-01 | `docs/content/domain-validation-registry.yaml` → `VR-L01-v0` | present | `PENDING_AT_FREEZE` | collect one of the three canonical source SHA-256 values; verify all record fields and coverage order literally match the submission |
| L01-SRC-02 | `docs/content/mandatory-lessons-l01-l05.md` → `### L01 — 상대풍과 침로` | present | `PENDING_AT_FREEZE` | collect one of the three canonical source SHA-256 values; copy only source-bound draft wording into submission |
| L01-SRC-03 | `src/content/l01.ts` → `l01Manifest` | present | `PENDING_AT_FREEZE` | collect exact file SHA-256; distinguish implementation declarations from domain evidence |
| L01-SRC-04 | `docs/contracts/coordinate-contract.md` → `canonical simulation convention` | present | `PENDING_AT_FREEZE` | collect exact file SHA-256; retain synthetic/non-chart limitation |
| L01-SRC-05 | `docs/contracts/determinism-replay-contract.md` → `replay identity`, `comparison policy` | present | `PENDING_AT_FREEZE` | collect exact file SHA-256; retain draft/no-domain-threshold limitation |
| L01-SRC-06 | `docs/quality/prototype-and-release-gates.md` → `Prototype gate`, `Release gate` | present | `PENDING_AT_FREEZE` | collect exact file SHA-256; verify the submission does not claim release eligibility |
| L01-EXT-01 | Future reviewer-provided evidence reference(s) | not provided by this packet | `PENDING_AT_FREEZE` | record provenance, scope, limitation, locator, and reviewer rationale without copying unsupported facts into the packet |
| L01-EXT-02 | Future authority/qualification decision reference | not provided by this packet | `PENDING_AT_FREEZE` | record only after a separate authority decision identifies packet snapshot and submission SHA-256 |

`PENDING_AT_FREEZE` is not evidence, a frozen digest, an approval, or a reason to promote a record.

## 5. Reviewer handoff — unresolved fields are intentional gates

A future submission may be prepared only when the following information is actually available. This packet leaves every field unresolved.

| Required handoff field | Current value | Required later evidence |
|---|---|---|
| Reviewer identity | `UNSELECTED` | reviewer-provided identity in the later submission |
| Qualification declaration | `NOT PROVIDED` | scope, relevant experience/limits, independence/conflict declaration, and packet/submission reference |
| Qualification decision | `PENDING` | separate authority identity, authority-scope reference, decision outcome/rationale/timestamp, signed decision reference and SHA-256 |
| Reviewer outcome | `NOT REVIEWED` | completed review outcome per coverage item with rationale and evidence or explicit evidence gap |
| Reviewer signature/date | `NOT PROVIDED` | completed final attestation matching reviewer identity and packet/submission snapshot |
| Authority approval for controlled apply | `NOT REQUESTED` | later explicit approval referencing frozen apply-request digest and expected pre-apply registry digest |

A reviewer declaration is not a project qualification acceptance. A reviewer recommendation is not a registry disposition. A qualification decision is not release authority.

## 6. Future decision form — blank by design

This section is a template for a future completed submission. It is not filled by this packet.

```text
packet_id: PENDING_AT_FREEZE
packet_version: PENDING_AT_FREEZE
packet_sha256: PENDING_AT_FREEZE
submission_path: PENDING_AT_FREEZE
submission_sha256: PENDING_AT_FREEZE
reviewer_identity: NOT PROVIDED
reviewer_qualification_declaration: NOT PROVIDED
qualification_decision_reference: NOT PROVIDED
review_outcome_for_VR-L01-v0: NOT REVIEWED
review_rationale: NOT PROVIDED
evidence_or_explicit_gap: NOT PROVIDED
registry_disposition_request: NOT REQUESTED
controlled_apply_request: NOT REQUESTED
authority_approval_reference: NOT PROVIDED
```

Allowed future review outcomes and registry dispositions must follow the runbook and registry schema. They must remain separate: `needs_evidence` may describe a review outcome but is not a registry disposition. Even a later positive review is only an apply candidate until all integrity gates and separate authority approval are satisfied.

## 7. Freeze and controlled-apply checklist

This L01 preparation packet cannot independently satisfy a submission-wide or apply gate. In particular, the runbook requires a completed submission to cover all five L01–L05 records, and it requires exact current-registry matching, source digests, qualification evidence, and separate authority approval before any apply.

Before a future packet/submission freeze, verify all of the following:

- [ ] Exact packet path/version and actual SHA-256 recorded.
- [ ] Exact completed submission path and actual SHA-256 recorded.
- [ ] `VR-L01-v0` source fields, claim text, coverage order, and all seven version-related bindings literally match the current registry snapshot.
- [ ] The three canonical source digests (`prd.md`, `docs/content/mandatory-lessons-l01-l05.md`, `docs/content/domain-validation-registry.yaml`) are collected from the exact submission snapshot and literally match the future submission.
- [ ] Current source digests are collected for every additional source in the evidence manifest.
- [ ] External evidence is present with scope, limitations, provenance, and reviewer rationale, or an explicit evidence gap keeps the record unchanged.
- [ ] Reviewer declaration and final attestation are complete and mutually consistent.
- [ ] Separate authority qualification decision references this exact packet/submission snapshot and its SHA-256.
- [ ] A submission-wide completeness check covers all five registry records; this L01 packet is only one component.
- [ ] Any later controlled-apply request is frozen, binds the expected pre-apply registry digest, and changes only runbook-allowlisted fields.
- [ ] A separately identified authority explicitly approves the frozen controlled-apply request.

If any box remains incomplete, the correct outcome is no controlled apply: preserve `assumption`, retain `BLOCKED` release status, and record only an evidence gap or deferred decision where appropriate.

## 8. Explicit exclusions and rollback

### Exclusions

This packet does not authorize reviewer outreach, reviewer acceptance, external research, registry changes, version binding changes, source/test changes, P1 artifact approval, controlled apply, commit, push, deployment, or release.

### Rollback

Because this is a new preparation-only document and makes no registry/code/release change, rollback is deletion of this uncommitted packet after an explicit decision to abandon it. No operational or product-state rollback applies.

## 9. Completion criteria for this preparation artifact

This packet is complete only when it remains source-bound and fail-closed:

- `VR-L01-v0` is stated as `assumption` throughout;
- all non-profile bindings are shown as current draft values;
- draft claims are presented as review questions, never nautical facts or advice;
- evidence, reviewer, qualification, authority, approval, and freeze fields remain explicitly unresolved until independently supplied;
- registry promotion, controlled apply, P1, and release are named as separate blocked gates.
