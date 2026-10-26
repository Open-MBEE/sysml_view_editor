import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import {
  loadCatalog,
  loadExample,
  validateCatalog,
} from '../examples/catalog.ts';
import { exampleIndex } from './examples-index.mjs';

test('catalog accounts for every example folder and all of its source files', async () => {
  const catalog = await loadCatalog();
  const root = new URL('../examples/', import.meta.url);
  const folders = (await readdir(root, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
  assert.deepEqual(catalog.examples.map((entry) => entry.id).sort(), folders);
  for (const entry of catalog.examples) {
    const sources = (await readdir(new URL(entry.id + '/', root)))
      .filter((name) => name.endsWith('.sysml'))
      .sort();
    assert.deepEqual([...entry.files].sort(), sources, entry.id);
    const documents = await loadExample(entry);
    assert.ok(
      documents.every((item) => item.text.trim().length),
      entry.id,
    );
    assert.ok(
      documents.reduce(
        (total, item) => total + Buffer.byteLength(item.text),
        0,
      ) <=
        5 * 1024 * 1024,
      entry.id,
    );
  }
});

test('catalog rejects unsafe paths, duplicate coverage and misleading support metadata', async () => {
  const original = await loadCatalog();
  const faults = [
    (value) => {
      value.version = 2;
    },
    (value) => {
      value.examples[0].id = '../outside';
    },
    (value) => {
      value.examples[0].files = ['../model.sysml'];
    },
    (value) => {
      value.examples[0].files = ['model.sysml', 'model.sysml'];
    },
    (value) => {
      value.examples.push(structuredClone(value.examples[0]));
    },
    (value) => {
      value.examples[0].views.push(structuredClone(value.examples[0].views[0]));
    },
    (value) => {
      value.examples[0].views[0].app = 'complete-enough';
    },
    (value) => {
      value.examples[0].views[0].app = 'rendered';
    },
    (value) => {
      value.examples[0].views[0].gaps = [];
    },
  ];
  for (const fault of faults) {
    const value = structuredClone(original);
    fault(value);
    assert.throws(() => validateCatalog(value));
  }
});

test('human-readable example index matches its catalog', async () => {
  assert.equal(
    await readFile(new URL('../examples/README.md', import.meta.url), 'utf8'),
    await exampleIndex(),
    'Run npm run examples:index after changing the catalog.',
  );
});
