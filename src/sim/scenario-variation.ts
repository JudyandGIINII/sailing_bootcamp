import { canonicalJson, type AvailableDirection, type ScenarioPackageV1, type VariationLevel } from '../contracts/scenario.js';
import { syntheticCalibrationV1 } from '../content/scenario-calibration.js';

export const SCENARIO_VARIATION_ALGORITHM_ID = 'scenario-variation-v1' as const;
const scalarPaths = ['raw.significant_wave_height_m', 'raw.dominant_wave_period_s', 'raw.wind_mean_kt', 'raw.current_kt', 'raw.visibility_nm', 'raw.water_level_m'] as const;
const directionPaths = ['raw.wave_direction_deg_true_from', 'raw.wind_direction_deg_true_from', 'raw.current_direction_deg_true_to'] as const;
export type VariationFieldPath = (typeof scalarPaths)[number] | (typeof directionPaths)[number];
export interface VariationTraceV1 { algorithm_id: typeof SCENARIO_VARIATION_ALGORITHM_ID; seed: string; scenario_digest: string; samples: Readonly<Record<VariationFieldPath, number>>; deltas: Readonly<Record<VariationFieldPath, number>>; effective_raw: ScenarioPackageV1['raw']; }

/** A field path is sampled independently from SHA-256(algorithm id, seed, canonical field path). */
async function sample(seed: string, path: VariationFieldPath): Promise<number> { const encoded = new TextEncoder().encode(canonicalJson([SCENARIO_VARIATION_ALGORITHM_ID, seed, path])); const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', encoded)); let magnitude = 0; for (const byte of digest.slice(0, 6)) magnitude = magnitude * 256 + byte; return (magnitude / 0xffffffffffff) * 2 - 1; }
function clamp(value: number, min: number, max: number): number { return Math.min(max, Math.max(min, value)); }
function bandBounds(value: number, kind: 'wave' | 'period' | 'wind' | 'current'): readonly [number, number] {
  if (kind === 'wave') return value <= .6 ? [0, .6] : value <= 2 ? [.600001, 2] : [2.000001, 3];
  if (kind === 'period') return value <= 5 ? [3, 5] : value <= 8 ? [5.000001, 8] : [8.000001, 12];
  if (kind === 'wind') return value <= 10 ? [1, 10] : value <= 16 ? [11, 16] : [17, 21];
  return value <= .5 ? [0, .5] : value <= 1.5 ? [.500001, 1.5] : [1.500001, 2.5];
}
function boundedPercent(value: number, percent: number, sampleValue: number, kind: 'wave' | 'period' | 'wind' | 'current'): number { const [min, max] = bandBounds(value, kind); return clamp(value + value * percent / 100 * sampleValue, min, max); }
function varyDirection(direction: AvailableDirection, delta: number): AvailableDirection { return { ...direction, value: ((direction.value + delta) % 360 + 360) % 360 }; }

export async function materializeVariation(scenario: ScenarioPackageV1, seed: string): Promise<VariationTraceV1> {
  const limit = syntheticCalibrationV1.variation[scenario.configuration.variation as VariationLevel];
  const orderedPaths: readonly VariationFieldPath[] = [...scalarPaths, ...directionPaths];
  const values = await Promise.all(orderedPaths.map(async (path) => [path, await sample(seed, path)] as const));
  const samples = Object.freeze(Object.fromEntries(values) as Record<VariationFieldPath, number>);
  const scalarDelta = (value: number, path: typeof scalarPaths[number]): number => value * limit.percent / 100 * samples[path];
  const waterAmplitude = syntheticCalibrationV1.water_level_variation_m[scenario.configuration.variation];
  const deltas = Object.freeze({
    'raw.significant_wave_height_m': scalarDelta(scenario.raw.significant_wave_height_m, 'raw.significant_wave_height_m'),
    'raw.dominant_wave_period_s': scalarDelta(scenario.raw.dominant_wave_period_s.value, 'raw.dominant_wave_period_s'),
    'raw.wind_mean_kt': scalarDelta(scenario.raw.wind_mean_kt, 'raw.wind_mean_kt'),
    'raw.current_kt': scalarDelta(scenario.raw.current_kt.value, 'raw.current_kt'),
    'raw.visibility_nm': scalarDelta(scenario.raw.visibility_nm.value, 'raw.visibility_nm'),
    'raw.water_level_m': waterAmplitude * samples['raw.water_level_m'],
    'raw.wave_direction_deg_true_from': limit.degrees * samples['raw.wave_direction_deg_true_from'],
    'raw.wind_direction_deg_true_from': limit.degrees * samples['raw.wind_direction_deg_true_from'],
    'raw.current_direction_deg_true_to': limit.degrees * samples['raw.current_direction_deg_true_to'],
  } satisfies Record<VariationFieldPath, number>);
  const waveHeight = boundedPercent(scenario.raw.significant_wave_height_m, limit.percent, samples['raw.significant_wave_height_m'], 'wave');
  const period = boundedPercent(scenario.raw.dominant_wave_period_s.value, limit.percent, samples['raw.dominant_wave_period_s'], 'period');
  const windMean = boundedPercent(scenario.raw.wind_mean_kt, limit.percent, samples['raw.wind_mean_kt'], 'wind');
  const currentSpeed = boundedPercent(scenario.raw.current_kt.value, limit.percent, samples['raw.current_kt'], 'current');
  const visibility = clamp(scenario.raw.visibility_nm.value + deltas['raw.visibility_nm'], .1, 10);
  const waterLevel = clamp(scenario.raw.water_level_m.value + deltas['raw.water_level_m'], -.65, .65);
  const effective_raw = Object.freeze({
    ...scenario.raw,
    significant_wave_height_m: waveHeight,
    dominant_wave_period_s: { ...scenario.raw.dominant_wave_period_s, value: period },
    wave_direction_deg_true_from: varyDirection(scenario.raw.wave_direction_deg_true_from, deltas['raw.wave_direction_deg_true_from']),
    wind_mean_kt: windMean,
    wind_peak_kt: scenario.raw.wind_peak_kt + (windMean - scenario.raw.wind_mean_kt),
    wind_direction_deg_true_from: varyDirection(scenario.raw.wind_direction_deg_true_from, deltas['raw.wind_direction_deg_true_from']),
    current_kt: { ...scenario.raw.current_kt, value: currentSpeed },
    current_direction_deg_true_to: varyDirection(scenario.raw.current_direction_deg_true_to, deltas['raw.current_direction_deg_true_to']),
    visibility_nm: { ...scenario.raw.visibility_nm, value: visibility },
    water_level_m: { ...scenario.raw.water_level_m, value: waterLevel },
  });
  return Object.freeze({ algorithm_id: SCENARIO_VARIATION_ALGORITHM_ID, seed, scenario_digest: scenario.content_sha256, samples, deltas, effective_raw });
}

export async function isValidVariationTrace(trace: unknown, scenario: ScenarioPackageV1, seed: string): Promise<boolean> { if (typeof trace !== 'object' || trace === null || Array.isArray(trace)) return false; const candidate = trace as Record<string, unknown>; if (candidate.algorithm_id !== SCENARIO_VARIATION_ALGORITHM_ID || candidate.seed !== seed || candidate.scenario_digest !== scenario.content_sha256) return false; return canonicalJson(candidate) === canonicalJson(await materializeVariation(scenario, seed)); }
