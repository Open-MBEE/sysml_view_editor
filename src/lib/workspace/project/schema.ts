import Type from 'typebox';
import { validator } from '$lib/contracts/validation';
const closed = { additionalProperties: false };
export const SourceDocumentSchema = Type.Object(
  { name: Type.String({ minLength: 1 }), text: Type.String() },
  closed,
);
export const SourceDocumentsSchema = Type.Array(SourceDocumentSchema, {
  minItems: 1,
  maxItems: 20,
});
export const DiagnosticSchema = Type.Object(
  {
    severity: Type.String(),
    message: Type.String(),
    file: Type.Optional(Type.String()),
    line: Type.Optional(Type.Integer({ minimum: 1 })),
  },
  closed,
);
export const SourceLocationSchema = Type.Object({
  file: Type.String(),
  offset: Type.Integer({ minimum: 0 }),
  length: Type.Integer({ minimum: 0 }),
  nameOffset: Type.Optional(Type.Integer({ minimum: 0 })),
  nameLength: Type.Optional(Type.Integer({ minimum: 0 })),
});
export const ModelElementSchema = Type.Object(
  {
    id: Type.String({ minLength: 1 }),
    name: Type.String(),
    kind: Type.String({ minLength: 1 }),
    ownerId: Type.Union([Type.String(), Type.Null()]),
    typeId: Type.Optional(Type.String()),
  },
  closed,
);
export const ModelSnapshotSchema = Type.Object(
  {
    modelHash: Type.String(),
    elements: Type.Array(ModelElementSchema, { maxItems: 2000 }),
    diagnostics: Type.Array(DiagnosticSchema),
  },
  closed,
);
export const readSourceDocuments = validator(
  SourceDocumentsSchema,
  'Invalid source documents',
);
export const readModelSnapshot = validator(
  ModelSnapshotSchema,
  'Invalid engine model response',
);
