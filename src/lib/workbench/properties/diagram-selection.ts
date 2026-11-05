import type { EvaluatedView, ViewArtifact } from '$lib/workspace/views';

type Subject = EvaluatedView['correspondence'][number]['subject'];
export interface DiagramRelationshipSelection {
  edge: ViewArtifact['edges'][number];
  declaration: Subject;
  source: Subject;
  target: Subject;
}

/** Renderer identities locate correspondence; display names never join endpoints. */
export function diagramRelationshipSelection(
  view: EvaluatedView | null,
  symbol: string | undefined,
): DiagramRelationshipSelection | undefined {
  if (view?.status !== 'complete' || view.artifact?.kind !== 'requirement')
    return;
  const edge = view.artifact.edges.find(
    (_item, index) => symbol === `edge:${index}`,
  );
  const declaration = view.correspondence.find(
    (item) => item.symbol === symbol,
  )?.subject;
  if (!edge || !declaration) return;
  const source = view.correspondence.find(
    (item) => item.symbol === edge.from,
  )?.subject;
  const target = view.correspondence.find(
    (item) => item.symbol === edge.to,
  )?.subject;
  if (!source || !target) return;
  return { edge, declaration, source, target };
}
