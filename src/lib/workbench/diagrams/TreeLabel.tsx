import type { ArtifactNode, EvaluatedView } from '$lib/workspace/views';
import {
  sourceAttributeLabel,
  sourceAttributePreview,
} from './source-attributes';

export function TreeLabel({
  item,
  subject,
  localName,
}: {
  item: ArtifactNode;
  subject?: EvaluatedView['correspondence'][number]['subject'];
  localName?: string;
}) {
  const attribute = item.sourceAttribute;
  const preview = attribute ? [] : sourceAttributePreview(item, subject);
  const name = item.name + (item.type ? ' : ' + item.type : '');
  const value = attribute?.value;
  return (
    <>
      <span className="model-node-kind">{item.kind}</span>
      <span
        className={attribute || preview.length ? 'tree-node-name' : undefined}
        title={name}
      >
        {preview.length
          ? (localName ?? item.name) + (item.type ? ' : ' + item.type : '')
          : name}
      </span>
      {value && (
        <span
          className="tree-node-value"
          title={
            value.status === 'available'
              ? value.expression
              : value.status === 'unsupported'
                ? value.reason
                : 'No declared expression'
          }
        >
          {value.status === 'available'
            ? `${value.isDefault ? 'default ' : ''}${value.isInitial ? ':=' : '='} ${value.expression}`
            : value.status === 'unsupported'
              ? 'Value unavailable · inspect details'
              : 'No declared expression'}
        </span>
      )}
      {preview.map((row) => (
        <span
          className="tree-attribute-preview"
          key={row.subject.id}
          title={sourceAttributeLabel(row)}
        >
          {row.name}
          {row.value.status === 'available'
            ? ` ${row.value.isDefault ? 'default ' : ''}${row.value.isInitial ? ':=' : '='} ${row.value.expression}`
            : row.value.status === 'unsupported'
              ? ' · value unavailable'
              : ' · no declared expression'}
        </span>
      ))}
      {!!preview.length && (
        <span className="tree-values-count">
          {item.sourceAttributes!.length} source attributes · inspect
        </span>
      )}
    </>
  );
}
