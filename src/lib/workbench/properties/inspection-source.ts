import type { SourceDocument, SourceLocation } from '$lib/workspace/project';

/** Convert an applied UTF-8 origin only while that file's draft is unchanged. */
export function inspectionSource(
  origin: SourceLocation | undefined,
  documents: readonly SourceDocument[],
  drafts: readonly SourceDocument[],
) {
  if (!origin) return;
  const applied = documents.find((item) => item.name === origin.file);
  const draft = drafts.find((item) => item.name === origin.file);
  if (!applied || draft?.text !== applied.text) return;
  const bytes = new TextEncoder().encode(applied.text);
  if (
    !Number.isSafeInteger(origin.offset) ||
    !Number.isSafeInteger(origin.length) ||
    origin.offset < 0 ||
    origin.length < 0 ||
    origin.offset + origin.length > bytes.length
  )
    return;
  const decoder = new TextDecoder('utf-8', { fatal: true });
  try {
    return {
      file: applied.name,
      start: decoder.decode(bytes.slice(0, origin.offset)).length,
      end: decoder.decode(bytes.slice(0, origin.offset + origin.length)).length,
      focus: false,
    };
  } catch {
    return;
  }
}
