import { describe, expect, it, vi } from 'vitest';
import { createLogicalScheduler } from '../../src/app/scheduler.js';
import { createSession, advanceLogicalTick } from '../../src/sim/session.js';
import { l01ReplayBindings } from '../../src/content/l01.js';

describe('browser-only logical scheduler cadence', () => {
  it('defaults to 250 ms and replaces exactly one active browser interval for each preset change', () => {
    vi.useFakeTimers();
    const onTick = vi.fn();
    const setIntervalSpy = vi.spyOn(globalThis, 'setInterval');
    const clearIntervalSpy = vi.spyOn(globalThis, 'clearInterval');
    const scheduler = createLogicalScheduler(onTick);

    scheduler.start();
    expect(scheduler.getCadence()).toBe(250);
    expect(setIntervalSpy).toHaveBeenCalledTimes(1);
    scheduler.setCadence(500);
    expect(clearIntervalSpy).toHaveBeenCalledTimes(1);
    expect(setIntervalSpy).toHaveBeenCalledTimes(2);
    scheduler.setCadence(500);
    expect(clearIntervalSpy).toHaveBeenCalledTimes(1);
    expect(setIntervalSpy).toHaveBeenCalledTimes(2);

    vi.advanceTimersByTime(499);
    expect(onTick).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(onTick).toHaveBeenCalledTimes(1);
    scheduler.stop();
    vi.advanceTimersByTime(1_000);
    expect(onTick).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it('changes cadence while stopped without creating a timer or catch-up work', () => {
    vi.useFakeTimers();
    const onTick = vi.fn();
    const scheduler = createLogicalScheduler(onTick);
    scheduler.setCadence(125);
    scheduler.start();
    vi.advanceTimersByTime(124);
    expect(onTick).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(onTick).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it('rejects invalid initial and running/stopped cadence casts without creating or reconfiguring timers', () => {
    vi.useFakeTimers();
    const onTick = vi.fn();
    const setIntervalSpy = vi.spyOn(globalThis, 'setInterval');
    const clearIntervalSpy = vi.spyOn(globalThis, 'clearInterval');

    expect(() => createLogicalScheduler(onTick, 300 as never)).toThrow('BROWSER_CADENCE_INVALID');
    expect(setIntervalSpy).not.toHaveBeenCalled();

    const scheduler = createLogicalScheduler(onTick);
    expect(() => scheduler.setCadence(300 as never)).toThrow('BROWSER_CADENCE_INVALID');
    expect(scheduler.getCadence()).toBe(250);
    expect(setIntervalSpy).not.toHaveBeenCalled();
    scheduler.start();
    expect(() => scheduler.setCadence(300 as never)).toThrow('BROWSER_CADENCE_INVALID');
    expect(scheduler.getCadence()).toBe(250);
    expect(setIntervalSpy).toHaveBeenCalledTimes(1);
    expect(clearIntervalSpy).not.toHaveBeenCalled();
    scheduler.stop();
    vi.useRealTimers();
  });

  it('produces equal canonical progression after the same callback count at every allowed cadence', () => {
    vi.useFakeTimers();
    const results = [125, 250, 500].map((cadence) => {
      let session = createSession({ ...l01ReplayBindings, seed: 'cadence-callback-count', ordered_input_log: [] });
      const scheduler = createLogicalScheduler(() => { session = advanceLogicalTick(session); }, cadence as 125 | 250 | 500);
      scheduler.start();
      vi.advanceTimersByTime(cadence * 4);
      scheduler.stop();
      return session;
    });
    expect(results[0]).toEqual(results[1]);
    expect(results[1]).toEqual(results[2]);
    expect(results[0]?.raw.logical_tick).toBe(4);
    vi.useRealTimers();
  });
});
