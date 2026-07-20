import type { CurrentBand, DominantWavePeriod, Visibility, WaterLevel, WaveBand, WindBand } from '../contracts/scenario.js';

export const syntheticCalibrationV1 = Object.freeze({
  wave_m: { low: .3, medium: 1.3, high: 2.5 },
  dominant_wave_period_s: { short: 4, medium: 6.5, long: 10 },
  wind_kt: { weak: 5.5, medium: 13.5, strong: 19 },
  current_kt: { weak: .25, medium: 1, strong: 2 },
  visibility_nm: { normal: 10, reduced: 5, restricted: 1 },
  water_level_m: { below_datum: -.5, at_datum: 0, above_datum: .5 },
  water_level_variation_m: { none: 0, weak: .05, strong: .15 },
  variation: { none: { percent: 0, degrees: 0 }, weak: { percent: 5, degrees: 5 }, strong: { percent: 15, degrees: 15 } },
} as const);

export function calibrationMidpoint(kind: 'wave_m', band: WaveBand): number;
export function calibrationMidpoint(kind: 'wind_kt', band: WindBand): number;
export function calibrationMidpoint(kind: 'current_kt', band: CurrentBand): number;
export function calibrationMidpoint(kind: 'dominant_wave_period_s', band: DominantWavePeriod): number;
export function calibrationMidpoint(kind: 'visibility_nm', band: Visibility): number;
export function calibrationMidpoint(kind: 'water_level_m', band: WaterLevel): number;
export function calibrationMidpoint(kind: 'wave_m' | 'wind_kt' | 'current_kt' | 'dominant_wave_period_s' | 'visibility_nm' | 'water_level_m', band: WaveBand | WindBand | CurrentBand | DominantWavePeriod | Visibility | WaterLevel): number {
  const calibration = syntheticCalibrationV1[kind] as Readonly<Record<string, number>>;
  return calibration[band]!;
}
