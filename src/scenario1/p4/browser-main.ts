import { currentP4Score, createP4Attempt, reduceP4Attempt, type P4UserRecord } from './in-memory-attempt.js';
import { retryP4Attempt } from './retry.js';

const mountElement = document.querySelector<HTMLElement>('#p4-app');
if (!mountElement) throw new Error('P4 mount is missing.');
const mount: HTMLElement = mountElement;

type Screen = 'entry' | 'onboarding' | 'active' | 'end-confirm' | 'debrief';
let screen: Screen = 'entry';
let attempt = createP4Attempt();
let nextTick = 1;
let nextSequence = 1;
let status = 'Ready for a synthetic memory-only attempt.';

mount.innerHTML = `
  <h1 tabindex="-1" id="p4-heading">Scenario 1 — Synthetic Control Deck</h1>
  <p class="boundary" role="note">Synthetic and unvalidated training display. Not navigation, safety, certification, or real-world sailing guidance.</p>
  <p class="boundary" id="memory-notice" role="note">This attempt is memory-only. No saved replay is available. Reload loses the P4 attempt and must not modify legacy saved replays.</p>
  <section class="card" id="entry-card"><h2>Scenario 1</h2><p>Use abstract controls to align with an explicitly synthetic target.</p><button type="button" id="start">Start</button></section>
  <section class="card" id="onboarding" hidden><h2>Before you begin</h2><p>Objective: adjust the synthetic controls toward the displayed target. Scoring is an unvalidated synthetic calibration and is not a pass/fail result.</p><p>Heading, engine, deployment, trim, and reef each have visible buttons. The display is not a navigation aid.</p><button type="button" id="enter-active">Enter active play</button></section>
  <section class="layout" id="active" hidden>
    <section class="world" aria-labelledby="world-title"><h2 id="world-title">Abstract synthetic world</h2><div class="world-art">SYNTHETIC TARGET / CONTROL STATUS<br />No coast, chart, weather, camera, or physical model.</div><dl id="hud" aria-live="polite"></dl><p id="runtime-status" role="status"></p><button type="button" id="pause-toggle">Pause</button><button type="button" id="end">End Voyage</button></section>
    <section class="deck" aria-label="Synthetic control tray"><h2>Control tray</h2><div class="controls" id="controls"></div></section>
  </section>
  <section class="card" id="end-confirm" hidden><h2>End Voyage?</h2><p>The current synthetic score will freeze. This does not mark pass or fail.</p><button type="button" id="confirm-end">Confirm End Voyage</button><button type="button" id="cancel-end">Keep playing</button></section>
  <section class="card" id="debrief" hidden><h2>Frozen debrief</h2><p id="debrief-status"></p><dl id="contributors"></dl><button type="button" id="retry">Retry same seed</button></section>
`;

function required<T extends Element>(selector: string): T {
  const element = mount.querySelector<T>(selector);
  if (!element) throw new Error(`P4 element missing: ${selector}`);
  return element;
}

const heading = required<HTMLElement>('#p4-heading');
const entryCard = required<HTMLElement>('#entry-card');
const onboarding = required<HTMLElement>('#onboarding');
const active = required<HTMLElement>('#active');
const endConfirm = required<HTMLElement>('#end-confirm');
const debrief = required<HTMLElement>('#debrief');
const hud = required<HTMLDListElement>('#hud');
const runtimeStatus = required<HTMLElement>('#runtime-status');
const controls = required<HTMLElement>('#controls');

function setScreen(next: Screen): void {
  screen = next;
  entryCard.hidden = next !== 'entry'; onboarding.hidden = next !== 'onboarding'; active.hidden = next !== 'active'; endConfirm.hidden = next !== 'end-confirm'; debrief.hidden = next !== 'debrief';
  heading.focus();
  render();
}

function addHud(label: string, value: string): void {
  const term = document.createElement('dt'); term.textContent = label;
  const detail = document.createElement('dd'); detail.textContent = value;
  hud.append(term, detail);
}

function submit(kind: P4UserRecord['kind'], payload: unknown): boolean {
  const result = reduceP4Attempt(attempt, { logical_tick: nextTick, sequence: nextSequence, kind, payload });
  if (result.status !== 'accepted') {
    status = result.status === 'rejected_post_terminal'
      ? 'Unavailable: the P4 reduction rejected this input because the attempt is frozen.'
      : 'Unavailable: P4 input validation rejected this input.';
    render();
    return false;
  }
  attempt = result.state;
  nextTick += 1;
  nextSequence = attempt.records.at(-1)!.sequence + 1;
  status = kind === 'end_voyage' ? 'Synthetic score frozen for this memory-only attempt.' : 'Synthetic control committed in canonical logical order.';
  render();
  return true;
}

function control(label: string, action: unknown): HTMLButtonElement {
  const button = document.createElement('button'); button.type = 'button'; button.textContent = label; button.setAttribute('aria-label', label); button.addEventListener('click', () => submit('p2_action', action)); return button;
}

function renderControls(): void {
  controls.replaceChildren();
  const c = attempt.p2_state.controls;
  const cards: Array<[string, HTMLButtonElement[]]> = [
    ['Heading', [control('Heading −100', { type: 'set_heading_centidegrees', heading_centidegrees: (c.headingCentidegrees + 35900) % 36000 }), control('Heading +100', { type: 'set_heading_centidegrees', heading_centidegrees: (c.headingCentidegrees + 100) % 36000 })]],
    ['Engine', [control('Engine −100', { type: 'set_engine_output', engine_output: Math.max(-10000, c.engineOutput - 100) }), control('Engine +100', { type: 'set_engine_output', engine_output: Math.min(10000, c.engineOutput + 100) })]],
    ['Main deployment', [control(c.mainDeployed ? 'Retract main' : 'Deploy main', { type: 'set_main_deployed', main_deployed: !c.mainDeployed })]],
    ['Jib deployment', [control(c.jibDeployed ? 'Retract jib' : 'Deploy jib', { type: 'set_jib_deployed', jib_deployed: !c.jibDeployed })]],
    ['Main trim', [control('Main trim −1', { type: 'set_main_trim', main_trim: Math.max(0, c.mainTrim - 1) }), control('Main trim +1', { type: 'set_main_trim', main_trim: Math.min(10000, c.mainTrim + 1) })]],
    ['Jib trim', [control('Jib trim −1', { type: 'set_jib_trim', jib_trim: Math.max(0, c.jibTrim - 1) }), control('Jib trim +1', { type: 'set_jib_trim', jib_trim: Math.min(10000, c.jibTrim + 1) })]],
    ['Main reef', [control('Main reef −1', { type: 'set_main_reef_level', main_reef_level: Math.max(0, c.mainReefLevel - 1) }), control('Main reef +1', { type: 'set_main_reef_level', main_reef_level: Math.min(2, c.mainReefLevel + 1) })]],
    ['Jib reef', [control('Jib reef −1', { type: 'set_jib_reef_level', jib_reef_level: Math.max(0, c.jibReefLevel - 1) }), control('Jib reef +1', { type: 'set_jib_reef_level', jib_reef_level: Math.min(2, c.jibReefLevel + 1) })]],
  ];
  for (const [label, buttons] of cards) {
    const card = document.createElement('div'); card.className = 'control';
    const title = document.createElement('strong'); title.textContent = label;
    for (const button of buttons) button.disabled = attempt.p2_state.status === 'paused';
    card.append(title, ...buttons); controls.append(card);
  }
}

function render(): void {
  if (screen !== 'active' && screen !== 'debrief') return;
  if (screen === 'active') {
    hud.replaceChildren();
    const target = attempt.binding;
    const c = attempt.p2_state.controls;
    addHud('Target heading', String(target.synthetic_target_heading_centidegrees)); addHud('Current heading', String(c.headingCentidegrees));
    addHud('Target trim', `main ${target.sail_targets.main_trim}; jib ${target.sail_targets.jib_trim}`); addHud('Current trim', `main ${c.mainTrim}; jib ${c.jibTrim}`);
    addHud('Target reef', `main ${target.sail_targets.main_reef_level}; jib ${target.sail_targets.jib_reef_level}`); addHud('Engine', String(c.engineOutput));
    addHud('P2 status', attempt.p2_state.status);
    const live = currentP4Score(attempt); addHud('Live synthetic score', live.score_status === 'available' ? String(live.score) : `Unavailable: ${live.reason}`);
    runtimeStatus.textContent = status;
    required<HTMLButtonElement>('#pause-toggle').textContent = attempt.p2_state.status === 'paused' ? 'Resume' : 'Pause';
    renderControls();
  } else {
    const frozen = currentP4Score(attempt); required<HTMLElement>('#debrief-status').textContent = frozen.score_status === 'available' ? `Frozen synthetic score: ${frozen.score} / 100. No pass/fail classification.` : `Score unavailable: ${frozen.reason}`;
    const list = required<HTMLDListElement>('#contributors'); list.replaceChildren();
    if (frozen.score_status === 'available') { addDebrief(list, 'Sail fit contributor', String(frozen.contributors.sail_wind_fit_q)); addDebrief(list, 'Course contributor', String(frozen.contributors.course_q)); addDebrief(list, 'Propulsion contributor', String(frozen.contributors.propulsion_q)); }
  }
}

function addDebrief(list: HTMLDListElement, label: string, value: string): void { const term = document.createElement('dt'); term.textContent = label; const detail = document.createElement('dd'); detail.textContent = value; list.append(term, detail); }

required<HTMLButtonElement>('#start').addEventListener('click', () => setScreen('onboarding'));
required<HTMLButtonElement>('#enter-active').addEventListener('click', () => setScreen('active'));
required<HTMLButtonElement>('#pause-toggle').addEventListener('click', () => submit('p2_action', { type: attempt.p2_state.status === 'paused' ? 'resume' : 'pause' }));
required<HTMLButtonElement>('#end').addEventListener('click', () => setScreen('end-confirm'));
required<HTMLButtonElement>('#cancel-end').addEventListener('click', () => setScreen('active'));
required<HTMLButtonElement>('#confirm-end').addEventListener('click', () => { if (submit('end_voyage', {})) setScreen('debrief'); });
required<HTMLButtonElement>('#retry').addEventListener('click', () => { attempt = retryP4Attempt(attempt); nextTick = 1; nextSequence = 1; status = 'Fresh memory-only attempt created with the same public seed.'; setScreen('active'); });
