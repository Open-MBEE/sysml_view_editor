import { describe, expect, it } from 'vitest';
import { validateEvaluation } from './index';

function response() {
  return {
    schemaVersion: 1,
    modelHash: 'hash',
    view: 'v',
    status: 'complete',
    renderStatus: 'available',
    diagnostics: [],
    correspondence: [],
    artifact: {
      kind: 'interconnection',
      nodes: [
        { id: 'owner', name: 'Assembly', kind: 'part def' },
        {
          id: 'a',
          name: 'primary',
          kind: 'part',
          parent: 'owner',
          ports: [{ id: 'a.out', name: 'output', direction: 'out' }],
        },
        {
          id: 'b',
          name: 'standby',
          kind: 'part',
          parent: 'owner',
          ports: [{ id: 'b.in', name: 'input', direction: 'in' }],
        },
      ],
      edges: [
        {
          from: 'a',
          to: 'b',
          fromPort: 'a.out',
          toPort: 'b.in',
          kind: 'connection',
        },
      ],
    },
  };
}

describe('structural artifact validation', () => {
  it('retains nested ownership and explicit port endpoints', () => {
    const value = response();
    expect(validateEvaluation(value, 'hash', 'v')).toEqual(value);
  });
  it.each([
    'missing parent',
    'cycle',
    'duplicate node',
    'duplicate port',
    'missing node',
    'wrong port',
    'unknown direction',
  ])('rejects %s instead of publishing partial structure', (fault) => {
    const value = response();
    const { nodes, edges } = value.artifact;
    if (fault === 'missing parent') nodes[1]!.parent = 'missing';
    if (fault === 'cycle') nodes[0]!.parent = 'a';
    if (fault === 'duplicate node') nodes[2]!.id = 'a';
    if (fault === 'duplicate port') nodes[2]!.ports![0]!.id = 'a.out';
    if (fault === 'missing node') edges[0]!.to = 'missing';
    if (fault === 'wrong port') edges[0]!.toPort = 'a.out';
    if (fault === 'unknown direction')
      nodes[2]!.ports![0]!.direction = 'sideways';
    expect(() => validateEvaluation(value, 'hash', 'v')).toThrow();
  });
});
