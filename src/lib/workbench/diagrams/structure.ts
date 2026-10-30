import ELK, { type ElkNode } from 'elkjs/lib/elk.bundled.js';
import type { Node, Edge } from '@xyflow/react';
import type { ArtifactNode, Point, ViewArtifact } from '$lib/workspace/views';

export type StructureNode = Node<
  { item: ArtifactNode; compound: boolean },
  'structure'
>;
const padding = 32;
// Subtracting fractional ancestor positions can put an exact boundary a few
// ULPs outside its owner. This is below renderer precision, not extra drag room.
const boundaryEpsilon = 1e-7;
const width = 280;
const layoutOptions = {
  'elk.algorithm': 'layered',
  'elk.direction': 'RIGHT',
  'elk.hierarchyHandling': 'INCLUDE_CHILDREN',
  'elk.spacing.nodeNode': '80',
  'elk.layered.spacing.nodeNodeBetweenLayers': '100',
};
export const headingHeight = 66;
export const portHeight = 30;
const contentTop = (item: ArtifactNode) =>
  headingHeight + (item.ports?.length ?? 0) * portHeight + 20;

/** Positions crossing the workspace boundary remain absolute version-1 coordinates. */
export function absolutePositions(
  nodes: readonly Pick<Node, 'id' | 'parentId' | 'position'>[],
) {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const points: Record<string, Point> = {};
  function position(id: string): Point {
    if (points[id]) return points[id]!;
    const node = byId.get(id)!;
    const parent = node.parentId ? position(node.parentId) : { x: 0, y: 0 };
    return (points[id] = {
      x: parent.x + node.position.x,
      y: parent.y + node.position.y,
    });
  }
  for (const node of nodes) position(node.id);
  return points;
}

export async function layoutStructure(
  artifact: ViewArtifact,
  stored: Readonly<Record<string, Point>>,
) {
  const children = (id?: string) =>
    artifact.nodes.filter((item) => (item.parent || undefined) === id);
  function graphNode(item: ArtifactNode): ElkNode {
    const nested = children(item.id);
    return {
      id: item.id,
      width,
      height: contentTop(item),
      ...(nested.length
        ? {
            children: nested.map(graphNode),
            layoutOptions: {
              ...layoutOptions,
              'elk.padding': `[top=${contentTop(item)},left=${padding},bottom=${padding},right=${padding}]`,
            },
          }
        : {}),
    };
  }
  const layout = await new ELK().layout({
    id: 'structure-root',
    layoutOptions,
    children: children().map(graphNode),
    edges: artifact.edges.map((edge, index) => ({
      id: `edge-${index}`,
      sources: [edge.from],
      targets: [edge.to],
    })),
  });
  const nodes: StructureNode[] = [];
  const absolute: Record<string, Point> = {};
  let discarded = false;
  function project(graph: ElkNode, parent?: StructureNode) {
    const item = artifact.nodes.find((item) => item.id === graph.id)!;
    const parentPosition = parent ? absolute[parent.id]! : { x: 0, y: 0 };
    let position = { x: graph.x ?? 0, y: graph.y ?? 0 };
    const saved = stored[item.id];
    const min = parent ? { x: padding, y: contentTop(parent.data.item) } : null;
    const max = parent
      ? {
          x: Number(parent.style!.width) - padding - (graph.width ?? width),
          y:
            Number(parent.style!.height) -
            padding -
            (graph.height ?? contentTop(item)),
        }
      : null;
    if (saved) {
      const candidate = {
        x: saved.x - parentPosition.x,
        y: saved.y - parentPosition.y,
      };
      if (
        !min ||
        !max ||
        (candidate.x >= min.x - boundaryEpsilon &&
          candidate.y >= min.y - boundaryEpsilon &&
          candidate.x <= max.x + boundaryEpsilon &&
          candidate.y <= max.y + boundaryEpsilon)
      )
        position = candidate;
      else discarded = true;
    }
    const compound = !!graph.children?.length;
    const node: StructureNode = {
      id: item.id,
      type: 'structure',
      position,
      data: { item, compound },
      ariaLabel: `${item.reference ? 'ref ' : ''}${item.direction ? item.direction + ' ' : ''}${item.kind} ${item.name}${item.type ? ' : ' + item.type : ''}`,
      className: `structure-node ${item.reference ? 'model-reference ' : ''}${item.kind === 'part def' ? 'model-definition' : 'model-usage'}${compound ? ' structure-compound' : ''}`,
      style: {
        width: graph.width ?? width,
        height: graph.height ?? contentTop(item),
      },
      ...(parent && min && max
        ? {
            parentId: parent.id,
            extent: [
              [min.x, min.y],
              [
                max.x + (graph.width ?? width),
                max.y + (graph.height ?? contentTop(item)),
              ],
            ] as [[number, number], [number, number]],
          }
        : {}),
    };
    nodes.push(node);
    absolute[item.id] = {
      x: parentPosition.x + position.x,
      y: parentPosition.y + position.y,
    };
    for (const child of graph.children ?? []) project(child, node);
  }
  for (const root of layout.children ?? []) project(root);
  const edges: Edge[] = artifact.edges.map((edge, index) => ({
    id: `edge:${index}`,
    source: edge.from,
    target: edge.to,
    sourceHandle: edge.fromPort ?? 'node-source',
    targetHandle: edge.toPort ?? 'node-target',
    label: edge.label || edge.kind,
    ariaLabel: `${edge.kind} ${edge.label ?? ''}: ${endpoint(edge.from, edge.fromPort)} to ${endpoint(edge.to, edge.toPort)}`,
    type: 'smoothstep',
    zIndex: 1,
  }));
  function endpoint(id: string, portId?: string) {
    const item = artifact.nodes.find((node) => node.id === id)!;
    const names = [item.name];
    let parent = item.parent;
    while (parent) {
      const owner = artifact.nodes.find((node) => node.id === parent)!;
      names.unshift(owner.name);
      parent = owner.parent;
    }
    const port = item.ports?.find((port) => port.id === portId);
    return names.join('.') + (port ? '.' + port.name : '');
  }
  return {
    nodes,
    edges,
    notice: discarded
      ? 'Some saved positions were arranged again because they fall outside the current owner.'
      : '',
  };
}
