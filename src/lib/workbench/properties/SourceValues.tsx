import type { ArtifactNode } from '$lib/workspace/views';
import type { SourceLocation } from '$lib/workspace/project';
import { Button } from '$lib/ui/primitives/button';

export function SourceValues({
  node,
  disabled,
  onSource,
}: {
  node: ArtifactNode;
  disabled: boolean;
  onSource: (origin: SourceLocation) => void;
}) {
  const rows = node.sourceAttribute
    ? [node.sourceAttribute]
    : node.sourceAttributes;
  if (!rows?.length) return null;
  return (
    <section className="source-values" aria-label="Declared source values">
      <h3>Declared source values</h3>
      <p>Expressions are shown as authored, without evaluation.</p>
      {rows.map((row) => {
        const value = row.value;
        const origin =
          value.status === 'available'
            ? value.provider.origin
            : row.subject.origin;
        return (
          <article className="source-value-card" key={row.subject.id}>
            <h4>{row.name || 'Unnamed attribute'}</h4>
            {value.status === 'available' && (
              <>
                <span className="source-value-label">
                  {value.isInitial
                    ? 'Initial expression'
                    : value.isDefault
                      ? 'Default expression'
                      : 'Authored expression'}
                </span>
                <pre>{value.expression}</pre>
              </>
            )}
            <details>
              <summary>Declaration details</summary>
              <dl>
                <dt>Declaration</dt>
                <dd>{row.subject.qualifiedName ?? row.subject.id}</dd>
                {row.type && (
                  <>
                    <dt>Type</dt>
                    <dd>{row.type}</dd>
                  </>
                )}
                {value.status === 'available' && (
                  <>
                    <dt>Value declared by</dt>
                    <dd>{value.provider.qualifiedName ?? value.provider.id}</dd>
                  </>
                )}
              </dl>
            </details>
            {value.status === 'absent' && (
              <p>
                No declared expression found. Bindings and evaluated values are
                not inferred.
              </p>
            )}
            {value.status === 'unsupported' && (
              <p>Value unavailable: {value.reason}</p>
            )}
            <Button
              variant="outline"
              disabled={disabled || !origin}
              onClick={() => origin && onSource(origin)}
            >
              {value.status === 'available'
                ? 'Open value source'
                : 'Open attribute source'}{' '}
              for {row.name || 'unnamed attribute'}
            </Button>
          </article>
        );
      })}
    </section>
  );
}
