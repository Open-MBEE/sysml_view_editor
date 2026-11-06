import {
  overviewGutters,
  routeOverview,
  explorationHeaderHeight,
} from './overview-routing';
export { explorationHeaderHeight } from './overview-routing';
import { Position, type Edge } from '@xyflow/react';
import type { ArtifactNode, ViewArtifact } from '$lib/workspace/views';
import type { StructureNode } from './structure';

const width = 208;
const padding = 16;
const gap = 20;
export function explorationKindLabel(kind: string) {
  return (
    (
      {
        package: 'Package',
        partDef: 'Part definition',
        partUsage: 'Part usage',
      } as Record<string, string>
    )[kind] ?? kind
  );
}
interface Box {
  item: ArtifactNode;
  width: number;
  height: number;
  children: { box: Box; x: number; y: number }[];
}

/** Arrange only engine-owned containment. Relationship endpoints never become owners. */
export function layoutExploration(artifact: ViewArtifact) {
  const byId = new Map(artifact.nodes.map((item) => [item.id, item]));
  if (byId.size !== artifact.nodes.length)
    throw new Error('Exploration has duplicate identities.');
  const byParent = new Map<string, ArtifactNode[]>();
  for (const item of artifact.nodes) {
    if (item.parent && !byId.has(item.parent))
      throw new Error('Exploration has a missing owner.');
    const siblings = byParent.get(item.parent || '') ?? [];
    siblings.push(item);
    byParent.set(item.parent || '', siblings);
    const seen = new Set([item.id]);
    let owner = item.parent;
    while (owner) {
      if (seen.has(owner)) throw new Error('Exploration has cyclic ownership.');
      seen.add(owner);
      owner = byId.get(owner)?.parent;
    }
  }
  for (const edge of artifact.edges)
    if (!byId.has(edge.from) || !byId.has(edge.to))
      throw new Error('Exploration has a missing relationship endpoint.');
  const routing =
    artifact.kind === 'tree' ? overviewGutters(artifact) : undefined;
  function box(item: ArtifactNode): Box {
    const nested = (byParent.get(item.id) ?? []).map(box);
    const top =
      explorationHeaderHeight +
      (item.attributeDeclarations?.length ?? 0) * 48 +
      (item.ports?.length ?? 0) * 30;
    // Structural leaf siblings fit side by side. Ownership overviews keep a
    // narrow declaration hierarchy so package-to-package relationships have room.
    const columns =
      artifact.kind === 'interconnection' &&
      nested.every((child) => !child.children.length)
        ? 2
        : 1;
    const children: Box['children'] = [];
    let y = top + padding,
      maxWidth = 0;
    for (let i = 0; i < nested.length; i += columns) {
      const row = nested.slice(i, i + columns);
      let x = padding;
      for (const child of row) {
        children.push({ box: child, x, y });
        x += child.width + gap;
      }
      maxWidth = Math.max(maxWidth, x - gap + padding);
      y += Math.max(...row.map((child) => child.height)) + gap;
    }
    return {
      item,
      width:
        Math.max(width, maxWidth) + (routing?.gutters.get(item.id)?.width ?? 0),
      height: Math.max(
        nested.length ? y - gap + padding : top,
        routing?.gutters.has(item.id)
          ? top + 32 + routing.gutters.get(item.id)!.indices.length * 24
          : 0,
      ),
      children,
    };
  }
  const nodes: StructureNode[] = [];
  const absolute = new Map<string, { x: number; y: number }>();
  function project(box: Box, x: number, y: number, parentId?: string) {
    const parent = parentId ? absolute.get(parentId)! : { x: 0, y: 0 };
    absolute.set(box.item.id, { x: parent.x + x, y: parent.y + y });
    const item = box.item;
    nodes.push({
      id: item.id,
      type: 'structure',
      position: { x, y },
      ...(parentId ? { parentId } : {}),
      data: { item, compound: box.children.length > 0, compact: true },
      ariaLabel: `${item.kind} ${item.name}${item.type ? ' : ' + item.type : ''}`,
      className: `structure-node exploration-node ${item.kind === 'package' ? 'model-package' : item.kind.endsWith('def') ? 'model-definition' : 'model-usage'}${box.children.length ? ' structure-compound' : !item.ports?.length ? ' exploration-leaf' : ''}`,
      style: { width: box.width, height: box.height },
      sourcePosition: Position.Right,
      targetPosition: Position.Left,
      draggable: false,
    });
    for (const child of box.children)
      project(child.box, child.x, child.y, item.id);
  }
  let x = 0;
  for (const root of byParent.get('') ?? []) {
    const bounds = box(root);
    project(bounds, x, 0);
    x +=
      bounds.width +
      Math.max(
        120,
        routing?.gutters.get('')?.labelWidth
          ? routing.gutters.get('')!.labelWidth + 64
          : 0,
      );
  }
  if (routing) {
    const result = routeOverview(artifact, nodes, absolute, routing);
    return { nodes, ...result, notice: '' };
  }
  const groups = new Map<string, number[]>();
  artifact.edges.forEach((edge, index) => {
    if (!byId.has(edge.from) || !byId.has(edge.to))
      throw new Error('Exploration has a missing relationship endpoint.');
    const key = JSON.stringify([edge.from, edge.to].sort());
    const group = groups.get(key) ?? [];
    group.push(index);
    groups.set(key, group);
  });
  const lanes = new Map<number, number>();
  for (const group of groups.values())
    group.forEach((index, lane) =>
      lanes.set(index, (lane - (group.length - 1) / 2) * 64),
    );
  const edges: Edge[] = artifact.edges.map((edge, index) => {
    const source = byId.get(edge.from)!,
      target = byId.get(edge.to)!;
    const forward = absolute.get(edge.from)!.x <= absolute.get(edge.to)!.x;
    return {
      id: `edge:${index}`,
      source: edge.from,
      target: edge.to,
      sourceHandle:
        edge.fromPort ?? (forward ? 'node-source' : 'exploration-source-left'),
      targetHandle:
        edge.toPort ?? (forward ? 'node-target' : 'exploration-target-right'),
      type: 'exploration',
      data: { lane: lanes.get(index) ?? 0 },
      label: edge.label || edge.kind,
      ariaLabel: `${edge.kind} ${edge.label ?? ''}: ${source.name} to ${target.name}`,
      interactionWidth: 20,
      zIndex: 1,
      deletable: false,
    };
  });
  return { nodes, edges, bounds: undefined, notice: '' };
}

/** Parallel relationships retain distinct paths and label positions, even for horizontal endpoints. */
export function explorationEdgePath(
  sourceX: number,
  sourceY: number,
  targetX: number,
  targetY: number,
  lane: number,
) {
  const dx = targetX - sourceX;
  const lead = Math.max(40, Math.abs(dx) / 3) * (dx >= 0 ? 1 : -1);
  return {
    path: `M ${sourceX} ${sourceY} C ${sourceX + lead} ${sourceY + lane}, ${targetX - lead} ${targetY + lane}, ${targetX} ${targetY}`,
    labelX: (sourceX + targetX) / 2,
    labelY: (sourceY + targetY) / 2 + lane * 0.75,
  };
}
