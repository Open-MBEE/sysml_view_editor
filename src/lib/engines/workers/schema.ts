import Type from 'typebox';
import { validator } from '$lib/contracts/validation';
import { SourceDocumentsSchema } from '$lib/workspace/project';
import { SemanticCommandSchema } from '$lib/workspace/editing';
const common = {
    protocolVersion: Type.Literal(1),
    documents: SourceDocumentsSchema,
    base: Type.String({ minLength: 1 }),
  },
  closed = { additionalProperties: false };
export const SemanticRequestSchema = Type.Union([
  Type.Object({ ...common, operation: Type.Literal('parse') }, closed),
  Type.Object(
    {
      ...common,
      operation: Type.Literal('evaluate'),
      modelHash: Type.String({ minLength: 1 }),
      view: Type.String({ minLength: 1 }),
    },
    closed,
  ),
]);
export const TransformRequestSchema = Type.Object(
  { ...common, command: SemanticCommandSchema },
  closed,
);
export const WorkerReplySchema = Type.Union([
  Type.Object({ value: Type.Unknown() }, closed),
  Type.Object({ error: Type.String() }, closed),
]);
export const readSemanticRequest = validator(
  SemanticRequestSchema,
  'Invalid semantic worker request',
);
export const readTransformRequest = validator(
  TransformRequestSchema,
  'Invalid transformation worker request',
);
export const readWorkerReply = validator(
  WorkerReplySchema,
  'Invalid worker reply',
);
