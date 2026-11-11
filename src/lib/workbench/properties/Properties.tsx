import { SourceValues } from './SourceValues';
import type { SourceLocation } from '$lib/workspace/project';
import { CodeXml, SquarePlus, Cable, Eye, Pencil } from 'lucide-react';
import { Input } from '$lib/ui/primitives/input';
import { Button } from '$lib/ui/primitives/button';
import { useState } from 'react';
import type { RequirementsResult } from '$lib/workspace/requirements';
import type { ModelElement } from '$lib/workspace/project';
import type { ArtifactNode } from '$lib/workspace/views';
import type { DiagramRelationshipSelection } from './diagram-selection';
export function Properties({
  element,
  artifactNode,
  requirement,
  subject,
  relationship,
  sourceAvailable = true,
  readOnlyDiagram = false,
  usageContext,
  disabled,
  onRename,
  onCreateView,
  onSource,
  onValueSource,
  onCreatePart,
  onConnectPorts,
}: {
  element?: ModelElement;
  artifactNode?: ArtifactNode;
  requirement?: RequirementsResult['requirements'][number];
  subject?: RequirementsResult['requirements'][number]['subject'];
  relationship?: DiagramRelationshipSelection;
  sourceAvailable?: boolean;
  readOnlyDiagram?: boolean;
  usageContext?: readonly string[];
  disabled: boolean;
  onRename: (name: string) => void;
  onCreateView: () => void;
  onSource: () => void;
  onValueSource: (origin: SourceLocation) => void;
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
            <div role="group" aria-label="Source endpoint">
              <dt>Source</dt>
              <dd>
                {relationship.source.qualifiedName ?? relationship.source.id}
              </dd>
            </div>
            <div role="group" aria-label="Target endpoint">
              <dt>Target</dt>
              <dd>
                {relationship.target.qualifiedName ?? relationship.target.id}
              </dd>
            </div>
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
          {!sourceAvailable && (
            <p>
              Source location unavailable for this selection, or its file has an
              unapplied draft.
            </p>
          )}
          <Button
            variant="outline"
            disabled={disabled || !sourceAvailable}
            onClick={onSource}
          >
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
      ) : subject ? (
        <>
          <h3>Declaration</h3>
          <dl>
            <dt>Identity</dt>
            <dd>{subject.qualifiedName ?? subject.id}</dd>
            {subject.origin && (
              <>
                <dt>Source file</dt>
                <dd>{subject.origin.file}</dd>
              </>
            )}
          </dl>
          <p>Applied model declaration; no execution result is reported.</p>
          {!sourceAvailable && (
            <p>
              Source location unavailable for this selection, or its file has an
              unapplied draft.
            </p>
          )}
          <Button
            variant="outline"
            disabled={disabled || !sourceAvailable}
            onClick={onSource}
          >
            <CodeXml aria-hidden="true" />
            Open source
          </Button>
        </>
      ) : (
        <p>Select a model element or diagram symbol to inspect it.</p>
      )}
      {requirement && (
        <>
          {requirement.shortName && (
            <p>
              <strong>Identifier:</strong> {requirement.shortName}
            </p>
          )}
          {requirement.documentation.map((text, index) => (
            <p key={index}>{text}</p>
          ))}
          <p>
            Applied requirement declaration; no execution result is reported.
          </p>
        </>
      )}
      {artifactNode && (
        <SourceValues
          node={artifactNode}
          disabled={disabled}
          onSource={onValueSource}
        />
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
