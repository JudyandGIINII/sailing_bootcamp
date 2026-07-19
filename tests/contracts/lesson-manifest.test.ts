import { describe, expect, it } from 'vitest';
import { evaluateLessonLoad } from '../../src/gates/eligibility.js';
import { l01Manifest, type L01Manifest } from '../../src/content/l01.js';
import { getLessonManifest, isLessonActionAllowed, lessonManifestRegistry, projectLessonObservations, resolveDeclaredSyntheticSafetyEvent } from '../../src/content/lesson-manifest.js';

describe('lesson action-manifest authority', () => {
  const declaredActions = [...new Set(Object.values(lessonManifestRegistry).flatMap((manifest) => manifest.permitted_actions))];

  it.each(Object.values(lessonManifestRegistry))('%s policy matrix admits every and only its declared actions', (manifest) => {
    const bindings = {
      scenario_version: manifest.scenario_version,
      model_version: manifest.model_version,
      boat_profile_version: manifest.boat_profile_version,
      contract_version: manifest.contract_version,
      coordinate_contract_version: manifest.coordinate_contract_version,
      determinism_contract_version: manifest.determinism_contract_version,
      comparison_policy_version: manifest.comparison_policy_version,
    };
    for (const action of declaredActions) {
      expect(isLessonActionAllowed(bindings, action)).toBe(manifest.permitted_actions.includes(action as never));
    }
    expect(evaluateLessonLoad(manifest.lesson_id, manifest.boat_profile_version, manifest.permitted_actions, bindings)).toEqual({ eligible: true, mode: 'prototype', reasons: [] });
  });

  it.each([
    ['L01', 'reef'],
    ['L02', 'reef'],
    ['L03', 'decision_pass'],
    ['L04', 'decision_wait'],
    ['L05', 'main_trim'],
  ])('%s rejects a keyboard/canonical action outside its policy', (lessonId, action) => {
    const manifest = getLessonManifest(lessonId)!;
    const identity = { ...manifest, seed: 'policy', ordered_input_log: [] };
    expect(isLessonActionAllowed(identity, action)).toBe(false);
  });

  it.each(Object.values(lessonManifestRegistry))('%s projects every observation in exact declaration order with explicit status', (manifest) => {
    expect(projectLessonObservations(manifest.lesson_id)).toEqual(manifest.required_observations);
    for (const observation of manifest.required_observations) {
      expect(observation.accessible_label).toContain('/');
      expect(['declared_synthetic', 'declared_unavailable']).toContain(observation.status);
    }
  });

  it('keeps every production L01-L05 manifest free of synthetic safety mappings', () => {
    expect(Object.values(lessonManifestRegistry).every((manifest) => manifest.synthetic_safety_event === undefined)).toBe(true);
  });

  it('validates a synthetic safety declaration without registering or injecting a runtime policy', () => {
    const fixture: L01Manifest = Object.freeze({
      ...l01Manifest,
      scenario_version: 'synthetic-safety-fixture-v0',
      synthetic_safety_event: { action: 'helm_port', status: 'declared_synthetic', validation_status: 'unvalidated' } as const,
    });
    expect(resolveDeclaredSyntheticSafetyEvent(fixture.permitted_actions, fixture.synthetic_safety_event)).toEqual(fixture.synthetic_safety_event);

    const absent: L01Manifest = Object.freeze({ ...fixture, synthetic_safety_event: undefined });
    const empty = { ...fixture, synthetic_safety_event: { action: '', status: 'declared_synthetic', validation_status: 'unvalidated' } } as unknown as L01Manifest;
    const unknown = { ...fixture, synthetic_safety_event: { action: 'unknown', status: 'declared_synthetic', validation_status: 'unvalidated' } } as unknown as L01Manifest;
    expect(resolveDeclaredSyntheticSafetyEvent(absent.permitted_actions, absent.synthetic_safety_event)).toBeUndefined();
    expect(resolveDeclaredSyntheticSafetyEvent(empty.permitted_actions, empty.synthetic_safety_event)).toBeUndefined();
    expect(resolveDeclaredSyntheticSafetyEvent(unknown.permitted_actions, unknown.synthetic_safety_event)).toBeUndefined();
  });
});
