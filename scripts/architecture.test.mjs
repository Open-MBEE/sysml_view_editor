import { test } from 'node:test';
import assert from 'node:assert/strict';
import { violation } from './check-architecture.mjs';
test('workspace rejects both alias and relative UI imports', () => {
  assert.ok(
    violation('src/lib/workspace/project/index.ts', '$lib/workbench/source'),
  );
  assert.ok(
    violation('src/lib/workspace/project/index.ts', '../../ui/Button.tsx'),
  );
  assert.ok(violation('src/lib/workspace/project/index.ts', 'react'));
  assert.equal(
    violation('src/lib/workspace/project/index.ts', '../views'),
    undefined,
  );
});
test('only composition may instantiate engine adapters', () => {
  assert.ok(
    violation(
      'src/lib/workbench/source/SourceEditor.tsx',
      '$lib/engines/toolkit',
    ),
  );
  assert.equal(
    violation('src/lib/workbench/shell/session.ts', '$lib/engines/toolkit'),
    undefined,
  );
});
