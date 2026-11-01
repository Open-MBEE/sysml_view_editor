import assert from 'node:assert/strict';
import { test } from 'node:test';
import { testPlan } from './ci-test-plan.mjs';

test('scheduled, manual and release pushes keep the complete browser suite', () => {
  for (const event of ['schedule', 'workflow_dispatch', 'push', undefined]) {
    assert.deepEqual(testPlan(event), { full: true, visual: false });
  }
});

test('documentation-only PRs retain critical workflows without screenshots', () => {
  assert.deepEqual(
    testPlan('pull_request', [
      'README.md',
      'docs/testing.md',
      '.github/CODEOWNERS',
    ]),
    { full: false, visual: false },
  );
});

test('code, assets, examples, tooling and unknown paths retain visual coverage', () => {
  for (const path of [
    'src/lib/ui/workbench.css',
    'public/logo.svg',
    'examples/example.sysml',
    'tests/e2e/visual.spec.ts',
    'package-lock.json',
    'playwright.config.ts',
    '.github/workflows/ci.yml',
    'docs/diagram.html',
    'new-surface/file',
  ]) {
    assert.deepEqual(testPlan('pull_request', ['README.md', path]), {
      full: false,
      visual: true,
    });
  }
  assert.deepEqual(testPlan('pull_request', []), { full: false, visual: true });
});

test('release-targeted PRs require the full suite before merging', () => {
  for (const branch of ['main', 'release/0.2', 'hotfix/parser']) {
    assert.deepEqual(testPlan('pull_request', ['README.md'], branch), {
      full: true,
      visual: false,
    });
  }
});
