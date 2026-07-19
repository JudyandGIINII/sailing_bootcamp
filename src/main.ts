import { evaluateLessonLoad, evaluatePrototypeEligibility } from './gates/eligibility.js';
import { normalizeKeyboardAction } from './app/input.js';
import { createLogicalScheduler } from './app/scheduler.js';
import { createWorldProjection } from './render/world-projection.js';
import { deleteLocalReplay, listLocalReplays, saveLocalReplay, type LocalReplayRecord } from './storage/replays.js';
import { l01ReplayBindings } from './content/l01.js';
import { l02ReplayBindings, l03ReplayBindings, l04ReplayBindings, l05ReplayBindings } from './content/l02-l05.js';
import { getLessonManifest, isLessonActionAllowed } from './content/lesson-manifest.js';
import { resolveStoredReplay, type ReplayIdentity } from './contracts/replay.js';
import { applyCanonicalInput, advanceLogicalTick, createSession, pauseForLifecycle, replayInputs, type CanonicalInput } from './sim/session.js';
import { projectDebrief, projectScore } from './scoring/projection.js';

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
let storageStatus = 'Local replay storage ready.';

mount.innerHTML = `
  <main>
    <h1 id="lesson-title">Sailing Training Sloop — L01</h1>
    <p class="notice" role="note">Simulation-only prototype • Unvalidated content • Not navigation, safety, or certification guidance.</p>
    <section aria-labelledby="lesson-heading"><h2 id="lesson-heading">Training module selection</h2><label for="lesson-select">Lesson</label><select id="lesson-select"><option>L01</option><option>L02</option><option>L03</option><option>L04</option><option>L05</option></select><p>Every lesson is an <strong>assumption</strong>; labels and text, not color alone, communicate that status.</p></section>
    <p id="eligibility" role="status"></p>
    <section aria-labelledby="world-heading"><h2 id="world-heading">Synthetic training water</h2><div id="world"></div></section>
    <section aria-labelledby="hud-heading"><h2 id="hud-heading">Accessible status HUD</h2>
      <dl id="hud"></dl>
      <p id="controls"></p>
      <p id="pause" role="status"></p>
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
const title = requiredElement<HTMLElement>('#lesson-title');
const controls = requiredElement<HTMLElement>('#controls');
const lessonSelect = requiredElement<HTMLSelectElement>('#lesson-select');

type PendingBrowserSignal =
  | { kind: 'keyboard'; key: string; repeat: boolean }
  | { kind: 'lifecycle'; reason: 'focus_lost' | 'visibility_hidden' };

let projection: Awaited<ReturnType<typeof createWorldProjection>>;
let applicationReady = false;
const pendingBrowserSignals: PendingBrowserSignal[] = [];

function replayPayload(): unknown {
  return { ...currentLesson.bindings, seed, ordered_input_log: inputLog };
}

function render(): void {
  const load = evaluateLessonLoad(currentLesson.id, 'training-sloop-v1', currentLesson.actions, currentLesson.bindings);
  const prototype = evaluatePrototypeEligibility();
  eligibility.textContent = load.eligible && prototype.eligible
    ? `${currentLesson.id} prototype eligibility: allowed only with the persistent unvalidated notice.`
    : `${currentLesson.id} blocked: ${[...load.reasons, ...prototype.reasons].join(', ')}`;
  title.textContent = `Sailing Training Sloop — ${currentLesson.id}`;
  controls.textContent = `Keyboard: ${currentLesson.controls} R saves this local attempt then resets.`;
  projection.render(session);
  hud.replaceChildren();
  const fields: [string, string][] = [
    ['Logical tick', String(session.raw.logical_tick)],
    ['Helm command', session.raw.helm_command],
    ['Heading', session.raw.heading],
    ['COG', session.raw.cog],
    ['True wind', session.raw.true_wind],
    ['Apparent wind', session.raw.apparent_wind],
    ['Domain status', 'Declared unavailable: validation pending'],
  ];
  if (session.raw.main_trim) fields.push(['Main trim', session.raw.main_trim]);
  if (session.raw.jib_trim) fields.push(['Jib trim', session.raw.jib_trim]);
  if (session.raw.reef_state) fields.push(['Reef state', session.raw.reef_state]);
  if (session.raw.synthetic_episode) fields.push(['Synthetic episode', session.raw.synthetic_episode]);
  if (session.raw.declared_navigation_concepts) fields.push(['Synthetic concepts', session.raw.declared_navigation_concepts]);
  if (session.raw.mark_state) fields.push(['Virtual mark state', session.raw.mark_state]);
  if (session.raw.synthetic_environment) fields.push(['Synthetic environment', session.raw.synthetic_environment]);
  if (session.raw.decision_state) fields.push(['Decision state', session.raw.decision_state]);
  for (const [label, value] of fields) {
    const term = document.createElement('dt'); term.textContent = label;
    const description = document.createElement('dd'); description.textContent = value;
    hud.append(term, description);
  }
  pause.textContent = session.paused ? 'PAUSED — explicit resume required; logical state is not progressing.' : 'RUNNING — logical tick scheduler active.';
  const score = projectScore(session.raw, session.ledger);
  debrief.replaceChildren();
  for (const fact of projectDebrief(session.raw, session.ledger)) {
    const item = document.createElement('li');
    item.textContent = fact.kind === 'contract_status'
      ? 'Simulation contract status: unvalidated domain model.'
      : `${fact.kind.replaceAll('_', ' ')} caused by raw event ${fact.cause_event_id ?? 'none'}.`;
    debrief.append(item);
  }
  const scoreItem = document.createElement('li');
  scoreItem.textContent = `Score status: ${score.status}; no validated numeric score is claimed.`;
  debrief.append(scoreItem);
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
      load.addEventListener('click', () => loadReplay(record));
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

function loadReplay(record: LocalReplayRecord): void {
  const scenarioVersion = typeof record.payload === 'object' && record.payload !== null && !Array.isArray(record.payload)
    ? (record.payload as { scenario_version?: unknown }).scenario_version : undefined;
  const lesson = lessons.find((candidate) => candidate.bindings.scenario_version === scenarioVersion);
  const validation = resolveStoredReplay(record.payload, lesson?.bindings ?? l01ReplayBindings);
  if (validation.outcome !== 'accepted') { storageStatus = `Replay not run: ${validation.reason_code}. Original local payload was preserved.`; render(); return; }
  if (!lesson) { storageStatus = 'Replay not run: REPLAY_IDENTITY_INCOMPATIBLE. Original local payload was preserved.'; render(); return; }
  const acceptedPayload = validation.replay;
  const canonicalInputs = acceptedPayload.ordered_input_log.filter(isCanonicalInput);
  if (canonicalInputs.length !== acceptedPayload.ordered_input_log.length) { storageStatus = 'Replay not run: REPLAY_PAYLOAD_CORRUPT. Original local payload was preserved.'; render(); return; }
  currentLesson = lesson;
  lessonSelect.value = lesson.id;
  inputLog = canonicalInputs;
  nextSequence = inputLog.reduce((highest, input) => Math.max(highest, input.sequence), 0) + 1;
  const terminalTick = inputLog.reduce((highest, input) => Math.max(highest, input.logical_tick), 0) + 1;
  seed = acceptedPayload.seed;
  session = replayInputs({ ...currentLesson.bindings, seed, ordered_input_log: inputLog }, inputLog, terminalTick);
  storageStatus = `Loaded local replay ${record.id}; replay inputs were validated and applied.`;
  render();
}

function isCanonicalInput(input: ReplayIdentity['ordered_input_log'][number]): input is CanonicalInput {
  return typeof input.input === 'object' && input.input !== null && 'action' in input.input &&
    ['helm_port', 'helm_starboard', 'main_trim', 'jib_trim', 'reef', 'decision_pass', 'decision_wait', 'decision_return', 'pause', 'resume', 'reset'].includes((input.input as { action?: unknown }).action as string);
}

async function saveAttemptThenReset(): Promise<void> {
  const record: LocalReplayRecord = { id: `attempt-${crypto.randomUUID()}`, created_at: new Date().toISOString(), payload: replayPayload() };
  try { await saveLocalReplay(record); storageStatus = `Saved local attempt ${record.id}.`; }
  catch { storageStatus = 'Local storage failure: reset did not alter canonical simulation history.'; }
  inputLog = []; nextSequence = 1;
  session = createSession({ ...currentLesson.bindings, seed, ordered_input_log: inputLog });
  await refreshReplays();
}

function applyAction(action: CanonicalInput['input']['action']): void {
  if (!isLessonActionAllowed(currentLesson.bindings, action)) return;
  if (action === 'reset') { void saveAttemptThenReset(); return; }
  const input: CanonicalInput = { logical_tick: session.raw.logical_tick, sequence: nextSequence++, input: { action } };
  inputLog = [...inputLog, input];
  session = applyCanonicalInput(session, input);
  if (action === 'pause') scheduler.stop();
  if (action === 'resume') scheduler.start();
  render();
}

const scheduler = createLogicalScheduler(() => { session = advanceLogicalTick(session); render(); });

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
  scheduler.stop();
  currentLesson = next;
  seed = `${next.id.toLowerCase()}-prototype-seed`;
  inputLog = []; nextSequence = 1;
  session = createSession({ ...next.bindings, seed, ordered_input_log: inputLog });
  scheduler.start();
  render();
});

projection = await createWorldProjection(world);
applicationReady = true;
for (const signal of pendingBrowserSignals) processBrowserSignal(signal);

render();
void refreshReplays();
scheduler.start();
