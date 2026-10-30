import Type from 'typebox';
import { validator, type ReadonlyData } from '$lib/contracts/validation';
import {
  SourceDocumentsSchema,
  sourceDigest,
  validateDocuments,
  type SourceDocument,
  type SourceLocation,
} from '../project';

const closed = { additionalProperties: false };
export const SpliceSchema = Type.Object(
  {
    unit: Type.String({ minLength: 1 }),
    start: Type.Integer({ minimum: 0 }),
    end: Type.Integer({ minimum: 0 }),
    text: Type.String(),
  },
  closed,
);
export const TransformationResultSchema = Type.Object(
  {
    documents: SourceDocumentsSchema,
    evidence: Type.Object(
      {
        beforeHash: Type.String({ pattern: '^[a-f0-9]{64}$' }),
        afterHash: Type.String({ pattern: '^[a-f0-9]{64}$' }),
        splices: Type.Array(SpliceSchema, { maxItems: 10000 }),
        owner: Type.Optional(
          Type.Object(
            {
              id: Type.String({ minLength: 1 }),
              unit: Type.String({ minLength: 1 }),
              start: Type.Integer({ minimum: 0 }),
              end: Type.Integer({ minimum: 0 }),
            },
            closed,
          ),
        ),
      },
      closed,
    ),
  },
  closed,
);
export type Splice = ReadonlyData<Type.Static<typeof SpliceSchema>>;
export type TransformationResult = ReadonlyData<
  Type.Static<typeof TransformationResultSchema>
>;
export const readTransformationResult = validator(
  TransformationResultSchema,
  'Invalid transformation evidence',
);
const encoder = new TextEncoder();
const decoder = new TextDecoder('utf-8', { fatal: true });

/** Validate source-bound UTF-8 edits before relying on any origin transport. */
export async function verifyTransformation(
  before: readonly SourceDocument[],
  input: unknown,
): Promise<TransformationResult> {
  const result = readTransformationResult(structuredClone(input));
  const after = validateDocuments(result.documents);
  if (
    before.length !== after.length ||
    before.some((item, i) => item.name !== after[i]?.name)
  )
    throw new Error('A semantic command changed project membership.');
  if (
    result.evidence.beforeHash !== (await sourceDigest(before)) ||
    result.evidence.afterHash !== (await sourceDigest(after))
  )
    throw new Error(
      'Transformation evidence does not match the source revision.',
    );
  for (const edit of result.evidence.splices)
    if (!before.some((source) => source.name === edit.unit))
      throw new Error('Edit evidence names an unknown source.');
  const scope = result.evidence.owner;
  if (scope) {
    const source = before.find((item) => item.name === scope.unit);
    if (
      !source ||
      scope.end <= scope.start ||
      scope.end > encoder.encode(source.text).length
    )
      throw new Error('The edit owner extent is invalid.');
  }
  for (const source of before) {
    let bytes = encoder.encode(source.text);
    let boundary = bytes.length;
    let previousStart: number | undefined;
    const edits = result.evidence.splices
      .filter((edit) => edit.unit === source.name)
      .toSorted((a, b) => b.start - a.start || b.end - a.end);
    for (const edit of edits) {
      if (edit.start === previousStart)
        throw new Error('Ambiguous edits at the same source boundary.');
      if (edit.end < edit.start || edit.end > boundary)
        throw new Error('Overlapping or out-of-bounds edit evidence.');
      // Boundaries must not split a code point, including an insertion boundary.
      decoder.decode(bytes.subarray(0, edit.start));
      decoder.decode(bytes.subarray(edit.start, edit.end));
      const replacement = encoder.encode(edit.text);
      const next = new Uint8Array(
        edit.start + replacement.length + bytes.length - edit.end,
      );
      next.set(bytes.subarray(0, edit.start));
      next.set(replacement, edit.start);
      next.set(bytes.subarray(edit.end), edit.start + replacement.length);
      bytes = next;
      boundary = edit.start;
      previousStart = edit.start;
    }
    if (
      decoder.decode(bytes) !==
      after.find((item) => item.name === source.name)!.text
    )
      throw new Error(
        'Edit evidence did not reproduce the complete candidate source.',
      );
  }
  return { ...result, documents: after };
}

/** Creation may insert a member or promote only its owner's terminal semicolon. */
export function verifyCreationEdit(
  before: readonly SourceDocument[],
  result: TransformationResult,
  ownerId: string,
): void {
  const scope = result.evidence.owner;
  if (!scope || scope.id !== ownerId || result.evidence.splices.length !== 1)
    throw new Error('Creation omitted its source owner evidence.');
  const edit = result.evidence.splices[0]!;
  if (
    edit.unit !== scope.unit ||
    edit.start < scope.start ||
    edit.end > scope.end
  )
    throw new Error('Creation changed source outside its owner.');
  if (edit.start === edit.end) return;
  const source = before.find((item) => item.name === scope.unit)!;
  const original = decoder.decode(
    encoder.encode(source.text).subarray(edit.start, edit.end),
  );
  if (
    edit.start !== scope.end - 1 ||
    edit.end !== scope.end ||
    original !== ';' ||
    !edit.text.trim().startsWith('{') ||
    !edit.text.trim().endsWith('}')
  )
    throw new Error('Creation rewrote unrelated existing source content.');
}

/** One conservative replacement range per changed file; no semantic parsing. */
export function sourceSplices(
  before: readonly SourceDocument[],
  after: readonly SourceDocument[],
): Splice[] {
  const edits: Splice[] = [];
  for (const source of before) {
    const next = after.find((item) => item.name === source.name);
    if (!next) continue;
    const old = Array.from(source.text),
      fresh = Array.from(next.text);
    let prefix = 0,
      suffix = 0;
    while (
      prefix < old.length &&
      prefix < fresh.length &&
      old[prefix] === fresh[prefix]
    )
      prefix++;
    while (
      suffix < old.length - prefix &&
      suffix < fresh.length - prefix &&
      old[old.length - suffix - 1] === fresh[fresh.length - suffix - 1]
    )
      suffix++;
    if (prefix === old.length && prefix === fresh.length) continue;
    edits.push({
      unit: source.name,
      start: encoder.encode(old.slice(0, prefix).join('')).length,
      end: encoder.encode(old.slice(0, old.length - suffix).join('')).length,
      text: fresh.slice(prefix, fresh.length - suffix).join(''),
    });
  }
  return edits;
}

/** Partial overlaps are never guessed. Enclosing declarations resize. */
export function transportSpan(
  origin: SourceLocation,
  edits: readonly Splice[],
): SourceLocation | undefined {
  let offset = origin.offset,
    length = origin.length;
  for (const edit of edits.filter((item) => item.unit === origin.file)) {
    const delta = encoder.encode(edit.text).length - (edit.end - edit.start);
    if (edit.end <= origin.offset) offset += delta;
    else if (edit.start >= origin.offset + origin.length) continue;
    else if (
      edit.start >= origin.offset &&
      edit.end <= origin.offset + origin.length
    )
      length += delta;
    else return undefined;
  }
  return { file: origin.file, offset, length };
}

export function originKey(origin: SourceLocation): string {
  return `${origin.file}@${origin.offset}:${origin.length}`;
}

/** A free-form edit may resize a body, but must leave its declaration header. */
export function unchangedHeader(
  origin: SourceLocation,
  edits: readonly Splice[],
): boolean {
  if (origin.nameOffset === undefined || !origin.nameLength)
    return !edits.some(
      (edit) =>
        edit.unit === origin.file &&
        edit.start < origin.offset + origin.length &&
        edit.end > origin.offset,
    );
  const end = origin.nameOffset + origin.nameLength;
  return !edits.some(
    (edit) =>
      (edit.unit === origin.file &&
        edit.start < end &&
        edit.end > origin.offset) ||
      (edit.unit === origin.file &&
        edit.start === edit.end &&
        edit.start >= origin.offset &&
        edit.start < end),
  );
}
