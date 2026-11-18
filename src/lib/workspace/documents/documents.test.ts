import { expect, it } from 'vitest';
import {
  documentDiagnostics,
  documentEntries,
  documentSourceTarget,
  validateRenderedDocument,
  type RenderedDocument,
} from './index';
import type { DocumentDefinition, SourceDocument } from '../project';

const applied: SourceDocument[] = [
  { name: 'model.sysml', text: 'package Demo { part def Ünit; part motor; }' },
  {
    name: 'report.sysml',
    text: 'package Report { part def R :> Document {} }',
  },
];
const modelBytes = new TextEncoder().encode(applied[0]!.text);
const motorOffset = modelBytes.indexOf(
  new TextEncoder().encode('part motor')[0]!,
  new TextEncoder().encode('package Demo { part def Ünit; ').length,
);
const rendered: RenderedDocument = {
  schemaVersion: 1,
  modelHash: 'hash',
  ['document']: 'Report::R',
  form: 'html',
  status: 'complete',
  title: 'Report',
  content: '<article class="sysml-document"></article>',
  references: [
    {
      qualifiedName: 'Demo::motor',
      kind: 'partUsage',
      origin: {
        file: 'model.sysml',
        offset: motorOffset,
        length: 'part motor;'.length,
        nameOffset: motorOffset + 5,
        nameLength: 5,
      },
    },
    { qualifiedName: 'ScalarValues::Real', kind: 'dataType' },
  ],
  contents: [
    {
      path: 'intro',
      name: 'intro',
      kind: 'paragraph',
      origin: { file: 'report.sysml', offset: 17, length: 26 },
    },
  ],
  diagnostics: [],
};

it('groups declared documents by display name and declaring file, disambiguating repeated names', () => {
  const definitions: DocumentDefinition[] = [
    {
      qualifiedName: 'B::Report',
      name: 'Report',
      origin: { file: 'b.sysml', offset: 0, length: 4 },
    },
    {
      qualifiedName: 'A::Report',
      name: 'Report',
      origin: { file: 'a.sysml', offset: 0, length: 4 },
    },
    { qualifiedName: 'Lib::Guide', name: 'Guide' },
  ];
  expect(documentEntries(definitions)).toEqual([
    { id: 'Lib::Guide', name: 'Guide', file: undefined, label: 'Guide' },
    {
      id: 'A::Report',
      name: 'Report',
      file: 'a.sysml',
      label: 'A::Report · a.sysml',
    },
    {
      id: 'B::Report',
      name: 'Report',
      file: 'b.sysml',
      label: 'B::Report · b.sysml',
    },
  ]);
  expect(documentEntries(undefined)).toEqual([]);
});

it('maps clicked elements and content blocks to UTF-16 ranges of the exact applied file', () => {
  const element = documentSourceTarget(
    { kind: 'element', qualifiedName: 'Demo::motor' },
    rendered,
    applied,
    applied,
  );
  // "Ünit" is two UTF-8 bytes but one UTF-16 unit, so the editor offset is one less.
  expect(element).toEqual({
    target: {
      file: 'model.sysml',
      start: motorOffset - 1,
      end: motorOffset - 1 + 'part motor;'.length,
    },
    qualifiedName: 'Demo::motor',
  });
  expect(
    documentSourceTarget(
      { kind: 'content', path: 'intro' },
      rendered,
      applied,
      applied,
    ),
  ).toEqual({ target: { file: 'report.sysml', start: 17, end: 43 } });
});

it('explains library, unknown, drafted and out-of-range targets instead of guessing', () => {
  expect(
    documentSourceTarget(
      { kind: 'element', qualifiedName: 'ScalarValues::Real' },
      rendered,
      applied,
      applied,
    ),
  ).toHaveProperty('reason');
  expect(
    documentSourceTarget(
      { kind: 'element', qualifiedName: 'Demo::missing' },
      rendered,
      applied,
      applied,
    ),
  ).toHaveProperty('reason');
  expect(
    documentSourceTarget(
      { kind: 'content', path: 'intro/missing' },
      rendered,
      applied,
      applied,
    ),
  ).toHaveProperty('reason');
  const drafted = applied.map((file) =>
    file.name === 'model.sysml' ? { ...file, text: file.text + ' ' } : file,
  );
  expect(
    documentSourceTarget(
      { kind: 'element', qualifiedName: 'Demo::motor' },
      rendered,
      applied,
      drafted,
    ),
  ).toEqual({
    reason:
      'Apply or discard this file’s draft before revealing its applied source.',
  });
  expect(
    documentSourceTarget(
      { kind: 'element', qualifiedName: 'Demo::motor' },
      rendered,
      applied.filter((file) => file.name !== 'model.sysml'),
      applied,
    ),
  ).toHaveProperty('reason');
});

it('accepts only the requested revision, document and form with in-bounds origins', () => {
  expect(
    validateRenderedDocument(rendered, 'hash', 'Report::R', 'html', applied),
  ).toEqual(rendered);
  expect(() =>
    validateRenderedDocument(rendered, 'other', 'Report::R', 'html', applied),
  ).toThrow(/stale/);
  expect(() =>
    validateRenderedDocument(
      rendered,
      'hash',
      'Report::Other',
      'html',
      applied,
    ),
  ).toThrow(/stale/);
  expect(() =>
    validateRenderedDocument(
      rendered,
      'hash',
      'Report::R',
      'markdown',
      applied,
    ),
  ).toThrow(/stale/);
  expect(() =>
    validateRenderedDocument(
      { ...rendered, status: 'invalid' },
      'hash',
      'Report::R',
      'html',
      applied,
    ),
  ).toThrow(/cannot publish content/);
  expect(() =>
    validateRenderedDocument(
      { ...rendered, status: 'invalid', content: '', diagnostics: [] },
      'hash',
      'Report::R',
      'html',
      applied,
    ),
  ).toThrow(/omitted its diagnostics/);
  expect(() =>
    validateRenderedDocument(
      {
        ...rendered,
        references: [
          {
            qualifiedName: 'Demo::motor',
            kind: 'partUsage',
            origin: { file: 'model.sysml', offset: 40, length: 40 },
          },
        ],
      },
      'hash',
      'Report::R',
      'html',
      applied,
    ),
  ).toThrow(/outside the applied project/);
});

it('turns typed planning and evaluation failures into located diagnostics', () => {
  const failed: RenderedDocument = {
    ...rendered,
    status: 'invalid',
    content: '',
    diagnostics: [
      {
        stage: 'planning',
        kind: 'unknownQuery',
        severity: 'error',
        message: 'content parts references unknown query Missing',
        file: 'report.sysml',
        line: 4,
      },
      {
        stage: 'evaluation',
        kind: 'queryExecution',
        severity: 'error',
        message: 'query failed',
      },
    ],
  };
  expect(documentDiagnostics(failed)).toEqual([
    {
      severity: 'error',
      message:
        'Document Report::R: content parts references unknown query Missing (planning unknownQuery)',
      file: 'report.sysml',
      line: 4,
    },
    {
      severity: 'error',
      message: 'Document Report::R: query failed (evaluation queryExecution)',
    },
  ]);
  expect(documentDiagnostics(null)).toEqual([]);
});
