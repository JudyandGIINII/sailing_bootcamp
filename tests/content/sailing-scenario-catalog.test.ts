import { describe, expect, it } from 'vitest';
import { canonicalJson, classifyCurrent, classifyDominantWavePeriod, classifyWave, classifyWind, sha256Canonical, validateScenarioPackage, type ScenarioPackageV1 } from '../../src/contracts/scenario.js';
import { createSyntheticScenario, defaultScenarioConfiguration } from '../../src/content/scenario-catalog.js';
import { syntheticCalibrationV1 } from '../../src/content/scenario-calibration.js';
import { materializeVariation, isValidVariationTrace } from '../../src/sim/scenario-variation.js';

describe('synthetic scenario catalog', () => {
  it('classifies every declared band boundary without rounding through wind gaps', () => {
    expect([0, .6, .600001, 2, 2.000001, 3].map(classifyWave)).toEqual(['low', 'low', 'medium', 'medium', 'high', 'high']);
    expect([0, .5, .500001, 1.5, 1.500001, 2.5].map(classifyCurrent)).toEqual(['weak', 'weak', 'medium', 'medium', 'strong', 'strong']);
    expect([1, 10, 10.0001, 11, 16, 16.0001, 17, 21].map(classifyWind)).toEqual(['weak', 'weak', undefined, 'medium', 'medium', undefined, 'strong', 'strong']);
    expect(syntheticCalibrationV1.dominant_wave_period_s).toEqual({ short: 4, medium: 6.5, long: 10 });
    expect(syntheticCalibrationV1.visibility_nm).toEqual({ normal: 10, reduced: 5, restricted: 1 });
    expect(syntheticCalibrationV1.water_level_m).toEqual({ below_datum: -.5, at_datum: 0, above_datum: .5 });
    expect(syntheticCalibrationV1.water_level_variation_m).toEqual({ none: 0, weak: .05, strong: .15 });
  });

  it('uses canonical key ordering, rejects unknown/tampered packages, and keeps the digest stable', async () => {
    expect(canonicalJson({ z: -0, a: [2, { b: true }] })).toBe('{"a":[2,{"b":true}],"z":0}');
    const scenario = await createSyntheticScenario({ ...defaultScenarioConfiguration, wave: 'medium', current: 'strong', wind: 'medium', gust: 'on', weather: 'rain', variation: 'strong', wave_direction: 'northwest', wind_direction: 'southwest', current_direction: 'northeast', dominant_wave_period: 'medium', visibility: 'reduced', water_level: 'above_datum', tide_phase: 'rising', course_template: 'triangle-v1' });
    expect(await validateScenarioPackage(scenario)).toMatchObject({ ok: true });
    expect(await validateScenarioPackage({ ...scenario, extra: true })).toMatchObject({ ok: false, reason_code: 'SCENARIO_SCHEMA_INVALID' });
    expect(await validateScenarioPackage({ ...scenario, raw: { ...scenario.raw, sun_elevation_deg: 31 } })).toMatchObject({ ok: false, reason_code: 'SCENARIO_HASH_INVALID' });
    expect(scenario.raw.wind_peak_kt - scenario.raw.wind_mean_kt).toBe(5);
    expect(scenario.raw.current_kt).toEqual({ status: 'available', value: 2 });
    expect(scenario.raw.current_direction_deg_true_to).toEqual({ status: 'available', value: 45, unit: 'degree', reference: 'true_north', convention: 'toward' });
    expect(scenario.raw.wave_direction_deg_true_from).toEqual({ status: 'available', value: 315, unit: 'degree', reference: 'true_north', convention: 'from' });
    expect(scenario.raw.dominant_wave_period_s).toEqual({ status: 'available', value: 6.5 });
    expect(scenario.raw.visibility_nm).toEqual({ status: 'available', value: 5 });
    expect(scenario.raw.water_level_datum).toEqual({ status: 'available', value: 'SYNTHETIC_SCENARIO_DATUM_V1' });
    expect(scenario.geometry.course_template).toEqual({ id: 'triangle-v1', start: { label: 'start', x_m: -100, y_m: 0 }, ordered_marks: [{ label: 'W1', x_m: 0, y_m: 600 }, { label: 'R1', x_m: 300, y_m: 300 }], finish: { label: 'finish', x_m: 100, y_m: 0 } });
    expect(Object.values(scenario.model_status.p1b_fields)).toEqual(Array(9).fill('SCENARIO_REPLAY_UI_ONLY_NOT_COUPLED_TO_CURRENT_CORE'));
    const reordered: ScenarioPackageV1 = {
      content_sha256: scenario.content_sha256, derived_labels: scenario.derived_labels, model_status: scenario.model_status, provenance: scenario.provenance,
      geometry: scenario.geometry, raw: scenario.raw, configuration: scenario.configuration, calibration_version: scenario.calibration_version,
      source_kind: scenario.source_kind, schema_version: scenario.schema_version,
    };
    expect(await validateScenarioPackage(reordered)).toMatchObject({ ok: true });
  });

  it('requires exact raw shape, selected current, explicit true-north direction metadata, and stable ancillary absence reasons', async () => {
    const scenario = await createSyntheticScenario({ ...defaultScenarioConfiguration, wave: 'high', current: 'weak', wind: 'strong', gust: 'off', weather: 'rain', variation: 'none' });
    expect(scenario.configuration.weather).toBe('rain');
    expect(scenario.raw).not.toHaveProperty('precipitation');
    expect([3, 5, 5.000001, 8, 8.000001, 12].map(classifyDominantWavePeriod)).toEqual(['short', 'short', 'medium', 'medium', 'long', 'long']);
    expect(scenario.raw.dominant_wave_period_s).toEqual({ status: 'available', value: 4 });
    expect(await validateScenarioPackage({ ...scenario, raw: { ...scenario.raw, current_kt: { status: 'missing', reason: 'NOT_MODELED_BY_CURRENT_CORE' } } })).toMatchObject({ ok: false, reason_code: 'SCENARIO_SCHEMA_INVALID' });
    expect(await validateScenarioPackage({ ...scenario, raw: { ...scenario.raw, wind_direction_deg_true_from: { status: 'available', value: 0, unit: 'degree', reference: 'true_north' } } })).toMatchObject({ ok: false, reason_code: 'SCENARIO_SCHEMA_INVALID' });
    expect(await validateScenarioPackage({ ...scenario, raw: { ...scenario.raw, current_direction_deg_true_to: { ...scenario.raw.current_direction_deg_true_to, convention: 'from' } } })).toMatchObject({ ok: false, reason_code: 'SCENARIO_SCHEMA_INVALID' });
    expect(await validateScenarioPackage({ ...scenario, raw: { ...scenario.raw, wind_direction_deg_true_from: { ...scenario.raw.wind_direction_deg_true_from, unit: 'radian' } } })).toMatchObject({ ok: false, reason_code: 'SCENARIO_SCHEMA_INVALID' });
    const rehashedInvalidRoute = { ...scenario, geometry: { ...scenario.geometry, course_template: { ...scenario.geometry.course_template, finish: { ...scenario.geometry.course_template.finish, y_m: 51 } } } };
    const { content_sha256: ignoredHash, ...invalidWithoutHash } = rehashedInvalidRoute;
    void ignoredHash;
    expect(await validateScenarioPackage({ ...invalidWithoutHash, content_sha256: await sha256Canonical(invalidWithoutHash) })).toMatchObject({ ok: false, reason_code: 'SCENARIO_SCHEMA_INVALID' });
  });

  it('materializes independent deterministic bounded variation and rejects tampering', async () => {
    const scenario = await createSyntheticScenario({ ...defaultScenarioConfiguration, wave: 'low', current: 'weak', wind: 'strong', gust: 'off', weather: 'clear', variation: 'weak', dominant_wave_period: 'long', visibility: 'restricted', water_level: 'below_datum' });
    const first = await materializeVariation(scenario, 'seed'); const second = await materializeVariation(scenario, 'seed');
    const windDelta = first.deltas['raw.wind_mean_kt'];
    expect(first).toEqual(second); expect(Math.abs(windDelta ?? Number.NaN)).toBeLessThanOrEqual(scenario.raw.wind_mean_kt * .05);
    expect(Object.keys(first.samples)).toEqual(['raw.significant_wave_height_m', 'raw.dominant_wave_period_s', 'raw.wind_mean_kt', 'raw.current_kt', 'raw.visibility_nm', 'raw.water_level_m', 'raw.wave_direction_deg_true_from', 'raw.wind_direction_deg_true_from', 'raw.current_direction_deg_true_to']);
    expect(first.samples['raw.wind_mean_kt']).not.toBe(first.samples['raw.current_kt']);
    expect(Math.abs(first.deltas['raw.current_kt'] ?? Number.NaN)).toBeLessThanOrEqual(scenario.raw.current_kt.value * .05);
    expect(first.effective_raw.wind_peak_kt - first.effective_raw.wind_mean_kt).toBe(scenario.raw.wind_peak_kt - scenario.raw.wind_mean_kt);
    expect(Math.abs(first.deltas['raw.water_level_m'])).toBeLessThanOrEqual(.05);
    expect(first.effective_raw.water_level_datum).toEqual(scenario.raw.water_level_datum);
    expect(first.effective_raw.water_level_tide_phase).toEqual(scenario.raw.water_level_tide_phase);
    expect(await isValidVariationTrace(first, scenario, 'seed')).toBe(true);
    expect(await isValidVariationTrace({ ...first, seed: 'other' }, scenario, 'seed')).toBe(false);
    expect(await isValidVariationTrace({ ...first, samples: { ...first.samples, 'raw.current_kt': 0 } }, scenario, 'seed')).toBe(false);
  });
});
