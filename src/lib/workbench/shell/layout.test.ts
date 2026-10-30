import { expect, it } from 'vitest';
import { defaultLayout, loadLayout, parseLayout, saveLayout } from './layout';

it('rejects incompatible, unbounded and source-bearing layout preferences', () => {
  for (const raw of [
    null,
    '',
    '{',
    'x'.repeat(2049),
    JSON.stringify({ ...defaultLayout, version: 2 }),
    JSON.stringify({ ...defaultLayout, split: -1 }),
    JSON.stringify({ ...defaultLayout, explorer: 90 }),
    JSON.stringify({ ...defaultLayout, issues: 100 }),
    JSON.stringify({
      ...defaultLayout,
      documents: [{ text: 'unsaved source' }],
    }),
  ])
    expect(parseLayout(raw)).toBeUndefined();
});
it('restores supported layout preferences independently of responsive defaults', () => {
  const saved = {
    ...defaultLayout,
    explorer: 25,
    split: 65,
    inspectorClosed: false,
  };
  const storage = { getItem: () => JSON.stringify(saved) };
  expect(loadLayout(storage, true)).toEqual(saved);
  expect(loadLayout({ getItem: () => '{' }, true).inspectorClosed).toBe(true);
  expect(loadLayout({ getItem: () => null }, false)).toEqual(defaultLayout);
});
it('does not hide failed writes or persist invalid layout data', () => {
  expect(
    saveLayout(
      {
        setItem() {
          throw new Error('denied');
        },
      },
      defaultLayout,
    ),
  ).toBe(false);
  expect(
    saveLayout(
      {
        setItem() {
          throw new Error('invalid data must not reach storage');
        },
      },
      { ...defaultLayout, split: Number.NaN },
    ),
  ).toBe(false);
});
