import { describe, expect, it } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { findSimulationBoundaryViolations } from '../../src/contracts/sim-boundary.js';

describe('simulation boundary', () => {
  it('is safe while src/sim is absent and scans it when later created', () => {
    expect(findSimulationBoundaryViolations(resolve('.'))).toEqual([]);
  });

  it('rejects nondeterministic APIs and renderer, storage, or network boundaries', () => {
    const projectRoot = mkdtempSync(join(tmpdir(), 'sailing-contract-'));
    const simDirectory = join(projectRoot, 'src', 'sim');
    mkdirSync(simDirectory, { recursive: true });
    writeFileSync(
      join(simDirectory, 'boundary-violation.ts'),
      "import 'pixi.js'; Date.now(); performance.now(); Math.random(); window.fetch('/');",
    );

    expect(findSimulationBoundaryViolations(projectRoot)).toHaveLength(6);
  });
});
