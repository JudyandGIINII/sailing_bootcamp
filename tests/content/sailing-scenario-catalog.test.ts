import { describe, expect, it } from 'vitest';
import { canonicalJson, classifyCurrent, classifyDominantWavePeriod, classifyWave, classifyWind, scenario1ContractV1, scenario1DefaultConfigurationV1, sha256Canonical, validateScenarioPackage, type ScenarioPackageV1 } from '../../src/contracts/scenario.js';
import { createSyntheticScenario, defaultScenarioConfiguration } from '../../src/content/scenario-catalog.js';
import { syntheticCalibrationV1 } from '../../src/content/scenario-calibration.js';
import { lessonManifestRegistry } from '../../src/content/lesson-manifest.js';
import { materializeVariation, isValidVariationTrace } from '../../src/sim/scenario-variation.js';

function expectDeepFrozen(value: unknown): void {
  expect(Object.isFrozen(value)).toBe(true);
  if (value && typeof value === 'object') Object.values(value).forEach(expectDeepFrozen);
}

describe('synthetic scenario catalog', () => {
  it('declares the exact versioned Scenario 1 synthetic default and calibration contract', () => {
    expect(scenario1DefaultConfigurationV1).toEqual({
      configuration_version: 'scenario-1-default-configuration-v1',
      start: {
        point_of_sail: 'beam_reach',
        sails_deployed: { main: true, jib: true },
        wind_speed_kt: 8,
        wave_height_m: 2,
        current_speed_kt: 0,
        weather: { sky: 'clear', season: 'autumn' },
      },
    });
    expect(scenario1ContractV1).toMatchObject({
      scenario_id: 'scenario-1',
      contract_version: 'scenario-1-contract-v1',
      scope: { calibration: 'synthetic-game-only', navigation: 'not-modeled', safety: 'not-modeled', certification: 'not-modeled', runtime_wiring: 'not-wired' },
      default_configuration: scenario1DefaultConfigurationV1,
      score: {
        component_weights_basis_points: { sail_wind_fit: 5000, course_control: 3000, propulsion_context: 2000 },
        course_control: { heading_unit: 'centidegree', full_score_through_error_centidegrees: 200, zero_score_at_or_above_error_centidegrees: 3000, interpolation: 'floor_linear' },
        propulsion_context: {
          normalized_engine_output: { minimum: 0, maximum: 10000 },
          engine_only_penalty_start: 500,
          sails_deployed_high_output_penalty_start_exclusive: 6500,
          engine_only_maximum_penalty: 6000,
          sails_deployed_high_output_maximum_penalty: 8000,
        },
      },
      end_voyage: {
        canonical_input: 'end_voyage',
        same_tick_processing: 'ascending_sequence',
        computes_after: 'lower_sequence_records',
        freeze: 'score_contributors_and_debrief_without_another_tick',
        higher_sequence_score_affecting_records: 'post_terminal_rejected',
      },
      scheduling: { stability_pacing_trigger_after_logical_seconds: 10, stability_is_completion_or_score: false },
    });
  });

  it('keeps the Scenario 1 contract deeply immutable and JSON-serializable', () => {
    expectDeepFrozen(scenario1DefaultConfigurationV1);
    expectDeepFrozen(scenario1ContractV1);
    expect(JSON.parse(JSON.stringify(scenario1ContractV1))).toEqual(scenario1ContractV1);
  });

  it('preserves the L01-L05 catalogue identity and action characterizations', () => {
    expect(Object.keys(lessonManifestRegistry)).toEqual(['L01', 'L02', 'L03', 'L04', 'L05']);
    expect(Object.values(lessonManifestRegistry).map(({ lesson_id, scenario_version, permitted_actions }) => ({ lesson_id, scenario_version, permitted_actions }))).toEqual([
      { lesson_id: 'L01', scenario_version: 'l01-scenario-v0-draft', permitted_actions: ['helm_port', 'helm_starboard', 'pause', 'resume', 'reset'] },
      { lesson_id: 'L02', scenario_version: 'l02-scenario-v0-draft', permitted_actions: ['helm_port', 'helm_starboard', 'main_trim', 'jib_trim', 'pause', 'resume', 'reset'] },
      { lesson_id: 'L03', scenario_version: 'l03-scenario-v0-draft', permitted_actions: ['helm_port', 'helm_starboard', 'main_trim', 'jib_trim', 'reef', 'pause', 'resume', 'reset'] },
      { lesson_id: 'L04', scenario_version: 'l04-scenario-v0-draft', permitted_actions: ['helm_port', 'helm_starboard', 'main_trim', 'jib_trim', 'pause', 'resume', 'reset'] },
      { lesson_id: 'L05', scenario_version: 'l05-scenario-v0-draft', permitted_actions: ['helm_port', 'helm_starboard', 'decision_pass', 'decision_wait', 'decision_return', 'pause', 'resume', 'reset'] },
    ]);
  });

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
