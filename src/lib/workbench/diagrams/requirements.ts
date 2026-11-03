import ELK from 'elkjs/lib/elk.bundled.js';
import { MarkerType, type Edge, type Node } from '@xyflow/react';
import type { ArtifactNode, Point, ViewArtifact } from '$lib/workspace/views';

export const requirementWidth = 340;
export const requirementHeight = 264;
export type RequirementNode = Node<{ item: ArtifactNode }, 'requirement'>;
type Relationship = ViewArtifact['edges'][number];

export function requirementNodeLabel(item: ArtifactNode) {
  return `${item.kind} ${item.shortName ? item.shortName + ' ' : ''}${item.name}${item.type ? ' : ' + item.type : ''}${item.exposure === 'contextual' ? ', related context' : ''}`;
}

/** Labels reflect only the native relationship and explicit bridge evidence. */
export function requirementEdgeLabel(edge: Relationship) {
  if (edge.kind === 'satisfy')
    return `${edge.asserted ? 'assert ' : ''}${edge.negated ? 'not ' : ''}satisfy`;
  if (edge.kind === 'typing') return 'typed by';
  if (edge.kind === 'composition') {
    if (edge.ownership === 'via-type') return 'owned feature (via type)';
    if (edge.ownership === 'direct') return 'contains';
  }
  if (edge.kind === 'reference' && edge.ownership === 'via-type')
    return 'reference (via type)';
  return edge.kind;
}

/** Flat graph positions cross the workspace boundary as absolute coordinates. */
export async function layoutRequirements(
  artifact: ViewArtifact,
  stored: Readonly<Record<string, Point>>,
) {
  if (artifact.kind !== 'requirement')
    throw new Error('Expected a native requirement graph.');
  const byId = new Map(artifact.nodes.map((item) => [item.id, item]));
  if (byId.size !== artifact.nodes.length)
    throw new Error('Requirement graph has duplicate symbol identities.');
  for (const edge of artifact.edges)
    if (!byId.has(edge.from) || !byId.has(edge.to))
      throw new Error(
        'Requirement graph has an unresolved relationship endpoint.',
      );
  const graph = await new ELK().layout({
    id: 'requirements-root',
    layoutOptions: {
      'elk.algorithm': 'layered',
      'elk.direction': 'DOWN',
      'elk.spacing.nodeNode': '88',
      'elk.layered.spacing.nodeNodeBetweenLayers': '104',
    },
    children: artifact.nodes.map((item) => ({
      id: item.id,
      width: requirementWidth,
      height: requirementHeight,
    })),
    edges: artifact.edges.map((edge, index) => ({
      id: `edge:${index}`,
      sources: [edge.from],
      targets: [edge.to],
    })),
  });
  const nodes: RequirementNode[] = artifact.nodes.map((item) => {
    const point =
      stored[item.id] ?? graph.children?.find((n) => n.id === item.id);
    if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y))
      throw new Error('Requirement graph has no finite node position.');
    return {
      id: item.id,
      type: 'requirement',
      data: { item },
      position: { x: point.x!, y: point.y! },
      ariaLabel: requirementNodeLabel(item),
      className: `requirement-node${item.kind === 'requirement def' ? ' requirement-definition' : ''}${item.exposure === 'contextual' ? ' requirement-contextual' : ''}`,
      style: { width: requirementWidth, height: requirementHeight },
    };
  });
  const edges: Edge[] = artifact.edges.map((edge, index) => {
    const relationship = requirementEdgeLabel(edge);
    const label =
      edge.label && edge.label !== edge.kind
        ? `${relationship}: ${edge.label}`
        : relationship;
    return {
      id: `edge:${index}`,
      source: edge.from,
      target: edge.to,
      sourceHandle: 'requirement-source',
      targetHandle: 'requirement-target',
      type: 'smoothstep',
      label,
      ariaLabel: `${label}: ${requirementNodeLabel(byId.get(edge.from)!)} to ${requirementNodeLabel(byId.get(edge.to)!)}`,
      className: `requirement-edge${edge.kind === 'satisfy' ? ' requirement-satisfaction' : ''}${edge.kind === 'typing' ? ' requirement-typing' : ''}${edge.negated ? ' requirement-negated' : ''}`,
      ...(edge.kind === 'typing' || edge.kind === 'satisfy'
        ? {
            markerEnd: {
              type:
                edge.kind === 'typing'
                  ? MarkerType.Arrow
                  : MarkerType.ArrowClosed,
              color: 'var(--sysml-stroke)',
            },
          }
        : {}),
      interactionWidth: 24,
      deletable: false,
    };
  });
  return { nodes, edges, notice: '' };
}
