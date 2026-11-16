import { validateSourceValues } from './source-values';
import type { SourceDocument } from '../project';
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
  documents: readonly SourceDocument[] = [],
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
  if (
    result.artifact &&
    ['interconnection', 'action', 'state'].includes(result.artifact.kind)
  )
    validateStructure(result.artifact);
  if (result.artifact?.kind === 'requirement') validateRequirements(result);
  validateSourceValues(result, documents);
  return result;
}

export type ViewArtifact = NonNullable<EvaluatedView['artifact']>;
export type ArtifactNode = ViewArtifact['nodes'][number];

export function validateStructure(artifact: ViewArtifact) {
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

/** Requirement relationships must carry exact source correspondence, not labels. */
function validateRequirements(result: EvaluatedView) {
  const artifact = result.artifact!;
  validateStructure(artifact);
  if (!result.selected)
    throw new Error('Requirements view omitted its exposed subjects.');
  const selected = new Set(result.selected.map((item) => item.id));
  if (selected.size !== result.selected.length)
    throw new Error('Requirements view has duplicate exposed subjects.');
  const correspondence = new Map(
    result.correspondence.map((item) => [item.symbol, item]),
  );
  if (correspondence.size !== result.correspondence.length)
    throw new Error('Requirements view has duplicate correspondence.');
  const subject = (symbol: string) => {
    const item = correspondence.get(symbol);
    if (!item || !item.subject.origin || !item.subject.id)
      throw new Error('Requirements view omitted exact source correspondence.');
    return item.subject;
  };
  const ids = new Set(artifact.nodes.map((node) => node.id));
  for (const node of artifact.nodes) {
    const source = subject(node.id);
    const exposure = selected.has(source.id) ? 'selected' : 'contextual';
    if (node.exposure !== exposure)
      throw new Error(
        'Requirements view misrepresented selected versus related context.',
      );
  }
  const owners = new Map<string, string>();
  artifact.edges.forEach((edge, index) => {
    const id = `edge:${index}`;
    if (ids.has(id))
      throw new Error('Requirements edge identity collides with a node.');
    const declaration = subject(id);
    if (
      edge.kind === 'satisfy' &&
      (typeof edge.negated !== 'boolean' || typeof edge.asserted !== 'boolean')
    )
      throw new Error('Requirements view omitted satisfaction polarity.');
    if (edge.kind === 'composition' || edge.kind === 'reference') {
      if (
        !edge.ownership ||
        (edge.ownership === 'direct') !==
          (declaration.id === subject(edge.to).id)
      )
        throw new Error('Requirements view omitted exact ownership semantics.');
      if (edge.ownership === 'direct') {
        if (owners.has(edge.to) && owners.get(edge.to) !== edge.from)
          throw new Error('Requirement usage has conflicting owners.');
        owners.set(edge.to, edge.from);
      }
    }
  });
  for (const start of owners.keys()) {
    const seen = new Set<string>();
    let current: string | undefined = start;
    while (current !== undefined) {
      if (seen.has(current))
        throw new Error('Requirements view has cyclic ownership.');
      seen.add(current);
      current = owners.get(current);
    }
  }
}
