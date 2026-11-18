import { supportsDiagram } from '../diagrams/supports-diagram';
import type { ReactNode } from 'react';
import { Network, Table2, Grid3X3, FileText } from 'lucide-react';
import { Button } from '$lib/ui/primitives/button';
import type { WorkspaceState } from '$lib/workspace/createWorkspace';
import type { EvaluatedView } from '$lib/workspace/views';

export function ModelPaneHeader({
  representation,
  onRepresentation,
  state,
  view,
  exploring,
  children,
}: {
  representation: 'diagram' | 'table' | 'matrix' | 'document';
  onRepresentation: (mode: 'diagram' | 'table' | 'matrix' | 'document') => void;
  state: Pick<
    WorkspaceState,
    'busy' | 'unapplied' | 'model' | 'renderedDocument'
  >;
  view: EvaluatedView | null;
  exploring: boolean;
  children: ReactNode;
}) {
  return (
    <header
      className="model-pane-header"
      role="group"
      aria-label="Model header"
    >
      <div className="model-header-primary">
        <div
          className="model-data-tabs"
          role="group"
          aria-label="Model representation"
        >
          <strong>Model</strong>
          <span className="model-representation-label">Representation</span>
          {(
            [
              ['diagram', 'Diagram view', Network],
              ['table', 'Requirements table', Table2],
              ['matrix', 'Traceability matrix', Grid3X3],
              ...(state.renderedDocument || state.model?.documents?.length
                ? [['document', 'Document', FileText] as const]
                : []),
            ] as const
          ).map(([value, label, Icon]) => (
            <Button
              key={value}
              size="xs"
              variant={representation === value ? 'secondary' : 'ghost'}
              aria-pressed={representation === value}
              disabled={state.busy}
              onClick={() => onRepresentation(value)}
            >
              <Icon aria-hidden="true" />
              {label}
            </Button>
          ))}
        </div>
      </div>
      <p className="model-header-status">
        {state.busy
          ? state.model
            ? 'Updating model… · showing applied revision'
            : 'Updating model…'
          : !state.model
            ? 'No applied model'
            : state.unapplied
              ? 'Applied revision · draft pending'
              : 'Applied model'}
        {representation === 'diagram' &&
          exploring &&
          ' · Temporary exploration'}
        {representation === 'diagram' &&
          view &&
          !supportsDiagram(view) &&
          ' · Rendering unavailable'}
      </p>
      <div
        hidden={representation !== 'diagram'}
        inert={representation !== 'diagram'}
      >
        {children}
      </div>
      {(representation === 'table' || representation === 'matrix') && (
        <p className="model-header-scope">Project-wide requirements</p>
      )}
    </header>
  );
}
