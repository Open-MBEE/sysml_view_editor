import type { AppliedModel, ModelSnapshot, SourceDocument } from '../project';
import type { EvaluatedView } from '../views';
import type { TransformationResult } from './evidence';
import type { ViewPresentation } from '../views';
import type { LayoutNotice } from '../views/reconciliation';
const name = Type.String({ pattern: '^[A-Za-z_]\\w*$' }),
  qualified = Type.String({ pattern: '^[A-Za-z_]\\w*(?:::[A-Za-z_]\\w*)*$' }),
  closed = { additionalProperties: false };
const endpoint = Type.Object({ usage: qualified, port: name }, closed);
export const SemanticCommandSchema = Type.Union([
  Type.Object(
    {
      kind: Type.Literal('createPart'),
      owner: qualified,
      type: qualified,
      name,
    },
    closed,
  ),
  Type.Object(
    {
      kind: Type.Literal('connectPorts'),
      owner: qualified,
      view: qualified,
      name,
      from: endpoint,
      to: endpoint,
    },
    closed,
  ),
  Type.Object(
    { kind: Type.Literal('rename'), target: qualified, name },
    closed,
  ),
  Type.Object(
    {
      kind: Type.Literal('createView'),
      owner: qualified,
      subject: qualified,
      name,
      family: Type.Union([
        Type.Literal('GeneralView'),
        Type.Literal('InterconnectionView'),
      ]),
    },
    closed,
  ),
]);
export type SemanticCommand = ReadonlyData<
  Type.Static<typeof SemanticCommandSchema>
>;
export const readSemanticCommand = validator(
  SemanticCommandSchema,
  'Invalid semantic command',
);
export interface EditProposal {
  readonly id: string;
  readonly baseRevision: number;
  readonly command: SemanticCommand;
  readonly documents: readonly SourceDocument[];
  readonly snapshot: AppliedModel;
  readonly presentations: Readonly<Record<string, ViewPresentation>>;
  readonly layoutNotices: readonly LayoutNotice[];
}
export interface SemanticEngine {
  parse(
    documents: readonly SourceDocument[],
    signal?: AbortSignal,
  ): Promise<ModelSnapshot>;
  evaluate(
    documents: readonly SourceDocument[],
    modelHash: string,
    view: string,
    signal?: AbortSignal,
  ): Promise<EvaluatedView>;
}
export interface TransformationEngine {
  propose(
    documents: readonly SourceDocument[],
    command: SemanticCommand,
    signal?: AbortSignal,
  ): Promise<TransformationResult>;
}
export function checkPostconditions(
  before: ModelSnapshot,
  after: ModelSnapshot,
  command: SemanticCommand,
): void {
  if (command.kind === 'createPart' || command.kind === 'connectPorts') {
    const id = `${command.owner}::${command.name}`;
    const created = after.elements.filter((item) => item.id === id);
    if (
      after.elements.length !== before.elements.length + 1 ||
      created.length !== 1 ||
      created[0]!.kind !==
        (command.kind === 'createPart' ? 'partUsage' : 'connectionUsage') ||
      created[0]!.ownerId !== command.owner ||
      (command.kind === 'createPart' && created[0]!.typeId !== command.type)
    )
      throw new Error(
        'The requested declaration or resolved type was not created in its owner.',
      );
    for (const old of before.elements) {
      const fresh = after.elements.find((item) => item.id === old.id);
      if (
        !fresh ||
        fresh.kind !== old.kind ||
        fresh.ownerId !== old.ownerId ||
        fresh.typeId !== old.typeId
      )
        throw new Error(
          'Creation changed an unrelated declaration or binding.',
        );
    }
    return;
  }
  if (command.kind === 'createView') {
    const id = `${command.owner}::${command.name}`;
    if (
      !after.elements.some(
        (item) =>
          item.id === id &&
          item.kind === 'viewUsage' &&
          item.ownerId === command.owner,
      )
    )
      throw new Error('The requested view was not created in its owner.');
    return;
  }
  const target = before.elements.find((item) => item.id === command.target);
  if (!target) throw new Error('Rename target is not in the applied model.');
  const split = command.target.lastIndexOf('::');
  const renamed =
    (split >= 0 ? command.target.slice(0, split + 2) : '') + command.name;
  const remap = (id: string) =>
    id === command.target || id.startsWith(command.target + '::')
      ? renamed + id.slice(command.target.length)
      : id;
  if (before.elements.length !== after.elements.length)
    throw new Error('Rename changed the declaration count.');
  for (const element of before.elements) {
    const next = after.elements.find((item) => item.id === remap(element.id));
    if (
      !next ||
      next.kind !== element.kind ||
      next.ownerId !== (element.ownerId ? remap(element.ownerId) : null) ||
      next.typeId !== (element.typeId ? remap(element.typeId) : undefined)
    )
      throw new Error('Rename changed an unexpected declaration or binding.');
  }
}
import Type from 'typebox';
import type { ReadonlyData } from '$lib/contracts/validation';
import { validator } from '$lib/contracts/validation';
