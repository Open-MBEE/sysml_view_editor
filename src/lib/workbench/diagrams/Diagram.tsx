import { useEffect, useState } from 'react';
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  applyNodeChanges,
  useReactFlow,
  useNodesInitialized,
  useStore,
  type Node,
  type Edge,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import ELK from 'elkjs/lib/elk.bundled.js';
import { layoutStructure, absolutePositions } from './structure';
import { StructureNode, SelectDiagramSymbol } from './StructureNode';
const nodeTypes = { structure: StructureNode };
function FitAvailableSpace({ padding }: { padding: number }) {
  const width = useStore((state) => state.width);
  const height = useStore((state) => state.height);
  const initialized = useNodesInitialized();
  const { fitView } = useReactFlow();
  useEffect(() => {
    if (initialized && width > 0 && height > 0)
      void fitView({ padding, maxZoom: 1 });
  }, [initialized, width, height, padding, fitView]);
  return null;
}
import type {
  EvaluatedView,
  ViewPresentation,
  Point,
} from '$lib/workspace/views';
interface Props {
  view: EvaluatedView | null;
  presentation?: ViewPresentation;
  disabled: boolean;
  onSelect: (symbol: string) => void;
  onMove: (positions: Record<string, Point>) => void;
}
export function Diagram({
  view,
  presentation,
  disabled,
  onSelect,
  onMove,
}: Props) {
  const [nodes, setNodes] = useState<Node[]>([]),
    [edges, setEdges] = useState<Edge[]>([]),
    [arranging, setArranging] = useState(false),
    [failure, setFailure] = useState(''),
    [layoutNotice, setLayoutNotice] = useState('');
  const supported =
    view?.status === 'complete' &&
    view.renderStatus === 'available' &&
    view.artifact &&
    ['tree', 'interconnection', 'definition'].includes(view.artifact.kind);
  const [initialPresentation] = useState(presentation);
  useEffect(() => {
    const artifact = view?.artifact;
    let cancelled = false;
    if (!supported || !artifact) {
      setNodes([]);
      setEdges([]);
      return;
    }
    setArranging(true);
    setFailure('');
    setLayoutNotice('');
    if (
      artifact.nodes.some(
        (item) => item.x !== undefined || item.y !== undefined,
      ) ||
      artifact.edges.some((edge) => !!edge.route?.length)
    ) {
      setFailure(
        'This view has modeled coordinates that this renderer cannot edit.',
      );
      setArranging(false);
      return;
    }
    const stored =
      initialPresentation?.modelHash === view?.modelHash
        ? initialPresentation.positions
        : {};
    if (artifact.kind === 'interconnection') {
      void layoutStructure(artifact, stored)
        .then((result) => {
          if (cancelled) return;
          setNodes(result.nodes);
          setEdges(result.edges);
          setLayoutNotice(result.notice);
          setArranging(false);
        })
        .catch((error) => {
          if (!cancelled) {
            setFailure(String(error));
            setArranging(false);
          }
        });
      return () => {
        cancelled = true;
      };
    }
    const graph = {
      id: 'root',
      layoutOptions: {
        'elk.algorithm': 'layered',
        'elk.direction': 'DOWN',
        'elk.spacing.nodeNode': '48',
        'elk.layered.spacing.nodeNodeBetweenLayers': '65',
      },
      children: artifact.nodes.map((item) => ({
        id: item.id,
        width: 190,
        height: 65,
      })),
      edges: artifact.edges
        .filter(
          (edge) =>
            artifact.nodes.some((node) => node.id === edge.from) &&
            artifact.nodes.some((node) => node.id === edge.to),
        )
        .map((edge, index) => ({
          id: 'edge-' + index,
          sources: [edge.from],
          targets: [edge.to],
        })),
    };
    void new ELK()
      .layout(graph)
      .then((layout) => {
        if (cancelled) return;
        const next = artifact.nodes.map((item) => {
          const point =
            stored[item.id] ??
            layout.children?.find((child) => child.id === item.id);
          return {
            id: item.id,
            className:
              item.kind === 'part def'
                ? 'model-definition'
                : item.kind === 'part'
                  ? 'model-usage'
                  : item.kind === 'package'
                    ? 'model-package'
                    : undefined,
            position: { x: point?.x ?? 0, y: point?.y ?? 0 },
            data: {
              label: (
                <>
                  <span className="model-node-kind">{item.kind}</span>
                  {item.name + (item.type ? ' : ' + item.type : '')}
                </>
              ),
            },
            style: { width: 190, minHeight: 65 },
          };
        });
        setNodes(next);
        setEdges(
          artifact.edges
            .filter(
              (edge) =>
                next.some((node) => node.id === edge.from) &&
                next.some((node) => node.id === edge.to),
            )
            .map((edge, index) => ({
              id: 'edge-' + index,
              source: edge.from,
              target: edge.to,
              label: edge.label ?? edge.kind,
              type: 'smoothstep',
            })),
        );
        setArranging(false);
      })
      .catch((error) => {
        if (!cancelled) {
          setFailure(String(error));
          setArranging(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [view, supported, initialPresentation]);
  return (
    <section className="diagram-pane" aria-label="Diagram">
      <header className="pane-heading">
        <strong>{view?.view.split('::').at(-1) ?? 'Views'}</strong>
        <span>
          {disabled
            ? 'Applied revision · draft pending'
            : view
              ? 'Applied model'
              : 'Choose a named view'}
        </span>
      </header>
      {!view ? (
        <div className="empty">
          <h2>One model. Focused views.</h2>
          <p>
            Open a named view from the sidebar, or select a model element and
            create one.
          </p>
        </div>
      ) : failure ? (
        <div className="empty" role="alert">
          {failure}
        </div>
      ) : !supported ? (
        <div className="empty">
          <h2>Rendering unavailable</h2>
          <p>
            {view.diagnostics.join(' ') ||
              `The ${view.artifact?.kind ?? 'selected'} representation has no renderer in this foundation.`}
          </p>
        </div>
      ) : arranging ? (
        <div className="empty" role="status">
          Arranging view…
        </div>
      ) : !nodes.length ? (
        <div className="empty">This view exposes no renderable elements.</div>
      ) : (
        <div className="canvas">
          <ReactFlowProvider>
            <SelectDiagramSymbol.Provider value={onSelect}>
              <ReactFlow
                nodes={nodes}
                edges={edges}
                nodeTypes={nodeTypes}
                onNodesChange={(changes) =>
                  setNodes((current) => applyNodeChanges(changes, current))
                }
                fitView
                fitViewOptions={{ padding: 0.2, maxZoom: 1 }}
                nodesConnectable={false}
                nodesDraggable={!disabled}
                deleteKeyCode={null}
                onNodeClick={(_event, node) => onSelect(node.id)}
                onNodeDragStop={(_event, node) =>
                  onMove(
                    absolutePositions(
                      nodes.map((current) =>
                        current.id === node.id ? node : current,
                      ),
                    ),
                  )
                }
              >
                <FitAvailableSpace
                  padding={
                    view?.artifact?.kind === 'interconnection' ? 0.1 : 0.2
                  }
                />
                <Background />
                <Controls />
              </ReactFlow>
            </SelectDiagramSymbol.Provider>
          </ReactFlowProvider>
        </div>
      )}
      {!!view?.artifact?.notices?.length && (
        <p className="notices">{view.artifact.notices.join(' · ')}</p>
      )}
      {layoutNotice && (
        <p className="notices" role="status">
          {layoutNotice}
        </p>
      )}
    </section>
  );
}
