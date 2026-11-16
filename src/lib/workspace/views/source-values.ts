import type { EvaluatedView, ArtifactNode } from './index';
import type { SourceDocument, SourceLocation } from '../project';

export type SourceAttribute = NonNullable<ArtifactNode['sourceAttribute']>;

/** Verify derived display metadata against applied bytes, never draft text. */
export function validateSourceValues(
  result: EvaluatedView,
  documents: readonly SourceDocument[],
) {
  const files = new Map(
    documents.map((file) => [file.name, new TextEncoder().encode(file.text)]),
  );
  const decoder = new TextDecoder('utf-8', { fatal: true });
  function slice(origin: SourceLocation | undefined): string {
    const bytes = origin && files.get(origin.file);
    if (
      !origin ||
      !bytes ||
      origin.length <= 0 ||
      origin.offset < 0 ||
      origin.offset + origin.length > bytes.length
    )
      throw new Error('Source value origin is outside the applied project.');
    try {
      decoder.decode(bytes.slice(0, origin.offset));
      return decoder.decode(
        bytes.slice(origin.offset, origin.offset + origin.length),
      );
    } catch {
      throw new Error('Source value origin splits a UTF-8 character.');
    }
  }
  function subject(value: SourceAttribute['subject']) {
    const text = slice(value.origin);
    const origin = value.origin!;
    if (value.id !== `${origin.file}@${origin.offset}:${origin.length}`)
      throw new Error(
        'Source value declaration identity does not match its origin.',
      );
    return text;
  }
  function attribute(row: SourceAttribute, context: readonly string[]) {
    if (row.declaration !== subject(row.subject))
      throw new Error(
        'Source attribute declaration differs from applied source.',
      );
    if (
      JSON.stringify(row.context) !== JSON.stringify(context) ||
      context.at(-1) !== row.subject.id
    )
      throw new Error('Source attribute has a different usage context.');
    const value = row.value;
    if (value.status !== 'available') return;
    subject(value.provider);
    const origin = value.expressionOrigin,
      provider = value.provider.origin!;
    if (
      origin.file !== provider.file ||
      origin.offset < provider.offset ||
      origin.offset + origin.length > provider.offset + provider.length ||
      slice(origin) !== value.expression
    )
      throw new Error('Source expression differs from its applied provider.');
    if ((value.provenance === 'own') !== (value.provider.id === row.subject.id))
      throw new Error('Source expression provider provenance is inconsistent.');
  }
  for (const node of result.artifact?.nodes ?? []) {
    if (!node.sourceAttribute && !node.sourceAttributes) continue;
    const matches = result.correspondence.filter(
      (entry) => entry.symbol === node.id,
    );
    if (matches.length !== 1)
      throw new Error('Source values require unique node correspondence.');
    const reference = matches[0]!;
    if (reference.context.at(-1) !== reference.subject.id)
      throw new Error('Source values require a complete owner context.');
    subject(reference.subject);
    if (node.sourceAttribute) {
      if (node.sourceAttribute.subject.id !== reference.subject.id)
        throw new Error('Source attribute belongs to another declaration.');
      attribute(node.sourceAttribute, reference.context);
    }
    const ids = new Set<string>();
    for (const row of node.sourceAttributes ?? []) {
      if (ids.has(row.subject.id))
        throw new Error('Duplicate source attribute in a compartment.');
      ids.add(row.subject.id);
      attribute(row, [...reference.context, row.subject.id]);
    }
  }
}
