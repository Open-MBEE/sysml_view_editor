import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { auditFindings } from './audit.mjs';

const clean = {
  auditReportVersion: 2,
  vulnerabilities: {},
  metadata: { vulnerabilities: { total: 0 } },
};
const finding = {
  ...clean,
  vulnerabilities: { example: { severity: 'low' } },
  metadata: { vulnerabilities: { total: 1 } },
};

test('rejects malformed, inconsistent and registry-error reports', () => {
  assert.deepEqual(auditFindings(clean), []);
  for (const report of [
    {},
    { ...clean, error: { code: 'REGISTRY' } },
    { ...clean, auditReportVersion: 1 },
    { ...clean, metadata: {} },
    { ...clean, metadata: { vulnerabilities: { total: 1 } } },
  ])
    assert.throws(() => auditFindings(report));
});

test('CLI requires clean production and development audits and rejects transport failures', () => {
  const directory = mkdtempSync(join(tmpdir(), 'sysml-audit-'));
  const env = { ...process.env, PATH: `${directory}:${process.env.PATH}` };
  const run = (body) => {
    writeFileSync(join(directory, 'npm'), `#!${process.execPath}\n${body}\n`, {
      mode: 0o755,
    });
    return spawnSync(process.execPath, ['scripts/audit.mjs'], {
      encoding: 'utf8',
      env,
    });
  };
  try {
    const production = run(
      `console.log(${JSON.stringify(JSON.stringify(finding))}); process.exit(1);`,
    );
    assert.equal(production.status, 1);
    assert.match(production.stderr, /Production audit findings/);
    const development = run(
      `const report = process.argv.includes('--omit=dev') ? ${JSON.stringify(clean)} : ${JSON.stringify(finding)}; console.log(JSON.stringify(report)); process.exit(report.metadata.vulnerabilities.total ? 1 : 0);`,
    );
    assert.equal(development.status, 1);
    assert.match(development.stderr, /Development audit findings/);
    const transport = run('process.exit(2);');
    assert.equal(transport.status, 1);
    assert.match(transport.stderr, /npm audit failed/);
    const success = run(
      `console.log(${JSON.stringify(JSON.stringify(clean))});`,
    );
    assert.equal(success.status, 0);
    assert.match(success.stdout, /Audit passed without exceptions/);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
