import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

export function auditFindings(report) {
  assert.equal(report?.auditReportVersion, 2, 'Unsupported audit report');
  assert.ok(!report.error, 'Audit registry error');
  assert.ok(
    report.vulnerabilities &&
      typeof report.vulnerabilities === 'object' &&
      !Array.isArray(report.vulnerabilities),
    'Missing vulnerability report',
  );
  const findings = Object.entries(report.vulnerabilities);
  assert.equal(
    report.metadata?.vulnerabilities?.total,
    findings.length,
    'Inconsistent audit report',
  );
  return findings;
}

export function fetchAudit(args = []) {
  const result = spawnSync(
    'npm',
    ['audit', '--json', '--audit-level=low', ...args],
    {
      encoding: 'utf8',
      maxBuffer: 10 * 1024 * 1024,
    },
  );
  assert.ok(
    !result.error && [0, 1].includes(result.status),
    'npm audit failed',
  );
  const report = JSON.parse(result.stdout);
  auditFindings(report);
  // Retain the complete report in hosted logs.
  process.stdout.write(`${result.stdout}\n`);
  return report;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const production = fetchAudit(['--omit=dev']);
  assert.equal(
    auditFindings(production).length,
    0,
    'Production audit findings',
  );
  const report = fetchAudit(['--include=dev']);
  assert.equal(auditFindings(report).length, 0, 'Development audit findings');
  console.log('Audit passed without exceptions.');
}
