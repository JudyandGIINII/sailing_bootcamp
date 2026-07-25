import { createP4Attempt, currentP4Score, reduceP4Attempt, type P4UserRecord } from '../p4/in-memory-attempt.js';
import { retryP4Attempt } from '../p4/retry.js';
import { captureP5TerminalAttempt, createP5ComparisonHistory, type P5AvailableComparison, type P5ComparisonHistory, type P5Debrief, type P5TerminalSnapshot } from './debrief-comparison.js';

const mountElement = document.querySelector<HTMLElement>('#p5-app');
if (!mountElement) throw new Error('P5 mount is missing.');
const mount: HTMLElement = mountElement;

type Screen = 'entry' | 'onboarding' | 'active' | 'end-confirm' | 'debrief';
let screen: Screen = 'entry';
let attempt = createP4Attempt();
let history: P5ComparisonHistory = createP5ComparisonHistory();
let terminalDebrief: P5Debrief | undefined;
let nextTick = 1;
let nextSequence = 1;
let status = 'Ready for a synthetic memory-only attempt.';

mount.innerHTML = `
  <h1 tabindex="-1" id="p5-heading">Scenario 1 — Synthetic Debrief Comparison</h1>
  <p class="boundary" role="note">Synthetic, unvalidated, memory-only training display. Not navigation, sailing advice, safety guidance, certification, or validated physical causation.</p>
  <p class="boundary" role="note">This page keeps at most two eligible terminated attempts only until reload or navigation. It does not save, send, or reuse data.</p>
  <section class="card" id="entry-card"><h2>Scenario 1</h2><p>Use abstract controls, then review previous/current values and their difference.</p><button type="button" id="start">Start</button></section>
  <section class="card" id="onboarding" hidden><h2>Before you begin</h2><p>Controls and target are synthetic. The frozen score is an unvalidated calibration and does not classify an attempt.</p><p>After the first terminated attempt, the debrief has no prior same-condition comparison. A retry may show a previous/current comparison.</p><button type="button" id="enter-active">Enter active play</button></section>
  <section class="layout" id="active" hidden>
    <section class="world" aria-labelledby="world-title"><h2 id="world-title">Abstract synthetic world</h2><div class="world-art">SYNTHETIC TARGET / CONTROL STATUS<br />No coast, chart, weather, camera, or physical model.</div><dl id="hud" aria-live="polite"></dl><p id="runtime-status" role="status"></p><button type="button" id="pause-toggle">Pause</button><button type="button" id="end">End Voyage</button></section>
    <section class="deck" aria-label="Synthetic control tray"><h2>Control tray</h2><div class="controls" id="controls"></div></section>
  </section>
  <section class="card" id="end-confirm" hidden><h2>End Voyage?</h2><p>The current synthetic score will freeze. This does not classify the attempt.</p><button type="button" id="confirm-end">Confirm End Voyage</button><button type="button" id="cancel-end">Keep playing</button></section>
  <section class="card" id="debrief" hidden><h2>Frozen synthetic debrief</h2><p id="debrief-status"></p><section aria-labelledby="terminal-values"><h3 id="terminal-values">Current terminal values</h3><dl id="contributors"></dl></section><section id="comparison" aria-labelledby="comparison-title"></section><button type="button" id="retry">Retry same seed</button></section>
`;

function required<T extends Element>(selector: string): T {
  const element = mount.querySelector<T>(selector);
  if (!element) throw new Error(`P5 element missing: ${selector}`);
  return element;
}

const heading = required<HTMLElement>('#p5-heading');
const entryCard = required<HTMLElement>('#entry-card');
const onboarding = required<HTMLElement>('#onboarding');
const active = required<HTMLElement>('#active');
const endConfirm = required<HTMLElement>('#end-confirm');
const debrief = required<HTMLElement>('#debrief');
const hud = required<HTMLDListElement>('#hud');
const runtimeStatus = required<HTMLElement>('#runtime-status');
const controls = required<HTMLElement>('#controls');
let tableScrollRegionSequence = 0;
type P5ControlFocusToken =
  | 'heading-decrease' | 'heading-increase' | 'engine-decrease' | 'engine-increase'
  | 'main-deployment' | 'jib-deployment'
  | 'main-trim-decrease' | 'main-trim-increase' | 'jib-trim-decrease' | 'jib-trim-increase'
  | 'main-reef-decrease' | 'main-reef-increase' | 'jib-reef-decrease' | 'jib-reef-increase';

function setScreen(next: Screen): void {
  screen = next;
  entryCard.hidden = next !== 'entry'; onboarding.hidden = next !== 'onboarding'; active.hidden = next !== 'active'; endConfirm.hidden = next !== 'end-confirm'; debrief.hidden = next !== 'debrief';
  heading.focus();
  render();
}

function addDefinition(list: HTMLDListElement, label: string, value: string): void {
  const term = document.createElement('dt'); term.textContent = label;
  const detail = document.createElement('dd'); detail.textContent = value;
  list.append(term, detail);
}

function submit(kind: P4UserRecord['kind'], payload: unknown, focusToken?: P5ControlFocusToken): boolean {
  const result = reduceP4Attempt(attempt, { logical_tick: nextTick, sequence: nextSequence, kind, payload });
  if (result.status !== 'accepted') {
    status = result.status === 'rejected_post_terminal' ? 'Unavailable: the frozen attempt rejected this input.' : 'Unavailable: input validation rejected this input.';
    render();
    return false;
  }
  attempt = result.state;
  nextTick += 1;
  nextSequence = attempt.records.at(-1)!.sequence + 1;
  status = kind === 'end_voyage' ? 'Synthetic score frozen for this memory-only attempt.' : 'Synthetic control committed in canonical logical order.';
  render();
  if (focusToken) restoreControlFocus(focusToken);
  return true;
}

function restoreControlFocus(token: P5ControlFocusToken): void {
  const replacement = Array.from(controls.querySelectorAll<HTMLButtonElement>('button')).find((button) => button.dataset.p5ControlFocusToken === token);
  replacement?.focus();
}

function control(label: string, action: unknown, focusToken: P5ControlFocusToken): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button'; button.textContent = label; button.setAttribute('aria-label', label); button.dataset.p5ControlFocusToken = focusToken;
  let pointerActivated = false;
  button.addEventListener('pointerdown', () => { pointerActivated = true; });
  button.addEventListener('click', (event) => {
    const logicalFocusToken = !pointerActivated && event.detail === 0 ? focusToken : undefined;
    pointerActivated = false;
    submit('p2_action', action, logicalFocusToken);
  });
  return button;
}

function renderControls(): void {
  controls.replaceChildren();
  const current = attempt.p2_state.controls;
  const cards: Array<[string, HTMLButtonElement[]]> = [
    ['Heading', [control('Heading −100', { type: 'set_heading_centidegrees', heading_centidegrees: (current.headingCentidegrees + 35900) % 36000 }, 'heading-decrease'), control('Heading +100', { type: 'set_heading_centidegrees', heading_centidegrees: (current.headingCentidegrees + 100) % 36000 }, 'heading-increase')]],
    ['Engine', [control('Engine −100', { type: 'set_engine_output', engine_output: Math.max(-10000, current.engineOutput - 100) }, 'engine-decrease'), control('Engine +100', { type: 'set_engine_output', engine_output: Math.min(10000, current.engineOutput + 100) }, 'engine-increase')]],
    ['Main deployment', [control(current.mainDeployed ? 'Retract main' : 'Deploy main', { type: 'set_main_deployed', main_deployed: !current.mainDeployed }, 'main-deployment')]],
    ['Jib deployment', [control(current.jibDeployed ? 'Retract jib' : 'Deploy jib', { type: 'set_jib_deployed', jib_deployed: !current.jibDeployed }, 'jib-deployment')]],
    ['Main trim', [control('Main trim −1', { type: 'set_main_trim', main_trim: Math.max(0, current.mainTrim - 1) }, 'main-trim-decrease'), control('Main trim +1', { type: 'set_main_trim', main_trim: Math.min(10000, current.mainTrim + 1) }, 'main-trim-increase')]],
    ['Jib trim', [control('Jib trim −1', { type: 'set_jib_trim', jib_trim: Math.max(0, current.jibTrim - 1) }, 'jib-trim-decrease'), control('Jib trim +1', { type: 'set_jib_trim', jib_trim: Math.min(10000, current.jibTrim + 1) }, 'jib-trim-increase')]],
    ['Main reef', [control('Main reef −1', { type: 'set_main_reef_level', main_reef_level: Math.max(0, current.mainReefLevel - 1) }, 'main-reef-decrease'), control('Main reef +1', { type: 'set_main_reef_level', main_reef_level: Math.min(2, current.mainReefLevel + 1) }, 'main-reef-increase')]],
    ['Jib reef', [control('Jib reef −1', { type: 'set_jib_reef_level', jib_reef_level: Math.max(0, current.jibReefLevel - 1) }, 'jib-reef-decrease'), control('Jib reef +1', { type: 'set_jib_reef_level', jib_reef_level: Math.min(2, current.jibReefLevel + 1) }, 'jib-reef-increase')]],
  ];
  for (const [label, buttons] of cards) {
    const card = document.createElement('div'); card.className = 'control';
    const title = document.createElement('strong'); title.textContent = label;
    for (const button of buttons) button.disabled = attempt.p2_state.status === 'paused';
    card.append(title, ...buttons); controls.append(card);
  }
}

function renderTable(title: string, comparison: P5AvailableComparison, key: 'target' | 'controls'): HTMLTableElement {
  const table = document.createElement('table');
  const caption = document.createElement('caption'); caption.textContent = `${title}: ${comparison[key].status}`;
  const head = document.createElement('thead'); head.innerHTML = '<tr><th scope="col">Field</th><th scope="col">Previous</th><th scope="col">Current</th><th scope="col">State</th></tr>';
  const body = document.createElement('tbody');
  const previous = comparison[key].previous as unknown as Record<string, unknown>;
  const current = comparison[key].current as unknown as Record<string, unknown>;
  for (const field of Object.keys(current)) {
    const row = document.createElement('tr');
    const changed = previous[field] !== current[field];
    const fieldCell = document.createElement('th'); fieldCell.scope = 'row'; fieldCell.textContent = field;
    const previousCell = document.createElement('td'); previousCell.textContent = String(previous[field]);
    const currentCell = document.createElement('td'); currentCell.textContent = String(current[field]);
    const stateCell = document.createElement('td'); stateCell.textContent = changed ? 'changed' : 'unchanged';
    row.append(fieldCell, previousCell, currentCell, stateCell);
    body.append(row);
  }
  table.append(caption, head, body);
  return table;
}

function renderTrace(title: string, snapshot: P5TerminalSnapshot): HTMLTableElement {
  const table = document.createElement('table');
  const caption = document.createElement('caption'); caption.textContent = title;
  const head = document.createElement('thead'); head.innerHTML = '<tr><th scope="col">Logical tick</th><th scope="col">Sequence</th><th scope="col">Action</th></tr>';
  const body = document.createElement('tbody');
  for (const record of snapshot.action_trace) {
    const row = document.createElement('tr');
    const tickCell = document.createElement('td'); tickCell.textContent = String(record.logical_tick);
    const sequenceCell = document.createElement('td'); sequenceCell.textContent = String(record.sequence);
    const kindCell = document.createElement('td'); kindCell.textContent = record.kind;
    row.append(tickCell, sequenceCell, kindCell);
    body.append(row);
  }
  table.append(caption, head, body);
  return table;
}

function renderScoreComparison(comparison: P5AvailableComparison): HTMLTableElement {
  const table = document.createElement('table');
  const caption = document.createElement('caption'); caption.textContent = 'Frozen score and contributors';
  const head = document.createElement('thead'); head.innerHTML = '<tr><th scope="col">Value</th><th scope="col">Previous</th><th scope="col">Current</th><th scope="col">Difference (current − previous)</th></tr>';
  const body = document.createElement('tbody');
  const previous = comparison.previous.score;
  const current = comparison.current.score;
  if (previous.score_status !== 'available' || current.score_status !== 'available') throw new Error('P5 available comparison has unavailable score.');
  const rows: Array<[string, number, number, number]> = [
    ['Score', previous.score, current.score, comparison.difference.score],
    ['Sail fit contributor', previous.contributors.sail_wind_fit_q, current.contributors.sail_wind_fit_q, comparison.difference.sail_wind_fit_q],
    ['Course contributor', previous.contributors.course_q, current.contributors.course_q, comparison.difference.course_q],
    ['Propulsion contributor', previous.contributors.propulsion_q, current.contributors.propulsion_q, comparison.difference.propulsion_q],
    ['Propulsion penalty contributor', previous.contributors.propulsion_penalty, current.contributors.propulsion_penalty, comparison.difference.propulsion_penalty],
  ];
  for (const [label, prior, present, difference] of rows) {
    const row = document.createElement('tr');
    const labelCell = document.createElement('th'); labelCell.scope = 'row'; labelCell.textContent = label;
    const priorCell = document.createElement('td'); priorCell.textContent = String(prior);
    const presentCell = document.createElement('td'); presentCell.textContent = String(present);
    const differenceCell = document.createElement('td'); differenceCell.textContent = String(difference);
    row.append(labelCell, priorCell, presentCell, differenceCell); body.append(row);
  }
  table.append(caption, head, body);
  return table;
}

function tableScrollRegion(table: HTMLTableElement): HTMLElement {
  const caption = table.caption;
  if (!caption) throw new Error('P5 comparison table caption is missing.');
  const label = caption.textContent;
  if (!label) throw new Error('P5 comparison table caption is empty.');
  caption.id = `p5-table-caption-${tableScrollRegionSequence += 1}`;
  const region = document.createElement('div');
  region.className = 'table-scroll-region';
  region.setAttribute('role', 'region');
  region.tabIndex = 0;
  region.setAttribute('aria-label', `${label}: horizontal scroll region`);
  region.setAttribute('aria-describedby', caption.id);
  region.addEventListener('keydown', (event) => {
    const scrollStep = Math.max(1, region.clientWidth);
    if (event.key === 'ArrowLeft') region.scrollLeft -= scrollStep;
    else if (event.key === 'ArrowRight') region.scrollLeft += scrollStep;
    else if (event.key === 'Home') region.scrollLeft = 0;
    else if (event.key === 'End') region.scrollLeft = region.scrollWidth;
    else return;
    event.preventDefault();
  });
  region.append(table);
  return region;
}

function renderComparison(): void {
  const section = required<HTMLElement>('#comparison');
  section.replaceChildren();
  if (!terminalDebrief) {
    const title = document.createElement('h3'); title.id = 'comparison-title'; title.textContent = 'Comparison unavailable';
    const text = document.createElement('p'); text.textContent = 'No comparison was retained because P5 identity verification failed closed.';
    section.append(title, text);
    return;
  }
  const comparison = terminalDebrief.comparison;
  const title = document.createElement('h3'); title.id = 'comparison-title'; title.textContent = 'Previous/current comparison';
  section.append(title);
  if (comparison.status === 'no_prior_same_condition') {
    const text = document.createElement('p'); text.textContent = 'No prior same-condition comparison is available for this baseline terminal attempt.';
    section.append(text);
    return;
  }
  const association = document.createElement('p'); association.textContent = 'Action traces are canonical logical-order associations only, not validated physical causation.';
  section.append(
    tableScrollRegion(renderScoreComparison(comparison)),
    tableScrollRegion(renderTable('Synthetic target', comparison, 'target')),
    tableScrollRegion(renderTable('Controls', comparison, 'controls')),
    association,
    tableScrollRegion(renderTrace('Previous action trace', comparison.previous)),
    tableScrollRegion(renderTrace('Current action trace', comparison.current)),
  );
}

function render(): void {
  if (screen !== 'active' && screen !== 'debrief') return;
  if (screen === 'active') {
    hud.replaceChildren();
    const target = attempt.binding; const current = attempt.p2_state.controls;
    addDefinition(hud, 'Target heading', String(target.synthetic_target_heading_centidegrees)); addDefinition(hud, 'Current heading', String(current.headingCentidegrees));
    addDefinition(hud, 'Target trim', `main ${target.sail_targets.main_trim}; jib ${target.sail_targets.jib_trim}`); addDefinition(hud, 'Current trim', `main ${current.mainTrim}; jib ${current.jibTrim}`);
    addDefinition(hud, 'Target reef', `main ${target.sail_targets.main_reef_level}; jib ${target.sail_targets.jib_reef_level}`); addDefinition(hud, 'Engine', String(current.engineOutput));
    addDefinition(hud, 'P2 status', attempt.p2_state.status);
    const live = currentP4Score(attempt); addDefinition(hud, 'Live synthetic score', live.score_status === 'available' ? String(live.score) : `Unavailable: ${live.reason}`);
    runtimeStatus.textContent = status;
    required<HTMLButtonElement>('#pause-toggle').textContent = attempt.p2_state.status === 'paused' ? 'Resume' : 'Pause';
    renderControls();
    return;
  }
  const frozen = currentP4Score(attempt);
  required<HTMLElement>('#debrief-status').textContent = frozen.score_status === 'available' ? `Frozen synthetic score: ${frozen.score} / 100. This does not classify the attempt.` : `Score unavailable: ${frozen.reason}`;
  const list = required<HTMLDListElement>('#contributors'); list.replaceChildren();
  if (frozen.score_status === 'available') {
    addDefinition(list, 'Sail fit contributor', String(frozen.contributors.sail_wind_fit_q)); addDefinition(list, 'Course contributor', String(frozen.contributors.course_q)); addDefinition(list, 'Propulsion contributor', String(frozen.contributors.propulsion_q));
  }
  renderComparison();
}

required<HTMLButtonElement>('#start').addEventListener('click', () => setScreen('onboarding'));
required<HTMLButtonElement>('#enter-active').addEventListener('click', () => setScreen('active'));
required<HTMLButtonElement>('#pause-toggle').addEventListener('click', () => submit('p2_action', { type: attempt.p2_state.status === 'paused' ? 'resume' : 'pause' }));
required<HTMLButtonElement>('#end').addEventListener('click', () => setScreen('end-confirm'));
required<HTMLButtonElement>('#cancel-end').addEventListener('click', () => setScreen('active'));
required<HTMLButtonElement>('#confirm-end').addEventListener('click', () => {
  if (!submit('end_voyage', {})) return;
  const captured = captureP5TerminalAttempt(history, attempt);
  if (captured.status === 'captured') { history = captured.history; terminalDebrief = captured.debrief; }
  else status = 'Comparison capture unavailable because P5 identity verification failed closed.';
  setScreen('debrief');
});
required<HTMLButtonElement>('#retry').addEventListener('click', () => { attempt = retryP4Attempt(attempt); terminalDebrief = undefined; nextTick = 1; nextSequence = 1; status = 'Fresh memory-only attempt created with the same public seed.'; setScreen('active'); });
