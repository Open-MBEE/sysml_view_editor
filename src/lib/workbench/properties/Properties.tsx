import { CodeXml, SquarePlus, Cable, Eye, Pencil } from 'lucide-react';
import { Input } from '$lib/ui/primitives/input';
import { Button } from '$lib/ui/primitives/button';
import { useState } from 'react';
import type { ModelElement } from '$lib/workspace/project';
export function Properties({
  element,
  usageContext,
  disabled,
  onRename,
  onCreateView,
  onSource,
  onCreatePart,
  onConnectPorts,
}: {
  element?: ModelElement;
  usageContext?: readonly string[];
  disabled: boolean;
  onRename: (name: string) => void;
  onCreateView: () => void;
  onSource: () => void;
  onCreatePart: () => void;
  onConnectPorts: () => void;
}) {
  return (
    <aside className="properties" aria-label="Properties">
      <h2>Selection</h2>
      {element ? (
        <>
          <h3>{element.name}</h3>
          <p className="kind">{element.kind}</p>
          <dl>
            <dt>Identity</dt>
            <dd>{element.id}</dd>
            {!!usageContext?.length && (
              <>
                <dt>Usage context</dt>
                <dd>{usageContext.join(' › ')}</dd>
              </>
            )}
            {element.typeId && (
              <>
                <dt>Type</dt>
                <dd>{element.typeId}</dd>
              </>
            )}
          </dl>
          <Button variant="outline" disabled={disabled} onClick={onSource}>
            <CodeXml aria-hidden="true" />
            Open source
          </Button>
          {['package', 'partDef', 'partUsage'].includes(element.kind) && (
            <Button
              variant="outline"
              disabled={disabled}
              onClick={onCreatePart}
            >
              <SquarePlus aria-hidden="true" />
              New part in selection
            </Button>
          )}
          {element.kind === 'portUsage' && (
            <Button
              variant="outline"
              disabled={disabled}
              onClick={onConnectPorts}
            >
              <Cable aria-hidden="true" />
              Connect selected port
            </Button>
          )}
          {['partDef', 'partUsage'].includes(element.kind) && (
            <RenameForm
              key={element.id}
              element={element}
              disabled={disabled}
              onRename={onRename}
            />
          )}
          <Button variant="outline" disabled={disabled} onClick={onCreateView}>
            <Eye aria-hidden="true" />
            New view of selection
          </Button>
        </>
      ) : (
        <p>Select a model element or diagram symbol to inspect it.</p>
      )}
    </aside>
  );
}
function RenameForm({
  element,
  disabled,
  onRename,
}: {
  element: ModelElement;
  disabled: boolean;
  onRename: (name: string) => void;
}) {
  const [name, setName] = useState(element.name);
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        onRename(name);
      }}
    >
      <label htmlFor="rename-name">Name</label>
      <Input
        id="rename-name"
        value={name}
        onChange={(event) => setName(event.target.value)}
        disabled={disabled}
      />
      <Button
        variant="outline"
        disabled={disabled || name === element.name || !name.trim()}
      >
        <Pencil aria-hidden="true" />
        Review rename
      </Button>
      <p>Updates resolved references across project files.</p>
    </form>
  );
}
