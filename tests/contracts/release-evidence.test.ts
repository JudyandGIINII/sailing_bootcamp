import { execFileSync, spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join, resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

const sourceRoot = resolve('.');
const temporaryPaths: string[] = [];

function hash(path: string): string {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

function git(cwd: string, args: string[]): string {
  return execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
}

function makeFixture(): { root: string; observations: string; revision: string; output: string; historicalPaths: string[] } {
  const root = mkdtempSync('/private/tmp/sailing-evidence-fixture-');
  temporaryPaths.push(root);
  mkdirSync(join(root, 'scripts'), { recursive: true });
  mkdirSync(join(root, 'docs/quality'), { recursive: true });
  mkdirSync(join(root, 'artifacts/release-evidence/generated'), { recursive: true });
  copyFileSync(join(sourceRoot, 'scripts/build-release-evidence.mjs'), join(root, 'scripts/build-release-evidence.mjs'));
  copyFileSync(join(sourceRoot, 'docs/quality/release-evidence.schema.json'), join(root, 'docs/quality/release-evidence.schema.json'));
  writeFileSync(join(root, '.gitignore'), 'artifacts/release-evidence/generated/\n');
  const historicalPaths = [
    join(root, 'artifacts/release-evidence/ap-0c.json'),
    join(root, 'artifacts/release-evidence/ap-0c-observations.json'),
  ];
  writeFileSync(historicalPaths[0]!, '{"historical":"evidence"}\n');
  writeFileSync(historicalPaths[1]!, '{"historical":"observations"}\n');
  writeFileSync(join(root, 'docs/tracked-output.json'), '{"tracked":true}\n');
  git(root, ['init']);
  git(root, ['config', 'user.email', 'test@example.invalid']);
  git(root, ['config', 'user.name', 'Evidence Test']);
  git(root, ['add', '.']);
  git(root, ['commit', '-m', 'fixture']);
  const revision = git(root, ['rev-parse', 'HEAD']);
  const observationsDirectory = mkdtempSync('/private/tmp/sailing-evidence-observations-');
  temporaryPaths.push(observationsDirectory);
  const observations = join(observationsDirectory, 'observations.json');
  writeFileSync(observations, `${JSON.stringify({
    task_id: 'ALF-20260719-1207-sailing-ap0c-r2',
    source_revision: revision,
    command_outcomes: [{ command: 'npm test', outcome: 'pass' }],
    browser_candidates: [
      { browser: 'Chromium', outcome: 'pass', support_claim: false },
      { browser: 'WebKit', outcome: 'inconclusive', support_claim: false },
      { browser: 'Firefox', outcome: 'inconclusive', support_claim: false },
    ],
    storage_evidence: {},
    unexpected_network_count: 0,
    registry_assumptions_count: 1,
    reason_codes: ['DOMAIN_ASSUMPTIONS_PRESENT', 'RELEASE_AUTHORITY_MISSING'],
    force_override_used: false,
  }, null, 2)}\n`);
  return { root, observations, revision, output: join(root, 'artifacts/release-evidence/generated/report.json'), historicalPaths };
}

function execute(root: string, argumentsList: string[]) {
  return spawnSync(process.execPath, ['scripts/build-release-evidence.mjs', ...argumentsList], { cwd: root, encoding: 'utf8' });
}

function expectFailure(root: string, argumentsList: string[], code: string): void {
  const result = execute(root, argumentsList);
  expect(result.status).toBe(1);
  expect(result.stderr).toBe(`${code}\n`);
}

function evaluate(expression: string): string {
  return execFileSync(process.execPath, ['--input-type=module', '--eval', expression], { cwd: sourceRoot, encoding: 'utf8' }).trim();
}

afterEach(() => {
  while (temporaryPaths.length) rmSync(temporaryPaths.pop()!, { recursive: true, force: true });
});

describe('AP-0C release evidence lifecycle', () => {
  it('generates only from a clean exact-HEAD fixture and validates the artifact on clean and dirty trees without mutating inputs or history', () => {
    const fixture = makeFixture();
    const historicalHashes = fixture.historicalPaths.map(hash);
    const observationsHash = hash(fixture.observations);
    const generate = execute(fixture.root, ['--generate', '--observations', fixture.observations, '--output', fixture.output, '--subject-revision', fixture.revision]);
    expect(generate.status).toBe(0);
    expect(readFileSync(fixture.output, 'utf8')).toContain(fixture.revision);
    expect(execute(fixture.root, ['--validate', '--input', fixture.output, '--subject-revision', fixture.revision]).status).toBe(0);
    const externalOutput = join(dirname(fixture.observations), 'external-report.json');
    expect(execute(fixture.root, ['--generate', '--observations', fixture.observations, '--output', externalOutput, '--subject-revision', fixture.revision]).status).toBe(0);
    expect(execute(fixture.root, ['--validate', '--input', externalOutput, '--subject-revision', fixture.revision]).status).toBe(0);

    const outputHash = hash(fixture.output);
    const externalOutputHash = hash(externalOutput);
    writeFileSync(join(fixture.root, 'dirty.txt'), 'uncommitted\n');
    expectFailure(fixture.root, ['--generate', '--observations', fixture.observations, '--output', fixture.output, '--subject-revision', fixture.revision], 'EVIDENCE_WORKTREE_DIRTY');
    expect(hash(fixture.output)).toBe(outputHash);
    expect(hash(externalOutput)).toBe(externalOutputHash);
    expect(execute(fixture.root, ['--validate', '--input', fixture.output, '--subject-revision', fixture.revision]).status).toBe(0);
    expect(hash(fixture.observations)).toBe(observationsHash);
    expect(fixture.historicalPaths.map(hash)).toEqual(historicalHashes);
  });

  it('rejects malformed, nonexistent, stale, tracked, historical, and traversal generation requests before writing output', () => {
    const fixture = makeFixture();
    git(fixture.root, ['commit', '--allow-empty', '-m', 'newer fixture head']);
    const currentRevision = git(fixture.root, ['rev-parse', 'HEAD']);
    const staleObservations = join(dirname(fixture.observations), 'stale-observations.json');
    writeFileSync(staleObservations, readFileSync(fixture.observations, 'utf8').replace(fixture.revision, 'b'.repeat(40)));
    const base = ['--generate', '--observations', fixture.observations, '--output', fixture.output];
    expectFailure(fixture.root, base, 'EVIDENCE_CLI_INVALID');
    expectFailure(fixture.root, [...base, '--subject-revision', 'not-a-revision'], 'EVIDENCE_SUBJECT_REVISION_INVALID');
    expectFailure(fixture.root, [...base, '--subject-revision', 'f'.repeat(40)], 'EVIDENCE_SUBJECT_REVISION_INVALID');
    expectFailure(fixture.root, [...base, '--subject-revision', fixture.revision], 'EVIDENCE_SUBJECT_REVISION_NOT_HEAD');
    expectFailure(fixture.root, ['--generate', '--observations', staleObservations, '--output', fixture.output, '--subject-revision', currentRevision], 'EVIDENCE_REVISION_STALE');
    expectFailure(fixture.root, ['--generate', '--observations', fixture.observations, '--output', 'docs/tracked-output.json', '--subject-revision', currentRevision], 'EVIDENCE_OUTPUT_TRACKED');
    expectFailure(fixture.root, ['--generate', '--observations', fixture.observations, '--output', 'artifacts/release-evidence/ap-0c.json', '--subject-revision', currentRevision], 'EVIDENCE_OUTPUT_HISTORICAL');
    expectFailure(fixture.root, ['--generate', '--observations', fixture.observations, '--output', '../escape.json', '--subject-revision', currentRevision], 'EVIDENCE_PATH_INVALID');
  });

  it('rejects malformed RFC3339 timestamps including impossible dates, missing offsets, and trailing content', () => {
    const revision = 'a'.repeat(40);
    const observations = {
      task_id: 'ALF-20260719-1207-sailing-ap0c-r2',
      source_revision: revision,
      command_outcomes: [{ command: 'npm test', outcome: 'pass' }],
      browser_candidates: [
        { browser: 'Chromium', outcome: 'pass', support_claim: false },
        { browser: 'WebKit', outcome: 'inconclusive', support_claim: false },
        { browser: 'Firefox', outcome: 'inconclusive', support_claim: false },
      ],
      storage_evidence: {}, unexpected_network_count: 0, registry_assumptions_count: 1,
      reason_codes: ['DOMAIN_ASSUMPTIONS_PRESENT', 'RELEASE_AUTHORITY_MISSING'], force_override_used: false,
    };
    for (const timestamp of ['not-a-date', '2026-02-29T00:00:00Z', '2026-07-19T00:00:00', '2026-07-19T00:00:00Z trailing', '2026-07-19T24:00:00+00:00']) {
      const expression = `import { constructReleaseEvidence, validateReleaseEvidence } from './scripts/build-release-evidence.mjs';
        const observations = ${JSON.stringify(observations)};
        const report = constructReleaseEvidence(observations, ${JSON.stringify(revision)}, '2026-07-19T00:00:00.000Z');
        try { validateReleaseEvidence({ ...report, generated_at: ${JSON.stringify(timestamp)} }, ${JSON.stringify(revision)}); } catch (error) { console.log(error.code); }`;
      expect(evaluate(expression)).toBe('EVIDENCE_TIMESTAMP_INVALID');
    }
  });
});
