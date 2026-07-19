alfred_response:
  schema_version: 1
  task_id: ALF-20260719-0110-coach-validation-packet
  plan_version: 1
  status: READY_FOR_HERMES_REVIEW
  planning_mode: LIGHT
  ambiguity_score: 0.0
  confidence: high
  risk_level: low
  user_approval_required: false
  ouroboros_used: false
  evidence_complete: true
  critical_open_questions: []

  objective: >-
    Create a documentation-only, snapshot-bound domain-review packet and machine-readable
    submission template for VR-L01-v0 through VR-L05-v0. The artifacts must collect qualified,
    named reviewer findings without presenting them as navigation, certification, product-release,
    or contract-change authority.

  evidence:
    - path: /Users/hipgiinii/.hermes/projects/Sailing_training/prd.md
      observed: "Draft v0.3; L01-L05 and training-sloop-v1 assumptions require domain validation."
    - path: /Users/hipgiinii/.hermes/projects/Sailing_training/docs/content/mandatory-lessons-l01-l05.md
      observed: "Draft v0.1; each lesson maps to exactly one VR record and remains release-ineligible."
    - path: /Users/hipgiinii/.hermes/projects/Sailing_training/docs/content/domain-validation-registry.yaml
      observed: "Registry 0-draft contains exactly five assumption records; model and contract bindings remain TBD."

  approach:
    pattern: "Two-artifact, immutable-target review workflow"
    rationale:
      - Keep reviewer declarations and findings outside the canonical registry until a separate controlled apply step.
      - Bind every finding to the exact source snapshot, record, claim text, coverage list, and version fields.
      - Prevent free-form review text from silently altering lesson, scenario, model, coordinate, or determinism contracts.
    rejected_alternatives:
      - "Embedding review fields directly in the registry, because drafting a response could then mutate release state."
      - "Using only a prose questionnaire, because completeness, version binding, and one-to-one coverage could not be validated reliably."

  file_impact:
    create:
      - /Users/hipgiinii/.hermes/projects/Sailing_training/docs/content/sailing-coach-domain-review-packet-v1.md
      - /Users/hipgiinii/.hermes/projects/Sailing_training/docs/content/sailing-coach-domain-review-submission-template-v1.yaml
    modify: []
    prohibited:
      - "Do not change the registry, lesson contracts, PRD, dispositions, release state, or application code."

  deliverables:
    - artifact: sailing-coach-domain-review-packet-v1.md
      required_sections:
        - "Purpose, synthetic virtual-water scope, training-sloop-v1 boundary, and non-navigation/non-certification warning."
        - "Source manifest containing packet version, registry schema/version, canonical paths, document status/version, and generated SHA-256 snapshot digests."
        - "Reviewer qualification/declaration section, kept separate from technical findings."
        - "Five review cards in registry order, mapping exactly one-to-one to VR-L01-v0 through VR-L05-v0."
        - "Outcome definitions, evidence/provenance requirements, completeness rules, stale-review handling, and controlled apply/reject procedure."
        - "Explicit statement that a review submission is neither release approval nor authority to change scenario/model contracts."
    - artifact: sailing-coach-domain-review-submission-template-v1.yaml
      required_structure:
        root_metadata:
          - schema_version
          - template_version
          - submission_id
          - submission_status
          - review_packet_id
          - review_packet_version
          - target_registry_schema_version
          - target_registry_version
          - source_snapshot_digests
        reviewer_qualification_declaration:
          required:
            - reviewer_name
            - professional_role
            - qualification_basis
            - relevant_experience_scope
            - conflict_of_interest_declaration
            - limitations
            - declaration_accepted
            - signature_name
            - signed_at
          excluded_personal_data:
            - postal_address
            - telephone_number
            - government_identifier
            - credentials_or_certificate_images
            - unrelated biography
        claim_reviews:
          cardinality: 5
          exact_record_ids:
            - VR-L01-v0
            - VR-L02-v0
            - VR-L03-v0
            - VR-L04-v0
            - VR-L05-v0
          per_record_fields:
            - lesson_id
            - reviewed_claim_snapshot
            - reviewed_coverage_snapshot
            - scenario_version
            - model_version
            - boat_profile_version
            - contract_version
            - coordinate_contract_version
            - determinism_contract_version
            - review_outcome
            - coverage_findings
            - rationale
            - evidence_references
            - evidence_gaps
            - limitations
            - requested_clarifications_or_changes
            - reviewer_confirmation
        final_attestation:
          - covered_validation_record_ids
          - findings_complete
          - non_navigation_acknowledgement
          - non_release_approval_acknowledgement
          - signature_name
          - signed_at

  classification_contract:
    machine_values:
      - validated
      - partially_validated
      - rejected
      - needs_evidence
    display_label:
      needs_evidence: "needing evidence"
    rules:
      - "validated requires every coverage item to be accepted, with rationale and traceable evidence or explicitly scoped professional judgment."
      - "partially_validated requires accepted and unresolved/rejected scope to be identified separately."
      - "rejected requires the contradicted or unsuitable claim scope, rationale, and provenance to be recorded."
      - "needs_evidence identifies the missing material and is a review outcome only; it is not added to the registry disposition enum."
      - "Every coverage finding preserves the exact registry coverage text and its original order."

  evidence_contract:
    per_reference_fields:
      - evidence_id
      - evidence_kind
      - title_or_description
      - author_or_origin
      - publication_or_artifact_version
      - date
      - locator_or_section
      - relevance
      - limitations
    allowed_evidence_kinds:
      - cited_source
      - reviewer_professional_judgment
      - project_artifact
    authoring_boundary: >-
      The documentation executor leaves reviewer evidence fields blank and performs no external
      research, reviewer identification, recruitment, contact, or impersonation.

  controlled_apply_policy:
    preconditions:
      - "The qualification declaration and final attestation contain the same real reviewer name and signed timestamp."
      - "All five target records and source digests match the current canonical files exactly."
      - "Claim text, coverage, lesson ID, and every version field match; literal TBD values are treated as incomplete bindings."
      - "Evidence and rationale satisfy the selected outcome's completeness rules."
    mapping:
      unsigned_or_incomplete_submission: "No registry change; preserve assumption."
      needs_evidence: "No disposition change; preserve assumption and retain the evidence request in the submission."
      partially_validated: "Eligible only for a separate authorized change to partially_validated."
      rejected: "Eligible only for a separate authorized change to rejected."
      validated: >-
        Eligible for a separate authorized change to validated only when every required version
        binding is concrete. Any TBD/null binding preserves assumption and requires review of the
        later concrete version.
    apply_allowlist:
      - reviewer
      - review_date
      - disposition
      - source_or_evidence_gap_reason
    safeguards:
      - "Archive the signed submission as provenance before any registry edit."
      - "Reject stale or mismatched submissions; never rebind them automatically."
      - "Produce an explicit before/after field report for the allowlisted registry fields."
      - "Do not change scenario, model, profile, coordinate, determinism, lesson, scoring, or boundary contracts while applying a review."
      - "Validated status does not satisfy P1 gates and is not product release approval."

  implementation_sequence:
    - step: 1
      action: "Capture versions and SHA-256 digests of the three canonical source files without modifying them."
    - step: 2
      action: "Author the packet with scope controls, reviewer instructions, five exact record cards, and apply/reject rules."
    - step: 3
      action: "Author valid YAML using null/empty placeholders and copy all record bindings and coverage text verbatim."
    - step: 4
      action: "Cross-check record cardinality, order, IDs, claims, coverage, versions, outcome values, and source digests."
    - step: 5
      action: "Parse the YAML with an already-installed parser and run read-only assertions; install no dependency."
    - step: 6
      action: "Recompute canonical source digests to prove the PRD, lesson contracts, and registry were unchanged."

  acceptance_criteria:
    - "Exactly two new documentation/template files exist; all three canonical source files remain byte-identical."
    - "The YAML parses successfully and contains exactly five unique reviews with no missing or extra validation record."
    - "Every record binding and coverage entry equals the registry source verbatim."
    - "The four review outcomes are available, while needs_evidence can never be applied as a registry disposition."
    - "An unsigned, unnamed, stale, digest-mismatched, or incomplete submission cannot change assumption status."
    - "A validated finding with any TBD/null required binding cannot set the registry to validated."
    - "Reviewer qualification/declaration and claim-level findings are distinct sections."
    - "No invented sailing values, thresholds, polars, draft figures, performance metrics, regulatory claims, or real-route advice appear."
    - "The packet repeatedly distinguishes technical review, registry application, P1 approval, and product release."
    - "No reviewer is sought, named, contacted, or represented by the artifacts."

  risk_register:
    - risk: "needs_evidence is not a registry enum."
      mitigation: "Keep it as a submission outcome and map it to no disposition change."
    - risk: "A review of TBD contracts could be mistaken for approval of later implementations."
      mitigation: "Block validated application until bindings are concrete and reject automatic rebinding."
    - risk: "A record-level outcome could hide unsupported subclaims."
      mitigation: "Require one finding for every exact coverage entry."
    - risk: "Reviewer information could become unnecessary personal-data collection."
      mitigation: "Collect only name, role, qualification scope, conflicts, limitations, and signature metadata."
    - risk: "The packet could be mistaken for navigation or release authority."
      mitigation: "Place explicit non-navigation, non-certification, non-release statements in instructions and attestation."

  rollback:
    trigger: "Artifact validation fails or either document exceeds the authorized documentation scope."
    procedure: >-
      Remove only the two newly created artifacts. No registry or contract restoration should be
      necessary because existing files are immutable for this task.

  executor_handoff:
    scope: "Documentation and template authoring only."
    completion_evidence:
      - "Paths of the two created artifacts."
      - "YAML parser success output."
      - "Five-record semantic assertion output."
      - "Before/after SHA-256 equality for all three canonical source files."
    stop_conditions:
      - "Any request to research, select, recruit, contact, or impersonate a reviewer."
      - "Any need to invent domain values or change an existing disposition or contract."
      - "Any proposal to treat the completed form as release approval."

  unresolved_issues:
    - "The future project authority responsible for accepting reviewer qualifications is not designated; the packet must leave that gate pending rather than infer an approver."
