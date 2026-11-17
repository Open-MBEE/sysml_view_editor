import Type from 'typebox';
import { validator } from '$lib/contracts/validation';
import { SourceLocationSchema } from '../project/schema';
export { DocumentDefinitionSchema } from '../project/schema';
const closed = { additionalProperties: false };
export const DocumentFormSchema = Type.Union([
  Type.Literal('html'),
  Type.Literal('markdown'),
]);
export const DocumentReferenceSchema = Type.Object(
  {
    qualifiedName: Type.String({ minLength: 1 }),
    kind: Type.String(),
    origin: Type.Optional(SourceLocationSchema),
  },
  closed,
);
export const DocumentContentSchema = Type.Object(
  {
    path: Type.String({ minLength: 1 }),
    name: Type.String(),
    kind: Type.String(),
    view: Type.Optional(Type.String()),
    origin: Type.Optional(SourceLocationSchema),
  },
  closed,
);
export const DocumentDiagnosticSchema = Type.Object(
  {
    stage: Type.String({ minLength: 1 }),
    kind: Type.String({ minLength: 1 }),
    severity: Type.String({ minLength: 1 }),
    message: Type.String(),
    ['document']: Type.Optional(Type.String()),
    content: Type.Optional(Type.String()),
    query: Type.Optional(Type.String()),
    file: Type.Optional(Type.String()),
    line: Type.Optional(Type.Integer({ minimum: 1 })),
  },
  closed,
);
export const RenderedDocumentSchema = Type.Object(
  {
    schemaVersion: Type.Literal(1),
    modelHash: Type.String({ minLength: 1 }),
    ['document']: Type.String({ minLength: 1 }),
    form: DocumentFormSchema,
    status: Type.Union([Type.Literal('complete'), Type.Literal('invalid')]),
    title: Type.Optional(Type.String()),
    content: Type.String(),
    references: Type.Array(DocumentReferenceSchema),
    contents: Type.Array(DocumentContentSchema),
    diagnostics: Type.Array(DocumentDiagnosticSchema),
  },
  closed,
);
export const readRenderedDocument = validator(
  RenderedDocumentSchema,
  'Invalid engine document response',
);
