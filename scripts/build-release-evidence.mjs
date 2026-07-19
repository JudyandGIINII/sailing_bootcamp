import { execFileSync } from 'node:child_process';
import { lstatSync, readFileSync, realpathSync, renameSync, statSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const generatedDirectory = resolve(root, 'artifacts/release-evidence/generated');
const historicalEvidencePaths = new Set([
  resolve(root, 'artifacts/release-evidence/ap-0c.json'),
  resolve(root, 'artifacts/release-evidence/ap-0c-observations.json'),
]);
const schemaPath = resolve(root, 'docs/quality/release-evidence.schema.json');
const identityFields = ['scenario_version', 'seed', 'ordered_input_log', 'model_version', 'boat_profile_version', 'contract_version', 'coordinate_contract_version', 'determinism_contract_version', 'comparison_policy_version'];
const revisionPattern = /^[0-9a-f]{40}$/;
const rfc3339Pattern = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;

export class EvidenceError extends Error {
  constructor(code) {
    super(code);
    this.code = code;
  }
}

function isWithin(parent, candidate) {
  const path = relative(parent, candidate);
  return path === '' || (!path.startsWith(`..${sep}`) && path !== '..' && !isAbsolute(path));
}

function hasTraversal(path) {
  return path.split(/[\\/]+/).includes('..');
}

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function assertStrictRfc3339(timestamp) {
  if (typeof timestamp !== 'string') throw new EvidenceError('EVIDENCE_TIMESTAMP_INVALID');
  const match = rfc3339Pattern.exec(timestamp);
  if (!match) throw new EvidenceError('EVIDENCE_TIMESTAMP_INVALID');
  const [, yearText, monthText, dayText, hourText, minuteText, secondText] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const hour = Number(hourText);
  const minute = Number(minuteText);
  const second = Number(secondText);
  const offset = timestamp.slice(-1) === 'Z' ? undefined : timestamp.slice(-6);
  const offsetHour = offset === undefined ? 0 : Number(offset.slice(1, 3));
  const offsetMinute = offset === undefined ? 0 : Number(offset.slice(4, 6));
  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const daysInMonth = [31, leapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1] ?? 0;
  if (month < 1 || month > 12 || day < 1 || day > daysInMonth || hour > 23 || minute > 59 || second > 59 || offsetHour > 23 || offsetMinute > 59) {
    throw new EvidenceError('EVIDENCE_TIMESTAMP_INVALID');
  }
}

export function parseCli(argumentsList) {
  const mode = argumentsList[0];
  const expectedNames = mode === '--generate'
    ? ['--observations', '--output', '--subject-revision']
    : mode === '--validate'
      ? ['--input', '--subject-revision']
      : undefined;
  if (!expectedNames || argumentsList.length !== 1 + expectedNames.length * 2) throw new EvidenceError('EVIDENCE_CLI_INVALID');

  const options = { mode };
  for (let index = 1; index < argumentsList.length; index += 2) {
    const name = argumentsList[index];
    const value = argumentsList[index + 1];
    if (!expectedNames.includes(name) || typeof value !== 'string' || Object.hasOwn(options, name.slice(2).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase()))) {
      throw new EvidenceError('EVIDENCE_CLI_INVALID');
    }
    options[name.slice(2).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())] = value;
  }
  if (!expectedNames.every((name) => Object.hasOwn(options, name.slice(2).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())))) {
    throw new EvidenceError('EVIDENCE_CLI_INVALID');
  }
  return options;
}

function resolveExplicitPath(value) {
  if (typeof value !== 'string' || value.length === 0 || value.includes('\0') || hasTraversal(value)) throw new EvidenceError('EVIDENCE_PATH_INVALID');
  return resolve(root, value);
}

function resolveReadablePath(value) {
  const path = resolveExplicitPath(value);
  try {
    if (!statSync(path).isFile()) throw new EvidenceError('EVIDENCE_PATH_INVALID');
    return realpathSync(path);
  } catch (error) {
    if (error instanceof EvidenceError) throw error;
    throw new EvidenceError('EVIDENCE_PATH_INVALID');
  }
}

function resolveOutputPath(value) {
  const requestedPath = resolveExplicitPath(value);
  if (historicalEvidencePaths.has(requestedPath)) throw new EvidenceError('EVIDENCE_OUTPUT_HISTORICAL');
  try {
    if (execFileSync('git', ['ls-files', '--error-unmatch', '--', requestedPath], { cwd: root, stdio: 'pipe' }).toString().trim()) {
      throw new EvidenceError('EVIDENCE_OUTPUT_TRACKED');
    }
  } catch (error) {
    if (error instanceof EvidenceError) throw error;
  }

  let targetStatus;
  try {
    targetStatus = lstatSync(requestedPath);
  } catch {
    targetStatus = undefined;
  }
  if (targetStatus?.isSymbolicLink()) throw new EvidenceError('EVIDENCE_OUTPUT_SYMLINK');

  const requestedParent = dirname(requestedPath);
  let realParent;
  try {
    if (!statSync(requestedParent).isDirectory()) throw new EvidenceError('EVIDENCE_PATH_INVALID');
    realParent = realpathSync(requestedParent);
  } catch (error) {
    if (error instanceof EvidenceError) throw error;
    throw new EvidenceError('EVIDENCE_PATH_INVALID');
  }
  const resolvedOutput = resolve(realParent, requestedPath.slice(requestedParent.length + 1));
  const realRoot = realpathSync(root);
  const lexicalInsideRepo = isWithin(root, requestedPath);
  const resolvedInsideRepo = isWithin(realRoot, resolvedOutput);
  if (lexicalInsideRepo !== resolvedInsideRepo) throw new EvidenceError('EVIDENCE_OUTPUT_SYMLINK');
  if (resolvedInsideRepo) {
    let realGeneratedDirectory;
    try {
      if (!statSync(generatedDirectory).isDirectory()) throw new EvidenceError('EVIDENCE_PATH_INVALID');
      realGeneratedDirectory = realpathSync(generatedDirectory);
    } catch (error) {
      if (error instanceof EvidenceError) throw error;
      throw new EvidenceError('EVIDENCE_PATH_INVALID');
    }
    if (!isWithin(generatedDirectory, requestedPath) || !isWithin(realGeneratedDirectory, resolvedOutput) || resolvedOutput === realGeneratedDirectory) {
      throw new EvidenceError('EVIDENCE_OUTPUT_UNSAFE');
    }
  }
  return resolvedOutput;
}

function assertSubjectRevision(subjectRevision, requireCurrentHead) {
  if (typeof subjectRevision !== 'string' || !revisionPattern.test(subjectRevision)) throw new EvidenceError('EVIDENCE_SUBJECT_REVISION_INVALID');
  try {
    execFileSync('git', ['cat-file', '-e', `${subjectRevision}^{commit}`], { cwd: root, stdio: 'pipe' });
  } catch {
    throw new EvidenceError('EVIDENCE_SUBJECT_REVISION_INVALID');
  }
  if (requireCurrentHead) {
    const currentHead = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
    if (subjectRevision !== currentHead) throw new EvidenceError('EVIDENCE_SUBJECT_REVISION_NOT_HEAD');
    if (execFileSync('git', ['status', '--porcelain'], { cwd: root, encoding: 'utf8' }).trim().length > 0) {
      throw new EvidenceError('EVIDENCE_WORKTREE_DIRTY');
    }
  }
}

export function validateReleaseEvidence(report, sourceRevision) {
  if (!report || typeof report !== 'object' || Array.isArray(report)) throw new EvidenceError('EVIDENCE_REVISION_MISSING');
  if (typeof report.source_revision !== 'string' || !revisionPattern.test(report.source_revision) || report.freshness_basis !== 'exact-source-revision') {
    throw new EvidenceError('EVIDENCE_REVISION_MISSING');
  }
  assertStrictRfc3339(report.generated_at);
  if (report.source_revision !== sourceRevision) throw new EvidenceError('EVIDENCE_REVISION_STALE');

  const errors = [];
  if (report.task_id !== 'ALF-20260719-1207-sailing-ap0c-r2') errors.push('task_id');
  if (JSON.stringify(report.replay_identity_fields) !== JSON.stringify(identityFields)) errors.push('replay_identity_fields');
  if (!Array.isArray(report.command_outcomes) || report.command_outcomes.length === 0) errors.push('command_outcomes');
  const browsers = new Map((report.browser_candidates ?? []).map((entry) => [entry.browser, entry]));
  for (const browser of ['Chromium', 'WebKit', 'Firefox']) if (!browsers.has(browser) || browsers.get(browser).support_claim !== false) errors.push(`browser:${browser}`);
  if (report.unexpected_network_count !== 0) errors.push('unexpected_network_count');
  if (!(Number.isInteger(report.registry_assumptions_count) && report.registry_assumptions_count >= 1)) errors.push('registry_assumptions_count');
  if (report.release_eligible !== false || report.decision !== 'BLOCKED' || report.force_override_used !== false) errors.push('release_gate');
  if (!Array.isArray(report.reason_codes) || !report.reason_codes.includes('DOMAIN_ASSUMPTIONS_PRESENT') || !report.reason_codes.includes('RELEASE_AUTHORITY_MISSING')) errors.push('reason_codes');
  if (!report.storage_evidence || typeof report.storage_evidence !== 'object') errors.push('storage_evidence');
  if (errors.length) throw new EvidenceError(`EVIDENCE_INVALID:${errors.join(',')}`);
  return report;
}

export function constructReleaseEvidence(observations, sourceRevision, generatedAt) {
  if (!observations || typeof observations !== 'object' || Array.isArray(observations) || typeof observations.source_revision !== 'string') {
    throw new EvidenceError('EVIDENCE_REVISION_MISSING');
  }
  if (observations.source_revision !== sourceRevision) throw new EvidenceError('EVIDENCE_REVISION_STALE');
  const { base: _legacyBase, source_revision: _observationRevision, generated_at: _observationGeneratedAt, freshness_basis: _observationFreshnessBasis, ...evidence } = observations;
  return validateReleaseEvidence({
    ...evidence,
    source_revision: sourceRevision,
    generated_at: generatedAt,
    freshness_basis: 'exact-source-revision',
    replay_identity_fields: identityFields,
    release_eligible: false,
    decision: 'BLOCKED',
  }, sourceRevision);
}

function assertSchemaLoaded() {
  const required = readJson(schemaPath).required;
  for (const field of ['decision', 'source_revision', 'generated_at', 'freshness_basis']) {
    if (!required.includes(field)) throw new EvidenceError('EVIDENCE_SCHEMA_INVALID');
  }
}

function atomicReplace(path, content) {
  const temporaryPath = `${path}.${process.pid}.tmp`;
  writeFileSync(temporaryPath, content, { flag: 'wx' });
  renameSync(temporaryPath, path);
}

export function run(options) {
  assertSchemaLoaded();
  if (options.mode === '--generate') {
    assertSubjectRevision(options.subjectRevision, true);
    const observationsPath = resolveReadablePath(options.observations);
    const outputPath = resolveOutputPath(options.output);
    const report = constructReleaseEvidence(readJson(observationsPath), options.subjectRevision, new Date().toISOString());
    atomicReplace(outputPath, `${JSON.stringify(report, null, 2)}\n`);
    return { report, outputPath };
  }
  assertSubjectRevision(options.subjectRevision, false);
  const inputPath = resolveReadablePath(options.input);
  return { report: validateReleaseEvidence(readJson(inputPath), options.subjectRevision), inputPath };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const result = run(parseCli(process.argv.slice(2)));
    process.stdout.write(result.outputPath === undefined ? 'release-evidence valid\n' : `${result.outputPath}\n`);
  } catch (error) {
    process.stderr.write(`${error instanceof EvidenceError ? error.code : 'EVIDENCE_UNEXPECTED'}\n`);
    process.exitCode = 1;
  }
}
