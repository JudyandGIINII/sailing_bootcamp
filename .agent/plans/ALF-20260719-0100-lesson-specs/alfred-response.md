alfred_response:
  schema_version: 1
  task_id: ALF-20260719-0100-lesson-specs
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

scope:
  fixed:
    - Desktop-browser MVP on synthetic virtual water.
    - Mandatory L01–L05 using only training-sloop-v1.
    - Replay and telemetry remain local-browser-only.
    - No Korean coastal names, live data, real navigation guidance, certification, or safety-authority claims.
    - All physical, threshold, scoring, mastery, and recovery claims remain simulation-only assumptions until validated.
  release_gate:
    - Every lesson initially remains release-blocked.
    - A lesson becomes eligible only when its referenced validation record is validated and no dependent P1 gate is outstanding.
    - assumption, partially_validated, rejected, missing, or otherwise unapproved records block release.

deliverables:
  - proposed_path: docs/content/mandatory-lessons-l01-l05.md
    purpose: Single normative document containing shared contracts and all five lesson contracts.
    minimal_structure:
      - Document metadata, scope, simulation-only/non-certification notice.
      - Shared training-sloop-v1, scoring, coordinate, and determinism declarations.
      - L01–L05 contracts.
      - PRD traceability and release-gate matrix.
  - proposed_path: docs/content/domain-validation-registry.yaml
    purpose: Machine-readable draft containing one aggregate release-gate record per lesson.
    initial_state: All five records have disposition=assumption.

lesson_document_contract:
  required_per_lesson_fields:
    - lesson_id
    - scenario_version
    - initial_state
    - required_observations
    - permitted_actions
    - checkpoints
    - pass_semantics
    - fail_semantics
    - safe_recovery_semantics
    - hint_and_debrief
    - retry_comparison
    - validation_record_id
    - failure_or_boundary_acceptance
  shared_required_references:
    - contract_version
    - model_version
    - boat_profile_version
    - coordinate_contract_version
    - determinism_contract_version
    - comparison_policy_version
  coordinate_contract_declarations:
    - Planar frame and origin.
    - Angle zero and rotation direction.
    - Wind “from” and current “to” conventions.
    - Distance, speed, and time units.
    - Synthetic depth datum.
    - Vector-composition order.
    - Rounding and clamping policy.
    - All unresolved values explicitly marked as unvalidated assumptions.
  determinism_contract_declarations:
    - Time progression or equivalent ordered-input identifier.
    - Input-log ordering, seed, and random-consumption policy.
    - State-update order and simultaneous-event tie-break.
    - Pause means no simulation progression.
    - Reset restores the declared initial state.
    - Compared state, event, score, and debrief fields.
    - Replay identity: scenario_version + seed + input_log + model_version + boat_profile_version + contract_version.
    - Numerical tolerance is referenced by versioned policy, never invented in these documents.
  scoring_invariants:
    - Separate observation, judgment, control stability, simulated safety, and goal attainment.
    - Speed or progress cannot offset a simulated safety violation.
    - Every score change identifies its environment state and user-action event.
    - Recovery does not erase the original event from scoring or debrief.
    - Weights and mastery predicates remain validation-gated.

lesson_specs:
  L01:
    title: Relative wind and course
    scenario_version: l01-scenario-v0-draft
    validation_record_id: VR-L01-v0
    initial_state: Versioned steady-wind virtual-water fixture with training-sloop-v1, a declared target course, and non-focus environmental effects neutralized or explicitly declared.
    required_observations:
      - True-wind “from” state and apparent-wind state.
      - Heading, course, target relation, and resulting boat response.
    permitted_actions: Helm, pause, and reset; unsupported controls are absent or disabled.
    checkpoints:
      - Observe and distinguish true wind, apparent wind, and course signals.
      - Make a deliberate helm correction tied to those observations.
      - Reach the scenario-defined course-maintenance predicate.
      - Explain the observation-to-result chain in debrief.
    pass_semantics: All checkpoints complete without an unresolved simulated boundary event.
    fail_semantics: Required observations are skipped, the objective remains unmet, or a declared terminal boundary is crossed; speed cannot compensate.
    safe_recovery_semantics: Before a terminal boundary, helm correction may restore the target state; the deviation remains recorded.
    hint_and_debrief: Compare true/apparent wind with heading and course before recommending a correction; show the causal state and action.
    retry_comparison: Heading/course trajectory, correction timing, checkpoint results, boundary events, and score components.
    failure_or_boundary_acceptance: A recovered deviation may complete the lesson under the validated policy; terminality and course predicates are assumptions requiring VR-L01-v0 disposition.

  L02:
    title: Main and jib trim
    scenario_version: l02-scenario-v0-draft
    validation_record_id: VR-L02-v0
    initial_state: Steady-wind fixture with declared initial main/jib trim, course objective, and training-sloop-v1.
    required_observations:
      - Apparent-wind angle and declared sail/trim feedback.
      - Main-sheet state, jib-sheet state, speed response, and control stability.
    permitted_actions: Main sheet, jib sheet, helm for course maintenance, pause, and reset.
    checkpoints:
      - Identify the initial trim state.
      - Make distinct, explainable main and jib adjustments.
      - Reach the versioned stable-trim predicate.
      - Relate trim actions to speed and stability in debrief.
    pass_semantics: Demonstrated observation and deliberate trim produce the validated stable state without unresolved simulated safety events.
    fail_semantics: No explainable trim response, persistent unstable state, or terminal boundary crossing; peak speed alone cannot pass.
    safe_recovery_semantics: Return controls toward the scenario-declared recoverable state and retrim; prior instability remains visible.
    hint_and_debrief: Identify which sail/control state caused each response rather than exposing a hidden ideal setting.
    retry_comparison: Sheet inputs, apparent-wind state, speed/stability trajectory, safety events, and causal score changes.
    failure_or_boundary_acceptance: A slower safety-preserving trim is not rejected solely for lower speed; trim coefficients and acceptance predicates require VR-L02-v0 validation.

  L03:
    title: Gust, wave, and reef response
    scenario_version: l03-scenario-v0-draft
    validation_record_id: VR-L03-v0
    initial_state: Deterministic gust/wave episode beginning before a declared risk checkpoint, with a versioned pre-mitigation sail state.
    required_observations:
      - Gust and wave cues.
      - Apparent-wind, sail/reef state, and declared boat control/safety-state indicators.
    permitted_actions: Helm, declared main/jib controls, declared reef or sail-reduction action, pause, and reset.
    checkpoints:
      - Detect the approaching episode before its boundary.
      - Select an explainable mitigation.
      - Execute sail reduction and/or simulated safety-first steering.
      - Reach the declared post-episode controlled state.
    pass_semantics: Timely observation and mitigation satisfy all validated checkpoints; conservative early mitigation remains pass-eligible.
    fail_semantics: The hazard is ignored, mitigation is omitted, or a declared terminal boundary is crossed; speed and progress cannot compensate.
    safe_recovery_semantics: A recoverable episode permits sail reduction and steering back to a scenario-safe state; crossing a validated terminal boundary ends the attempt.
    hint_and_debrief: Connect gust/wave state, sail configuration, control action, and outcome without presenting reef timing as real-world guidance.
    retry_comparison: Hazard-detection timing, reef/control events, state trajectory, boundary events, and safety-first score components.
    failure_or_boundary_acceptance: Reef timing, gust/wave thresholds, terminality, and recovery predicates are draft assumptions governed by VR-L03-v0.

  L04:
    title: Current correction
    scenario_version: l04-scenario-v0-draft
    validation_record_id: VR-L04-v0
    initial_state: Synthetic non-zero current-to vector, declared mark, steady-wind support state, and training-sloop-v1.
    required_observations:
      - Current direction/speed under the shared convention.
      - Heading versus COG, STW versus SOG, drift trail, and mark relation.
    permitted_actions: Helm, declared sail controls needed to maintain the exercise state, pause, and reset.
    checkpoints:
      - Identify heading/COG and STW/SOG divergence.
      - Form an explainable correction.
      - Apply the correction.
      - Reach the versioned mark-acceptance predicate.
    pass_semantics: The mark is reached while demonstrating current interpretation and correction, without unresolved boundary events.
    fail_semantics: The current is not accounted for, the objective remains unmet, or a terminal boundary is crossed.
    safe_recovery_semantics: Re-observe the vector relationship and re-approach the mark when the scenario labels the miss recoverable; the miss remains recorded.
    hint_and_debrief: Explain current-to vector composition and the resulting drift rather than prescribing a real bearing.
    retry_comparison: Heading/COG and STW/SOG trajectories, correction inputs, drift, mark result, boundary events, and score causes.
    failure_or_boundary_acceptance: A slower valid correction remains acceptable; vector, mark, boundary, and mastery predicates require VR-L04-v0 validation.

  L05:
    title: Tide, depth, and visibility decision
    scenario_version: l05-scenario-v0-draft
    validation_record_id: VR-L05-v0
    initial_state: Versioned synthetic tide/depth/visibility timeline with a decision gate, virtual shallow-water boundary, and training-sloop-v1 draft reference.
    required_observations:
      - Synthetic tide state, scenario depth, depth datum, declared draft/clearance state, visibility, and route state.
    permitted_actions: Choose pass, wait, or return; use declared helm/sail controls to execute the choice; pause and reset.
    checkpoints:
      - Gather all required environmental and boat-state observations.
      - Make a decision before the declared boundary.
      - Execute the selected pass, wait, or return outcome.
      - Explain why the choice followed the simulation policy.
    pass_semantics: Any scenario-accepted safety-first choice may pass; transit, speed, and progress are not intrinsically required.
    fail_semantics: Proceeding without required observations or crossing a declared terminal boundary fails and cannot be offset by score elsewhere.
    safe_recovery_semantics: Waiting or returning before the terminal boundary remains pass-eligible; post-boundary terminality is validation-gated.
    hint_and_debrief: Show tide/depth/draft/visibility assumptions and decision consequences with an explicit “not real navigational advice” notice.
    retry_comparison: Observation completeness, decision timing/type, synthetic clearance and visibility events, route trajectory, and score causes.
    failure_or_boundary_acceptance: Wait or return may be the correct outcome; clearance, visibility, decision, and terminality semantics require VR-L05-v0 validation.

validation_registry_schema:
  top_level_fields:
    - schema_version
    - registry_version
    - status
    - allowed_dispositions
    - release_rule
    - records
  record_fields:
    - validation_record_id
    - lesson_id
    - claim_or_assumption
    - source_or_evidence_gap_reason
    - scenario_version
    - model_version
    - boat_profile_version
    - contract_version
    - coordinate_contract_version
    - determinism_contract_version
    - coverage
    - reviewer
    - review_date
    - disposition
  initial_values:
    registry_version: 0-draft
    status: unapproved
    allowed_dispositions: [assumption, partially_validated, validated, rejected]
    reviewer: null
    review_date: null
    disposition: assumption
    source_or_evidence_gap_reason: No approved domain evidence is attached; documentation draft only.
  common_coverage_for_all_records:
    - Relevant training-sloop-v1 hull, rig, polar, draft, controls, safety-state, and model assumptions.
    - Coordinate/unit/direction/datum/vector/rounding declarations.
    - Deterministic comparison fields and tolerance policy.
    - Scoring weights, mastery predicates, boundaries, terminality, and recovery meaning.
  lesson_specific_coverage:
    VR-L01-v0:
      - True/apparent-wind relationship.
      - Course objective and boundary predicates.
    VR-L02-v0:
      - Representative main/jib configuration.
      - Trim response, polar effects, and stable-speed predicate.
    VR-L03-v0:
      - Gust/wave effects and thresholds.
      - Reef timing/effect and simulated safety-recovery semantics.
    VR-L04-v0:
      - Current-to vector composition.
      - Heading/COG, STW/SOG, drift, and mark-acceptance predicates.
    VR-L05-v0:
      - Tide curve, depth datum, draft, and clearance assumptions.
      - Visibility effects and pass/wait/return decision semantics.

implementation_sequence:
  - Create the two documentation files only.
  - Write shared invariants and contract references before lesson details.
  - Populate every required field for L01–L05; do not rely on implicit inheritance.
  - Add exactly matching VR-L01-v0 through VR-L05-v0 registry records.
  - Add PRD traceability for §§7.2.1, 8.0, 8.3, 10, and 12.
  - Parse the YAML and perform terminology, reference, and release-gate review.
  - Submit assumptions for domain review; update disposition without silently changing versioned content.

acceptance_checks:
  - Five lesson contracts exist and every §7.2.1 field is non-empty.
  - All lessons name only training-sloop-v1 and synthetic virtual water.
  - Every validation_record_id resolves uniquely in the YAML registry.
  - All initial registry records are assumption and visibly block lesson release.
  - No numeric marine threshold, polar, draft, safety limit, scoring weight, mastery threshold, or tolerance is invented.
  - Replay identity, pause/reset behavior, comparison fields, and contract versions are explicit.
  - Score and debrief semantics are causally traceable and safety-first.
  - No Korean coastal name, live/realtime data, certification, or real navigational-safety claim appears.
  - P1 browser, accessibility, pilot, privacy, rollout/rollback, and replay-compatibility artifacts are referenced as separate unresolved release gates, never represented as approved.

risks_and_controls:
  - risk: Draft assumptions may be mistaken for marine guidance.
    control: Simulation-only notices plus release blocking for every non-validated record.
  - risk: Lesson and registry versions may drift.
    control: Exact ID/version cross-references and atomic review of both files.
  - risk: Hidden scoring may reward unsafe optimization.
    control: Causal score records and a non-offsettable simulated-safety invariant.
  - risk: Recovery semantics may imply approval before review.
    control: Mark terminality and recovery choices as assumptions requiring lesson-record disposition.

rollback:
  - Revert the two documents together if schema or scope review fails.
  - Never reuse a validation approval after changing scenario, model, boat-profile, contract, coordinate, or determinism versions.
  - If a record is rejected, retain the record and exclude the lesson rather than silently weakening its boundary or scoring policy.
