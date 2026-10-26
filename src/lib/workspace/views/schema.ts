import Type from 'typebox';
import { validator } from '$lib/contracts/validation';
import { SourceLocationSchema } from '../project/schema';
const closed = { additionalProperties: false };
export const ViewSubjectSchema = Type.Object({
  id: Type.String(),
  qualifiedName: Type.Optional(Type.String()),
  origin: Type.Optional(SourceLocationSchema),
});
export const CorrespondenceSchema = Type.Object({
  symbol: Type.String(),
  subject: ViewSubjectSchema,
  context: Type.Array(Type.String()),
});
const DirectionSchema = Type.Union([
  Type.Literal('in'),
  Type.Literal('out'),
  Type.Literal('inout'),
]);
export const ArtifactPortSchema = Type.Object({
  id: Type.String({ minLength: 1 }),
  name: Type.String(),
  type: Type.Optional(Type.String()),
  direction: Type.Optional(DirectionSchema),
});
export const ArtifactNodeSchema = Type.Object({
  id: Type.String(),
  name: Type.String(),
  kind: Type.String(),
  type: Type.Optional(Type.String()),
  parent: Type.Optional(Type.String()),
  ports: Type.Optional(Type.Array(ArtifactPortSchema)),
  reference: Type.Optional(Type.Boolean()),
  direction: Type.Optional(DirectionSchema),
  x: Type.Optional(Type.Number()),
  y: Type.Optional(Type.Number()),
});
export const ArtifactEdgeSchema = Type.Object({
  from: Type.String(),
  to: Type.String(),
  fromPort: Type.Optional(Type.String()),
  toPort: Type.Optional(Type.String()),
  route: Type.Optional(
    Type.Array(Type.Object({ x: Type.Number(), y: Type.Number() })),
  ),
  label: Type.Optional(Type.String()),
  kind: Type.String(),
});
export const EvaluatedViewSchema = Type.Object({
  schemaVersion: Type.Literal(1),
  modelHash: Type.String(),
  view: Type.String(),
  status: Type.Union([
    Type.Literal('complete'),
    Type.Literal('invalid'),
    Type.Literal('indeterminate'),
  ]),
  renderStatus: Type.Union([
    Type.Literal('available'),
    Type.Literal('unsupported'),
    Type.Literal('unavailable'),
  ]),
  diagnostics: Type.Array(Type.String()),
  correspondence: Type.Array(CorrespondenceSchema),
  artifact: Type.Optional(
    Type.Object({
      kind: Type.String(),
      nodes: Type.Array(ArtifactNodeSchema),
      edges: Type.Array(ArtifactEdgeSchema),
      notices: Type.Optional(Type.Array(Type.String())),
    }),
  ),
});
export const PointSchema = Type.Object(
  {
    x: Type.Number({ minimum: -1e7, maximum: 1e7 }),
    y: Type.Number({ minimum: -1e7, maximum: 1e7 }),
  },
  closed,
);
export const ViewPresentationSchema = Type.Object(
  {
    sourceHash: Type.String({ pattern: '^[a-f0-9]{64}$' }),
    modelHash: Type.String(),
    positions: Type.Record(Type.String(), PointSchema),
  },
  closed,
);
export const readEvaluatedView = validator(
  EvaluatedViewSchema,
  'Invalid engine view response',
);
