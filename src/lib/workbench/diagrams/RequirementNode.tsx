import { useContext } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { Button } from '$lib/ui/primitives/button';
import { SelectDiagramSymbol } from './StructureNode';
import type { RequirementNode as RequirementNodeType } from './requirements';

export function RequirementNode({ data }: NodeProps<RequirementNodeType>) {
  const select = useContext(SelectDiagramSymbol);
  const { item } = data;
  const documentation = item.documentation?.join('\n\n');
  const detail = documentation || item.detail;
  return (
    <>
      <Handle
        type="target"
        id="requirement-target"
        position={Position.Top}
        isConnectable={false}
      />
      <div className="requirement-heading">
        <div className="requirement-meta">
          <span className="model-node-kind">{item.kind}</span>
          {item.exposure === 'contextual' && <span>Related context</span>}
        </div>
        {item.shortName && (
          <span className="requirement-identifier" title={item.shortName}>
            {item.shortName}
          </span>
        )}
        <strong className="requirement-name" title={item.name}>
          {item.name}
        </strong>
        {item.type && (
          <span className="requirement-type" title={item.type}>
            : {item.type}
          </span>
        )}
      </div>
      <div className="requirement-body">
        {detail ? (
          <p className="requirement-detail" title={detail}>
            {detail}
          </p>
        ) : (
          <p className="requirement-detail requirement-no-detail">
            No additional details available.
          </p>
        )}
      </div>
      <Button
        type="button"
        variant="link"
        size="xs"
        className="requirement-inspect nodrag nopan"
        aria-label={`Inspect ${item.shortName ? item.shortName + ' ' : ''}${item.name}`}
        onClick={(event) => {
          event.stopPropagation();
          select(item.id);
        }}
      >
        Inspect details
      </Button>
      <Handle
        type="source"
        id="requirement-source"
        position={Position.Bottom}
        isConnectable={false}
      />
    </>
  );
}
