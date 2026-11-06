import Type, { type Static } from 'typebox';
import { validator, type ReadonlyData } from '$lib/contracts/validation';
import type { SourceDocument } from '../project';
import { ViewSubjectSchema } from '../views/schema';
const closed = { additionalProperties: false };
const subject = Type.Object(ViewSubjectSchema.properties, closed);
export const RequirementsSchema = Type.Object(
  {
    schemaVersion: Type.Literal(1),
    modelHash: Type.String(),
    status: Type.Union([
      Type.Literal('complete'),
      Type.Literal('invalid'),
      Type.Literal('indeterminate'),
    ]),
    diagnostics: Type.Array(Type.String()),
    requirements: Type.Array(
      Type.Object(
        {
          subject,
          kind: Type.Union([
            Type.Literal('requirementDef'),
            Type.Literal('requirementUsage'),
          ]),
          shortName: Type.String(),
          documentation: Type.Array(Type.String()),
        },
        closed,
      ),
      { maxItems: 2000 },
    ),
    relationships: Type.Array(
      Type.Object(
        {
          kind: Type.Union([
            Type.Literal('allocation'),
            Type.Literal('satisfaction'),
            Type.Literal('verification'),
          ]),
          declaration: subject,
          source: subject,
          target: subject,
          negated: Type.Boolean(),
          asserted: Type.Boolean(),
        },
        closed,
      ),
      { maxItems: 20000 },
    ),
  },
  closed,
);
export type RequirementsResult = ReadonlyData<
  Static<typeof RequirementsSchema>
>;
export type RequirementSubject =
  RequirementsResult['requirements'][number]['subject'];
const read = validator(RequirementsSchema, 'Invalid requirements response');
export function validateRequirementsResult(
  value: unknown,
  modelHash: string,
  documents: readonly SourceDocument[],
): RequirementsResult {
  const result = read(value);
  if (result.modelHash !== modelHash)
    throw new Error('Stale requirements response.');
  if (
    result.status !== 'complete' &&
    (result.requirements.length || result.relationships.length)
  )
    throw new Error('Incomplete requirements response exposed data.');
  const sizes = new Map(
    documents.map((d) => [d.name, new TextEncoder().encode(d.text).length]),
  );
  for (const s of [
    ...result.requirements.map((r) => r.subject),
    ...result.relationships.flatMap((r) => [r.declaration, r.source, r.target]),
  ]) {
    const o = s.origin,
      size = o && sizes.get(o.file);
    if (
      !o ||
      size === undefined ||
      s.id !== `${o.file}@${o.offset}:${o.length}` ||
      o.offset + o.length > size ||
      ((o.nameLength ?? 0) > 0 &&
        (o.nameOffset === undefined ||
          o.nameOffset < o.offset ||
          o.nameOffset + o.nameLength! > o.offset + o.length))
    )
      throw new Error('Requirements source is outside the applied project.');
  }
  if (
    new Set(result.requirements.map((r) => r.subject.id)).size !==
    result.requirements.length
  )
    throw new Error('Duplicate requirement identity.');
  return result;
}
export interface RequirementsEngine {
  requirements(
    documents: readonly SourceDocument[],
    modelHash: string,
    signal?: AbortSignal,
  ): Promise<RequirementsResult>;
}
