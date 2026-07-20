import { evaluateLessonLoad, evaluatePrototypeEligibility } from './gates/eligibility.js';
import { normalizeKeyboardAction } from './app/input.js';
import { installLocalOnlyTransportGuard } from './app/local-network-policy.js';
import { BROWSER_CADENCE_PRESETS, createLogicalScheduler, type BrowserCadenceMs } from './app/scheduler.js';
import { createWorldProjection } from './render/world-projection.js';
import { deleteLocalReplay, listLocalReplays, saveLocalReplay, type LocalReplayRecord } from './storage/replays.js';
import { l01ReplayBindings } from './content/l01.js';
import { l02ReplayBindings, l03ReplayBindings, l04ReplayBindings, l05ReplayBindings } from './content/l02-l05.js';
import { l02SyntheticTrimProfileV1 } from './contracts/l02-synthetic-trim.js';
import { getLessonManifest, isLessonActionAllowed, projectLessonObservations } from './content/lesson-manifest.js';
import { resolveReplayV2, resolveStoredReplay, serializeReplayV2Attempt, type ReplayIdentity, type ReplayV2 } from './contracts/replay.js';
import { createSyntheticScenario, defaultScenarioConfiguration } from './content/scenario-catalog.js';
import { validateScenarioPackage, type ScenarioConfiguration } from './contracts/scenario.js';
import { materializeVariation } from './sim/scenario-variation.js';
import { applyCanonicalInput, advanceLogicalTick, createSession, pauseForLifecycle, replayInputs, type CanonicalInput } from './sim/session.js';
import { projectDebrief, projectL02RuntimeTrace, projectL02SyntheticTrimAcknowledgment, projectL03RuntimeTrace, projectL04RuntimeTrace, projectL05DecisionLedger, projectScore, type L02TraceEvidence, type L03TraceEvidence, type L04TraceEvidence, type L05DecisionLedgerRecordEvidence } from './scoring/projection.js';

// Install before any app-owned bootstrap work can initiate a browser transport.
installLocalOnlyTransportGuard();

const app = document.querySelector<HTMLDivElement>('#app');
if (!app) throw new Error('Application mount point is missing.');
const mount = app;

type ReplayBindings = Omit<ReplayIdentity, 'seed' | 'ordered_input_log'>;
type LessonRuntime = { id: 'L01' | 'L02' | 'L03' | 'L04' | 'L05'; bindings: ReplayBindings; actions: readonly CanonicalInput['input']['action'][]; controls: string };
const lessons: readonly LessonRuntime[] = [
  { id: 'L01', bindings: l01ReplayBindings, actions: getLessonManifest('L01')!.permitted_actions, controls: 'Left/Right helm; Space pause/resume; R saves then resets.' },
  { id: 'L02', bindings: l02ReplayBindings, actions: getLessonManifest('L02')!.permitted_actions, controls: 'M adjusts declared main trim; J adjusts declared jib trim; Left/Right helm; Space pause/resume.' },
  { id: 'L03', bindings: l03ReplayBindings, actions: getLessonManifest('L03')!.permitted_actions, controls: 'F records a conservative synthetic reef mitigation; Left/Right helm; Space pause/resume.' },
  { id: 'L04', bindings: l04ReplayBindings, actions: getLessonManifest('L04')!.permitted_actions, controls: 'Left records a recoverable synthetic miss; Right records a slower valid correction; Space pause/resume.' },
  { id: 'L05', bindings: l05ReplayBindings, actions: getLessonManifest('L05')!.permitted_actions, controls: 'P/W/B record synthetic pass/wait/return decisions; Space pause/resume.' },
];
let currentLesson = lessons[0]!;
let seed = 'l01-prototype-seed';
let inputLog: CanonicalInput[] = [];
let nextSequence = 1;
let session = createSession({ ...currentLesson.bindings, seed, ordered_input_log: inputLog });
let frozenReplay: ReplayV2 | ReplayIdentity | undefined;
let startInProgress = false;
let scenarioConfiguration: ScenarioConfiguration = { ...defaultScenarioConfiguration };
let storageStatus = 'Local replay storage ready.';

mount.innerHTML = `
  <main>
    <h1 id="session-heading" tabindex="-1">Sailing Training Sloop — draft</h1>
    <p class="notice" role="note">Simulation-only prototype • Unvalidated content • Not navigation, safety, or certification guidance.</p>
    <p id="synthetic-boundary" role="note">Synthetic — declared/unvalidated. Synthetic educational model — unvalidated — not for navigation or safety guidance. Scenario values are synthetic game calibration, not real-world conditions or safety thresholds.</p>
    <fieldset id="lesson-fieldset"><legend>Training module selection</legend><label for="lesson-select">Lesson</label><select id="lesson-select"><option>L01</option><option>L02</option><option>L03</option><option>L04</option><option>L05</option></select><p>Every lesson is an <strong>assumption</strong>; labels and text, not color alone, communicate that status.</p></fieldset>
    <fieldset id="scenario-fieldset"><legend>Synthetic scenario calibration</legend><label>Wave <select id="wave-select"><option value="low">low</option><option value="medium">medium</option><option value="high">high</option></select></label><label>Current <select id="current-select"><option value="weak">weak</option><option value="medium">medium</option><option value="strong">strong</option></select></label><label>Wind <select id="wind-select"><option value="weak">weak</option><option value="medium">medium</option><option value="strong">strong</option></select></label><label>Gust <select id="gust-select"><option value="off">off</option><option value="on">on</option></select></label><label>Weather <select id="weather-select"><option value="clear">clear</option><option value="cloudy">cloudy</option><option value="rain">rain</option></select></label><label>Day <select id="day-select"><option value="fixed">fixed</option></select></label><label>Variation <select id="variation-select"><option value="none">none</option><option value="weak">weak</option><option value="strong">strong</option></select></label><label>Wave direction <select id="wave-direction-select"><option value="north">north (0°)</option><option value="northeast">northeast (45°)</option><option value="east">east (90°)</option><option value="southeast">southeast (135°)</option><option value="south">south (180°)</option><option value="southwest">southwest (225°)</option><option value="west">west (270°)</option><option value="northwest">northwest (315°)</option></select></label><label>Wind direction <select id="wind-direction-select"><option value="north">north (0°)</option><option value="northeast">northeast (45°)</option><option value="east">east (90°)</option><option value="southeast">southeast (135°)</option><option value="south">south (180°)</option><option value="southwest">southwest (225°)</option><option value="west">west (270°)</option><option value="northwest">northwest (315°)</option></select></label><label>Current direction <select id="current-direction-select"><option value="north">north (0°)</option><option value="northeast">northeast (45°)</option><option value="east" selected>east (90°)</option><option value="southeast">southeast (135°)</option><option value="south">south (180°)</option><option value="southwest">southwest (225°)</option><option value="west">west (270°)</option><option value="northwest">northwest (315°)</option></select></label><label>Dominant wave period <select id="dominant-wave-period-select"><option value="short">short (4.0 s)</option><option value="medium">medium (6.5 s)</option><option value="long">long (10.0 s)</option></select></label><label>Visibility <select id="visibility-select"><option value="normal">normal (10.0 nmi)</option><option value="reduced">reduced (5.0 nmi)</option><option value="restricted">restricted (1.0 nmi)</option></select></label><label>Water level <select id="water-level-select"><option value="below_datum">below datum (-0.5 m)</option><option value="at_datum" selected>at datum (0.0 m)</option><option value="above_datum">above datum (0.5 m)</option></select></label><label>Tide phase <select id="tide-phase-select"><option value="rising">rising</option><option value="falling">falling</option><option value="slack" selected>slack</option></select></label><label>Course template <select id="course-template-select"><option value="windward-return-v1">windward-return-v1</option><option value="triangle-v1">triangle-v1</option></select></label></fieldset>
    <section aria-labelledby="scenario-details-heading"><h2 id="scenario-details-heading">Synthetic scenario package details</h2><p id="scenario-details" aria-live="polite"></p></section>
    <p><button id="start-session" type="button">Start</button> <button id="new-session" type="button" disabled>New Session</button></p><p id="start-status" aria-live="polite">Draft: select a lesson and synthetic scenario, then Start.</p>
    <p id="eligibility" role="status"></p>
    <section aria-labelledby="world-heading"><h2 id="world-heading">Synthetic training water</h2><div id="world"></div></section>
    <section aria-labelledby="hud-heading"><h2 id="hud-heading">Accessible status HUD</h2>
      <dl id="hud"></dl>
      <label for="cadence-select">Browser update cadence</label><select id="cadence-select" aria-describedby="cadence-note"><option value="125">125 ms</option><option value="250" selected>250 ms</option><option value="500">500 ms</option></select><p id="cadence-note">Browser rendering cadence only; logical tick order is unchanged.</p>
      <p id="controls"></p>
      <p id="pause" role="status"></p>
      <section id="l02-runtime-evidence-section" aria-labelledby="l02-runtime-evidence-trace-heading" hidden>
        <h3 id="l02-runtime-evidence-trace-heading">L02 browser-local runtime-evidence trace</h3>
        <h4 id="l02-static-declarations-heading">L02 static lesson-manifest declarations</h4><dl id="l02-static-declarations"></dl>
        <h4 id="l02-runtime-evidence-heading">L02 browser-local synthetic recorded evidence</h4><dl id="l02-runtime-evidence"></dl>
        <p id="l02-runtime-evidence-boundary" role="note"></p>
      </section>
      <section id="l03-trace-section" aria-labelledby="l03-trace-heading" hidden>
        <h3 id="l03-trace-heading">L03 trace</h3>
        <h4 id="l03-static-heading">Static lesson-manifest declaration</h4><dl id="l03-static-trace"></dl>
        <h4 id="l03-runtime-heading">Current runtime trace</h4><dl id="l03-runtime-trace"></dl>
        <p id="l03-trace-boundary" role="note"></p>
      </section>
      <section id="l04-runtime-evidence-section" aria-label="L04 runtime-evidence trace" hidden>
        <h3>L04 runtime-evidence trace</h3>
        <h4>L04 static lesson-manifest declarations</h4><dl id="l04-static-declarations"></dl>
        <h4>L04 runtime evidence</h4><dl id="l04-runtime-evidence"></dl>
        <p id="l04-runtime-evidence-boundary" role="note"></p>
      </section>
      <section id="l05-decision-ledger-section" aria-labelledby="l05-decision-ledger-heading" hidden>
        <h3 id="l05-decision-ledger-heading">L05 decision-ledger record visibility</h3>
        <p id="l05-decision-ledger-boundary" role="note"></p>
        <h4 id="l05-accepted-action-records-heading">Accepted-action record evidence</h4><dl id="l05-accepted-action-records"></dl>
        <h4 id="l05-checkpoint-records-heading">Checkpoint record evidence</h4><dl id="l05-checkpoint-records"></dl>
        <p id="l05-decision-ledger-ordering" role="note"></p>
      </section>
    </section>
    <section aria-labelledby="debrief-heading"><h2 id="debrief-heading">Debrief</h2><ul id="debrief"></ul></section>
    <section aria-labelledby="replays-heading"><h2 id="replays-heading">Local replays</h2><p id="storage-status" role="status"></p><ul id="replays"></ul></section>
  </main>`;

function requiredElement<T extends Element>(selector: string): T {
  const element = mount.querySelector<T>(selector);
  if (!element) throw new Error(`Training Sloop UI is incomplete: ${selector}`);
  return element;
}

const world = requiredElement<HTMLElement>('#world');
const hud = requiredElement<HTMLElement>('#hud');
const pause = requiredElement<HTMLElement>('#pause');
const debrief = requiredElement<HTMLUListElement>('#debrief');
const replays = requiredElement<HTMLUListElement>('#replays');
const storage = requiredElement<HTMLElement>('#storage-status');
const eligibility = requiredElement<HTMLElement>('#eligibility');
const title = requiredElement<HTMLElement>('#session-heading');
const controls = requiredElement<HTMLElement>('#controls');
const lessonSelect = requiredElement<HTMLSelectElement>('#lesson-select');
const scenarioSelectors = ['wave', 'current', 'wind', 'gust', 'weather', 'day', 'variation', 'wave-direction', 'wind-direction', 'current-direction', 'dominant-wave-period', 'visibility', 'water-level', 'tide-phase', 'course-template'].map((name) => requiredElement<HTMLSelectElement>(`#${name}-select`));
const scenarioDetails = requiredElement<HTMLElement>('#scenario-details');
const startButton = requiredElement<HTMLButtonElement>('#start-session');
const newSessionButton = requiredElement<HTMLButtonElement>('#new-session');
const startStatus = requiredElement<HTMLElement>('#start-status');
const cadenceSelect = requiredElement<HTMLSelectElement>('#cadence-select');
const l02RuntimeEvidenceSection = requiredElement<HTMLElement>('#l02-runtime-evidence-section');
const l02StaticDeclarations = requiredElement<HTMLDListElement>('#l02-static-declarations');
const l02RuntimeEvidence = requiredElement<HTMLDListElement>('#l02-runtime-evidence');
const l02RuntimeEvidenceBoundary = requiredElement<HTMLElement>('#l02-runtime-evidence-boundary');
const l03TraceSection = requiredElement<HTMLElement>('#l03-trace-section');
const l03StaticTrace = requiredElement<HTMLDListElement>('#l03-static-trace');
const l03RuntimeTrace = requiredElement<HTMLDListElement>('#l03-runtime-trace');
const l03TraceBoundary = requiredElement<HTMLElement>('#l03-trace-boundary');
const l04RuntimeEvidenceSection = requiredElement<HTMLElement>('#l04-runtime-evidence-section');
const l04StaticDeclarations = requiredElement<HTMLDListElement>('#l04-static-declarations');
const l04RuntimeEvidence = requiredElement<HTMLDListElement>('#l04-runtime-evidence');
const l04RuntimeEvidenceBoundary = requiredElement<HTMLElement>('#l04-runtime-evidence-boundary');
const l05DecisionLedgerSection = requiredElement<HTMLElement>('#l05-decision-ledger-section');
const l05DecisionLedgerBoundary = requiredElement<HTMLElement>('#l05-decision-ledger-boundary');
const l05AcceptedActionRecords = requiredElement<HTMLDListElement>('#l05-accepted-action-records');
const l05CheckpointRecords = requiredElement<HTMLDListElement>('#l05-checkpoint-records');
const l05DecisionLedgerOrdering = requiredElement<HTMLElement>('#l05-decision-ledger-ordering');

type PendingBrowserSignal =
  | { kind: 'keyboard'; key: string; repeat: boolean }
  | { kind: 'lifecycle'; reason: 'focus_lost' | 'visibility_hidden' };

let projection: Awaited<ReturnType<typeof createWorldProjection>>;
let applicationReady = false;
const pendingBrowserSignals: PendingBrowserSignal[] = [];

function replayPayload(): unknown {
  if (!frozenReplay) return undefined;
  if ('schema_version' in frozenReplay && frozenReplay.schema_version === 'replay-v2') {
    return serializeReplayV2Attempt(
      frozenReplay,
      inputLog,
      frozenReplay.lesson_binding.lesson_id === 'L01' || frozenReplay.lesson_binding.lesson_id === 'L02' ? session.raw.logical_tick : undefined,
      frozenReplay.lesson_binding.lesson_id === 'L01' || frozenReplay.lesson_binding.lesson_id === 'L02' ? session.paused : undefined,
    );
  }
  return { ...frozenReplay, ordered_input_log: inputLog };
}

const directionDegrees = { north: 0, northeast: 45, east: 90, southeast: 135, south: 180, southwest: 225, west: 270, northwest: 315 } as const;
const periodSeconds = { short: 4, medium: 6.5, long: 10 } as const;
const visibilityNmi = { normal: 10, reduced: 5, restricted: 1 } as const;
const waterLevelMeters = { below_datum: -.5, at_datum: 0, above_datum: .5 } as const;

function formatCourse(course: { id: string; start: { label: string; x_m: number; y_m: number }; ordered_marks: readonly { label: string; x_m: number; y_m: number }[]; finish: { label: string; x_m: number; y_m: number } }): string {
  const point = (value: { label: string; x_m: number; y_m: number }) => `${value.label} (${value.x_m}, ${value.y_m}) meter`;
  return `${course.id}; origin (0, 0) meter; bounds x -500..500, y -250..1000 meter; start ${point(course.start)}; ordered marks ${course.ordered_marks.map(point).join(', ')}; finish ${point(course.finish)}.`;
}

function renderScenarioDetails(): void {
  if (!frozenReplay) {
    scenarioDetails.textContent = `Draft preview — Synthetic — declared/unvalidated; scenario/replay/UI-only and not coupled to the current core. Wave direction ${scenarioConfiguration.wave_direction} ${directionDegrees[scenarioConfiguration.wave_direction]} degree true_north/from; wind direction ${scenarioConfiguration.wind_direction} ${directionDegrees[scenarioConfiguration.wind_direction]} degree true_north/from; current direction ${scenarioConfiguration.current_direction} ${directionDegrees[scenarioConfiguration.current_direction]} degree true_north/toward; dominant wave period ${periodSeconds[scenarioConfiguration.dominant_wave_period]} s; visibility ${visibilityNmi[scenarioConfiguration.visibility]} nmi (synthetic/unvalidated, not a safety category); water level ${waterLevelMeters[scenarioConfiguration.water_level]} m at SYNTHETIC_SCENARIO_DATUM_V1, phase ${scenarioConfiguration.tide_phase}; ${scenarioConfiguration.course_template === 'windward-return-v1' ? 'windward-return-v1; origin (0, 0) meter; bounds x -500..500, y -250..1000 meter; start start (0, 0) meter; ordered marks W1 (0, 600) meter; finish finish (0, 50) meter.' : 'triangle-v1; origin (0, 0) meter; bounds x -500..500, y -250..1000 meter; start start (-100, 0) meter; ordered marks W1 (0, 600) meter, R1 (300, 300) meter; finish finish (100, 0) meter.'}`;
    return;
  }
  if (!('schema_version' in frozenReplay)) {
    scenarioDetails.textContent = 'Frozen Replay V1 has no P1B scenario snapshot. No P1B values were fabricated.';
    return;
  }
  const snapshot = frozenReplay.scenario_snapshot;
  const raw = snapshot.raw;
  const provenance = snapshot.provenance.kind === 'synthetic' ? snapshot.provenance.statement : 'historical snapshot rejected by Replay V2';
  scenarioDetails.textContent = `Frozen Replay V2 snapshot. Hash ${snapshot.content_sha256}; provenance ${provenance}; model status ${Object.values(snapshot.model_status.p1b_fields).join(', ')}. Wave direction ${raw.wave_direction_deg_true_from.value} degree true_north/from; dominant wave period ${raw.dominant_wave_period_s.value} s; wind direction ${raw.wind_direction_deg_true_from.value} degree true_north/from; current direction ${raw.current_direction_deg_true_to.value} degree true_north/toward; visibility ${raw.visibility_nm.value} nmi (synthetic/unvalidated, not a safety category); water level ${raw.water_level_m.value} m at ${raw.water_level_datum.value}, phase ${raw.water_level_tide_phase.value}; route ${formatCourse(snapshot.geometry.course_template)} Variation trace ${frozenReplay.variation_trace.algorithm_id}, seed ${frozenReplay.variation_trace.seed}.`;
}

function appendTraceEntry(target: HTMLDListElement, label: string, description: string): void {
  const term = document.createElement('dt'); term.textContent = label;
  const detail = document.createElement('dd'); detail.textContent = description;
  target.append(term, detail);
}

function traceEvidenceText(evidence: L03TraceEvidence): string {
  if (evidence.status === 'unavailable_no_runtime_record') return 'Unavailable: no runtime record.';
  return `Recorded runtime evidence. Event ID: ${evidence.event_id ?? 'unavailable'}. Recorded cause reference: ${evidence.recorded_cause ?? 'unavailable'}.`;
}

function l04TraceEvidenceText(evidence: L04TraceEvidence): string {
  if (evidence.status === 'unavailable_no_runtime_record') return 'Unavailable: no matching L04 runtime record.';
  return `Recorded L04 runtime evidence. Event ID: ${evidence.event_id ?? 'unavailable'}. Explicit cause: ${evidence.recorded_cause ?? 'unavailable'}.`;
}

function l02TraceEvidenceText(evidence: L02TraceEvidence): string {
  if (evidence.status === 'unavailable_no_runtime_record') return 'Unavailable: no exact browser-local synthetic runtime record.';
  const recordIds = evidence.record_ids?.join(', ') ?? 'unavailable';
  return evidence.recorded_cause
    ? `Recorded synthetic causality statement: ${evidence.recorded_cause}. Browser-local record IDs: ${recordIds}.`
    : `Recorded browser-local synthetic runtime evidence. Record IDs: ${recordIds}.`;
}

function l05DecisionLedgerRecordText(evidence: L05DecisionLedgerRecordEvidence, absenceNotice: string): string {
  if (evidence.status === 'unavailable_no_exact_matching_immutable_ledger_record') return absenceNotice;
  return `Record IDs: ${evidence.record_ids?.join(', ') ?? 'unavailable'}.`;
}

/** Presentation-only trust check; action authority remains in the canonical input policy. */
function hasTrustedL02Presentation(): boolean {
  const manifest = getLessonManifest(currentLesson.id);
  return currentLesson.id === 'L02' && manifest?.lesson_id === 'L02' &&
    manifest.scenario_version === currentLesson.bindings.scenario_version &&
    manifest.model_version === currentLesson.bindings.model_version &&
    manifest.boat_profile_version === currentLesson.bindings.boat_profile_version &&
    manifest.contract_version === currentLesson.bindings.contract_version &&
    manifest.coordinate_contract_version === currentLesson.bindings.coordinate_contract_version &&
    manifest.determinism_contract_version === currentLesson.bindings.determinism_contract_version &&
    manifest.comparison_policy_version === currentLesson.bindings.comparison_policy_version;
}

/** Presentation-only trust check; action authority remains in the canonical input policy. */
function hasTrustedL04Presentation(): boolean {
  const manifest = getLessonManifest(currentLesson.id);
  return currentLesson.id === 'L04' && manifest?.lesson_id === 'L04' &&
    manifest.scenario_version === currentLesson.bindings.scenario_version &&
    manifest.model_version === currentLesson.bindings.model_version &&
    manifest.boat_profile_version === currentLesson.bindings.boat_profile_version &&
    manifest.contract_version === currentLesson.bindings.contract_version &&
    manifest.coordinate_contract_version === currentLesson.bindings.coordinate_contract_version &&
    manifest.determinism_contract_version === currentLesson.bindings.determinism_contract_version &&
    manifest.comparison_policy_version === currentLesson.bindings.comparison_policy_version;
}

/** Presentation-only trust check; action authority remains in the canonical input policy. */
function hasTrustedL05Presentation(): boolean {
  const manifest = getLessonManifest(currentLesson.id);
  return currentLesson.id === 'L05' && manifest?.lesson_id === 'L05' &&
    manifest.scenario_version === currentLesson.bindings.scenario_version &&
    manifest.model_version === currentLesson.bindings.model_version &&
    manifest.boat_profile_version === currentLesson.bindings.boat_profile_version &&
    manifest.contract_version === currentLesson.bindings.contract_version &&
    manifest.coordinate_contract_version === currentLesson.bindings.coordinate_contract_version &&
    manifest.determinism_contract_version === currentLesson.bindings.determinism_contract_version &&
    manifest.comparison_policy_version === currentLesson.bindings.comparison_policy_version;
}

function render(): void {
  const load = evaluateLessonLoad(currentLesson.id, 'training-sloop-v1', currentLesson.actions, currentLesson.bindings);
  const prototype = evaluatePrototypeEligibility();
  eligibility.textContent = load.eligible && prototype.eligible
    ? `${currentLesson.id} prototype eligibility: allowed only with the persistent unvalidated notice.`
    : `${currentLesson.id} blocked: ${[...load.reasons, ...prototype.reasons].join(', ')}`;
  title.textContent = frozenReplay ? `Sailing Training Sloop — ${currentLesson.id}` : 'Sailing Training Sloop — draft';
  lessonSelect.disabled = Boolean(frozenReplay) || startInProgress;
  for (const selector of scenarioSelectors) selector.disabled = Boolean(frozenReplay) || startInProgress;
  startButton.disabled = Boolean(frozenReplay) || startInProgress;
  newSessionButton.disabled = !frozenReplay || startInProgress;
  renderScenarioDetails();
  controls.textContent = frozenReplay ? `Keyboard: ${currentLesson.controls} R saves this local attempt then resets.` : 'Start a frozen synthetic session to enable keyboard controls.';
  projection.render(session);
  hud.replaceChildren();
  for (const observation of projectLessonObservations(currentLesson.id) ?? []) {
    const term = document.createElement('dt'); term.textContent = observation.accessible_label;
    const description = document.createElement('dd');
    if (currentLesson.id === 'L01' && observation.status === 'declared_synthetic') {
      const numeric = (value: number) => value.toFixed(6);
      if (observation.key === 'true_wind_from' && session.raw.true_wind !== 'declared-unavailable') description.textContent = `Synthetic computed wind-from ${numeric(session.raw.true_wind.from_rad)} rad; synthetic speed ${numeric(session.raw.true_wind.speed_mps)} mps.`;
      else if (observation.key === 'apparent_wind' && session.raw.apparent_wind !== 'declared-unavailable') description.textContent = `Synthetic computed wind-from ${numeric(session.raw.apparent_wind.from_rad)} rad; synthetic speed ${numeric(session.raw.apparent_wind.speed_mps)} mps.`;
      else if (observation.key === 'heading' && session.raw.heading !== 'declared-unavailable') description.textContent = `Synthetic computed heading ${numeric(session.raw.heading)} rad.`;
      else if (observation.key === 'cog' && session.raw.cog !== 'declared-unavailable') description.textContent = `Synthetic computed COG ${numeric(session.raw.cog)} rad.`;
      else description.textContent = 'Synthetic computed observation unavailable.';
    } else if (currentLesson.id === 'L02' && observation.key === 'declared_trim_feedback') {
      const acknowledgment = projectL02SyntheticTrimAcknowledgment(session.raw);
      description.textContent = acknowledgment
        ? `main_trim_adjusted: ${acknowledgment.main_trim_adjusted}; jib_trim_adjusted: ${acknowledgment.jib_trim_adjusted}; last_accepted_trim: ${acknowledgment.last_accepted_trim ?? 'null'}; last_accepted_tick: ${acknowledgment.last_accepted_tick ?? 'null'}; causal_state: ${acknowledgment.causal_state}. Synthetic control-input acknowledgment — unvalidated. No sail, speed, stability, safety, or navigation response is modeled.`
        : 'Synthetic control-input acknowledgment unavailable.';
    } else description.textContent = observation.status;
    hud.append(term, description);
  }
  const l02Trace = hasTrustedL02Presentation() ? projectL02RuntimeTrace(session.raw, session.ledger) : undefined;
  l02RuntimeEvidenceSection.hidden = !l02Trace;
  l02StaticDeclarations.replaceChildren();
  l02RuntimeEvidence.replaceChildren();
  if (l02Trace) {
    appendTraceEntry(l02StaticDeclarations, l02Trace.static_declaration.trim_feedback_label, 'Declared synthetic in the trusted L02 lesson manifest; this is a static declaration, not runtime evidence.');
    appendTraceEntry(l02StaticDeclarations, l02Trace.static_declaration.trim_actions_label, 'Registered in the trusted L02 lesson manifest; this is a static declaration, not runtime evidence.');
    appendTraceEntry(l02RuntimeEvidence, l02Trace.runtime_evidence.main_action.label, l02TraceEvidenceText(l02Trace.runtime_evidence.main_action));
    appendTraceEntry(l02RuntimeEvidence, l02Trace.runtime_evidence.jib_action.label, l02TraceEvidenceText(l02Trace.runtime_evidence.jib_action));
    appendTraceEntry(l02RuntimeEvidence, l02Trace.runtime_evidence.checkpoint.label, l02TraceEvidenceText(l02Trace.runtime_evidence.checkpoint));
    l02RuntimeEvidenceBoundary.textContent = l02Trace.boundary_copy;
  } else {
    l02RuntimeEvidenceBoundary.textContent = '';
  }
  const l03Trace = projectL03RuntimeTrace(session.raw, session.ledger);
  l03TraceSection.hidden = !l03Trace;
  l03StaticTrace.replaceChildren();
  l03RuntimeTrace.replaceChildren();
  if (l03Trace) {
    appendTraceEntry(l03StaticTrace, l03Trace.static_declaration.episode_label, 'Declared synthetic in the trusted L03 lesson manifest; not a runtime record.');
    appendTraceEntry(l03StaticTrace, l03Trace.static_declaration.reef_action_label, 'Registered in the trusted L03 lesson manifest; not a runtime record.');
    appendTraceEntry(l03RuntimeTrace, l03Trace.runtime_trace.episode.label, traceEvidenceText(l03Trace.runtime_trace.episode));
    appendTraceEntry(l03RuntimeTrace, l03Trace.runtime_trace.reef_action.label, traceEvidenceText(l03Trace.runtime_trace.reef_action));
    appendTraceEntry(l03RuntimeTrace, l03Trace.runtime_trace.checkpoint.label, traceEvidenceText(l03Trace.runtime_trace.checkpoint));
    l03TraceBoundary.textContent = l03Trace.boundary_copy;
  } else {
    l03TraceBoundary.textContent = '';
  }
  const l04Trace = hasTrustedL04Presentation() ? projectL04RuntimeTrace(session.raw, session.ledger) : undefined;
  l04RuntimeEvidenceSection.hidden = !l04Trace;
  l04StaticDeclarations.replaceChildren();
  l04RuntimeEvidence.replaceChildren();
  if (l04Trace) {
    appendTraceEntry(l04StaticDeclarations, l04Trace.static_declaration.mark_relation_label, 'Declared synthetic in the trusted L04 lesson manifest; this is a static declaration, not runtime evidence.');
    appendTraceEntry(l04StaticDeclarations, l04Trace.static_declaration.helm_action_label, 'Registered in the trusted L04 lesson manifest; this is a static declaration, not runtime evidence.');
    appendTraceEntry(l04RuntimeEvidence, l04Trace.runtime_evidence.miss.label, l04TraceEvidenceText(l04Trace.runtime_evidence.miss));
    appendTraceEntry(l04RuntimeEvidence, l04Trace.runtime_evidence.correction.label, l04TraceEvidenceText(l04Trace.runtime_evidence.correction));
    l04RuntimeEvidenceBoundary.textContent = l04Trace.boundary_copy;
  } else {
    l04RuntimeEvidenceBoundary.textContent = '';
  }
  const l05DecisionLedger = hasTrustedL05Presentation() ? projectL05DecisionLedger(session.ledger) : undefined;
  l05DecisionLedgerSection.hidden = !l05DecisionLedger;
  l05AcceptedActionRecords.replaceChildren();
  l05CheckpointRecords.replaceChildren();
  if (l05DecisionLedger) {
    appendTraceEntry(l05AcceptedActionRecords, 'pass', l05DecisionLedgerRecordText(l05DecisionLedger.accepted_action_records.pass, l05DecisionLedger.absence_notice));
    appendTraceEntry(l05AcceptedActionRecords, 'wait', l05DecisionLedgerRecordText(l05DecisionLedger.accepted_action_records.wait, l05DecisionLedger.absence_notice));
    appendTraceEntry(l05AcceptedActionRecords, 'return', l05DecisionLedgerRecordText(l05DecisionLedger.accepted_action_records.return, l05DecisionLedger.absence_notice));
    appendTraceEntry(l05CheckpointRecords, 'pass', l05DecisionLedgerRecordText(l05DecisionLedger.checkpoint_records.pass, l05DecisionLedger.absence_notice));
    appendTraceEntry(l05CheckpointRecords, 'wait', l05DecisionLedgerRecordText(l05DecisionLedger.checkpoint_records.wait, l05DecisionLedger.absence_notice));
    appendTraceEntry(l05CheckpointRecords, 'return', l05DecisionLedgerRecordText(l05DecisionLedger.checkpoint_records.return, l05DecisionLedger.absence_notice));
    l05DecisionLedgerBoundary.textContent = l05DecisionLedger.boundary_notice;
    l05DecisionLedgerOrdering.textContent = l05DecisionLedger.ordering_notice;
  } else {
    l05DecisionLedgerBoundary.textContent = '';
    l05DecisionLedgerOrdering.textContent = '';
  }
  pause.textContent = !frozenReplay ? 'DRAFT — no logical session is running.' : session.paused ? 'PAUSED — explicit resume required; logical state is not progressing.' : 'RUNNING — logical tick scheduler active.';
  const score = projectScore(session.raw, session.ledger);
  debrief.replaceChildren();
  for (const fact of projectDebrief(session.raw, session.ledger)) {
    const item = document.createElement('li');
    item.textContent = fact.kind === 'contract_status'
      ? 'Simulation contract status: unvalidated domain model.'
      : fact.kind === 'synthetic_transition'
        ? `Synthetic educational transition recorded by immutable ledger event ${fact.cause_event_id ?? 'none'}; unvalidated and not navigation or safety guidance.`
        : `${fact.kind.replaceAll('_', ' ')} caused by immutable ledger event ${fact.cause_event_id ?? 'none'}.`;
    debrief.append(item);
  }
  const l02Acknowledgment = projectL02SyntheticTrimAcknowledgment(session.raw);
  if (l02Acknowledgment) {
    const item = document.createElement('li');
    item.textContent = `L02 acknowledgment: main_trim_adjusted ${l02Acknowledgment.main_trim_adjusted}; jib_trim_adjusted ${l02Acknowledgment.jib_trim_adjusted}; last_accepted_trim ${l02Acknowledgment.last_accepted_trim ?? 'null'}; last_accepted_tick ${l02Acknowledgment.last_accepted_tick ?? 'null'}; causal_state ${l02Acknowledgment.causal_state}. Synthetic control-input acknowledgment — unvalidated. No sail, speed, stability, safety, or navigation response is modeled.`;
    debrief.append(item);
  }
  const scoreItem = document.createElement('li');
  scoreItem.textContent = `Score status: ${score.status}; no validated numeric score is claimed.`;
  debrief.append(scoreItem);
  if (l03Trace) {
    const staticItem = document.createElement('li');
    staticItem.textContent = `${l03Trace.static_declaration.heading}: ${l03Trace.static_declaration.episode_label} and ${l03Trace.static_declaration.reef_action_label} are declarations, not runtime records.`;
    debrief.append(staticItem);
    for (const evidence of [l03Trace.runtime_trace.episode, l03Trace.runtime_trace.reef_action, l03Trace.runtime_trace.checkpoint]) {
      const item = document.createElement('li');
      item.textContent = `${l03Trace.runtime_trace.heading} — ${evidence.label}: ${traceEvidenceText(evidence)}`;
      debrief.append(item);
    }
    const boundaryItem = document.createElement('li');
    boundaryItem.textContent = l03Trace.boundary_copy;
    debrief.append(boundaryItem);
  }
  storage.textContent = storageStatus;
}

async function refreshReplays(): Promise<void> {
  try {
    const records = await listLocalReplays();
    replays.replaceChildren();
    for (const record of records) {
      const item = document.createElement('li');
      const load = document.createElement('button');
      load.type = 'button'; load.textContent = `Load ${record.id}`;
      load.addEventListener('click', () => { void loadReplay(record); });
      const remove = document.createElement('button');
      remove.type = 'button'; remove.textContent = `Delete ${record.id}`;
      remove.addEventListener('click', async () => {
        try { await deleteLocalReplay(record.id); storageStatus = `Deleted local replay ${record.id}.`; await refreshReplays(); }
        catch { storageStatus = 'Local storage failure: replay was not changed.'; render(); }
      });
      item.append(load, remove); replays.append(item);
    }
    storageStatus = records.length === 0 ? 'No saved local attempts.' : `Saved local attempts: ${records.length}.`;
  } catch {
    storageStatus = 'Local storage unavailable: canonical simulation continues without saving.';
  }
  render();
}

async function loadReplay(record: LocalReplayRecord): Promise<void> {
  if (typeof record.payload === 'object' && record.payload !== null && !Array.isArray(record.payload) && (record.payload as { schema_version?: unknown }).schema_version === 'replay-v2') {
    const validation = await resolveReplayV2(record.payload);
    if (validation.outcome !== 'accepted') { storageStatus = `Replay not run: ${validation.reason_code}. Original local payload was preserved.`; render(); return; }
    const accepted = validation.replay; const lesson = lessons.find((candidate) => candidate.id === accepted.lesson_binding.lesson_id);
    if (!lesson) { storageStatus = 'Replay not run: REPLAY_V2_SCHEMA_INVALID. Original local payload was preserved.'; render(); return; }
    const canonicalInputs = accepted.ordered_input_log.filter(isCanonicalInput);
    if (canonicalInputs.length !== accepted.ordered_input_log.length) { storageStatus = 'Replay not run: REPLAY_PAYLOAD_CORRUPT. Original local payload was preserved.'; render(); return; }
    const terminalTick = accepted.lesson_binding.lesson_id === 'L01'
      ? accepted.l01_terminal_logical_tick
      : accepted.lesson_binding.lesson_id === 'L02'
        ? accepted.l02_terminal_logical_tick
      : canonicalInputs.reduce((highest, input) => Math.max(highest, input.logical_tick), 0) + 1;
    if (typeof terminalTick !== 'number' || !Number.isSafeInteger(terminalTick) || terminalTick < 0) { storageStatus = 'Replay not run: REPLAY_V2_SCHEMA_INVALID. Original local payload was preserved.'; render(); return; }
    const candidateReplay: ReplayV2 = { ...accepted, ordered_input_log: canonicalInputs };
    let restoredSession;
    try {
      restoredSession = replayInputs(candidateReplay, canonicalInputs, terminalTick);
    } catch {
      storageStatus = 'Replay not run: REPLAY_V2_SCHEMA_INVALID. Original local payload was preserved.';
      render();
      return;
    }
    scheduler.stop(); currentLesson = lesson; lessonSelect.value = lesson.id; frozenReplay = candidateReplay; inputLog = canonicalInputs; seed = accepted.seed; nextSequence = inputLog.reduce((highest, input) => Math.max(highest, input.sequence), 0) + 1;
    session = restoredSession; if (!session.paused) scheduler.start(); startStatus.textContent = 'Loaded frozen Replay V2 identity.'; storageStatus = `Loaded local replay ${record.id}; replay inputs were validated and applied.`; render(); title.focus(); return;
  }
  const scenarioVersion = typeof record.payload === 'object' && record.payload !== null && !Array.isArray(record.payload)
    ? (record.payload as { scenario_version?: unknown }).scenario_version : undefined;
  const lesson = lessons.find((candidate) => candidate.bindings.scenario_version === scenarioVersion);
  const validation = resolveStoredReplay(record.payload, lesson?.bindings ?? l01ReplayBindings);
  if (validation.outcome !== 'accepted') { storageStatus = `Replay not run: ${validation.reason_code}. Original local payload was preserved.`; render(); return; }
  if (!lesson) { storageStatus = 'Replay not run: REPLAY_IDENTITY_INCOMPATIBLE. Original local payload was preserved.'; render(); return; }
  const acceptedPayload = validation.replay;
  const canonicalInputs = acceptedPayload.ordered_input_log.filter(isCanonicalInput);
  if (canonicalInputs.length !== acceptedPayload.ordered_input_log.length) { storageStatus = 'Replay not run: REPLAY_PAYLOAD_CORRUPT. Original local payload was preserved.'; render(); return; }
  scheduler.stop(); currentLesson = lesson;
  lessonSelect.value = lesson.id;
  inputLog = canonicalInputs;
  nextSequence = inputLog.reduce((highest, input) => Math.max(highest, input.sequence), 0) + 1;
  const terminalTick = inputLog.reduce((highest, input) => Math.max(highest, input.logical_tick), 0) + 1;
  seed = acceptedPayload.seed;
  frozenReplay = { ...currentLesson.bindings, seed, ordered_input_log: inputLog };
  session = replayInputs(frozenReplay, inputLog, terminalTick); scheduler.start(); startStatus.textContent = 'Loaded frozen legacy Replay V1 identity.';
  storageStatus = `Loaded local replay ${record.id}; replay inputs were validated and applied.`;
  render();
}

function isCanonicalInput(input: ReplayIdentity['ordered_input_log'][number]): input is CanonicalInput {
  return typeof input.input === 'object' && input.input !== null && 'action' in input.input &&
    ['helm_port', 'helm_starboard', 'main_trim', 'jib_trim', 'reef', 'decision_pass', 'decision_wait', 'decision_return', 'pause', 'resume', 'reset'].includes((input.input as { action?: unknown }).action as string);
}

async function saveAttemptThenReset(): Promise<void> {
  if (!frozenReplay) return;
  const record: LocalReplayRecord = { id: `attempt-${crypto.randomUUID()}`, created_at: new Date().toISOString(), payload: replayPayload() };
  try { await saveLocalReplay(record); storageStatus = `Saved local attempt ${record.id}.`; }
  catch { storageStatus = 'Local storage failure: reset did not alter canonical simulation history.'; }
  inputLog = []; nextSequence = 1;
  frozenReplay = { ...frozenReplay, ordered_input_log: inputLog };
  session = createSession(frozenReplay);
  await refreshReplays();
}

function applyAction(action: CanonicalInput['input']['action']): void {
  if (!frozenReplay) return;
  if (!isLessonActionAllowed(currentLesson.bindings, action)) return;
  if (action === 'reset') { void saveAttemptThenReset(); return; }
  const input: CanonicalInput = { logical_tick: session.raw.logical_tick, sequence: nextSequence++, input: { action } };
  inputLog = [...inputLog, input];
  session = applyCanonicalInput(session, input);
  if (action === 'pause') scheduler.stop();
  if (action === 'resume') scheduler.start();
  render();
}

const scheduler = createLogicalScheduler(() => {
  if (!frozenReplay) return;
  session = advanceLogicalTick(session);
  render();
});

cadenceSelect.addEventListener('change', () => {
  const cadence = Number(cadenceSelect.value);
  if (!BROWSER_CADENCE_PRESETS.includes(cadence as BrowserCadenceMs)) return;
  scheduler.setCadence(cadence as BrowserCadenceMs);
});

function processBrowserSignal(signal: PendingBrowserSignal): void {
  if (signal.kind === 'keyboard') {
    const action = normalizeKeyboardAction(signal.key, signal.repeat, session.paused, currentLesson.actions);
    if (action) applyAction(action);
    return;
  }
  lifecyclePause(signal.reason);
}

window.addEventListener('keydown', (event) => {
  const action = normalizeKeyboardAction(event.key, event.repeat, session.paused, currentLesson.actions);
  if (!action) return;
  event.preventDefault();
  const signal: PendingBrowserSignal = { kind: 'keyboard', key: event.key, repeat: event.repeat };
  if (!applicationReady) { pendingBrowserSignals.push(signal); return; }
  processBrowserSignal(signal);
});
function lifecyclePause(reason: 'focus_lost' | 'visibility_hidden'): void {
  if (!frozenReplay) return;
  scheduler.stop();
  session = pauseForLifecycle(session, reason, nextSequence);
  render();
}
function receiveLifecyclePause(reason: 'focus_lost' | 'visibility_hidden'): void {
  const signal: PendingBrowserSignal = { kind: 'lifecycle', reason };
  if (!applicationReady) { pendingBrowserSignals.push(signal); return; }
  processBrowserSignal(signal);
}
window.addEventListener('blur', () => receiveLifecyclePause('focus_lost'));
document.addEventListener('visibilitychange', () => { if (document.hidden) receiveLifecyclePause('visibility_hidden'); });
lessonSelect.addEventListener('change', () => {
  const next = lessons.find((lesson) => lesson.id === lessonSelect.value);
  if (!next || next.id === currentLesson.id) return;
  currentLesson = next;
  render();
});

for (const selector of scenarioSelectors) selector.addEventListener('change', () => {
  scenarioConfiguration = {
    wave: requiredElement<HTMLSelectElement>('#wave-select').value as ScenarioConfiguration['wave'], current: requiredElement<HTMLSelectElement>('#current-select').value as ScenarioConfiguration['current'], wind: requiredElement<HTMLSelectElement>('#wind-select').value as ScenarioConfiguration['wind'], gust: requiredElement<HTMLSelectElement>('#gust-select').value as ScenarioConfiguration['gust'], weather: requiredElement<HTMLSelectElement>('#weather-select').value as ScenarioConfiguration['weather'], day: 'fixed', variation: requiredElement<HTMLSelectElement>('#variation-select').value as ScenarioConfiguration['variation'], wave_direction: requiredElement<HTMLSelectElement>('#wave-direction-select').value as ScenarioConfiguration['wave_direction'], wind_direction: requiredElement<HTMLSelectElement>('#wind-direction-select').value as ScenarioConfiguration['wind_direction'], current_direction: requiredElement<HTMLSelectElement>('#current-direction-select').value as ScenarioConfiguration['current_direction'], dominant_wave_period: requiredElement<HTMLSelectElement>('#dominant-wave-period-select').value as ScenarioConfiguration['dominant_wave_period'], visibility: requiredElement<HTMLSelectElement>('#visibility-select').value as ScenarioConfiguration['visibility'], water_level: requiredElement<HTMLSelectElement>('#water-level-select').value as ScenarioConfiguration['water_level'], tide_phase: requiredElement<HTMLSelectElement>('#tide-phase-select').value as ScenarioConfiguration['tide_phase'], course_template: requiredElement<HTMLSelectElement>('#course-template-select').value as ScenarioConfiguration['course_template'],
  };
  render();
});
startButton.addEventListener('click', () => { void startFrozenSession(); });
newSessionButton.addEventListener('click', () => {
  scheduler.stop(); frozenReplay = undefined; inputLog = []; nextSequence = 1; seed = `${currentLesson.id.toLowerCase()}-prototype-seed`; session = createSession({ ...currentLesson.bindings, seed, ordered_input_log: inputLog }); startStatus.textContent = 'Draft restored. Choose controls and Start.'; render();
});
async function startFrozenSession(): Promise<void> {
  if (frozenReplay || startInProgress) return;
  startInProgress = true; startStatus.textContent = 'Starting: validating and freezing synthetic scenario.'; render();
  try {
    const scenario = await createSyntheticScenario(scenarioConfiguration); const validated = await validateScenarioPackage(scenario); if (!validated.ok) throw new Error(validated.reason_code); seed = `${currentLesson.id.toLowerCase()}-prototype-seed`; const { scenario_version: _legacyScenario, l01_synthetic_environment, ...bindings } = currentLesson.bindings; const lessonBinding = { lesson_id: currentLesson.id, ...bindings }; const trace = await materializeVariation(validated.scenario, seed);
    frozenReplay = Object.freeze({ schema_version: 'replay-v2' as const, lesson_binding: Object.freeze(lessonBinding), scenario_snapshot: validated.scenario, variation_trace: trace, seed, ordered_input_log: Object.freeze([]), ...(currentLesson.id === 'L01' ? { l01_synthetic_environment, l01_terminal_logical_tick: 0, l01_terminal_paused: false } : {}), ...(currentLesson.id === 'L02' ? { l02_synthetic_trim_profile: l02SyntheticTrimProfileV1, l02_terminal_logical_tick: 0, l02_terminal_paused: false } : {}) }); inputLog = []; nextSequence = 1; session = createSession(frozenReplay); startStatus.textContent = 'Started: lesson, synthetic scenario, and variation trace are frozen.'; scheduler.start(); render(); title.focus();
  } catch { startStatus.textContent = 'Start failed: SCENARIO_SCHEMA_INVALID. Draft controls remain editable.'; }
  startInProgress = false; render();
}

projection = await createWorldProjection(world);
applicationReady = true;
for (const signal of pendingBrowserSignals) processBrowserSignal(signal);

render();
void refreshReplays();
