import {
  sourceAttributeLabel,
  sourceAttributeCount,
} from './source-attributes';
import { attributeLabel } from './attribute-label';
import { explorationHeaderHeight } from './exploration';
import { createContext, useContext } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import {
  headingHeight,
  portHeight,
  type StructureNode as StructureNodeType,
} from './structure';

export const SelectDiagramSymbol = createContext<(symbol: string) => void>(
  () => {},
);

export function StructureNode({ data }: NodeProps<StructureNodeType>) {
  const select = useContext(SelectDiagramSymbol);
  const { item, compound, compact, behavior, dense } = data;
  return (
    <>
      <div
        className="structure-heading"
        style={{
          height: compact ? explorationHeaderHeight - 2 : headingHeight,
        }}
      >
        <div className="structure-meta">
          <span className="model-node-kind">
            {item.reference ? 'ref ' : ''}
            {item.direction ? item.direction + ' ' : ''}
            {item.kind}
          </span>
          {compound && <span className="structure-containment">contains</span>}
        </div>
        <strong title={`${item.name}${item.type ? ' : ' + item.type : ''}`}>
          <span className="structure-name">{item.name}</span>
          {item.type && (
            <span className="structure-type">
              <span aria-hidden="true">{' : '}</span>
              <span>{item.type}</span>
            </span>
          )}
        </strong>
      </div>
      {sourceAttributeCount(item) > 0 && (
        <div className="structure-attributes" aria-label="Declared attributes">
          {item.sourceAttribute && (
            <div
              title={sourceAttributeLabel(item.sourceAttribute)}
              style={{ height: dense ? 32 : 48 }}
            >
              {sourceAttributeLabel(item.sourceAttribute)}
            </div>
          )}
          {item.sourceAttributes
            ? item.sourceAttributes.map((row) => (
                <div
                  key={row.subject.id}
                  title={
                    row.value.status === 'unsupported'
                      ? row.value.reason
                      : sourceAttributeLabel(row)
                  }
                  style={{ height: dense ? 32 : 48 }}
                >
                  {sourceAttributeLabel(row)}
                </div>
              ))
            : item.attributeDeclarations?.map((declaration, index) => (
                <div
                  key={index}
                  title={declaration}
                  style={{ height: dense ? 32 : 48 }}
                >
                  {attributeLabel(declaration)}
                </div>
              ))}
        </div>
      )}
      {!!item.detail &&
        ['state', 'action', 'start', 'done'].includes(item.kind) && (
          <div className="behavior-detail">{item.detail}</div>
        )}
      {(!compact || !!item.ports?.length) && (
        <div
          className="structure-ports"
          style={{
            height: compound
              ? undefined
              : `calc(100% - ${compact ? explorationHeaderHeight - 2 : headingHeight}px - ${sourceAttributeCount(item) * (dense ? 32 : 48)}px)`,
          }}
        >
          {item.ports?.map((port) => (
            <div
              key={port.id}
              className={'structure-port ' + (port.direction ?? 'undirected')}
              style={{ height: portHeight }}
            >
              <Handle
                type="target"
                id={port.id}
                position={
                  port.direction === 'out' ? Position.Right : Position.Left
                }
                isConnectable={false}
              />
              <Handle
                type="source"
                id={port.id}
                position={
                  port.direction === 'out' ? Position.Right : Position.Left
                }
                isConnectable={false}
              />
              <button
                type="button"
                className="nodrag nopan"
                aria-label={`${port.direction ? port.direction + ' ' : ''}port ${port.name}${port.type ? ' : ' + port.type : ''}`}
                onClick={(event) => {
                  event.stopPropagation();
                  select(port.id);
                }}
              >
                <span className="port-direction">
                  {port.direction?.toUpperCase() ?? 'PORT'}
                </span>
                <span className="port-label">
                  <span className="port-name">{port.name}</span>
                  {port.type && (
                    <>
                      <span aria-hidden="true">{' : '}</span>
                      <span className="port-type">{port.type}</span>
                    </>
                  )}
                </span>
              </button>
            </div>
          ))}
        </div>
      )}
      {compact && (
        <>
          <Handle
            type="source"
            id="exploration-source-left"
            position={Position.Left}
            isConnectable={false}
            className="structure-node-handle"
          />
          <Handle
            type="target"
            id="exploration-target-right"
            position={Position.Right}
            isConnectable={false}
            className="structure-node-handle"
          />
        </>
      )}
      <Handle
        type="target"
        id="node-target"
        position={behavior ? Position.Top : Position.Left}
        isConnectable={false}
        className="structure-node-handle"
      />
      <Handle
        type="source"
        id="node-source"
        position={behavior ? Position.Bottom : Position.Right}
        isConnectable={false}
        className="structure-node-handle"
      />
    </>
  );
}
