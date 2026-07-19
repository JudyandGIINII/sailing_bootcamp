import type { SessionAction } from '../sim/session.js';

/** Browser repeat count is deliberately not translated into canonical actions. */
export function normalizeKeyboardAction(key: string, repeat: boolean, paused: boolean): SessionAction | null {
  if (repeat) return null;
  if (key === 'ArrowLeft') return 'helm_port';
  if (key === 'ArrowRight') return 'helm_starboard';
  if (key.toLowerCase() === 'm') return 'main_trim';
  if (key.toLowerCase() === 'j') return 'jib_trim';
  if (key.toLowerCase() === 'f') return 'reef';
  if (key.toLowerCase() === 'p') return 'decision_pass';
  if (key.toLowerCase() === 'w') return 'decision_wait';
  if (key.toLowerCase() === 'b') return 'decision_return';
  if (key === ' ') return paused ? 'resume' : 'pause';
  if (key.toLowerCase() === 'r') return 'reset';
  return null;
}
