alfred_response:
  schema_version: 1
  task_id: ALF-20260719-0120-domain-review-apply-runbook
  plan_version: 1
  status: READY_FOR_HERMES_REVIEW
  planning_mode: STANDARD
  ambiguity_score: 0.0
  confidence: high
  risk_level: low
  user_approval_required: false
  ouroboros_used: false
  evidence_complete: true
  critical_open_questions: []

  objective: >-
    Add exactly two documentation-only artifacts defining an auditable,
    fail-closed reviewer-qualification and controlled-apply process. Creating
    these artifacts performs no qualification decision, registry mutation,
    P1/release approval, reviewer selection, or contract change.

  evidence:
    - "The canonical registry contains exactly VR-L01-v0 through VR-L05-v0; all dispositions are assumption."
    - "All five records currently have TBD model, contract, coordinate-contract, and determinism-contract bindings."
    - "Registry dispositions are limited to assumption, partially_validated, validated, and rejected; needs_evidence is not a disposition."
    - "The existing submission template already captures qualification declarations, five claim reviews, final attestation, source digests, and the four-field controlled-apply allowlist."
    - "submission.reviewer_qualification_declaration.declaration_accepted must not be interpreted as project or authority acceptance of the reviewer."

  artifacts:
    - path: docs/content/sailing-coach-domain-review-qualification-controlled-apply-runbook-v1.md
      contents:
        - "Purpose, scope, actors, terminology, and an explicit statement that the runbook neither finds nor contacts reviewers nor designates an authority."
        - "Separate states for qualification decision, evidence-review outcome, registry disposition, P1 gates, and release approval."
        - "Qualification outcomes accepted, rejected, and deferred, recorded only by an explicitly identified authority with authority-scope reference, decision time, rationale, and signed decision reference."
        - "Qualification acceptance limited to the identified submission and review packet; it grants no navigation, safety, certification, P1, release, or contract authority."
        - "Submission-wide checks: completed submission; submission path and SHA-256; unchanged canonical source digests; five unique ordered record IDs; matching declaration/final-attestation identity and timestamps; complete signatures, attestations, coverage findings, rationale, evidence, and limitations."
        - "Per-record checks: exact claim, coverage, lesson, scenario, boat-profile, model, contract, coordinate-contract, and determinism-contract bindings against the current registry."
        - "Concrete binding means non-null, non-empty, not TBD, and an exact current-registry match. Any incomplete binding preserves assumption and requires binding completion through a separate workflow followed by a fresh review."
        - "Controlled-apply preparation, explicit authority approval, immediate pre-apply base-digest recheck, allowlist-only atomic mutation, post-apply diff verification, audit recording, and rollback from preserved pre-apply bytes."
        - "No normative scenario, model, profile, lesson, coordinate, determinism, scoring, boundary, PRD, or lesson-contract content may be smuggled through source_or_evidence_gap_reason."
        - "Evidence acceptance and even a validated registry disposition do not satisfy dependent P1 gates or authorize release."
      decision_matrix:
        - condition: "Qualification authority or authority scope is absent, or qualification is rejected/deferred."
          result: "No reviewer qualification acceptance; no apply request may advance."
        - condition: "Submission path/digest is absent, stale, or mismatched; source snapshots changed."
          result: "Reject/hold request; no registry change; assumption preserved."
        - condition: "Signature, attestation, identity match, five-record coverage, or required evidence is incomplete."
          result: "Reject/hold request; no registry change; assumption preserved."
        - condition: "Any binding is null, empty, TBD, stale, or mismatched."
          result: "Affected record remains assumption; no controlled apply for that record."
        - condition: "Outcome is needs_evidence."
          result: "Record remains assumption; preserve the evidence-gap request separately."
        - condition: "Outcome is validated, partially_validated, or rejected and all qualification, integrity, completeness, evidence, and binding gates pass."
          result: "Eligible only as an apply candidate; no state changes before separate explicit authority approval."
        - condition: "Any requested delta names a field outside reviewer, review_date, disposition, source_or_evidence_gap_reason."
          result: "Reject the entire apply request without mutation."
        - condition: "Authority approval is absent, does not bind the frozen request and expected registry digest, or the base digest changes before apply."
          result: "Abort fail-closed; no registry mutation."
        - condition: "Authorized apply succeeds and the verified diff contains only approved allowlisted deltas."
          result: "Record audit evidence; P1 and release states remain unchanged."

    - path: docs/content/sailing-coach-domain-review-apply-request-template-v1.yaml
      contents:
        - "Blank defaults only: request_status draft, decisions pending, execution_status not_started, booleans false, identity/path/digest/time fields null, and requested_registry_deltas empty."
        - "Submission reference containing repository-relative path and SHA-256."
        - "Review-packet and target-registry references, including expected schema/version and pre-apply SHA-256."
        - "Qualification-decision block with pending status, authority identity, authority-scope reference, rationale, decision timestamp, and signed decision path/digest."
        - "Gate evaluations for digest freshness, signatures, attestations, exact five-record coverage, claim/coverage equality, concrete bindings, evidence completeness, outcome validity, release/P1 separation, and delta allowlist compliance."
        - "Per-record eligibility results with explicit preserve_assumption reason."
        - "requested_registry_deltas entries containing validation_record_id, allowlisted field, before value, requested value, rationale, and submission finding pointer."
        - "Constant allowed_registry_fields containing exactly reviewer, review_date, disposition, and source_or_evidence_gap_reason."
        - "Explicit invariants forbidding direct application, needs_evidence-to-disposition mapping, contract changes, P1 approval, and release approval."
        - "Separate controlled-apply authorization reference bound to the frozen request digest and expected registry digest."
        - "Execution/audit placeholders for no-op, rejected, aborted, applied, verified post-apply digest, actual deltas, and rollback reference; all remain unexecuted in the template."

  implementation_sequence:
    - "Create the runbook first and define terminology, authority boundaries, decision matrix, fail-closed gates, apply procedure, verification, and rollback."
    - "Create the YAML template from those gates; do not copy real reviewer or authority data and do not pre-authorize any request."
    - "Cross-check all record IDs, outcomes, binding names, and the four-field allowlist against the three existing source artifacts."
    - "Perform an adversarial tabletop review covering stale digest, missing signature, incomplete coverage, needs_evidence, TBD binding, unauthorized field, absent approval, and pre-apply digest race."
    - "Confirm the final change set contains only the two new artifacts."

  acceptance_criteria:
    - "Exactly two new files are added; the registry, PRD, lesson contracts, review packet, submission template, code, and release state remain byte-for-byte unchanged."
    - "The YAML template parses successfully and contains no actual reviewer, authority, approval, requested delta, or execution result."
    - "Every non-allowlisted requested field causes rejection rather than partial application."
    - "Every missing, stale, null, TBD, incomplete, unsigned, or needs_evidence case has an explicit no-mutation outcome."
    - "Approval is separately evidenced and bound to both the frozen request and expected pre-apply registry digest; an apply request alone is never approval."
    - "No procedure can alter scenario/model/profile/lesson/coordinate/determinism/scoring/boundary contracts or imply P1/release authorization."

  rollback:
    - "For this documentation task, remove only the two newly added files."
    - "For any future authorized apply, preserve exact pre-apply registry bytes and digest; restore them if the post-apply diff exceeds the approved allowlist or fails verification."

  executor_handoffs:
    codex: "Author only the two specified artifacts and run Markdown/YAML and source-consistency checks."
    claude: "Read-only adversarial review of authority separation, matrix completeness, and contract/release boundary language."
    agent_robin: "Read-only YAML/schema and negative-case tabletop validation; report any path that can advance with a false, null, TBD, stale, or pending gate."

  risks:
    - risk: "Qualification acceptance is confused with declaration_accepted in the submission."
      mitigation: "Define declaration_accepted as submitter-side data only and require a separate authority decision."
    - risk: "Free text is used to change contracts indirectly."
      mitigation: "Restrict source_or_evidence_gap_reason to provenance/evidence rationale and reject normative contract content."
    - risk: "Approval is replayed after registry or request changes."
      mitigation: "Bind approval to frozen request and pre-apply registry digests and recheck immediately before mutation."
    - risk: "A validated evidence outcome is mistaken for release approval."
      mitigation: "Keep evidence, registry, P1, and release gates visibly separate in every decision and audit state."

  unresolved_issues: []
