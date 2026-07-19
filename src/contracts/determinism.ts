/** Structural determinism protocol; cadence and pause semantics are model obligations. */
export const determinismProtocolV1Draft = {
  version: 'determinism-contract-v1-draft',
  input_authority: ['logical_tick', 'sequence'],
  scheduler_cadence: 'implementation-independent',
  focus_or_visibility_loss: 'pause_then_requires_explicit_resume',
  paused_progression: {
    logical_tick: 'forbidden',
    rng: 'forbidden',
    state: 'forbidden',
    event: 'forbidden',
    score: 'forbidden',
  },
} as const;

export interface DeterministicInputAuthority {
  logical_tick: number;
  sequence: number;
}

export type PauseProgression = Readonly<{
  logical_tick: 'forbidden';
  rng: 'forbidden';
  state: 'forbidden';
  event: 'forbidden';
  score: 'forbidden';
}>;
