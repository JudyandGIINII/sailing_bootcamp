import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('AP-0C release evidence', () => {
  it('generates and validates a dependency-free blocked report', () => {
    execFileSync(process.execPath, ['scripts/build-release-evidence.mjs'], { stdio: 'pipe' });
    expect(existsSync('artifacts/release-evidence/ap-0c.json')).toBe(true);
    expect(execFileSync(process.execPath, ['scripts/build-release-evidence.mjs', '--validate'], { encoding: 'utf8' })).toContain('valid');
  });
});
