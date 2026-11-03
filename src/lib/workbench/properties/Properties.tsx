import { CodeXml, SquarePlus, Cable, Eye, Pencil } from 'lucide-react';
import { Input } from '$lib/ui/primitives/input';
import { Button } from '$lib/ui/primitives/button';
import { useState } from 'react';
import type { ModelElement } from '$lib/workspace/project';
import type { ArtifactNode } from '$lib/workspace/views';
import type { DiagramRelationshipSelection } from './diagram-selection';
export function Properties({
  element,
  artifactNode,
  relationship,
  sourceAvailable = true,
  readOnlyDiagram = false,
  usageContext,
  disabled,
  onRename,
  onCreateView,
  onSource,
  onCreatePart,
  onConnectPorts,
}: {
  element?: ModelElement;
  artifactNode?: ArtifactNode;
  relationship?: DiagramRelationshipSelection;
  sourceAvailable?: boolean;
  readOnlyDiagram?: boolean;
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
      {relationship ? (
        <>
          <h3>Relationship declaration</h3>
          <p className="kind">
            {relationship.edge.asserted ? 'assert ' : ''}
            {relationship.edge.negated ? 'not ' : ''}
            {relationship.edge.kind}
          </p>
          <dl>
            {relationship.edge.ownership && (
              <>
                <dt>Ownership representation</dt>
                <dd>
                  {relationship.edge.ownership === 'direct'
                    ? 'Direct owned usage'
                    : 'Owned feature shown through its type'}
                </dd>
              </>
            )}
            <dt>Source</dt>
            <dd>
              {relationship.source.qualifiedName ?? relationship.source.id}
            </dd>
            <dt>Target</dt>
            <dd>
              {relationship.target.qualifiedName ?? relationship.target.id}
            </dd>
            {relationship.declaration.qualifiedName && (
              <>
                <dt>Declaration</dt>
                <dd>{relationship.declaration.qualifiedName}</dd>
              </>
            )}
          </dl>
          <p>Model declaration; no execution result is reported.</p>
          <Button
            variant="outline"
            disabled={disabled || !sourceAvailable}
            onClick={onSource}
          >
            <CodeXml aria-hidden="true" />
            Open source
          </Button>
        </>
      ) : element ? (
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
          {readOnlyDiagram && artifactNode && (
            <>
              {artifactNode.shortName && (
                <p>
                  <strong>Identifier:</strong> {artifactNode.shortName}
                </p>
              )}
              {artifactNode.exposure === 'contextual' && (
                <p>
                  Related context included by this view's engine projection.
                </p>
              )}
              {artifactNode.documentation?.length
                ? artifactNode.documentation.map((text, index) => (
                    <p key={index}>{text}</p>
                  ))
                : artifactNode.detail && <p>{artifactNode.detail}</p>}
            </>
          )}
          <Button variant="outline" disabled={disabled} onClick={onSource}>
            <CodeXml aria-hidden="true" />
            Open source
          </Button>
          {!readOnlyDiagram &&
            ['package', 'partDef', 'partUsage'].includes(element.kind) && (
              <Button
                variant="outline"
                disabled={disabled}
                onClick={onCreatePart}
              >
                <SquarePlus aria-hidden="true" />
                New part in selection
              </Button>
            )}
          {!readOnlyDiagram && element.kind === 'portUsage' && (
            <Button
              variant="outline"
              disabled={disabled}
              onClick={onConnectPorts}
            >
              <Cable aria-hidden="true" />
              Connect selected port
            </Button>
          )}
          {!readOnlyDiagram &&
            ['partDef', 'partUsage'].includes(element.kind) && (
              <RenameForm
                key={element.id}
                element={element}
                disabled={disabled}
                onRename={onRename}
              />
            )}
          {!readOnlyDiagram && (
            <Button
              variant="outline"
              disabled={disabled}
              onClick={onCreateView}
            >
              <Eye aria-hidden="true" />
              New view of selection
            </Button>
          )}
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
