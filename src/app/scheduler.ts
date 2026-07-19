export interface LogicalScheduler {
  start(): void;
  stop(): void;
  dispose(): void;
}

/** Cadence is browser-only; every callback advances exactly one logical tick. */
export function createLogicalScheduler(onTick: () => void): LogicalScheduler {
  let timer: ReturnType<typeof setInterval> | undefined;
  return {
    start() {
      if (timer !== undefined) return;
      timer = setInterval(onTick, 250);
    },
    stop() {
      if (timer === undefined) return;
      clearInterval(timer);
      timer = undefined;
    },
    dispose() {
      this.stop();
    },
  };
}
