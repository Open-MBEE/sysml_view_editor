import type { EvaluatedView } from '$lib/workspace/views';
import { Button } from '$lib/ui/primitives/button';

/** Relationships in this evaluated view, never inferred from display names. */
export function Relationships({
  view,
  symbol,
  onSelect,
}: {
  view: EvaluatedView | null;
  symbol?: string;
  onSelect: (symbol: string) => void;
}) {
  const node = view?.artifact?.nodes.find(
    (item) =>
      item.id === symbol || item.ports?.some((port) => port.id === symbol),
  );
  const symbols = new Set([
    symbol,
    ...(node && node.id === symbol
      ? (node.ports?.map((port) => port.id) ?? [])
      : []),
  ]);
  const edges =
    view?.artifact?.edges.filter(
      (edge) =>
        symbols.has(edge.from) ||
        symbols.has(edge.to) ||
        (!!edge.fromPort && symbols.has(edge.fromPort)) ||
        (!!edge.toPort && symbols.has(edge.toPort)),
    ) ?? [];
  function name(id: string) {
    return (
      view?.correspondence.find((item) => item.symbol === id)?.subject
        .qualifiedName ??
      view?.artifact?.nodes.find((item) => item.id === id)?.name ??
      view?.artifact?.nodes
        .flatMap((item) => item.ports ?? [])
        .find((item) => item.id === id)?.name ??
      id
    );
  }
  return (
    <section
      className="inspection-relationships"
      aria-label="Relationships in current view"
    >
      <p>
        Declared relationships shown in the current view. No execution results
        are reported.
      </p>
      {!symbol ? (
        <p>Select an element to browse its relationships.</p>
      ) : !edges.length ? (
        <p>
          No relationships for this selection are exposed in the current view.
        </p>
      ) : (
        <ul>
          {edges.map((edge, index) => (
            <li key={`${edge.from}:${edge.to}:${index}`}>
              <small>
                {edge.kind}
                {edge.label ? ` · ${edge.label}` : ''}
              </small>
              <div>
                <Button variant="ghost" onClick={() => onSelect(edge.from)}>
                  {name(edge.from)}
                </Button>
                <span aria-hidden="true">→</span>
                <Button variant="ghost" onClick={() => onSelect(edge.to)}>
                  {name(edge.to)}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
