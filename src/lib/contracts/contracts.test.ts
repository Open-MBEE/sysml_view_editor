import { it, expect } from 'vitest';
import {
  readSemanticRequest,
  readWorkerReply,
} from '$lib/engines/workers/schema';
import { readModelSnapshot } from '$lib/workspace/project';
import { readSemanticCommand } from '$lib/workspace/editing';
import { validateEvaluation } from '$lib/workspace/views';
it('rejects a future worker protocol and malformed nested source data', () => {
  expect(() =>
    readSemanticRequest({
      protocolVersion: 2,
      operation: 'parse',
      base: '/',
      documents: [{ name: 'a.sysml', text: '' }],
    }),
  ).toThrow('worker request');
  expect(() =>
    readSemanticRequest({
      protocolVersion: 1,
      operation: 'parse',
      base: '/',
      documents: [{ name: 'a.sysml', text: 42 }],
    }),
  ).toThrow('worker request');
});
it('rejects missing and contradictory worker envelopes', () => {
  expect(() => readWorkerReply({})).toThrow('reply');
  expect(() => readWorkerReply({ value: [], error: 'partial' })).toThrow(
    'reply',
  );
});
it('rejects malformed nested model and artifact data', () => {
  expect(() =>
    readModelSnapshot({
      modelHash: 'hash',
      diagnostics: [],
      elements: [{ id: 'a', name: 'a', kind: 'partDef', ownerId: 5 }],
    }),
  ).toThrow('model response');
  expect(() =>
    validateEvaluation(
      {
        schemaVersion: 1,
        modelHash: 'hash',
        view: 'v',
        status: 'complete',
        renderStatus: 'available',
        diagnostics: [],
        correspondence: [],
        artifact: { kind: 'tree', nodes: [{ id: 42 }], edges: [] },
      },
      'hash',
      'v',
    ),
  ).toThrow('view response');
});
it('does not coerce source commands or accept unsupported operations', () => {
  expect(() =>
    readSemanticCommand({ kind: 'rename', target: 'P::A', name: 42 }),
  ).toThrow('command');
  expect(() => readSemanticCommand({ kind: 'deleteAll' })).toThrow('command');
});
