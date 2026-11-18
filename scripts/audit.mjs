import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export const advisory = 'https://github.com/advisories/GHSA-fc5q-39xc-vjpf';
export const expires = '2026-12-02T00:00:00Z';
// Temporary development-tool exception; rationale and removal: docs/testing.md.
const reviewed = {
  picomatch: ['4.0.7', []],
  fdir: ['6.5.0', ['picomatch']],
  tinyglobby: ['0.2.17', ['fdir', 'picomatch']],
  vite: ['8.2.4', ['picomatch', 'tinyglobby']],
  vitest: ['4.1.12', ['picomatch', 'tinyglobby']],
  '@vitejs/plugin-react': ['6.1.2', ['vite']],
};

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

export function checkDevelopmentException(report, lock, now = new Date()) {
  const findings = auditFindings(report);
  if (!findings.length) return 0;
  assert.ok(now < new Date(expires), `Audit exception expired ${expires}`);
  for (const [name, finding] of findings) {
    const policy = reviewed[name];
    assert.ok(policy, `Unreviewed vulnerable package: ${name}`);
    assert.equal(finding.name, name);
    assert.equal(finding.severity, 'high', `Changed severity: ${name}`);
    const path = `node_modules/${name}`;
    assert.deepEqual(finding.nodes, [path], `Changed package paths: ${name}`);
    assert.equal(lock.packages?.[path]?.dev, true, `Not dev-only: ${name}`);
    assert.equal(
      lock.packages[path].version,
      policy[0],
      `Changed version: ${name}`,
    );
    if (name === 'picomatch') {
      assert.equal(finding.via.length, 1, 'Additional picomatch advisory');
      const cause = finding.via[0];
      assert.equal(cause.url, advisory, 'Unreviewed picomatch advisory');
      assert.equal(cause.name, 'picomatch');
      assert.equal(cause.dependency, 'picomatch');
      assert.equal(cause.range, '<=4.0.7');
      assert.equal(cause.severity, 'high');
    } else {
      assert.deepEqual(
        [...finding.via].sort(),
        policy[1],
        `Changed causes: ${name}`,
      );
      for (const cause of finding.via)
        assert.ok(report.vulnerabilities[cause], `Missing cause: ${cause}`);
    }
  }
  assert.ok(report.vulnerabilities.picomatch, 'Missing root advisory');
  return findings.length;
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
  // Retain the complete report in hosted logs, including accepted findings.
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
  const lock = JSON.parse(readFileSync('package-lock.json', 'utf8'));
  const count = checkDevelopmentException(report, lock);
  console.log(
    count
      ? `TEMPORARY EXCEPTION: ${advisory}; ${count} development-tool entries; expires ${expires}. Not a clean audit.`
      : 'Audit passed without exceptions.',
  );
}
