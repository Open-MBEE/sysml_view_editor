import { useState } from 'react';
import { Input } from '$lib/ui/primitives/input';
import { Button } from '$lib/ui/primitives/button';
import {
  NativeSelect,
  NativeSelectOption,
} from '$lib/ui/primitives/native-select';
import type { ModelSnapshot, ModelElement } from '$lib/workspace/project';
import type { EvaluatedView } from '$lib/workspace/views';
import type { SemanticCommand } from '$lib/workspace/editing';
import {
  structuralPorts,
  compatiblePorts,
} from '$lib/workspace/editing/structure';

const simpleQualified = /^[A-Za-z_]\w*(?:::[A-Za-z_]\w*)*$/;
type Props = {
  model: ModelSnapshot;
  selected?: ModelElement;
  view: EvaluatedView | null;
  selectedSymbol?: string;
  busy: boolean;
  onClose: () => void;
  onReview: (command: SemanticCommand) => void;
};

function nextName(model: ModelSnapshot, owner: string, base: string) {
  let index = 1;
  while (model.elements.some((item) => item.id === `${owner}::${base}${index}`))
    index++;
  return base + index;
}

export function NewPartForm({
  model,
  selected,
  busy,
  onClose,
  onReview,
}: Props) {
  const owners = model.elements.filter(
    (item) =>
      ['package', 'partDef', 'partUsage'].includes(item.kind) &&
      simpleQualified.test(item.id),
  );
  const types = model.elements.filter(
    (item) => item.kind === 'partDef' && simpleQualified.test(item.id),
  );
  const [owner, setOwner] = useState(
    owners.find((item) => item.id === selected?.id)?.id ??
      owners.find((item) => item.kind === 'partUsage')?.id ??
      owners[0]?.id ??
      '',
  );
  const [type, setType] = useState(
    types.find((item) => item.id === selected?.typeId)?.id ??
      types[0]?.id ??
      '',
  );
  const [name, setName] = useState(() => nextName(model, owner, 'part'));
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        onReview({ kind: 'createPart', owner, type, name });
      }}
    >
      <p>
        Add a typed part to an explicit source owner. Review the source change
        before applying it.
      </p>
      <label htmlFor="part-name">Part name</label>
      <Input
        id="part-name"
        value={name}
        onChange={(event) => setName(event.target.value)}
        required
        disabled={busy}
      />
      <label htmlFor="part-owner">Owner</label>
      <NativeSelect
        id="part-owner"
        value={owner}
        onChange={(event) => setOwner(event.target.value)}
        disabled={busy}
      >
        {owners.map((item) => (
          <NativeSelectOption key={item.id} value={item.id}>
            {item.id}
          </NativeSelectOption>
        ))}
      </NativeSelect>
      <label htmlFor="part-type">Part definition</label>
      <NativeSelect
        id="part-type"
        value={type}
        onChange={(event) => setType(event.target.value)}
        disabled={busy}
      >
        {types.map((item) => (
          <NativeSelectOption key={item.id} value={item.id}>
            {item.id}
          </NativeSelectOption>
        ))}
      </NativeSelect>
      {!types.length && (
        <p>
          No supported part definition is available. Add one in source first.
        </p>
      )}
      <div className="dialog-actions">
        <Button type="button" variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button disabled={busy || !owner || !type}>Review source</Button>
      </div>
    </form>
  );
}

export function NewConnectionForm({
  model,
  view,
  selectedSymbol,
  busy,
  onClose,
  onReview,
}: Props) {
  const ports = structuralPorts(model, view);
  const encode = (port: Pick<(typeof ports)[number], 'usage' | 'port'>) =>
    `${port.usage}#${port.port}`;
  const initial = ports.find((port) => port.symbol === selectedSymbol);
  const source =
    initial && initial.direction !== 'in'
      ? initial
      : ports.find((port) => port.direction !== 'in');
  const [fromId, setFromId] = useState(source ? encode(source) : '');
  const from = ports.find((port) => encode(port) === fromId);
  const targets = from
    ? ports.filter((port) => compatiblePorts(from, port))
    : [];
  const [toId, setToId] = useState(() =>
    initial &&
    initial.direction === 'in' &&
    from &&
    compatiblePorts(from, initial)
      ? encode(initial)
      : targets[0]
        ? encode(targets[0])
        : '',
  );
  const to = targets.find((port) => encode(port) === toId) ?? targets[0];
  const owners = model.elements
    .filter(
      (item) =>
        ['package', 'partDef', 'partUsage'].includes(item.kind) &&
        simpleQualified.test(item.id) &&
        from?.usage.startsWith(item.id + '::') &&
        to?.usage.startsWith(item.id + '::'),
    )
    .toSorted((a, b) => b.id.length - a.id.length);
  const [ownerId, setOwner] = useState(owners[0]?.id ?? '');
  const owner =
    owners.find((item) => item.id === ownerId)?.id ?? owners[0]?.id ?? '';
  const [name, setName] = useState(() => nextName(model, owner, 'connection'));
  const label = (port: (typeof ports)[number]) =>
    `${port.usage}.${port.port} (${port.direction}, ${port.type})`;
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (from && to && view)
          onReview({
            kind: 'connectPorts',
            view: view.view,
            owner,
            name,
            from: { usage: from.usage, port: from.port },
            to: { usage: to.usage, port: to.port },
          });
      }}
    >
      <p>
        Connect explicitly directed ports with the same resolved type. Each
        endpoint includes its part usage.
      </p>
      <label htmlFor="connection-name">Connection name</label>
      <Input
        id="connection-name"
        value={name}
        onChange={(event) => setName(event.target.value)}
        required
        disabled={busy}
      />
      <label htmlFor="connection-from">From port</label>
      <NativeSelect
        id="connection-from"
        value={fromId}
        onChange={(event) => setFromId(event.target.value)}
        disabled={busy}
      >
        {ports
          .filter((port) => port.direction !== 'in')
          .map((port) => (
            <NativeSelectOption key={encode(port)} value={encode(port)}>
              {label(port)}
            </NativeSelectOption>
          ))}
      </NativeSelect>
      {from && (
        <p className="endpoint-summary">
          From: {from.usage}.{from.port} · {from.direction} · {from.type}
        </p>
      )}
      <label htmlFor="connection-to">To port</label>
      <NativeSelect
        id="connection-to"
        value={to ? encode(to) : ''}
        onChange={(event) => setToId(event.target.value)}
        disabled={busy}
      >
        {targets.map((port) => (
          <NativeSelectOption key={encode(port)} value={encode(port)}>
            {label(port)}
          </NativeSelectOption>
        ))}
      </NativeSelect>
      {to && (
        <p className="endpoint-summary">
          To: {to.usage}.{to.port} · {to.direction} · {to.type}
        </p>
      )}
      <label htmlFor="connection-owner">Connection owner</label>
      <NativeSelect
        id="connection-owner"
        value={owner}
        onChange={(event) => setOwner(event.target.value)}
        disabled={busy}
      >
        {owners.map((item) => (
          <NativeSelectOption key={item.id} value={item.id}>
            {item.id}
          </NativeSelectOption>
        ))}
      </NativeSelect>
      {(!from || !to) && (
        <p>
          No compatible endpoints in this view. Open a structural view with
          typed, explicitly directed ports. Conjugated directions are not
          supported for creation.
        </p>
      )}
      <div className="dialog-actions">
        <Button type="button" variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button disabled={busy || !from || !to || !owner}>Review source</Button>
      </div>
    </form>
  );
}
