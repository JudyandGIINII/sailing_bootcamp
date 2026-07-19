import { describe, expect, it } from 'vitest';
import { normalizeKeyboardAction } from '../../src/app/input.js';

describe('keyboard normalization', () => {
  it('maps only declared discrete actions and ignores browser repeat cadence', () => {
    expect(normalizeKeyboardAction('ArrowLeft', false, false)).toBe('helm_port');
    expect(normalizeKeyboardAction('ArrowLeft', true, false)).toBeNull();
    expect(normalizeKeyboardAction(' ', false, true)).toBe('resume');
    expect(normalizeKeyboardAction('x', false, false)).toBeNull();
  });
});
