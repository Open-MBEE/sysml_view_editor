import { expect, it } from 'vitest';
import {
  defaultLayout,
  layoutStorageKey,
  loadLayout,
  parseLayout,
  saveLayout,
} from './layout';

it('rejects incompatible, unbounded and source-bearing preferences', () => {
  for (const raw of [
    null,
    '',
    '{',
    'x'.repeat(2049),
    JSON.stringify({ ...defaultLayout, version: 3 }),
    JSON.stringify({ ...defaultLayout, source: -1 }),
    JSON.stringify({ ...defaultLayout, explorer: 90 }),
    JSON.stringify({ ...defaultLayout, inspection: 100 }),
    JSON.stringify({
      ...defaultLayout,
      documents: [{ text: 'unsaved source' }],
    }),
  ])
    expect(parseLayout(raw)).toBeUndefined();
});
it('restores validated preferences with model-first defaults', () => {
  const saved = {
    ...defaultLayout,
    explorer: 25,
    source: 45,
    inspectionClosed: false,
  };
  expect(
    loadLayout(
      {
        getItem: (key) =>
          key === layoutStorageKey ? JSON.stringify(saved) : null,
      },
      true,
    ),
  ).toEqual(saved);
  expect(loadLayout({ getItem: () => '{' }, true)).toEqual(defaultLayout);
  expect(loadLayout({ getItem: () => null }, false)).toEqual(defaultLayout);
});
it('migrates supported legacy sizes and issues visibility without changing portable data', () => {
  const legacy = {
    version: 1,
    explorer: 23,
    inspector: 19,
    split: 80,
    issues: 30,
    explorerClosed: true,
    inspectorClosed: false,
    issuesClosed: false,
  };
  expect(
    loadLayout(
      {
        getItem: (key) => (key.endsWith('v1') ? JSON.stringify(legacy) : null),
      },
      false,
    ),
  ).toEqual({
    ...defaultLayout,
    explorer: 23,
    explorerClosed: true,
    source: 65,
    inspection: 30,
    inspectionClosed: false,
    inspectionTab: 'issues',
  });
});
it('does not hide failed writes or persist invalid data', () => {
  const denied = {
    setItem() {
      throw new Error('denied');
    },
  };
  expect(saveLayout(denied, defaultLayout)).toBe(false);
  expect(saveLayout(denied, { ...defaultLayout, source: Number.NaN })).toBe(
    false,
  );
});
