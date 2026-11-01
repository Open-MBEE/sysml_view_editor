import { Type, type Static } from 'typebox';
import { validator, type ReadonlyData } from '$lib/contracts/validation';
import type { SourceDocument } from '../project';
const offset = Type.Integer({ minimum: 0 });
const range = { from: offset, to: offset };
const closed = { additionalProperties: false } as const;
export const LanguageQuerySchema = Type.Object(
  {
    kind: Type.Union([
      Type.Literal('completion'),
      Type.Literal('hover'),
      Type.Literal('definition'),
    ]),
    file: Type.String({ minLength: 1 }),
    offset,
  },
  closed,
);
const ItemSchema = Type.Object(
  {
    label: Type.String({ minLength: 1, maxLength: 1000 }),
    text: Type.String({ maxLength: 100000 }),
    ...range,
    detail: Type.Optional(Type.String({ maxLength: 10000 })),
  },
  closed,
);
export const LanguageResultSchema = Type.Union([
  Type.Object(
    {
      kind: Type.Literal('completion'),
      items: Type.Array(ItemSchema, { maxItems: 2000 }),
    },
    closed,
  ),
  Type.Object(
    {
      kind: Type.Literal('hover'),
      text: Type.String({ maxLength: 100000 }),
      ...range,
    },
    closed,
  ),
  Type.Object(
    {
      kind: Type.Literal('definition'),
      target: Type.Union([
        Type.Null(),
        Type.Object({ file: Type.String(), ...range }, closed),
      ]),
      message: Type.String(),
    },
    closed,
  ),
]);
export type LanguageQuery = ReadonlyData<Static<typeof LanguageQuerySchema>>;
export type LanguageResult = ReadonlyData<Static<typeof LanguageResultSchema>>;
export const readLanguageQuery = validator(
  LanguageQuerySchema,
  'Invalid language query',
);
export const readLanguageResult = validator(
  LanguageResultSchema,
  'Invalid language result',
);
export interface SourceLanguageEngine {
  query(
    sources: readonly SourceDocument[],
    query: LanguageQuery,
    signal?: AbortSignal,
  ): Promise<LanguageResult>;
}
