import type { Static } from 'typebox';
import type { ReadonlyData } from '$lib/contracts/validation';
import type {
  Diagnostic,
  DocumentDefinition,
  SourceDocument,
  SourceLocation,
} from '../project';
import {
  DocumentFormSchema,
  DocumentReferenceSchema,
  DocumentContentSchema,
  DocumentDiagnosticSchema,
  RenderedDocumentSchema,
  readRenderedDocument,
} from './schema';
export { RenderedDocumentSchema, readRenderedDocument } from './schema';
export type DocumentForm = Static<typeof DocumentFormSchema>;
export type DocumentReference = ReadonlyData<
  Static<typeof DocumentReferenceSchema>
>;
export type DocumentContent = ReadonlyData<
  Static<typeof DocumentContentSchema>
>;
export type DocumentDiagnostic = ReadonlyData<
  Static<typeof DocumentDiagnosticSchema>
>;
export type RenderedDocument = ReadonlyData<
  Static<typeof RenderedDocumentSchema>
>;

/** Renders one document definition of an already parsed model revision. */
export interface DocumentEngine {
  renderDocument(
    documents: readonly SourceDocument[],
    modelHash: string,
    name: string,
    form: DocumentForm,
    signal?: AbortSignal,
  ): Promise<unknown>;
}

function withinSources(
  origin: SourceLocation | undefined,
  sizes: ReadonlyMap<string, number>,
) {
  if (!origin) return true;
  const size = sizes.get(origin.file);
  const nameLength = origin.nameLength ?? 0;
  return (
    size !== undefined &&
    origin.offset + origin.length <= size &&
    (nameLength === 0 ||
      (origin.nameOffset !== undefined &&
        origin.nameOffset >= origin.offset &&
        origin.nameOffset + nameLength <= origin.offset + origin.length))
  );
}

function sourceSizes(documents: readonly SourceDocument[]) {
  return new Map(
    documents.map((file) => [
      file.name,
      new TextEncoder().encode(file.text).length,
    ]),
  );
}

/** Accept only the requested document of the requested revision, with origins inside the applied sources. */
export function validateRenderedDocument(
  value: unknown,
  modelHash: string,
  name: string,
  form: DocumentForm,
  documents: readonly SourceDocument[],
): RenderedDocument {
  const result = readRenderedDocument(value);
  if (
    result.modelHash !== modelHash ||
    result['document'] !== name ||
    result.form !== form
  )
    throw new Error('Invalid or stale document response.');
  if (result.status === 'complete' && !result.content)
    throw new Error('Complete document rendering omitted its content.');
  if (result.status !== 'complete' && result.content)
    throw new Error('Incomplete document rendering cannot publish content.');
  if (result.status !== 'complete' && !result.diagnostics.length)
    throw new Error('Incomplete document rendering omitted its diagnostics.');
  const sizes = sourceSizes(documents);
  for (const item of [...result.references, ...result.contents])
    if (!withinSources(item.origin, sizes))
      throw new Error(
        'Document source correspondence is outside the applied project.',
      );
  return result;
}

/** Document definitions are listed by the engine with the file declaring them. */
export function validateDocumentDefinitions(
  definitions: readonly DocumentDefinition[],
  documents: readonly SourceDocument[],
) {
  const sizes = sourceSizes(documents);
  const seen = new Set<string>();
  for (const item of definitions) {
    if (seen.has(item.qualifiedName))
      throw new Error('Document definitions have duplicate identities.');
    seen.add(item.qualifiedName);
    if (!withinSources(item.origin, sizes))
      throw new Error(
        'Document declaration is outside the applied project sources.',
      );
  }
  return definitions;
}

export interface DocumentEntry {
  readonly id: string;
  readonly name: string;
  readonly file?: string;
  readonly label: string;
}

/** Explorer rows: declared documents sorted by name, then qualified name, labelled with their declaring file. */
export function documentEntries(
  definitions: readonly DocumentDefinition[] | undefined,
): DocumentEntry[] {
  const counts = new Map<string, number>();
  for (const item of definitions ?? [])
    counts.set(item.name, (counts.get(item.name) ?? 0) + 1);
  return (definitions ?? [])
    .map((item) => ({
      id: item.qualifiedName,
      name: item.name,
      file: item.origin?.file,
      label:
        (counts.get(item.name) === 1 ? item.name : item.qualifiedName) +
        (item.origin ? ` · ${item.origin.file}` : ''),
    }))
    .sort(
      (a, b) =>
        a.name.localeCompare(b.name) ||
        a.id.localeCompare(b.id) ||
        (a.file ?? '').localeCompare(b.file ?? ''),
    );
}

/** Diagnostics for the Issues surface; typed kinds stay visible in the message. */
export function documentDiagnostics(
  rendered: RenderedDocument | null | undefined,
): Diagnostic[] {
  return (rendered?.diagnostics ?? []).map((item) => ({
    severity: item.severity,
    message: `Document ${rendered!['document']}: ${item.message} (${item.stage} ${item.kind})`,
    ...(item.file ? { file: item.file } : {}),
    ...(item.line !== undefined ? { line: item.line } : {}),
  }));
}

export type DocumentClick =
  | { kind: 'element'; qualifiedName: string }
  | { kind: 'content'; path: string };
export type DocumentSourceTarget =
  | {
      target: { file: string; start: number; end: number };
      qualifiedName?: string;
    }
  | { reason: string };

/** Convert a recorded UTF-8 origin to UTF-16 editor offsets in the matching applied file. */
export function documentSourceTarget(
  click: DocumentClick,
  rendered: RenderedDocument,
  applied: readonly SourceDocument[],
  drafts: readonly SourceDocument[],
): DocumentSourceTarget {
  let origin: SourceLocation | undefined, qualifiedName: string | undefined;
  if (click.kind === 'element') {
    const reference = rendered.references.find(
      (item) => item.qualifiedName === click.qualifiedName,
    );
    if (!reference)
      return { reason: 'This reference is not part of the rendered document.' };
    origin = reference.origin;
    qualifiedName = reference.qualifiedName;
  } else {
    const content = rendered.contents.find((item) => item.path === click.path);
    if (!content)
      return { reason: 'This block is not part of the rendered document.' };
    origin = content.origin;
  }
  if (!origin)
    return {
      reason:
        'This element is declared outside the project sources (for example in a library).',
    };
  const file = applied.find((item) => item.name === origin.file);
  const draft = drafts.find((item) => item.name === origin.file);
  if (!file || !draft)
    return { reason: 'The declaring source file is not in the project.' };
  if (file.text !== draft.text)
    return {
      reason:
        'Apply or discard this file’s draft before revealing its applied source.',
    };
  const bytes = new TextEncoder().encode(file.text);
  if (origin.offset + origin.length > bytes.length)
    return { reason: 'The recorded source range is outside the file.' };
  const decoder = new TextDecoder('utf-8', { fatal: true });
  const start = decoder.decode(bytes.slice(0, origin.offset)).length;
  const end = decoder.decode(
    bytes.slice(0, origin.offset + origin.length),
  ).length;
  return {
    target: { file: file.name, start, end },
    ...(qualifiedName ? { qualifiedName } : {}),
  };
}
