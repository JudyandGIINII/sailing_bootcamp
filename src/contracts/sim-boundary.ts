import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const FORBIDDEN_PATTERNS: readonly RegExp[] = [
  /\bDate\.now\s*\(/,
  /\bperformance\.now\s*\(/,
  /\bMath\.random\s*\(/,
  /\b(?:window|document|localStorage|sessionStorage)\b/,
  /\b(?:fetch|XMLHttpRequest|WebSocket|EventSource)\b/,
  /(?:from|import\s*)\s*['"][^'"]*(?:pixi|dom|storage|network)[^'"]*['"]/i,
];

function filesUnder(directory: string): string[] {
  if (!existsSync(directory)) return [];
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? filesUnder(path) : [path];
  });
}

/** Scans a future simulation boundary without requiring that it exists today. */
export function findSimulationBoundaryViolations(projectRoot: string): string[] {
  const simulationRoot = join(projectRoot, 'src', 'sim');
  return filesUnder(simulationRoot)
    .filter((path) => /\.(?:[cm]?[jt]sx?)$/.test(path))
    .flatMap((path) => {
      const source = readFileSync(path, 'utf8');
      return FORBIDDEN_PATTERNS.flatMap((pattern) =>
        pattern.test(source) ? [`${relative(projectRoot, path)} violates ${pattern.source}`] : [],
      );
    });
}
