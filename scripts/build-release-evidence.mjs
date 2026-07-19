import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const identityFields = ['scenario_version', 'seed', 'ordered_input_log', 'model_version', 'boat_profile_version', 'contract_version', 'coordinate_contract_version', 'determinism_contract_version', 'comparison_policy_version'];
const observationPath = resolve(root, 'artifacts/release-evidence/ap-0c-observations.json');
const reportPath = resolve(root, 'artifacts/release-evidence/ap-0c.json');
const schemaPath = resolve(root, 'docs/quality/release-evidence.schema.json');

function readJson(path) { return JSON.parse(readFileSync(path, 'utf8')); }
function validate(report) {
  const errors = [];
  if (report.task_id !== 'ALF-20260719-1207-sailing-ap0c-r2') errors.push('task_id');
  if (report.base !== 'ac9b43f') errors.push('base');
  if (JSON.stringify(report.replay_identity_fields) !== JSON.stringify(identityFields)) errors.push('replay_identity_fields');
  if (!Array.isArray(report.command_outcomes) || report.command_outcomes.length === 0) errors.push('command_outcomes');
  const browsers = new Map((report.browser_candidates ?? []).map((entry) => [entry.browser, entry]));
  for (const browser of ['Chromium', 'WebKit', 'Firefox']) if (!browsers.has(browser) || browsers.get(browser).support_claim !== false) errors.push(`browser:${browser}`);
  if (report.unexpected_network_count !== 0) errors.push('unexpected_network_count');
  if (!(Number.isInteger(report.registry_assumptions_count) && report.registry_assumptions_count >= 1)) errors.push('registry_assumptions_count');
  if (report.release_eligible !== false || report.decision !== 'BLOCKED' || report.force_override_used !== false) errors.push('release_gate');
  if (!Array.isArray(report.reason_codes) || !report.reason_codes.includes('DOMAIN_ASSUMPTIONS_PRESENT') || !report.reason_codes.includes('RELEASE_AUTHORITY_MISSING')) errors.push('reason_codes');
  if (!report.storage_evidence || typeof report.storage_evidence !== 'object') errors.push('storage_evidence');
  if (errors.length) throw new Error(`Invalid release evidence: ${errors.join(', ')}`);
}

if (!readJson(schemaPath).required.includes('decision')) throw new Error('Release evidence schema is not loaded.');
if (process.argv.includes('--validate')) { validate(readJson(reportPath)); process.stdout.write('release-evidence valid\n'); }
else {
  const observations = readJson(observationPath);
  const report = { ...observations, replay_identity_fields: identityFields, release_eligible: false, decision: 'BLOCKED' };
  validate(report);
  writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  process.stdout.write(`${reportPath}\n`);
}
