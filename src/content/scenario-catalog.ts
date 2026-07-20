import { COURSE_TEMPLATES, DIRECTION_DEGREES, P1B_MODEL_STATUS, SCENARIO_CALIBRATION_VERSION, SCENARIO_SCHEMA_VERSION, SYNTHETIC_SCENARIO_DATUM_V1, sha256Canonical, type ScenarioConfiguration, type ScenarioPackageV1 } from '../contracts/scenario.js';
import { calibrationMidpoint } from './scenario-calibration.js';

export const defaultScenarioConfiguration: ScenarioConfiguration = Object.freeze({ wave: 'low', current: 'weak', wind: 'weak', gust: 'off', weather: 'clear', day: 'fixed', variation: 'none', wave_direction: 'north', wind_direction: 'north', current_direction: 'east', dominant_wave_period: 'short', visibility: 'normal', water_level: 'at_datum', tide_phase: 'slack', course_template: 'windward-return-v1' });

export async function createSyntheticScenario(configuration: ScenarioConfiguration): Promise<ScenarioPackageV1> {
  const wind = calibrationMidpoint('wind_kt', configuration.wind);
  const withoutHash = {
    schema_version: SCENARIO_SCHEMA_VERSION,
    source_kind: 'synthetic' as const,
    calibration_version: SCENARIO_CALIBRATION_VERSION,
    configuration,
    raw: {
      significant_wave_height_m: calibrationMidpoint('wave_m', configuration.wave),
      dominant_wave_period_s: { status: 'available' as const, value: calibrationMidpoint('dominant_wave_period_s', configuration.dominant_wave_period) },
      wave_direction_deg_true_from: { status: 'available' as const, value: DIRECTION_DEGREES[configuration.wave_direction], unit: 'degree' as const, reference: 'true_north' as const, convention: 'from' as const },
      wind_mean_kt: wind,
      wind_peak_kt: configuration.gust === 'on' ? wind + 5 : wind,
      wind_direction_deg_true_from: { status: 'available' as const, value: DIRECTION_DEGREES[configuration.wind_direction], unit: 'degree' as const, reference: 'true_north' as const, convention: 'from' as const },
      current_kt: { status: 'available' as const, value: calibrationMidpoint('current_kt', configuration.current) },
      current_direction_deg_true_to: { status: 'available' as const, value: DIRECTION_DEGREES[configuration.current_direction], unit: 'degree' as const, reference: 'true_north' as const, convention: 'toward' as const },
      visibility_nm: { status: 'available' as const, value: calibrationMidpoint('visibility_nm', configuration.visibility) },
      water_level_m: { status: 'available' as const, value: calibrationMidpoint('water_level_m', configuration.water_level) },
      water_level_datum: { status: 'available' as const, value: SYNTHETIC_SCENARIO_DATUM_V1 },
      water_level_tide_phase: { status: 'available' as const, value: configuration.tide_phase },
      sun_elevation_deg: 30,
    },
    geometry: { scenario_origin: { x_m: 0 as const, y_m: 0 as const }, map_bounds_m: { min_x: -500 as const, min_y: -250 as const, max_x: 500 as const, max_y: 1000 as const }, coordinate_contract_version: 'coordinate-contract-v1-draft' as const, course_template: COURSE_TEMPLATES[configuration.course_template] },
    provenance: { kind: 'synthetic' as const, statement: 'Synthetic — declared/unvalidated' as const },
    model_status: { current_physical_coupling: 'NOT_MODELED_BY_CURRENT_CORE' as const, p1b_fields: { wave_direction_deg_true_from: P1B_MODEL_STATUS, dominant_wave_period_s: P1B_MODEL_STATUS, wind_direction_deg_true_from: P1B_MODEL_STATUS, current_direction_deg_true_to: P1B_MODEL_STATUS, visibility_nm: P1B_MODEL_STATUS, water_level_m: P1B_MODEL_STATUS, water_level_datum: P1B_MODEL_STATUS, water_level_tide_phase: P1B_MODEL_STATUS, course_template: P1B_MODEL_STATUS } },
    derived_labels: { ...configuration },
  } satisfies Omit<ScenarioPackageV1, 'content_sha256'>;
  return Object.freeze({ ...withoutHash, content_sha256: await sha256Canonical(withoutHash) });
}
