import type { SessionAction } from '../sim/session.js';

/** Browser repeat count is deliberately not translated into canonical actions. */
export function normalizeKeyboardAction(
  key: string,
  repeat: boolean,
  paused: boolean,
  permittedActions: readonly SessionAction[],
): SessionAction | null {
  if (repeat) return null;
  const action: SessionAction | null = key === 'ArrowLeft' ? 'helm_port'
    : key === 'ArrowRight' ? 'helm_starboard'
      : key.toLowerCase() === 'm' ? 'main_trim'
        : key.toLowerCase() === 'j' ? 'jib_trim'
          : key.toLowerCase() === 'f' ? 'reef'
            : key.toLowerCase() === 'p' ? 'decision_pass'
              : key.toLowerCase() === 'w' ? 'decision_wait'
                : key.toLowerCase() === 'b' ? 'decision_return'
                  : key === ' ' ? (paused ? 'resume' : 'pause')
                    : key.toLowerCase() === 'r' ? 'reset'
                      : null;
  return action && permittedActions.includes(action) ? action : null;
}
