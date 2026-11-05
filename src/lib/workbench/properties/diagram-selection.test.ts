import { describe, expect, it } from 'vitest';
import type { EvaluatedView } from '$lib/workspace/views';
import { diagramRelationshipSelection } from './diagram-selection';

function view(): EvaluatedView {
  return {
    schemaVersion: 1,
    modelHash: 'revision',
    view: 'Views::requirements',
    status: 'complete',
    renderStatus: 'available',
    diagnostics: [],
    artifact: {
      kind: 'requirement',
      nodes: [
        { id: 'left', name: 'tank', kind: 'part' },
        { id: 'right', name: 'tank', kind: 'part' },
        { id: 'capacity', name: 'capacity', kind: 'requirement' },
      ],
      edges: [{ from: 'right', to: 'capacity', kind: 'satisfy' }],
    },
    correspondence: [
      {
        symbol: 'left',
        subject: { id: 'a', qualifiedName: 'A::tank' },
        context: [],
      },
      {
        symbol: 'right',
        subject: { id: 'b', qualifiedName: 'B::tank' },
        context: [],
      },
      {
        symbol: 'capacity',
        subject: { id: 'c', qualifiedName: 'R::capacity' },
        context: [],
      },
      {
        symbol: 'edge:0',
        subject: {
          id: 'anonymous-declaration',
          origin: {
            file: 'r.sysml',
            offset: 10,
            length: 20,
            nameOffset: 10,
            nameLength: 0,
          },
        },
        context: [],
      },
    ],
  };
}

describe('requirements relationship selection', () => {
  it('resolves repeated display names and anonymous declarations by exact correspondence', () => {
    const selection = diagramRelationshipSelection(view(), 'edge:0');
    expect(selection?.source.qualifiedName).toBe('B::tank');
    expect(selection?.target.qualifiedName).toBe('R::capacity');
    expect(selection?.declaration.origin?.file).toBe('r.sysml');
    expect(selection?.declaration.qualifiedName).toBeUndefined();
  });
  it('does not guess an endpoint or declaration when correspondence is missing', () => {
    const input = view();
    expect(
      diagramRelationshipSelection(
        {
          ...input,
          correspondence: input.correspondence.filter(
            (item) => item.symbol !== 'right',
          ),
        },
        'edge:0',
      ),
    ).toBeUndefined();
    expect(diagramRelationshipSelection(input, 'edge-0')).toBeUndefined();
  });
  it('does not reuse a relationship from an invalid or different representation', () => {
    const input = view();
    expect(
      diagramRelationshipSelection({ ...input, status: 'invalid' }, 'edge:0'),
    ).toBeUndefined();
    expect(
      diagramRelationshipSelection(
        { ...input, artifact: { ...input.artifact!, kind: 'tree' } },
        'edge:0',
      ),
    ).toBeUndefined();
    expect(diagramRelationshipSelection(null, 'edge:0')).toBeUndefined();
  });
});
