import { describe, expect, it } from 'vitest';
import { normalizeKeyboardAction } from '../../src/app/input.js';
import { getLessonManifest, lessonManifestRegistry } from '../../src/content/lesson-manifest.js';

describe('keyboard normalization', () => {
  it('maps only declared discrete actions and ignores browser repeat cadence', () => {
    const l01Actions = getLessonManifest('L01')!.permitted_actions;
    expect(normalizeKeyboardAction('ArrowLeft', false, false, l01Actions)).toBe('helm_port');
    expect(normalizeKeyboardAction('ArrowLeft', true, false, l01Actions)).toBeNull();
    expect(normalizeKeyboardAction(' ', false, true, l01Actions)).toBe('resume');
    expect(normalizeKeyboardAction('f', false, false, l01Actions)).toBeNull();
    expect(normalizeKeyboardAction('x', false, false, l01Actions)).toBeNull();
  });

  it.each([
    ['L01', 'f'],
    ['L02', 'f'],
    ['L03', 'p'],
    ['L04', 'w'],
    ['L05', 'm'],
  ] as const)('returns null for a disallowed %s keyboard action', (lessonId, key) => {
    const actions = lessonManifestRegistry[lessonId].permitted_actions;
    expect(normalizeKeyboardAction(key, false, false, actions)).toBeNull();
  });
});
