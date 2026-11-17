import { supportsDiagram } from './supports-diagram';
import { TreeLabel } from './TreeLabel';
import { treeNodeHeight } from './source-attributes';
import { useDiagramFit } from './useDiagramFit';
import { layoutExploration } from './exploration';
import { RoutedEdge } from './RoutedEdge';
import { ExplorationEdge } from './ExplorationEdge';
import type { ExplorationRequest } from '$lib/workspace/exploration';
import type { ModelElement } from '$lib/workspace/project';
import { DiagramControls } from './DiagramControls';
import { useEffect, useRef, useState } from 'react';
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  applyNodeChanges,
  applyEdgeChanges,
  useNodesInitialized,
  useStore,
  type Node,
  type Edge,
  type Rect,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import ELK from 'elkjs/lib/elk.bundled.js';
import { Button } from '$lib/ui/primitives/button';
import { layoutStructure, absolutePositions } from './structure';
import { StructureNode, SelectDiagramSymbol } from './StructureNode';
import { RequirementNode } from './RequirementNode';
import { layoutRequirements } from './requirements';
const edgeTypes = { exploration: ExplorationEdge, routed: RoutedEdge };
const nodeTypes = { structure: StructureNode, requirement: RequirementNode };
function FitAvailableSpace({
  padding,
  layoutMode,
  bounds,
  readableEntry,
}: {
  padding: number;
  layoutMode: string;
  bounds?: Rect;
  readableEntry: boolean;
}) {
  const width = useStore((state) => state.width);
  const height = useStore((state) => state.height);
  const initialized = useNodesInitialized();
  const fit = useDiagramFit(padding, bounds, readableEntry);
  const fitted = useRef(false);
  const previousMode = useRef(layoutMode);
  useEffect(() => {
    if (previousMode.current !== layoutMode) {
      previousMode.current = layoutMode;
      fitted.current = false;
    }
    if (
      fitted.current ||
      layoutMode === 'code' ||
      !initialized ||
      width <= 0 ||
      height <= 0
    )
      return;
    // Wait for the panel layout and React Flow's ResizeObserver to settle.
    // Divider movement alone never resets this flag or the user's camera.
    let secondFrame = 0;
    const firstFrame = requestAnimationFrame(() => {
      secondFrame = requestAnimationFrame(() => {
        fitted.current = true;
        void fit();
      });
    });
    return () => {
      cancelAnimationFrame(firstFrame);
      cancelAnimationFrame(secondFrame);
    };
  }, [initialized, width, height, fit, layoutMode]);
  return null;
}

import type {
  EvaluatedView,
  ViewPresentation,
  Point,
} from '$lib/workspace/views';
interface Props {
  exploration?: ExplorationRequest;
  elements?: readonly ModelElement[];
  onExplore?: (
    request: ExplorationRequest,
    focus?: 'scope' | 'representation',
  ) => void;
  view: EvaluatedView | null;
  busy: boolean;
  presentation?: ViewPresentation;
  disabled: boolean;
  onSelect: (symbol: string) => void;
  selectedSymbol?: string;
  onMove: (positions: Record<string, Point>) => void;
  layoutMode: 'code' | 'split' | 'diagram';
}
export function Diagram({
  exploration,
  elements = [],
  onExplore,
  view,
  busy,
  presentation,
  disabled,
  onSelect,
  selectedSymbol,
  onMove,
  layoutMode,
}: Props) {
  const [nodes, setNodes] = useState<Node[]>([]),
    [edges, setEdges] = useState<Edge[]>([]),
    [arranging, setArranging] = useState(false),
    [failure, setFailure] = useState(''),
    [layoutNotice, setLayoutNotice] = useState(''),
    [locked, setLocked] = useState(false);
  const [sceneBounds, setSceneBounds] = useState<Rect>();
  const explorationSubject =
    exploration?.scope.kind !== 'project'
      ? exploration?.scope.subject
      : undefined;
  const supported = supportsDiagram(view);
  const fitPadding = exploration
    ? 0.1
    : ['interconnection', 'requirement', 'action', 'state'].includes(
          view?.artifact?.kind ?? '',
        )
      ? 0.1
      : 0.2;
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
    if (exploration) {
      try {
        const result = layoutExploration(artifact);
        setNodes(result.nodes);
        setEdges(result.edges);
        setSceneBounds(result.bounds);
        setArranging(false);
      } catch (error) {
        setFailure(String(error));
        setArranging(false);
      }
      return;
    }
    const stored =
      initialPresentation?.modelHash === view?.modelHash
        ? initialPresentation.positions
        : {};
    if (
      ['interconnection', 'action', 'state'].includes(artifact.kind) ||
      artifact.kind === 'requirement'
    ) {
      const layout =
        artifact.kind === 'requirement' ? layoutRequirements : layoutStructure;
      void layout(artifact, stored)
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
        height: treeNodeHeight(item),
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
        const subjects = new Map(
          view.correspondence.map((entry) => [entry.symbol, entry.subject]),
        );
        const names = new Map(
          elements.map((element) => [element.id, element.name]),
        );
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
                <TreeLabel
                  item={item}
                  localName={names.get(
                    subjects.get(item.id)?.qualifiedName ?? '',
                  )}
                  subject={subjects.get(item.id)}
                />
              ),
            },
            style: { width: 190, minHeight: treeNodeHeight(item) },
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
    <section
      className={`diagram-pane${exploration ? ' diagram-exploration' : ''}`}
      aria-label="Diagram"
    >
      {!view ? (
        <div className="empty">
          <h2>One model. Focused views.</h2>
          <p>
            Explore the applied model, open a named view from the sidebar, or
            select a model element and create one.
          </p>
          {onExplore && (
            <Button
              disabled={busy}
              onClick={() =>
                onExplore(
                  { scope: { kind: 'project' }, representation: 'tree' },
                  'scope',
                )
              }
            >
              Explore model
            </Button>
          )}
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
                edgeTypes={edgeTypes}
                onNodesChange={(changes) => {
                  setNodes((current) => applyNodeChanges(changes, current));
                  for (const change of changes)
                    if (change.type === 'select' && change.selected)
                      onSelect(change.id);
                  if (
                    ['requirement', 'action', 'state'].includes(
                      view?.artifact?.kind ?? '',
                    ) ||
                    exploration
                  ) {
                    if (
                      !exploration &&
                      !disabled &&
                      !locked &&
                      changes.some(
                        (change) =>
                          change.type === 'position' &&
                          change.position &&
                          change.dragging === false,
                      )
                    )
                      onMove(
                        absolutePositions(applyNodeChanges(changes, nodes)),
                      );
                  }
                }}
                onEdgesChange={(changes) => {
                  setEdges((current) => applyEdgeChanges(changes, current));
                  if (
                    ['requirement', 'action', 'state'].includes(
                      view?.artifact?.kind ?? '',
                    ) ||
                    exploration
                  ) {
                    for (const change of changes)
                      if (change.type === 'select' && change.selected)
                        onSelect(change.id);
                  }
                }}
                edgesFocusable={!locked}
                onEdgeClick={(_event, edge) => {
                  if (
                    ['requirement', 'action', 'state'].includes(
                      view?.artifact?.kind ?? '',
                    ) ||
                    exploration
                  )
                    onSelect(edge.id);
                }}
                fitView
                fitViewOptions={{
                  padding:
                    exploration || view?.artifact?.kind === 'requirement'
                      ? 0.1
                      : 0.2,
                  maxZoom: 1,
                }}
                minZoom={0.1}
                nodesConnectable={false}
                nodesDraggable={!disabled && !locked && !exploration}
                elementsSelectable={!locked}
                deleteKeyCode={null}
                onNodeClick={(_event, node) => onSelect(node.id)}
                onNodeDragStop={(_event, node) => {
                  if (
                    !['requirement', 'action', 'state'].includes(
                      view?.artifact?.kind ?? '',
                    )
                  )
                    onMove(
                      absolutePositions(
                        nodes.map((current) =>
                          current.id === node.id ? node : current,
                        ),
                      ),
                    );
                }}
              >
                <FitAvailableSpace
                  readableEntry={
                    !!view?.artifact &&
                    ['tree', 'interconnection'].includes(view.artifact.kind) &&
                    !exploration
                  }
                  layoutMode={layoutMode}
                  padding={fitPadding}
                  bounds={sceneBounds}
                />
                <Background />
                <DiagramControls
                  readTarget={
                    view?.artifact?.nodes.find(
                      (node) =>
                        node.id === selectedSymbol ||
                        node.ports?.some((port) => port.id === selectedSymbol),
                    )?.id
                  }
                  locked={locked}
                  onLock={setLocked}
                  padding={fitPadding}
                  bounds={sceneBounds}
                />
              </ReactFlow>
            </SelectDiagramSymbol.Provider>
          </ReactFlowProvider>
        </div>
      )}
      {exploration?.scope.kind === 'element' &&
        exploration.representation === 'interconnection' &&
        elements.some(
          (item) => item.id === explorationSubject && item.kind === 'partUsage',
        ) && (
          <p className="notices">
            This usage projection does not automatically expand its type’s
            internal structure. Select the definition to inspect its declared
            internals.
          </p>
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
