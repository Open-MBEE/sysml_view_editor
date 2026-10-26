import type { Static } from 'typebox';
import type { ReadonlyData } from '$lib/contracts/validation';
import {
  SourceDocumentSchema,
  DiagnosticSchema,
  SourceLocationSchema,
  ModelElementSchema,
  ModelSnapshotSchema,
  readSourceDocuments,
} from './schema';
export { SourceDocumentsSchema, readModelSnapshot } from './schema';
export type SourceDocument = ReadonlyData<Static<typeof SourceDocumentSchema>>;
export type Diagnostic = ReadonlyData<Static<typeof DiagnosticSchema>>;
export type SourceLocation = ReadonlyData<Static<typeof SourceLocationSchema>>;
export type ModelElement = ReadonlyData<Static<typeof ModelElementSchema>>;
export type ModelSnapshot = ReadonlyData<Static<typeof ModelSnapshotSchema>>;
export const sourceLimits = { files: 20, bytes: 5 * 1024 * 1024 } as const;
export function validateDocuments(input: unknown): SourceDocument[] {
  const sources = readSourceDocuments(input);
  const names = new Set<string>();
  let bytes = 0;
  return sources.map((value) => {
    const { name, text } = value;
    if (
      !name.endsWith('.sysml') ||
      name.startsWith('/') ||
      name.includes('\\') ||
      /[\x00-\x1f]/.test(name) ||
      name.split('/').some((p) => !p || p === '.' || p === '..') ||
      names.has(name)
    )
      throw new Error('Use unique relative .sysml filenames.');
    names.add(name);
    bytes += new TextEncoder().encode(text).length;
    if (bytes > sourceLimits.bytes)
      throw new Error('Project sources exceed 5 MiB.');
    return Object.freeze({ name, text });
  });
}
export function sameSources(
  a: readonly SourceDocument[],
  b: readonly SourceDocument[],
): boolean {
  return (
    a.length === b.length &&
    a.every((item, i) => item.name === b[i]?.name && item.text === b[i]?.text)
  );
}

export interface AppliedModel extends ModelSnapshot {
  readonly sourceHash: string;
}
export async function sourceDigest(
  documents: readonly SourceDocument[],
): Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify(documents));
  return Array.from(
    new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)),
    (byte) => byte.toString(16).padStart(2, '0'),
  ).join('');
}
