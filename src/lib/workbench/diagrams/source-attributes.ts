import type { ArtifactNode } from '$lib/workspace/views';

export function sourceAttributeLabel(
  row: NonNullable<ArtifactNode['sourceAttribute']>,
) {
  const heading =
    row.name + (row.type ? ` : ${row.type.split('::').at(-1)}` : '');
  if (row.value.status === 'unsupported')
    return `${heading} · value unavailable`;
  if (row.value.status === 'absent') return heading;
  return `${heading} ${row.value.isDefault ? 'default ' : ''}${row.value.isInitial ? ':=' : '='} ${row.value.expression}`;
}
export function sourceAttributeCount(item: ArtifactNode) {
  return (
    (item.sourceAttribute ? 1 : 0) +
    (item.sourceAttributes?.length ?? item.attributeDeclarations?.length ?? 0)
  );
}

/** Bound card previews; exact declarations and every row remain in inspection. */
export function sourceAttributePreview(
  item: ArtifactNode,
  owner?: { origin?: { file: string; offset: number; length: number } },
) {
  const origin = owner?.origin;
  const own = (row: NonNullable<ArtifactNode['sourceAttribute']>) => {
    const member = row.subject.origin;
    return (
      !!origin &&
      !!member &&
      origin.file === member.file &&
      member.offset >= origin.offset &&
      member.offset + member.length <= origin.offset + origin.length
    );
  };
  return [...(item.sourceAttributes ?? [])]
    .sort((a, b) => Number(own(b)) - Number(own(a)))
    .slice(0, 2);
}
export function treeNodeHeight(item: ArtifactNode) {
  return item.sourceAttribute ? 92 : item.sourceAttributes?.length ? 128 : 65;
}
