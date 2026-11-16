import Type from 'typebox';
import { validator } from '$lib/contracts/validation';
import { SourceLocationSchema } from '../project/schema';
const closed = { additionalProperties: false };
export const ViewSubjectSchema = Type.Object({
  id: Type.String(),
  qualifiedName: Type.Optional(Type.String()),
  origin: Type.Optional(SourceLocationSchema),
});
export const SourceValueSchema = Type.Union([
  Type.Object(
    {
      status: Type.Literal('available'),
      expression: Type.String({ minLength: 1 }),
      expressionOrigin: Type.Object(
        {
          file: Type.String(),
          offset: Type.Integer({ minimum: 0 }),
          length: Type.Integer({ minimum: 1 }),
        },
        closed,
      ),
      provider: ViewSubjectSchema,
      isDefault: Type.Boolean(),
      isInitial: Type.Boolean(),
      provenance: Type.Union([Type.Literal('own'), Type.Literal('redefined')]),
    },
    closed,
  ),
  Type.Object({ status: Type.Literal('absent') }, closed),
  Type.Object(
    {
      status: Type.Literal('unsupported'),
      reason: Type.String({ minLength: 1 }),
    },
    closed,
  ),
]);
export const SourceAttributeSchema = Type.Object(
  {
    subject: ViewSubjectSchema,
    name: Type.String(),
    type: Type.Optional(Type.String()),
    context: Type.Array(Type.String()),
    declaration: Type.String(),
    value: SourceValueSchema,
  },
  closed,
);
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
  detail: Type.Optional(Type.String()),
  attributeDeclarations: Type.Optional(Type.Array(Type.String())),
  sourceAttribute: Type.Optional(SourceAttributeSchema),
  sourceAttributes: Type.Optional(Type.Array(SourceAttributeSchema)),
  shortName: Type.Optional(Type.String()),
  documentation: Type.Optional(Type.Array(Type.String())),
  exposure: Type.Optional(
    Type.Union([Type.Literal('selected'), Type.Literal('contextual')]),
  ),
  parent: Type.Optional(Type.String()),
  ports: Type.Optional(Type.Array(ArtifactPortSchema)),
  reference: Type.Optional(Type.Boolean()),
  inherited: Type.Optional(Type.Boolean()),
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
  negated: Type.Optional(Type.Boolean()),
  asserted: Type.Optional(Type.Boolean()),
  ownership: Type.Optional(
    Type.Union([Type.Literal('direct'), Type.Literal('via-type')]),
  ),
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
  selected: Type.Optional(Type.Array(ViewSubjectSchema)),
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
