import { it, expect } from 'vitest';
import { readProject } from './index';
import { validateDocuments } from '../project';
it.each([
  '../secret.sysml',
  '/absolute.sysml',
  'a/../b.sysml',
  'a\\b.sysml',
  'bad.txt',
])('rejects unsafe project path %s', (name) => {
  expect(() => validateDocuments([{ name, text: '' }])).toThrow();
});
it('rejects duplicate sources and unsupported bundle versions', () => {
  expect(() =>
    validateDocuments([
      { name: 'a.sysml', text: '' },
      { name: 'a.sysml', text: '' },
    ]),
  ).toThrow();
  expect(() =>
    readProject(JSON.stringify({ format: 'sysmlv2-view-project', version: 2 })),
  ).toThrow('supported');
});
it('rejects invalid coordinates rather than loading corrupt geometry', () => {
  expect(() =>
    readProject(
      JSON.stringify({
        format: 'sysmlv2-view-project',
        version: 1,
        name: 'P',
        documents: [{ name: 'a.sysml', text: '' }],
        drafts: [{ name: 'a.sysml', text: '' }],
        presentations: {
          v: {
            sourceHash: '0'.repeat(64),
            modelHash: 'hash',
            positions: { n: { x: 1e100, y: 0 } },
          },
        },
      }),
    ),
  ).toThrow('position');
});
