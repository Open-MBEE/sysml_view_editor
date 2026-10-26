import { expect, it } from 'vitest';
import { absolutePositions, layoutStructure } from './structure';
import type { ViewArtifact } from '$lib/workspace/views';

const artifact: ViewArtifact = {
  kind: 'interconnection',
  nodes: [
    { id: 'root', name: 'Assembly', kind: 'part def' },
    { id: 'bay', name: 'bay', kind: 'part', parent: 'root' },
    {
      id: 'left',
      name: 'left',
      kind: 'part',
      parent: 'bay',
      ports: [{ id: 'left.out', name: 'output', direction: 'out' }],
    },
    {
      id: 'right',
      name: 'right',
      kind: 'part',
      parent: 'bay',
      ports: [{ id: 'right.in', name: 'input', direction: 'in' }],
    },
  ],
  edges: [
    {
      from: 'left',
      to: 'right',
      fromPort: 'left.out',
      toPort: 'right.in',
      label: 'link',
      kind: 'connection',
    },
  ],
};

it('projects engine ownership and resolves edges to the intended port handles', async () => {
  const { nodes, edges } = await layoutStructure(artifact, {});
  expect(nodes.find((node) => node.id === 'left')?.parentId).toBe('bay');
  expect(nodes.find((node) => node.id === 'bay')?.parentId).toBe('root');
  expect(edges[0]).toMatchObject({
    source: 'left',
    sourceHandle: 'left.out',
    target: 'right',
    targetHandle: 'right.in',
  });
  const bay = nodes.find((node) => node.id === 'bay')!;
  for (const child of nodes.filter((node) => node.parentId === 'bay')) {
    expect(child.position.x).toBeGreaterThan(0);
    expect(child.position.y).toBeGreaterThan(66);
    expect(child.position.x + Number(child.style!.width)).toBeLessThan(
      Number(bay.style!.width),
    );
    expect(child.position.y + Number(child.style!.height)).toBeLessThan(
      Number(bay.style!.height),
    );
  }
});

it('restores absolute version-1 positions after moving an assembly and all descendants', async () => {
  const first = await layoutStructure(artifact, {});
  first.nodes[0]!.position = { x: 120, y: 90 };
  const saved = absolutePositions(first.nodes);
  const restored = await layoutStructure(artifact, saved);
  expect(absolutePositions(restored.nodes)).toEqual(saved);
  expect(restored.notice).toBe('');
});

it('reports incompatible old flat positions instead of drawing a child outside its owner', async () => {
  const result = await layoutStructure(artifact, {
    left: { x: -500, y: -500 },
  });
  expect(result.notice).toContain('outside the current owner');
  expect(absolutePositions(result.nodes).left).not.toEqual({
    x: -500,
    y: -500,
  });
});
