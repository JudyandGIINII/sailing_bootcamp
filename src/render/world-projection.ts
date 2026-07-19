import { Application, Graphics, Text } from 'pixi.js';
import type { DeterministicSession } from '../sim/session.js';

/**
 * A read-only PixiJS world projection adapter. It has no callbacks into
 * simulation and deliberately renders only synthetic, non-navigational shapes.
 */
export async function createWorldProjection(container: HTMLElement): Promise<{ render(session: DeterministicSession): void }> {
  const application = new Application();
  await application.init({
    width: 520,
    height: 180,
    autoStart: false,
    backgroundAlpha: 0,
    preference: 'webgl',
  });

  const canvas = application.canvas;
  canvas.setAttribute('aria-hidden', 'true');
  canvas.className = 'world-canvas';
  container.replaceChildren(canvas);

  const water = new Graphics().rect(0, 0, 520, 180).fill(0x082f49);
  const waves = new Graphics();
  for (let x = 0; x < 520; x += 40) waves.rect(x, 140, 24, 2);
  waves.fill(0x38bdf8);
  const sloop = new Graphics().rect(248, 74, 24, 8).fill(0xf8fafc);
  const helm = new Graphics();
  const title = new Text({ position: { x: 14, y: 12 }, style: { fill: 0xe2e8f0, fontFamily: 'system-ui', fontSize: 14 } });
  const command = new Text({ position: { x: 14, y: 34 }, style: { fill: 0xe2e8f0, fontFamily: 'system-ui', fontSize: 14 } });
  application.stage.addChild(water, waves, sloop, helm, title, command);

  return {
    render(session) {
      helm.clear().rect(258, 38, 2, 36).fill(session.raw.helm_command === 'neutral' ? 0xfde68a : 0x86efac);
      title.text = `Synthetic L01 • logical tick ${session.raw.logical_tick}`;
      command.text = `helm command: ${session.raw.helm_command}`;
      application.render();
    },
  };
}
