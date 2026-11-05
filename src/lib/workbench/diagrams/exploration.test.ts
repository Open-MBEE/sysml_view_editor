import { expect, it } from 'vitest';
import { layoutExploration, explorationEdgePath } from './exploration';
import type { ViewArtifact } from '$lib/workspace/views';

const overview: ViewArtifact = {
  kind: 'tree',
  nodes: [
    { id: 'P', kind: 'package', name: 'P' },
    { id: 'System', kind: 'part def', name: 'System', parent: 'P' },
    {
      id: 'primary',
      kind: 'part',
      name: 'primary',
      type: 'Q::Motor',
      parent: 'System',
    },
    {
      id: 'standby',
      kind: 'part',
      name: 'standby',
      type: 'Q::Motor',
      parent: 'System',
    },
    { id: 'system', kind: 'part', name: 'system', type: 'System', parent: 'P' },
    { id: 'Q', kind: 'package', name: 'Q' },
    { id: 'Motor', kind: 'part def', name: 'Motor', parent: 'Q' },
  ],
  edges: [
    { from: 'System', to: 'Motor', kind: 'composition', label: 'primary' },
    { from: 'System', to: 'Motor', kind: 'composition', label: 'standby' },
  ],
};
it('keeps packages and engine ownership distinct from relationship targets', () => {
  const { nodes, edges } = layoutExploration(overview);
  const node = (id: string) => nodes.find((node) => node.id === id)!;
  expect(node('System').parentId).toBe('P');
  expect(node('Motor').parentId).toBe('Q');
  expect(node('primary').parentId).toBe('System');
  expect(node('standby').parentId).toBe('System');
  expect(node('system').parentId).toBe('P');
  expect(node('P').parentId).toBeUndefined();
  expect(node('Q').parentId).toBeUndefined();
  expect(node('primary').style?.height).toBe(52);
  expect(node('Q').position.x).toBeGreaterThan(
    node('P').position.x + Number(node('P').style!.width),
  );
  expect(edges.map((edge) => edge.id)).toEqual(['edge:0', 'edge:1']);
  expect(edges.map((edge) => edge.label)).toEqual(['primary', 'standby']);
  expect(edges[0]!.data?.route).not.toEqual(edges[1]!.data?.route);
});
it('separates both parallel paths and labels at equal-height endpoints', () => {
  const a = explorationEdgePath(0, 0, 200, 0, -32),
    b = explorationEdgePath(0, 0, 200, 0, 32);
  expect(a.path).not.toBe(b.path);
  expect(Math.abs(a.labelY - b.labelY)).toBe(48);
  expect(a.path).toMatch(/^M 0 0 C/);
  expect(a.path.endsWith('200 0')).toBe(true);
});
it('packs structural siblings into a compact row without empty card bodies', () => {
  const artifact: ViewArtifact = {
    ...overview,
    kind: 'interconnection',
    nodes: overview.nodes
      .filter((node) => ['System', 'primary', 'standby'].includes(node.id))
      .map((node) =>
        node.id === 'System' ? { ...node, parent: undefined } : node,
      ),
    edges: [],
  };
  const { nodes } = layoutExploration(artifact);
  const root = nodes[0]!,
    primary = nodes[1]!,
    standby = nodes[2]!;
  expect(primary.position.y).toBe(standby.position.y);
  expect(standby.position.x).toBeGreaterThan(primary.position.x + 208);
  expect(root.style!.height).toBe(136);
  expect(primary.style!.height).toBe(52);
  expect(standby.position.x + 208).toBeLessThan(Number(root.style!.width));
});
it('refuses malformed ownership instead of displaying an invented hierarchy', () => {
  expect(() =>
    layoutExploration({
      ...overview,
      nodes: [{ id: 'x', name: 'x', kind: 'part', parent: 'missing' }],
    }),
  ).toThrow(/missing owner/);
  expect(() =>
    layoutExploration({
      ...overview,
      nodes: [{ id: 'x', name: 'x', kind: 'part', parent: 'x' }],
    }),
  ).toThrow(/cyclic/);
});
