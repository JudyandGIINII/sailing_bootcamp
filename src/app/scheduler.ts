export interface LogicalScheduler {
  start(): void;
  stop(): void;
  dispose(): void;
  setCadence(cadence: BrowserCadenceMs): void;
  getCadence(): BrowserCadenceMs;
}

export const BROWSER_CADENCE_PRESETS = [125, 250, 500] as const;
export type BrowserCadenceMs = (typeof BROWSER_CADENCE_PRESETS)[number];

export function isBrowserCadenceMs(value: unknown): value is BrowserCadenceMs {
  return typeof value === 'number' && BROWSER_CADENCE_PRESETS.includes(value as BrowserCadenceMs);
}

function requireBrowserCadence(value: unknown): BrowserCadenceMs {
  if (!isBrowserCadenceMs(value)) throw new RangeError('BROWSER_CADENCE_INVALID');
  return value;
}

/** Cadence is browser-only; every callback advances exactly one logical tick. */
export function createLogicalScheduler(onTick: () => void, initialCadence: BrowserCadenceMs = 250): LogicalScheduler {
  let timer: ReturnType<typeof setInterval> | undefined;
  const configuredInitialCadence = requireBrowserCadence(initialCadence);
  let cadence = configuredInitialCadence;
  function createInterval(): void {
    timer = setInterval(onTick, cadence);
  }
  return {
    start() {
      if (timer !== undefined) return;
      createInterval();
    },
    stop() {
      if (timer === undefined) return;
      clearInterval(timer);
      timer = undefined;
    },
    dispose() {
      this.stop();
    },
    setCadence(nextCadence) {
      const validatedCadence = requireBrowserCadence(nextCadence);
      if (validatedCadence === cadence) return;
      cadence = validatedCadence;
      if (timer === undefined) return;
      clearInterval(timer);
      createInterval();
    },
    getCadence() {
      return cadence;
    },
  };
}
