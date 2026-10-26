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
  const { item, compound } = data;
  return (
    <>
      <div className="structure-heading" style={{ height: headingHeight }}>
        <span className="model-node-kind">
          {item.reference ? 'ref ' : ''}
          {item.direction ? item.direction + ' ' : ''}
          {item.kind}
          {compound ? ' · contains' : ''}
        </span>
        <strong>
          {item.name}
          {item.type ? ' : ' + item.type : ''}
        </strong>
      </div>
      <div className="structure-ports">
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
              <span className="port-direction">{port.direction ?? 'port'}</span>
              {port.name}
              {port.type ? ' : ' + port.type : ''}
            </button>
          </div>
        ))}
      </div>
      <Handle
        type="target"
        id="node-target"
        position={Position.Left}
        isConnectable={false}
        className="structure-node-handle"
      />
      <Handle
        type="source"
        id="node-source"
        position={Position.Right}
        isConnectable={false}
        className="structure-node-handle"
      />
    </>
  );
}
