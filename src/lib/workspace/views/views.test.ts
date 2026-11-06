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

function requirementsResponse() {
  const source = (id: string) => ({
    id,
    origin: { file: 'requirements.sysml', offset: 0, length: 1 },
  });
  return {
    schemaVersion: 1,
    modelHash: 'hash',
    view: 'v',
    status: 'complete',
    renderStatus: 'available',
    diagnostics: [],
    selected: [source('spec'), source('req')],
    correspondence: [
      { symbol: 'spec', subject: source('spec'), context: [] },
      { symbol: 'req', subject: source('req'), context: [] },
      { symbol: 'part', subject: source('part'), context: [] },
      { symbol: 'edge:0', subject: source('req'), context: [] },
      { symbol: 'edge:1', subject: source('satisfaction'), context: [] },
    ],
    artifact: {
      kind: 'requirement',
      nodes: [
        {
          id: 'spec',
          name: 'Specification',
          kind: 'requirement',
          exposure: 'selected',
        },
        {
          id: 'req',
          name: 'Capacity',
          kind: 'requirement',
          shortName: 'REQ-1',
          documentation: ['Full documentation'],
          exposure: 'selected',
        },
        { id: 'part', name: 'Tank', kind: 'part', exposure: 'contextual' },
      ],
      edges: [
        { from: 'spec', to: 'req', kind: 'composition', ownership: 'direct' },
        {
          from: 'part',
          to: 'req',
          kind: 'satisfy',
          negated: true,
          asserted: true,
        },
      ],
    },
  };
}

describe('requirements artifact validation', () => {
  it('retains exact metadata, selected/contextual subjects and negated satisfaction', () => {
    const value = requirementsResponse();
    expect(validateEvaluation(value, 'hash', 'v')).toEqual(value);
  });
  it('distinguishes an owned feature drawn through its type from direct ownership', () => {
    const value = requirementsResponse();
    value.artifact.edges[0]!.ownership = 'via-type';
    value.correspondence[3]!.subject = {
      id: 'undrawn-member',
      origin: { file: 'requirements.sysml', offset: 9, length: 1 },
    };
    expect(validateEvaluation(value, 'hash', 'v')).toEqual(value);
  });
  it.each([
    'duplicate node',
    'missing endpoint',
    'missing source',
    'duplicate correspondence',
    'missing polarity',
    'wrong exposure',
    'missing selected',
    'missing ownership',
    'false ownership',
    'cyclic ownership',
    'stale model',
    'partial artifact',
  ])('rejects %s without publishing a misleading graph', (fault) => {
    const value = requirementsResponse();
    if (fault === 'duplicate node') value.artifact.nodes[2]!.id = 'req';
    if (fault === 'missing endpoint') value.artifact.edges[1]!.from = 'missing';
    if (fault === 'missing source') value.correspondence.pop();
    if (fault === 'duplicate correspondence')
      value.correspondence.push(value.correspondence[0]!);
    if (fault === 'missing polarity')
      delete (value.artifact.edges[1] as { negated?: boolean }).negated;
    if (fault === 'wrong exposure')
      value.artifact.nodes[2]!.exposure = 'selected';
    if (fault === 'missing selected')
      delete (value as { selected?: unknown }).selected;
    if (fault === 'missing ownership')
      delete value.artifact.edges[0]!.ownership;
    if (fault === 'false ownership')
      value.artifact.edges[0]!.ownership = 'via-type';
    if (fault === 'cyclic ownership') {
      value.artifact.edges.push({
        from: 'req',
        to: 'spec',
        kind: 'composition',
        ownership: 'direct',
      });
      value.correspondence.push({
        symbol: 'edge:2',
        subject: value.selected[0]!,
        context: [],
      });
    }
    if (fault === 'stale model') value.modelHash = 'old';
    if (fault === 'partial artifact') value.status = 'indeterminate';
    expect(() => validateEvaluation(value, 'hash', 'v')).toThrow();
  });
});

for (const kind of ['action', 'state']) {
  it(`rejects unresolved ${kind} endpoints rather than dropping a behavior relationship`, () => {
    const value = response();
    value.artifact.kind = kind;
    value.artifact.edges[0]!.to = 'missing';
    expect(() => validateEvaluation(value, 'hash', 'v')).toThrow(
      'unresolved connection endpoint',
    );
  });
}
