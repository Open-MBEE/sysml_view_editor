import type { LayoutRoute } from './RoutedEdge';
import ELK, { type ElkNode } from 'elkjs/lib/elk.bundled.js';
import { MarkerType, type Node, type Edge } from '@xyflow/react';
import type { ArtifactNode, Point, ViewArtifact } from '$lib/workspace/views';

export type StructureNode = Node<
  {
    item: ArtifactNode;
    compound: boolean;
    compact?: boolean;
    behavior?: boolean;
    dense?: boolean;
  },
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
const contentTop = (item: ArtifactNode, dense = false) =>
  headingHeight +
  (item.attributeDeclarations?.length ?? 0) * (dense ? 32 : 48) +
  (item.ports?.length ?? 0) * portHeight +
  20;

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
  const behavior = ['action', 'state'].includes(artifact.kind);
  const dense = !behavior && artifact.nodes.length >= 10;
  const cardWidth = dense ? 240 : width;
  const options = behavior
    ? {
        ...layoutOptions,
        'elk.direction': 'DOWN',
        'elk.edgeRouting': 'ORTHOGONAL',
      }
    : {
        ...layoutOptions,
        'elk.edgeRouting': 'ORTHOGONAL',
        ...(dense
          ? {
              'elk.spacing.nodeNode': '40',
              'elk.layered.spacing.nodeNodeBetweenLayers': '64',
            }
          : {}),
      };
  const children = (id?: string) =>
    artifact.nodes.filter((item) => (item.parent || undefined) === id);
  function graphNode(item: ArtifactNode): ElkNode {
    const nested = children(item.id);
    const terminal =
      behavior && ['initial', 'final', 'start', 'done'].includes(item.kind);
    return {
      id: item.id,
      width: terminal ? 36 : cardWidth,
      height: terminal ? 36 : contentTop(item, dense),
      ...(behavior
        ? {
            ports: [
              {
                id: item.id + '::source',
                width: 0,
                height: 0,
                layoutOptions: { 'elk.port.side': 'SOUTH' },
              },
              {
                id: item.id + '::target',
                width: 0,
                height: 0,
                layoutOptions: { 'elk.port.side': 'NORTH' },
              },
              ...(item.ports ?? []).map((port) => ({
                id: port.id,
                width: 0,
                height: 0,
                layoutOptions: {
                  'elk.port.side': port.direction === 'out' ? 'EAST' : 'WEST',
                },
              })),
            ],
            layoutOptions: {
              'elk.portConstraints': 'FIXED_SIDE',
              ...(terminal
                ? {
                    'elk.layered.layering.layerConstraint': [
                      'initial',
                      'start',
                    ].includes(item.kind)
                      ? 'FIRST'
                      : 'LAST',
                  }
                : {}),
            },
          }
        : {}),
      ...(!behavior
        ? {
            ports: [
              {
                id: item.id + '::source',
                x: cardWidth,
                y: contentTop(item, dense) / 2,
                width: 0,
                height: 0,
                layoutOptions: { 'elk.port.side': 'EAST' },
              },
              {
                id: item.id + '::target',
                x: 0,
                y: contentTop(item, dense) / 2,
                width: 0,
                height: 0,
                layoutOptions: { 'elk.port.side': 'WEST' },
              },
              ...(item.ports ?? []).map((port, index) => ({
                id: port.id,
                x: port.direction === 'out' ? cardWidth : 0,
                // Match the rendered border, header, attribute border and row centre.
                // Leaf rows share the 20px footer minus two 1px borders.
                // Logical owners are not DOM ancestors of their child nodes.
                y:
                  1 +
                  headingHeight +
                  (item.attributeDeclarations?.length ?? 0) *
                    (dense ? 32 : 48) +
                  (item.attributeDeclarations?.length ? 1 : 0) +
                  (index + 0.5) *
                    (portHeight +
                      (!nested.length ? 18 / item.ports!.length : 0)) +
                  (index > 0 ? 0.5 : 0),
                width: 0,
                height: 0,
                layoutOptions: {
                  'elk.port.side': port.direction === 'out' ? 'EAST' : 'WEST',
                },
              })),
            ],
            layoutOptions: { 'elk.portConstraints': 'FIXED_POS' },
          }
        : {}),
      ...(nested.length
        ? {
            children: nested.map(graphNode),
            layoutOptions: {
              ...options,
              'elk.portConstraints': behavior ? 'FIXED_SIDE' : 'FIXED_POS',
              'elk.padding': `[top=${contentTop(item, dense)},left=${padding},bottom=${padding},right=${padding}]`,
            },
          }
        : {}),
    };
  }
  const layout: ElkNode = await new ELK().layout({
    id: 'structure-root',
    layoutOptions: options,
    children: children().map(graphNode),
    edges: artifact.edges.map((edge, index) => ({
      id: `edge-${index}`,
      sources: [edge.fromPort ?? edge.from + '::source'],
      targets: [edge.toPort ?? edge.to + '::target'],
      ...((behavior ? edge.label : edge.label || edge.kind)
        ? {
            labels: [
              {
                text: behavior ? edge.label! : edge.label || edge.kind,
                width: (edge.label || edge.kind).length * 7 + 16,
                height: 20,
              },
            ],
          }
        : {}),
    })),
  });
  const nodes: StructureNode[] = [];
  const absolute: Record<string, Point> = {};
  const restored = new Set<string>();
  let discarded = false;
  function project(graph: ElkNode, parent?: StructureNode) {
    const item = artifact.nodes.find((item) => item.id === graph.id)!;
    const parentPosition = parent ? absolute[parent.id]! : { x: 0, y: 0 };
    let position = { x: graph.x ?? 0, y: graph.y ?? 0 };
    const saved = stored[item.id];
    const min = parent
      ? { x: padding, y: contentTop(parent.data.item, dense) }
      : null;
    const max = parent
      ? {
          x: Number(parent.style!.width) - padding - (graph.width ?? cardWidth),
          y:
            Number(parent.style!.height) -
            padding -
            (graph.height ?? contentTop(item, dense)),
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
      ) {
        position = candidate;
        restored.add(item.id);
      } else discarded = true;
    }
    const compound = !!graph.children?.length;
    const node: StructureNode = {
      id: item.id,
      type: 'structure',
      position,
      data: {
        item,
        compound,
        ...(behavior ? { behavior: true } : {}),
        ...(dense ? { dense: true } : {}),
      },
      ariaLabel: `${item.reference ? 'ref ' : ''}${item.direction ? item.direction + ' ' : ''}${item.kind} ${item.name}${item.type ? ' : ' + item.type : ''}`,
      className: `structure-node ${behavior ? 'behavior-node behavior-' + item.kind.replaceAll(' ', '-') + ' ' : ''}${item.reference ? 'model-reference ' : ''}${item.kind === 'part def' ? 'model-definition' : 'model-usage'}${compound ? ' structure-compound' : ''}`,
      style: {
        width: graph.width ?? cardWidth,
        height: graph.height ?? contentTop(item, dense),
      },
      ...(parent && min && max
        ? {
            parentId: parent.id,
            extent: [
              [min.x, min.y],
              [
                max.x + (graph.width ?? cardWidth),
                max.y + (graph.height ?? contentTop(item, dense)),
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
  // Newly retained inherited occurrences may share a legacy saved child's
  // automatic slot. Keep ordinary authored-node placement and canonical bounds:
  // version 1 saves positions, not larger drag extents.
  let placementOverlap = false;
  if (!behavior && restored.size) {
    function separate(parent?: StructureNode): boolean {
      const siblings = nodes.filter((node) => node.parentId === parent?.id);
      const anchored = new Set(
        siblings.filter((node) => separate(node) || restored.has(node.id)),
      );
      const automaticInherited = new Set(
        siblings.filter(
          (node) => !anchored.has(node) && node.data.item.inherited,
        ),
      );
      const occupied = siblings.filter((node) => !automaticInherited.has(node));
      if (occupied.length && automaticInherited.size) {
        for (const node of automaticInherited) {
          const nodeWidth = Number(node.style!.width);
          const nodeHeight = Number(node.style!.height);
          const min = parent
            ? { x: padding, y: contentTop(parent.data.item, dense) }
            : { x: 0, y: 0 };
          const max = parent
            ? {
                x: Number(parent.style!.width) - padding - nodeWidth,
                y: Number(parent.style!.height) - padding - nodeHeight,
              }
            : { x: Infinity, y: Infinity };
          const xs = new Set([node.position.x, min.x]);
          const ys = new Set([node.position.y, min.y]);
          for (const other of occupied) {
            const right = other.position.x + Number(other.style!.width);
            const bottom = other.position.y + Number(other.style!.height);
            xs.add(right + padding);
            xs.add(right);
            ys.add(bottom + padding);
            ys.add(bottom);
          }
          const candidates = [...ys].flatMap((y) =>
            [...xs].map((x) => ({ x, y })),
          );
          const free = candidates.find(
            (point) =>
              point.x >= min.x &&
              point.y >= min.y &&
              point.x <= max.x + boundaryEpsilon &&
              point.y <= max.y + boundaryEpsilon &&
              occupied.every(
                (other) =>
                  point.x + nodeWidth <= other.position.x ||
                  other.position.x + Number(other.style!.width) <= point.x ||
                  point.y + nodeHeight <= other.position.y ||
                  other.position.y + Number(other.style!.height) <= point.y,
              ),
          );
          if (free) node.position = free;
          else placementOverlap = true;
          occupied.push(node);
        }
      }
      return anchored.size > 0;
    }
    separate();
    Object.assign(absolute, absolutePositions(nodes));
  }
  const edges: Edge[] = artifact.edges.map((edge, index) => ({
    id: `edge:${index}`,
    source: edge.from,
    target: edge.to,
    sourceHandle: edge.fromPort ?? 'node-source',
    targetHandle: edge.toPort ?? 'node-target',
    label: behavior ? edge.label || undefined : edge.label || edge.kind,
    ariaLabel: `${edge.kind} ${edge.label ?? ''}: ${endpoint(edge.from, edge.fromPort)} to ${endpoint(edge.to, edge.toPort)}`,
    type: 'routed',
    data: { route: layoutRoute(index) },
    ...(behavior
      ? {
          markerEnd: { type: MarkerType.ArrowClosed },
          style: edge.kind === 'flow' ? { strokeDasharray: '6 4' } : undefined,
        }
      : {}),
    zIndex: 1,
  }));
  function layoutRoute(index: number): LayoutRoute {
    const routed = layout.edges?.find((edge) => edge.id === `edge-${index}`);
    const section = routed?.sections?.[0];
    if (!section || routed?.sections?.length !== 1)
      throw new Error('Layout omitted an unambiguous relationship route.');
    const offset = (routed.container && absolute[routed.container]) || {
      x: 0,
      y: 0,
    };
    const label = routed.labels?.[0];
    return {
      ...(routed.container && absolute[routed.container]
        ? { container: { id: routed.container, position: { ...offset } } }
        : {}),
      points: [
        section.startPoint,
        ...(section.bendPoints ?? []),
        section.endPoint,
      ].map((point) => ({ x: point.x + offset.x, y: point.y + offset.y })),
      ...(label && label.x !== undefined && label.y !== undefined
        ? {
            labelX: offset.x + label.x + (label.width ?? 0) / 2,
            labelY: offset.y + label.y + (label.height ?? 0) / 2,
          }
        : {}),
    };
  }
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
    notice: [
      discarded
        ? 'Some saved positions were arranged again because they fall outside the current owner.'
        : '',
      placementOverlap
        ? 'Some automatic positions overlap saved nodes. Move saved nodes to make room.'
        : '',
    ]
      .filter(Boolean)
      .join(' '),
  };
}
