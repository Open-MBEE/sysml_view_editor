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

it('keeps compatible saved positions when a new connection changes the automatic owner bounds', async () => {
  const expanded: ViewArtifact = {
    ...artifact,
    nodes: [
      ...artifact.nodes,
      {
        id: 'extra',
        name: 'extra',
        kind: 'part',
        parent: 'bay',
        ports: [{ id: 'extra.out', name: 'output', direction: 'out' }],
      },
    ],
  };
  const before = await layoutStructure(expanded, {});
  const saved = absolutePositions(before.nodes);
  const connected = {
    ...expanded,
    edges: [
      ...expanded.edges,
      {
        from: 'extra',
        to: 'right',
        fromPort: 'extra.out',
        toPort: 'right.in',
        kind: 'connection',
      },
    ],
  };
  const after = await layoutStructure(connected, saved);
  expect(absolutePositions(after.nodes)).toEqual(saved);
  expect(after.notice).toBe('');
});

it.each([0.1, 0.2, 55.46, 67.46, 100.12345])(
  'retains a child on the exact owner boundary after fractional group movement (%s)',
  async (offset) => {
    const first = await layoutStructure(artifact, {});
    first.nodes.find((node) => node.id === 'root')!.position = {
      x: 92.88,
      y: offset,
    };
    const bay = first.nodes.find((node) => node.id === 'bay')!;
    const child = first.nodes.find((node) => node.id === 'left')!;
    child.position = {
      x: 100,
      y: Number(bay.style!.height) - 32 - Number(child.style!.height),
    };
    const saved = absolutePositions(first.nodes);
    const restored = await layoutStructure(artifact, saved);
    expect(restored.notice).toBe('');
    expect(absolutePositions(restored.nodes)).toEqual(saved);
  },
);

it('still rejects positions meaningfully beyond an owner boundary', async () => {
  const first = await layoutStructure(artifact, {});
  const bay = first.nodes.find((node) => node.id === 'bay')!;
  const child = first.nodes.find((node) => node.id === 'left')!;
  child.position = {
    x: 100,
    y: Number(bay.style!.height) - 32 - Number(child.style!.height) + 0.001,
  };
  const saved = absolutePositions(first.nodes);
  const restored = await layoutStructure(artifact, saved);
  expect(restored.notice).toContain('outside the current owner');
  expect(absolutePositions(restored.nodes).left).not.toEqual(saved.left);
});

it('places newly visible children clear of unchanged saved siblings', async () => {
  const original: ViewArtifact = {
    kind: 'interconnection',
    nodes: [
      { id: 'root', name: 'usage', kind: 'part' },
      { id: 'a', name: 'a', kind: 'part', parent: 'root' },
      { id: 'b', name: 'b', kind: 'part', parent: 'root' },
    ],
    edges: [],
  };
  const saved = absolutePositions((await layoutStructure(original, {})).nodes);
  const expanded: ViewArtifact = {
    ...original,
    nodes: [
      original.nodes[0]!,
      { id: 'c', name: 'c', kind: 'part', parent: 'root', inherited: true },
      ...original.nodes.slice(1),
    ],
  };
  const result = await layoutStructure(expanded, saved);
  const positions = absolutePositions(result.nodes);
  for (const [id, position] of Object.entries(saved))
    expect(positions[id]).toEqual(position);
  const added = result.nodes.find((node) => node.id === 'c')!;
  const root = result.nodes.find((node) => node.id === 'root')!;
  for (const id of ['a', 'b']) {
    const sibling = result.nodes.find((node) => node.id === id)!;
    expect(
      added.position.x + Number(added.style!.width) <= sibling.position.x ||
        sibling.position.x + Number(sibling.style!.width) <= added.position.x ||
        added.position.y + Number(added.style!.height) <= sibling.position.y ||
        sibling.position.y + Number(sibling.style!.height) <= added.position.y,
    ).toBe(true);
  }
  expect(added.position.y + Number(added.style!.height)).toBeLessThan(
    Number(root.style!.height),
  );
});

it('anchors an unsaved ancestor of a restored child while placing an automatic sibling', async () => {
  const nested: ViewArtifact = {
    kind: 'interconnection',
    nodes: [
      { id: 'root', name: 'root', kind: 'part' },
      { id: 'branch', name: 'branch', kind: 'part', parent: 'root' },
      { id: 'leaf', name: 'leaf', kind: 'part', parent: 'branch' },
      { id: 'saved', name: 'saved', kind: 'part', parent: 'root' },
      { id: 'new', name: 'new', kind: 'part', parent: 'root', inherited: true },
    ],
    edges: [],
  };
  const automatic = await layoutStructure(nested, {});
  const original = absolutePositions(automatic.nodes);
  const stored = { leaf: original.leaf!, saved: original.new! };
  const result = await layoutStructure(nested, stored);
  const actual = absolutePositions(result.nodes);
  expect(actual.leaf).toEqual(stored.leaf);
  expect(actual.saved).toEqual(stored.saved);
  expect(actual.branch).toEqual(original.branch);
  const root = result.nodes.find((node) => node.id === 'root')!;
  const added = result.nodes.find((node) => node.id === 'new')!;
  const occupied = result.nodes.find((node) => node.id === 'saved')!;
  expect(
    added.position.y + Number(added.style!.height) <= occupied.position.y ||
      occupied.position.y + Number(occupied.style!.height) <=
        added.position.y ||
      added.position.x + Number(added.style!.width) <= occupied.position.x ||
      occupied.position.x + Number(occupied.style!.width) <= added.position.x,
  ).toBe(true);
  expect(added.position.y + Number(added.style!.height)).toBeLessThan(
    Number(root.style!.height),
  );
  expect(added.extent).toEqual([
    [32, 86],
    [Number(root.style!.width) - 32, Number(root.style!.height) - 32],
  ]);
});

it('reuses a vacant slot within unchanged owner bounds and drag extents', async () => {
  const simple: ViewArtifact = {
    kind: 'interconnection',
    nodes: [
      { id: 'root', name: 'root', kind: 'part' },
      { id: 'saved', name: 'saved', kind: 'part', parent: 'root' },
      { id: 'new', name: 'new', kind: 'part', parent: 'root', inherited: true },
    ],
    edges: [],
  };
  const automatic = await layoutStructure(simple, {});
  const original = absolutePositions(automatic.nodes);
  const result = await layoutStructure(simple, { saved: original.new! });
  const actual = absolutePositions(result.nodes);
  expect(actual.saved).toEqual(original.new);
  const root = result.nodes.find((node) => node.id === 'root')!;
  const added = result.nodes.find((node) => node.id === 'new')!;
  expect(root.style).toEqual(automatic.nodes[0]!.style);
  expect(added.position.y).toBeLessThan(
    result.nodes.find((node) => node.id === 'saved')!.position.y,
  );
  expect(added.position.y + Number(added.style!.height)).toBeLessThan(
    Number(root.style!.height),
  );
  expect(added.extent).toEqual([
    [32, 86],
    [Number(root.style!.width) - 32, Number(root.style!.height) - 32],
  ]);
});

it('reopens every position published by partial restoration without discarding geometry', async () => {
  const simple: ViewArtifact = {
    kind: 'interconnection',
    nodes: [
      { id: 'root', name: 'root', kind: 'part' },
      { id: 'saved', name: 'saved', kind: 'part', parent: 'root' },
      { id: 'new', name: 'new', kind: 'part', parent: 'root', inherited: true },
    ],
    edges: [],
  };
  const automatic = await layoutStructure(simple, {});
  const original = absolutePositions(automatic.nodes);
  const first = await layoutStructure(simple, { saved: original.new! });
  const published = absolutePositions(first.nodes);
  const reopened = await layoutStructure(simple, published);
  expect(absolutePositions(reopened.nodes)).toEqual(published);
  expect(reopened.notice).not.toContain('outside the current owner');
});

it('warns when fixed saved geometry leaves no bounded slot instead of publishing larger drag bounds', async () => {
  const simple: ViewArtifact = {
    kind: 'interconnection',
    nodes: [
      { id: 'root', name: 'root', kind: 'part' },
      { id: 'saved', name: 'saved', kind: 'part', parent: 'root' },
      { id: 'new', name: 'new', kind: 'part', parent: 'root', inherited: true },
    ],
    edges: [],
  };
  const automatic = await layoutStructure(simple, {});
  const original = absolutePositions(automatic.nodes);
  const owner = automatic.nodes[0]!;
  const child = automatic.nodes.find((node) => node.id === 'saved')!;
  const middle = {
    x: original.saved!.x,
    y:
      original.root!.y +
      86 +
      (Number(owner.style!.height) - 86 - 32 - Number(child.style!.height)) / 2,
  };
  const result = await layoutStructure(simple, { saved: middle });
  expect(absolutePositions(result.nodes).saved).toEqual(middle);
  expect(result.nodes[0]!.style).toEqual(owner.style);
  expect(result.notice).toContain('automatic positions overlap saved nodes');
  const published = absolutePositions(result.nodes);
  expect(
    absolutePositions((await layoutStructure(simple, published)).nodes),
  ).toEqual(published);
});

it('keeps native placement of newly authored owned nodes outside inherited-member restoration', async () => {
  const owned: ViewArtifact = {
    kind: 'interconnection',
    nodes: [
      { id: 'root', name: 'root', kind: 'part' },
      { id: 'saved', name: 'saved', kind: 'part', parent: 'root' },
      { id: 'new', name: 'new', kind: 'part', parent: 'root' },
    ],
    edges: [],
  };
  const automatic = await layoutStructure(owned, {});
  const original = absolutePositions(automatic.nodes);
  const result = await layoutStructure(owned, { saved: original.new! });
  expect(absolutePositions(result.nodes).new).toEqual(original.new);
  expect(result.notice).toBe('');
});
