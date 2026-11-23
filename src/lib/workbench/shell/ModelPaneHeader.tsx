import { supportsDiagram } from '../diagrams/supports-diagram';
import type { ReactNode } from 'react';
import type { WorkspaceState } from '$lib/workspace/createWorkspace';
import type { EvaluatedView } from '$lib/workspace/views';

export function ModelPaneHeader({
  title,
  representation,
  navigation,
  state,
  view,
  children,
  actions,
}: {
  title?: string;
  representation: 'diagram' | 'table' | 'matrix' | 'document';
  navigation?: ReactNode;
  state: Pick<
    WorkspaceState,
    'busy' | 'unapplied' | 'model' | 'renderedDocument'
  >;
  view: EvaluatedView | null;
  children: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header
      className="model-pane-header"
      role="group"
      aria-label="Model header"
    >
      <h2 className="sr-only">{title || 'Model'}</h2>
      <div className="model-header-primary">
        {navigation}
        {(!state.model ||
          state.busy ||
          state.unapplied ||
          (representation === 'diagram' && view && !supportsDiagram(view))) && (
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
              view &&
              !supportsDiagram(view) &&
              ' · Rendering unavailable'}
          </p>
        )}
        <div
          className="model-pane-context"
          hidden={representation !== 'diagram'}
          inert={representation !== 'diagram'}
        >
          {children}
        </div>
        {actions}
        {(representation === 'table' || representation === 'matrix') && (
          <p className="model-header-scope">Project-wide requirements</p>
        )}
      </div>
    </header>
  );
}
