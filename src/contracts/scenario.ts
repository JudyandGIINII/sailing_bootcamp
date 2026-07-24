export const SCENARIO_SCHEMA_VERSION = 'scenario-package-v1' as const;
export const SCENARIO_CALIBRATION_VERSION = 'synthetic-calibration-v1' as const;
export const SYNTHETIC_SCENARIO_DATUM_V1 = 'SYNTHETIC_SCENARIO_DATUM_V1' as const;

/**
 * Data-only identity for the separately authored Scenario 1 calibration.
 * It is intentionally not a lesson binding, replay schema, or runtime input.
 */
export const SCENARIO_1_CONTRACT_VERSION = 'scenario-1-contract-v1' as const;
export const SCENARIO_1_DEFAULT_CONFIGURATION_VERSION = 'scenario-1-default-configuration-v1' as const;

export interface Scenario1DefaultConfigurationV1 {
  readonly configuration_version: typeof SCENARIO_1_DEFAULT_CONFIGURATION_VERSION;
  readonly start: {
    readonly point_of_sail: 'beam_reach';
    readonly sails_deployed: { readonly main: true; readonly jib: true };
    readonly wind_speed_kt: 8;
    readonly wave_height_m: 2;
    readonly current_speed_kt: 0;
    readonly weather: { readonly sky: 'clear'; readonly season: 'autumn' };
  };
}

export interface Scenario1ContractV1 {
  readonly scenario_id: 'scenario-1';
  readonly contract_version: typeof SCENARIO_1_CONTRACT_VERSION;
  readonly scope: {
    readonly calibration: 'synthetic-game-only';
    readonly navigation: 'not-modeled';
    readonly safety: 'not-modeled';
    readonly certification: 'not-modeled';
    readonly runtime_wiring: 'not-wired';
  };
  readonly default_configuration: Scenario1DefaultConfigurationV1;
  readonly score: {
    readonly component_weights_basis_points: {
      readonly sail_wind_fit: 5000;
      readonly course_control: 3000;
      readonly propulsion_context: 2000;
    };
    readonly course_control: {
      readonly heading_unit: 'centidegree';
      readonly full_score_through_error_centidegrees: 200;
      readonly zero_score_at_or_above_error_centidegrees: 3000;
      readonly interpolation: 'floor_linear';
    };
    readonly propulsion_context: {
      readonly normalized_engine_output: { readonly minimum: 0; readonly maximum: 10000 };
      readonly engine_only_penalty_start: 500;
      readonly sails_deployed_high_output_penalty_start_exclusive: 6500;
      readonly engine_only_maximum_penalty: 6000;
      readonly sails_deployed_high_output_maximum_penalty: 8000;
    };
  };
  readonly end_voyage: {
    readonly canonical_input: 'end_voyage';
    readonly same_tick_processing: 'ascending_sequence';
    readonly computes_after: 'lower_sequence_records';
    readonly freeze: 'score_contributors_and_debrief_without_another_tick';
    readonly higher_sequence_score_affecting_records: 'post_terminal_rejected';
  };
  readonly scheduling: {
    readonly stability_pacing_trigger_after_logical_seconds: 10;
    readonly stability_is_completion_or_score: false;
  };
}

function deepFreeze<T>(value: T): T {
  if (typeof value === 'object' && value !== null && !Object.isFrozen(value)) {
    for (const nested of Object.values(value)) deepFreeze(nested);
    Object.freeze(value);
  }
  return value;
}

export const scenario1DefaultConfigurationV1: Scenario1DefaultConfigurationV1 = deepFreeze({
  configuration_version: SCENARIO_1_DEFAULT_CONFIGURATION_VERSION,
  start: {
    point_of_sail: 'beam_reach',
    sails_deployed: { main: true, jib: true },
    wind_speed_kt: 8,
    wave_height_m: 2,
    current_speed_kt: 0,
    weather: { sky: 'clear', season: 'autumn' },
  },
});

export const scenario1ContractV1: Scenario1ContractV1 = deepFreeze({
  scenario_id: 'scenario-1',
  contract_version: SCENARIO_1_CONTRACT_VERSION,
  scope: {
    calibration: 'synthetic-game-only',
    navigation: 'not-modeled',
    safety: 'not-modeled',
    certification: 'not-modeled',
    runtime_wiring: 'not-wired',
  },
  default_configuration: scenario1DefaultConfigurationV1,
  score: {
    component_weights_basis_points: {
      sail_wind_fit: 5000,
      course_control: 3000,
      propulsion_context: 2000,
    },
    course_control: {
      heading_unit: 'centidegree',
      full_score_through_error_centidegrees: 200,
      zero_score_at_or_above_error_centidegrees: 3000,
      interpolation: 'floor_linear',
    },
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
  scheduling: {
    stability_pacing_trigger_after_logical_seconds: 10,
    stability_is_completion_or_score: false,
  },
});

export type WaveBand = 'low' | 'medium' | 'high';
export type CurrentBand = 'weak' | 'medium' | 'strong';
export type WindBand = 'weak' | 'medium' | 'strong';
export type Weather = 'clear' | 'cloudy' | 'rain';
export type VariationLevel = 'none' | 'weak' | 'strong';
export type DirectionSelector = 'north' | 'northeast' | 'east' | 'southeast' | 'south' | 'southwest' | 'west' | 'northwest';
export type DominantWavePeriod = 'short' | 'medium' | 'long';
export type Visibility = 'normal' | 'reduced' | 'restricted';
export type WaterLevel = 'below_datum' | 'at_datum' | 'above_datum';
export type TidePhase = 'rising' | 'falling' | 'slack';
export type CourseTemplateId = 'windward-return-v1' | 'triangle-v1';
export type MissingValue = { status: 'missing'; reason: 'NOT_MODELED_BY_CURRENT_CORE' };
export type AvailableValue<T> = { status: 'available'; value: T };
export type DirectionConvention = 'from' | 'toward';
export type AvailableDirection = AvailableValue<number> & {
  unit: 'degree'; reference: 'true_north'; convention: DirectionConvention;
};

export interface ScenarioConfiguration {
  wave: WaveBand; current: CurrentBand; wind: WindBand; gust: 'off' | 'on'; weather: Weather; day: 'fixed'; variation: VariationLevel;
  wave_direction: DirectionSelector; wind_direction: DirectionSelector; current_direction: DirectionSelector;
  dominant_wave_period: DominantWavePeriod; visibility: Visibility; water_level: WaterLevel; tide_phase: TidePhase; course_template: CourseTemplateId;
}
export interface ScenarioRaw {
  significant_wave_height_m: number;
  dominant_wave_period_s: AvailableValue<number>;
  wave_direction_deg_true_from: AvailableDirection;
  wind_mean_kt: number;
  wind_peak_kt: number;
  wind_direction_deg_true_from: AvailableDirection;
  current_kt: AvailableValue<number>;
  current_direction_deg_true_to: AvailableDirection;
  visibility_nm: AvailableValue<number>;
  water_level_m: AvailableValue<number>;
  water_level_datum: AvailableValue<typeof SYNTHETIC_SCENARIO_DATUM_V1>;
  water_level_tide_phase: AvailableValue<TidePhase>;
  sun_elevation_deg: number;
}
export interface ScenarioPoint { label: string; x_m: number; y_m: number; }
export interface ScenarioGeometry {
  scenario_origin: { x_m: 0; y_m: 0 };
  map_bounds_m: { min_x: -500; min_y: -250; max_x: 500; max_y: 1000 };
  coordinate_contract_version: 'coordinate-contract-v1-draft';
  course_template: { id: CourseTemplateId; start: ScenarioPoint; ordered_marks: readonly ScenarioPoint[]; finish: ScenarioPoint; };
}
export type ScenarioProvenance =
  | { kind: 'synthetic'; statement: 'Synthetic — declared/unvalidated' }
  | { kind: 'historical'; provider: string; record_id: string; observed_at: string };
export const P1B_MODEL_STATUS = 'SCENARIO_REPLAY_UI_ONLY_NOT_COUPLED_TO_CURRENT_CORE' as const;
export interface ScenarioModelStatus {
  current_physical_coupling: 'NOT_MODELED_BY_CURRENT_CORE';
  p1b_fields: {
    wave_direction_deg_true_from: typeof P1B_MODEL_STATUS;
    dominant_wave_period_s: typeof P1B_MODEL_STATUS;
    wind_direction_deg_true_from: typeof P1B_MODEL_STATUS;
    current_direction_deg_true_to: typeof P1B_MODEL_STATUS;
    visibility_nm: typeof P1B_MODEL_STATUS;
    water_level_m: typeof P1B_MODEL_STATUS;
    water_level_datum: typeof P1B_MODEL_STATUS;
    water_level_tide_phase: typeof P1B_MODEL_STATUS;
    course_template: typeof P1B_MODEL_STATUS;
  };
}
export type ScenarioDerivedLabels = ScenarioConfiguration;
export interface ScenarioPackageV1 {
  schema_version: typeof SCENARIO_SCHEMA_VERSION;
  source_kind: 'synthetic' | 'historical';
  calibration_version: typeof SCENARIO_CALIBRATION_VERSION;
  configuration: ScenarioConfiguration;
  raw: ScenarioRaw;
  geometry: ScenarioGeometry;
  provenance: ScenarioProvenance;
  model_status: ScenarioModelStatus;
  derived_labels: ScenarioDerivedLabels;
  content_sha256: string;
}

export const DIRECTION_DEGREES: Readonly<Record<DirectionSelector, number>> = Object.freeze({ north: 0, northeast: 45, east: 90, southeast: 135, south: 180, southwest: 225, west: 270, northwest: 315 });
export const COURSE_TEMPLATES: Readonly<Record<CourseTemplateId, ScenarioGeometry['course_template']>> = Object.freeze({
  'windward-return-v1': { id: 'windward-return-v1', start: { label: 'start', x_m: 0, y_m: 0 }, ordered_marks: [{ label: 'W1', x_m: 0, y_m: 600 }], finish: { label: 'finish', x_m: 0, y_m: 50 } },
  'triangle-v1': { id: 'triangle-v1', start: { label: 'start', x_m: -100, y_m: 0 }, ordered_marks: [{ label: 'W1', x_m: 0, y_m: 600 }, { label: 'R1', x_m: 300, y_m: 300 }], finish: { label: 'finish', x_m: 100, y_m: 0 } },
});

const topKeys = ['schema_version', 'source_kind', 'calibration_version', 'configuration', 'raw', 'geometry', 'provenance', 'model_status', 'derived_labels', 'content_sha256'] as const;
const configKeys = ['wave', 'current', 'wind', 'gust', 'weather', 'day', 'variation', 'wave_direction', 'wind_direction', 'current_direction', 'dominant_wave_period', 'visibility', 'water_level', 'tide_phase', 'course_template'] as const;
const rawKeys = ['significant_wave_height_m', 'dominant_wave_period_s', 'wave_direction_deg_true_from', 'wind_mean_kt', 'wind_peak_kt', 'wind_direction_deg_true_from', 'current_kt', 'current_direction_deg_true_to', 'visibility_nm', 'water_level_m', 'water_level_datum', 'water_level_tide_phase', 'sun_elevation_deg'] as const;
const p1bKeys = ['wave_direction_deg_true_from', 'dominant_wave_period_s', 'wind_direction_deg_true_from', 'current_direction_deg_true_to', 'visibility_nm', 'water_level_m', 'water_level_datum', 'water_level_tide_phase', 'course_template'] as const;

function exact(value: unknown, keys: readonly string[]): value is Record<string, unknown> { return typeof value === 'object' && value !== null && !Array.isArray(value) && Object.keys(value).length === keys.length && keys.every((key) => Object.hasOwn(value, key)); }
function finite(value: unknown): value is number { return typeof value === 'number' && Number.isFinite(value) && Number.isSafeInteger(value * 1_000_000); }
function isNonEmpty(value: unknown): value is string { return typeof value === 'string' && value.length > 0; }
function angle(value: unknown): value is number { return finite(value) && value >= 0 && value < 360; }
function isAvailableNumber(value: unknown): value is AvailableValue<number> { return exact(value, ['status', 'value']) && value.status === 'available' && finite(value.value); }
function isAvailableString(value: unknown): value is AvailableValue<string> { return exact(value, ['status', 'value']) && value.status === 'available' && isNonEmpty(value.value); }
function isDirection(value: unknown, convention: DirectionConvention): value is AvailableDirection {
  return exact(value, ['status', 'value', 'unit', 'reference', 'convention']) && value.status === 'available' && angle(value.value) && value.unit === 'degree' && value.reference === 'true_north' && value.convention === convention;
}
function isConfiguration(value: unknown): value is ScenarioConfiguration {
  return exact(value, configKeys) && ['low', 'medium', 'high'].includes(value.wave as string) && ['weak', 'medium', 'strong'].includes(value.current as string) && ['weak', 'medium', 'strong'].includes(value.wind as string) && ['off', 'on'].includes(value.gust as string) && ['clear', 'cloudy', 'rain'].includes(value.weather as string) && value.day === 'fixed' && ['none', 'weak', 'strong'].includes(value.variation as string) && Object.hasOwn(DIRECTION_DEGREES, value.wave_direction as string) && Object.hasOwn(DIRECTION_DEGREES, value.wind_direction as string) && Object.hasOwn(DIRECTION_DEGREES, value.current_direction as string) && ['short', 'medium', 'long'].includes(value.dominant_wave_period as string) && ['normal', 'reduced', 'restricted'].includes(value.visibility as string) && ['below_datum', 'at_datum', 'above_datum'].includes(value.water_level as string) && ['rising', 'falling', 'slack'].includes(value.tide_phase as string) && Object.hasOwn(COURSE_TEMPLATES, value.course_template as string);
}
function isRaw(value: unknown): value is ScenarioRaw {
  return exact(value, rawKeys) && finite(value.significant_wave_height_m) && finite(value.wind_mean_kt) && finite(value.wind_peak_kt) && finite(value.sun_elevation_deg) && isAvailableNumber(value.dominant_wave_period_s) && isDirection(value.wave_direction_deg_true_from, 'from') && isDirection(value.wind_direction_deg_true_from, 'from') && isAvailableNumber(value.current_kt) && isDirection(value.current_direction_deg_true_to, 'toward') && isAvailableNumber(value.visibility_nm) && isAvailableNumber(value.water_level_m) && isAvailableString(value.water_level_datum) && isAvailableString(value.water_level_tide_phase);
}
function isPoint(value: unknown): value is ScenarioPoint { return exact(value, ['label', 'x_m', 'y_m']) && isNonEmpty(value.label) && finite(value.x_m) && finite(value.y_m); }
function isGeometry(value: unknown): value is ScenarioGeometry {
  if (!exact(value, ['scenario_origin', 'map_bounds_m', 'coordinate_contract_version', 'course_template']) || !exact(value.scenario_origin, ['x_m', 'y_m']) || !exact(value.map_bounds_m, ['min_x', 'min_y', 'max_x', 'max_y']) || !exact(value.course_template, ['id', 'start', 'ordered_marks', 'finish'])) return false;
  const bounds = value.map_bounds_m; const course = value.course_template;
  return value.scenario_origin.x_m === 0 && value.scenario_origin.y_m === 0 && bounds.min_x === -500 && bounds.min_y === -250 && bounds.max_x === 500 && bounds.max_y === 1000 && value.coordinate_contract_version === 'coordinate-contract-v1-draft' && typeof course.id === 'string' && Object.hasOwn(COURSE_TEMPLATES, course.id) && isPoint(course.start) && Array.isArray(course.ordered_marks) && course.ordered_marks.every(isPoint) && isPoint(course.finish) && canonicalJson(course) === canonicalJson(COURSE_TEMPLATES[course.id as CourseTemplateId]);
}
function isProvenance(value: unknown, sourceKind: 'synthetic' | 'historical', variation: VariationLevel): value is ScenarioProvenance { return sourceKind === 'synthetic' ? exact(value, ['kind', 'statement']) && value.kind === 'synthetic' && value.statement === 'Synthetic — declared/unvalidated' : exact(value, ['kind', 'provider', 'record_id', 'observed_at']) && value.kind === 'historical' && isNonEmpty(value.provider) && isNonEmpty(value.record_id) && isNonEmpty(value.observed_at) && variation === 'none'; }
function isModelStatus(value: unknown): value is ScenarioModelStatus { return exact(value, ['current_physical_coupling', 'p1b_fields']) && value.current_physical_coupling === 'NOT_MODELED_BY_CURRENT_CORE' && exact(value.p1b_fields, p1bKeys) && Object.values(value.p1b_fields).every((status) => status === P1B_MODEL_STATUS); }
function isScenarioPackageShape(value: unknown): value is ScenarioPackageV1 {
  if (!exact(value, topKeys) || value.schema_version !== SCENARIO_SCHEMA_VERSION || value.calibration_version !== SCENARIO_CALIBRATION_VERSION || (value.source_kind !== 'synthetic' && value.source_kind !== 'historical') || typeof value.content_sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(value.content_sha256) || !isConfiguration(value.configuration) || !isRaw(value.raw) || !isGeometry(value.geometry) || !isConfiguration(value.derived_labels) || !isModelStatus(value.model_status)) return false;
  const { configuration, raw, geometry } = value;
  return classifyWave(raw.significant_wave_height_m) === configuration.wave && classifyDominantWavePeriod(raw.dominant_wave_period_s.value) === configuration.dominant_wave_period && raw.wave_direction_deg_true_from.value === DIRECTION_DEGREES[configuration.wave_direction] && classifyWind(raw.wind_mean_kt) === configuration.wind && raw.wind_direction_deg_true_from.value === DIRECTION_DEGREES[configuration.wind_direction] && classifyCurrent(raw.current_kt.value) === configuration.current && raw.current_direction_deg_true_to.value === DIRECTION_DEGREES[configuration.current_direction] && classifyVisibility(raw.visibility_nm.value) === configuration.visibility && classifyWaterLevel(raw.water_level_m.value) === configuration.water_level && raw.water_level_datum.value === SYNTHETIC_SCENARIO_DATUM_V1 && raw.water_level_tide_phase.value === configuration.tide_phase && canonicalJson(geometry.course_template) === canonicalJson(COURSE_TEMPLATES[configuration.course_template]) && (configuration.gust === 'off' ? raw.wind_peak_kt === raw.wind_mean_kt : raw.wind_peak_kt === raw.wind_mean_kt + 5) && raw.sun_elevation_deg >= 0 && canonicalJson(value.derived_labels) === canonicalJson(configuration) && isProvenance(value.provenance, value.source_kind, configuration.variation);
}

export function classifyWave(height: number): WaveBand | undefined { return height >= 0 && height <= .6 ? 'low' : height > .6 && height <= 2 ? 'medium' : height > 2 && height <= 3 ? 'high' : undefined; }
export function classifyDominantWavePeriod(seconds: number): DominantWavePeriod | undefined { return seconds >= 3 && seconds <= 5 ? 'short' : seconds > 5 && seconds <= 8 ? 'medium' : seconds > 8 && seconds <= 12 ? 'long' : undefined; }
export function classifyWind(kt: number): WindBand | undefined { return kt >= 1 && kt <= 10 ? 'weak' : kt >= 11 && kt <= 16 ? 'medium' : kt >= 17 && kt <= 21 ? 'strong' : undefined; }
export function classifyCurrent(kt: number): CurrentBand | undefined { return kt >= 0 && kt <= .5 ? 'weak' : kt > .5 && kt <= 1.5 ? 'medium' : kt > 1.5 && kt <= 2.5 ? 'strong' : undefined; }
export function classifyVisibility(nmi: number): Visibility | undefined { return nmi === 10 ? 'normal' : nmi === 5 ? 'reduced' : nmi === 1 ? 'restricted' : undefined; }
export function classifyWaterLevel(meters: number): WaterLevel | undefined { return meters === -.5 ? 'below_datum' : meters === 0 ? 'at_datum' : meters === .5 ? 'above_datum' : undefined; }

export function canonicalJson(value: unknown): string { if (value === null || typeof value === 'boolean' || typeof value === 'string') return JSON.stringify(value); if (typeof value === 'number') { if (!Number.isFinite(value)) throw new TypeError('SCENARIO_NON_CANONICAL_NUMBER'); return JSON.stringify(Object.is(value, -0) ? 0 : value); } if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`; if (typeof value !== 'object' || value === undefined) throw new TypeError('SCENARIO_NON_CANONICAL_VALUE'); const object = value as Record<string, unknown>; return `{${Object.keys(object).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(object[key])}`).join(',')}}`; }
export async function sha256Canonical(value: unknown): Promise<string> { const bytes = new TextEncoder().encode(canonicalJson(value)); const digest = await crypto.subtle.digest('SHA-256', bytes); return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join(''); }
export function scenarioPackageForHash(value: ScenarioPackageV1): Omit<ScenarioPackageV1, 'content_sha256'> { const { content_sha256: hash, ...packageForHash } = value; void hash; return packageForHash; }
export async function validateScenarioPackage(value: unknown): Promise<{ ok: true; scenario: ScenarioPackageV1 } | { ok: false; reason_code: 'SCENARIO_SCHEMA_INVALID' | 'SCENARIO_HASH_INVALID' }> { if (!isScenarioPackageShape(value)) return { ok: false, reason_code: 'SCENARIO_SCHEMA_INVALID' }; if (await sha256Canonical(scenarioPackageForHash(value)) !== value.content_sha256) return { ok: false, reason_code: 'SCENARIO_HASH_INVALID' }; return { ok: true, scenario: value }; }
