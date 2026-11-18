import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  advisory,
  auditFindings,
  checkDevelopmentException,
  expires,
} from './audit.mjs';

function fixture() {
  const versions = {
    picomatch: '4.0.7',
    fdir: '6.5.0',
    tinyglobby: '0.2.17',
    vite: '8.2.4',
    vitest: '4.1.12',
    '@vitejs/plugin-react': '6.1.2',
  };
  const causes = {
    picomatch: [
      {
        url: advisory,
        name: 'picomatch',
        dependency: 'picomatch',
        range: '<=4.0.7',
        severity: 'high',
      },
    ],
    fdir: ['picomatch'],
    tinyglobby: ['fdir', 'picomatch'],
    vite: ['picomatch', 'tinyglobby'],
    vitest: ['picomatch', 'tinyglobby'],
    '@vitejs/plugin-react': ['vite'],
  };
  const report = {
    auditReportVersion: 2,
    vulnerabilities: {},
    metadata: { vulnerabilities: { total: 6 } },
  };
  const lock = { packages: {} };
  for (const [name, version] of Object.entries(versions)) {
    const path = `node_modules/${name}`;
    lock.packages[path] = { dev: true, version };
    report.vulnerabilities[name] = {
      name,
      severity: 'high',
      nodes: [path],
      via: causes[name],
    };
  }
  return { report, lock };
}
const beforeExpiry = new Date('2026-11-18T00:00:00Z');

test('accepts only the reviewed development graph before expiry', () => {
  const { report, lock } = fixture();
  assert.equal(checkDevelopmentException(report, lock, beforeExpiry), 6);
  assert.throws(
    () => checkDevelopmentException(report, lock, new Date(expires)),
    /expired/,
  );
});

test('new advisories, package versions, production scope and graph changes fail', () => {
  const mutations = [
    ({ report }) => {
      report.vulnerabilities.picomatch.via[0].url =
        'https://github.com/advisories/OTHER';
    },
    ({ report }) => {
      report.vulnerabilities.vite.via.push({ url: advisory });
    },
    ({ report }) => {
      report.vulnerabilities.picomatch.via.push({ url: advisory });
    },
    ({ report }) => {
      report.vulnerabilities.fdir.nodes.push(
        'node_modules/other/node_modules/fdir',
      );
    },
    ({ report }) => {
      report.vulnerabilities.picomatch.severity = 'critical';
    },
    ({ lock }) => {
      lock.packages['node_modules/picomatch'].dev = false;
    },
    ({ lock }) => {
      lock.packages['node_modules/vite'].version = '8.2.5';
    },
    ({ report }) => {
      delete report.vulnerabilities.fdir;
      report.metadata.vulnerabilities.total--;
    },
    ({ report }) => {
      report.vulnerabilities.other = report.vulnerabilities.fdir;
      report.metadata.vulnerabilities.total++;
    },
  ];
  for (const mutate of mutations) {
    const data = fixture();
    mutate(data);
    assert.throws(() =>
      checkDevelopmentException(data.report, data.lock, beforeExpiry),
    );
  }
});

test('clean reports pass after expiry, malformed and registry-error reports fail', () => {
  const clean = {
    auditReportVersion: 2,
    vulnerabilities: {},
    metadata: { vulnerabilities: { total: 0 } },
  };
  assert.equal(checkDevelopmentException(clean, {}, new Date(expires)), 0);
  for (const report of [
    {},
    { ...clean, error: { code: 'REGISTRY' } },
    { ...clean, auditReportVersion: 1 },
    { ...clean, metadata: {} },
  ])
    assert.throws(() => auditFindings(report));
});

test('CLI rejects production findings and audit transport errors', async () => {
  const { mkdtempSync, writeFileSync, rmSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const { spawnSync } = await import('node:child_process');
  const directory = mkdtempSync(join(tmpdir(), 'sysml-audit-'));
  try {
    const { report } = fixture();
    writeFileSync(
      join(directory, 'npm'),
      `#!${process.execPath}\nconsole.log(${JSON.stringify(JSON.stringify(report))});\nprocess.exit(1);\n`,
      { mode: 0o755 },
    );
    const env = { ...process.env, PATH: `${directory}:${process.env.PATH}` };
    const production = spawnSync(process.execPath, ['scripts/audit.mjs'], {
      encoding: 'utf8',
      env,
    });
    assert.equal(production.status, 1);
    assert.match(production.stderr, /Production audit findings/);
    writeFileSync(
      join(directory, 'npm'),
      `#!${process.execPath}\nprocess.exit(2);\n`,
      { mode: 0o755 },
    );
    const transport = spawnSync(process.execPath, ['scripts/audit.mjs'], {
      encoding: 'utf8',
      env,
    });
    assert.equal(transport.status, 1);
    assert.match(transport.stderr, /npm audit failed/);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
