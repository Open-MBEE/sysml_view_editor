import { expect, it } from 'vitest';
import type { ViewArtifact } from '$lib/workspace/views';
import { absolutePositions } from './structure';
import {
  layoutRequirements,
  requirementEdgeLabel,
  requirementHeight,
  requirementWidth,
} from './requirements';

// Controlled renderer fixtures establish projection behavior, not engine conformance.
const artifact: ViewArtifact = {
  kind: 'requirement',
  nodes: [
    {
      id: 'definition',
      name: 'Capacity::Minimum',
      kind: 'requirement def',
      shortName: 'REQ-1',
      documentation: ['The tank shall store at least ten units.'],
      exposure: 'selected',
    },
    {
      id: 'left',
      name: 'Capacity::primary::capacity',
      kind: 'requirement',
      type: 'Capacity::Minimum',
      exposure: 'selected',
    },
    {
      id: 'right',
      name: 'Capacity::standby::capacity',
      kind: 'requirement',
      type: 'Capacity::Minimum',
      exposure: 'selected',
    },
    { id: 'tank', name: 'System::tank', kind: 'part', exposure: 'contextual' },
  ],
  edges: [
    { from: 'left', to: 'definition', kind: 'typing' },
    { from: 'right', to: 'definition', kind: 'typing' },
    { from: 'tank', to: 'left', kind: 'satisfy' },
    {
      from: 'tank',
      to: 'right',
      kind: 'satisfy',
      negated: true,
      asserted: true,
    },
  ],
};

it('retains exact native symbol and relationship-index identities with distinct endpoint descriptions', async () => {
  const result = await layoutRequirements(artifact, {});
  expect(result.nodes.map((node) => node.id)).toEqual([
    'definition',
    'left',
    'right',
    'tank',
  ]);
  expect(result.edges[2]).toMatchObject({
    id: 'edge:2',
    source: 'tank',
    target: 'left',
    label: 'satisfy',
    sourceHandle: 'requirement-source',
    targetHandle: 'requirement-target',
  });
  expect(result.edges[3]).toMatchObject({
    id: 'edge:3',
    source: 'tank',
    target: 'right',
    label: 'assert not satisfy',
  });
  expect(result.edges[2]!.ariaLabel).toContain('Capacity::primary::capacity');
  expect(result.edges[3]!.ariaLabel).toContain('Capacity::standby::capacity');
  expect(result.nodes[0]!.ariaLabel).toContain('REQ-1');
  expect(result.nodes[3]!.ariaLabel).toContain('related context');
});

it('keeps display-name duplicates separate and restores absolute saved positions without mutating the artifact', async () => {
  const duplicated = {
    ...artifact,
    nodes: artifact.nodes.map((node) =>
      node.id === 'left' || node.id === 'right'
        ? { ...node, name: 'capacity' }
        : node,
    ),
  };
  const saved = {
    left: { x: -143.75, y: 21.125 },
    right: { x: 900.5, y: 1200.25 },
  };
  const before = JSON.stringify(duplicated);
  const result = await layoutRequirements(duplicated, saved);
  expect(
    result.nodes.filter((node) => node.data.item.name === 'capacity'),
  ).toHaveLength(2);
  expect(absolutePositions(result.nodes)).toMatchObject(saved);
  expect(result.nodes.every((node) => node.parentId === undefined)).toBe(true);
  expect(result.nodes[0]!.style).toMatchObject({
    width: requirementWidth,
    height: requirementHeight,
  });
  expect(JSON.stringify(duplicated)).toBe(before);
  expect(result.notice).toBe('');
});

it('distinguishes native direct ownership, via-type features, typing and negated satisfaction', () => {
  const edge = { from: 'a', to: 'b', kind: 'composition' };
  expect(requirementEdgeLabel({ ...edge, ownership: 'direct' })).toBe(
    'contains',
  );
  expect(requirementEdgeLabel({ ...edge, ownership: 'via-type' })).toBe(
    'owned feature (via type)',
  );
  expect(requirementEdgeLabel(edge)).toBe('composition');
  expect(requirementEdgeLabel({ ...edge, kind: 'typing' })).toBe('typed by');
  expect(
    requirementEdgeLabel({ ...edge, kind: 'satisfy', negated: true }),
  ).toBe('not satisfy');
  expect(
    requirementEdgeLabel({ ...edge, kind: 'satisfy', asserted: true }),
  ).toBe('assert satisfy');
});

it('rejects unresolved and duplicate identities rather than silently discarding relations', async () => {
  await expect(
    layoutRequirements(
      {
        ...artifact,
        edges: [{ from: 'tank', to: 'missing', kind: 'satisfy' }],
      },
      {},
    ),
  ).rejects.toThrow('unresolved');
  await expect(
    layoutRequirements(
      { ...artifact, nodes: [...artifact.nodes, artifact.nodes[0]!] },
      {},
    ),
  ).rejects.toThrow('duplicate');
  await expect(
    layoutRequirements({ ...artifact, kind: 'tree' }, {}),
  ).rejects.toThrow('native requirement');
});
