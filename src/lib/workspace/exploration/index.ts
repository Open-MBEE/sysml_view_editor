import Type, { type Static } from 'typebox';
import { validator, type ReadonlyData } from '$lib/contracts/validation';
import type { SourceDocument } from '../project';
import { EvaluatedViewSchema, ViewSubjectSchema } from '../views/schema';
import { validateEvaluation, validateStructure } from '../views';

const closed = { additionalProperties: false };
const subject = Type.String({ minLength: 1 });
export const ExplorationRequestSchema = Type.Union([
  Type.Object(
    {
      scope: Type.Object({ kind: Type.Literal('project') }, closed),
      representation: Type.Literal('tree'),
    },
    closed,
  ),
  Type.Object(
    {
      scope: Type.Object({ kind: Type.Literal('package'), subject }, closed),
      representation: Type.Literal('tree'),
    },
    closed,
  ),
  Type.Object(
    {
      scope: Type.Object({ kind: Type.Literal('element'), subject }, closed),
      representation: Type.Union([
        Type.Literal('tree'),
        Type.Literal('interconnection'),
      ]),
    },
    closed,
  ),
]);
const evaluation = Type.Omit(
  EvaluatedViewSchema,
  Type.Literal('view'),
).properties;
export const ExplorationResultSchema = Type.Object(
  {
    ...evaluation,
    request: ExplorationRequestSchema,
    selected: Type.Array(ViewSubjectSchema),
  },
  closed,
);
export type ExplorationRequest = ReadonlyData<
  Static<typeof ExplorationRequestSchema>
>;
export type ExplorationResult = ReadonlyData<
  Static<typeof ExplorationResultSchema>
>;
export const readExplorationRequest = validator(
  ExplorationRequestSchema,
  'Invalid exploration request',
);
export const readExplorationResult = validator(
  ExplorationResultSchema,
  'Invalid exploration response',
);

export function sameExploration(a: ExplorationRequest, b: ExplorationRequest) {
  return (
    a.representation === b.representation &&
    a.scope.kind === b.scope.kind &&
    (a.scope.kind === 'project'
      ? b.scope.kind === 'project'
      : b.scope.kind !== 'project' && a.scope.subject === b.scope.subject)
  );
}

/** Reuse artifact validation, never the authored-view identity or persistence path. */
export function validateExploration(
  value: unknown,
  modelHash: string,
  request: ExplorationRequest,
  documents: readonly SourceDocument[],
): ExplorationResult {
  const result = readExplorationResult(value);
  if (
    !sameExploration(result.request, request) ||
    result.modelHash !== modelHash
  )
    throw new Error('Invalid or stale exploration response.');
  validateEvaluation({ ...result, view: '' }, modelHash, '');
  const sizes = new Map(
    documents.map((file) => [
      file.name,
      new TextEncoder().encode(file.text).length,
    ]),
  );
  for (const subject of [
    ...result.selected,
    ...result.correspondence.map((item) => item.subject),
  ]) {
    const origin = subject.origin;
    const size = origin && sizes.get(origin.file);
    const nameLength = origin?.nameLength ?? 0;
    if (
      !origin ||
      size === undefined ||
      subject.id !== `${origin.file}@${origin.offset}:${origin.length}` ||
      origin.offset + origin.length > size ||
      (nameLength > 0 &&
        (origin.nameOffset === undefined ||
          origin.nameOffset < origin.offset ||
          origin.nameOffset + nameLength > origin.offset + origin.length))
    )
      throw new Error(
        'Exploration source correspondence is outside the applied project.',
      );
  }
  if (result.artifact) {
    validateStructure(result.artifact);
    if (
      result.artifact.kind !== request.representation ||
      result.status !== 'complete' ||
      result.renderStatus !== 'available'
    )
      throw new Error('Exploration returned an incompatible artifact.');
    const nodes = new Set(result.artifact.nodes.map((node) => node.id));
    const symbols = new Set<string>();
    const correspondence = new Map(
      result.correspondence.map((item) => [item.symbol, item]),
    );
    if (
      nodes.size !== result.artifact.nodes.length ||
      correspondence.size !== result.correspondence.length
    )
      throw new Error('Exploration has duplicate identities.');
    for (const node of result.artifact.nodes) {
      for (const id of [
        node.id,
        ...(node.ports ?? []).map((port) => port.id),
      ]) {
        if (
          !id ||
          symbols.has(id) ||
          !correspondence.get(id)?.subject.origin ||
          !correspondence.get(id)?.subject.id
        )
          throw new Error('Exploration omitted exact source correspondence.');
        symbols.add(id);
      }
    }
    result.artifact.edges.forEach((edge, index) => {
      if (
        !nodes.has(edge.from) ||
        !nodes.has(edge.to) ||
        symbols.has(`edge:${index}`) ||
        !correspondence.get(`edge:${index}`)?.subject.origin
      )
        throw new Error('Exploration has an unresolved relationship.');
    });
  }
  return result;
}

export interface ExplorationEngine {
  explore(
    documents: readonly SourceDocument[],
    modelHash: string,
    request: ExplorationRequest,
    signal?: AbortSignal,
  ): Promise<ExplorationResult>;
}
