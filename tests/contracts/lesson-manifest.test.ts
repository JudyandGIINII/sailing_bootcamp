import { describe, expect, it } from 'vitest';
import { evaluateLessonLoad } from '../../src/gates/eligibility.js';
import { getLessonManifest, isLessonActionAllowed, lessonManifestRegistry } from '../../src/content/lesson-manifest.js';

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
});
