/** Shared, renderer-independent helm control ordering rules. No sailing behaviour is implied. */
export type HelmCommand = 'neutral' | 'port' | 'starboard';

export interface HelmControl {
  readonly logical_tick: number;
  readonly sequence: number;
  readonly helm_command: HelmCommand;
}

/**
 * Sorts by (logical_tick, sequence) and rejects controls that do not belong to
 * the prior tick or that collide on an identical ordering key.
 */
export function validateHelmControls(
  priorLogicalTick: number,
  controls: readonly HelmControl[],
): readonly HelmControl[] {
  const ordered = [...controls].sort((left, right) => left.logical_tick - right.logical_tick || left.sequence - right.sequence);
  for (let index = 0; index < ordered.length; index += 1) {
    const control = ordered[index];
    const previous = ordered[index - 1];
    if (!control || control.logical_tick !== priorLogicalTick || !Number.isSafeInteger(control.sequence) || control.sequence < 0 ||
      !['neutral', 'port', 'starboard'].includes(control.helm_command) ||
      (previous !== undefined && previous.logical_tick === control.logical_tick && previous.sequence === control.sequence)) {
      throw new TypeError('Helm controls must have unique ordered logical tick and sequence values.');
    }
  }
  return Object.freeze(ordered.map((control) => Object.freeze({ ...control })));
}
