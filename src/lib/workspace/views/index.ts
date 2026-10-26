import type { Static } from 'typebox';
import type { ReadonlyData } from '$lib/contracts/validation';
import {
  EvaluatedViewSchema,
  PointSchema,
  ViewPresentationSchema,
  readEvaluatedView,
} from './schema';
export type EvaluatedView = ReadonlyData<Static<typeof EvaluatedViewSchema>>;
export type Point = ReadonlyData<Static<typeof PointSchema>>;
export type ViewPresentation = ReadonlyData<
  Static<typeof ViewPresentationSchema>
>;
export function validateEvaluation(
  value: unknown,
  modelHash: string,
  view: string,
): EvaluatedView {
  const result = readEvaluatedView(value);
  if (
    !result ||
    result.schemaVersion !== 1 ||
    result.modelHash !== modelHash ||
    result.view !== view ||
    !['complete', 'invalid', 'indeterminate'].includes(result.status) ||
    !['available', 'unsupported', 'unavailable'].includes(
      result.renderStatus,
    ) ||
    !Array.isArray(result.diagnostics) ||
    !Array.isArray(result.correspondence)
  )
    throw new Error('Invalid or stale view response.');
  if (result.status !== 'complete' && result.artifact)
    throw new Error('Incomplete evaluation cannot publish an artifact.');
  if (
    result.renderStatus === 'available' &&
    (!result.artifact ||
      !Array.isArray(result.artifact.nodes) ||
      !Array.isArray(result.artifact.edges))
  )
    throw new Error('View response omitted its artifact.');
  if (result.artifact?.kind === 'interconnection')
    validateStructure(result.artifact);
  return result;
}

export type ViewArtifact = NonNullable<EvaluatedView['artifact']>;
export type ArtifactNode = ViewArtifact['nodes'][number];

function validateStructure(artifact: ViewArtifact) {
  const nodes = new Map(artifact.nodes.map((node) => [node.id, node]));
  const symbols = new Set(nodes.keys());
  if (nodes.size !== artifact.nodes.length)
    throw new Error('Structural view has duplicate symbol identities.');
  for (const node of artifact.nodes) {
    const ancestry = new Set([node.id]);
    let parent = node.parent;
    while (parent) {
      if (!nodes.has(parent) || ancestry.has(parent))
        throw new Error('Structural view has missing or cyclic ownership.');
      ancestry.add(parent);
      parent = nodes.get(parent)!.parent;
    }
    for (const port of node.ports ?? []) {
      if (symbols.has(port.id))
        throw new Error('Structural view has duplicate port identities.');
      symbols.add(port.id);
    }
  }
  for (const edge of artifact.edges) {
    for (const [id, port] of [
      [edge.from, edge.fromPort],
      [edge.to, edge.toPort],
    ]) {
      const node = nodes.get(id!);
      if (
        !node ||
        (port && !node.ports?.some((candidate) => candidate.id === port))
      )
        throw new Error(
          'Structural view has an unresolved connection endpoint.',
        );
    }
  }
}
