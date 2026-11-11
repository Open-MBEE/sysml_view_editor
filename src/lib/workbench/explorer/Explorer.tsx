import { Button } from '$lib/ui/primitives/button';
import { Eye, FileCode2, FileText } from 'lucide-react';
import { documentEntries } from '$lib/workspace/documents';
import { ModelTree } from './ModelTree';
import type { WorkspaceState } from '$lib/workspace/createWorkspace';
import type { ModelElement } from '$lib/workspace/project';
export function Explorer({
  state,
  file,
  selected,
  selectionRequest,
  onFile,
  onView,
  onDocument,
  onSelect,
  onNewView,
}: {
  state: WorkspaceState;
  file: string;
  selected: string;
  selectionRequest: number;
  onFile: (name: string) => void;
  onView: (id: string) => void;
  onDocument: (id: string) => void;
  onSelect: (element: ModelElement) => void;
  onNewView: () => void;
}) {
  const views =
    state.model?.elements.filter((item) => item.kind === 'viewUsage') ?? [];
  const documents = documentEntries(state.model?.documents);
  return (
    <aside className="explorer" aria-label="Project navigation">
      <section>
        <h2>Files</h2>
        {state.project?.drafts.map((document) => (
          <Button
            variant="ghost"
            key={document.name}
            aria-label={document.name}
            title={document.name}
            aria-current={file === document.name ? 'page' : undefined}
            className={file === document.name ? 'active' : ''}
            onClick={() => onFile(document.name)}
          >
            <FileCode2 aria-hidden="true" />
            <span className="explorer-filename">{document.name}</span>
            {state.project?.documents.find(
              (item) => item.name === document.name,
            )?.text !== document.text && (
              <span aria-label="Unapplied draft">•</span>
            )}
          </Button>
        ))}
      </section>
      <section>
        <div className="section-heading">
          <h2>Views</h2>
          <Button
            variant="ghost"
            className="small"
            disabled={state.busy || state.unapplied || !state.model}
            onClick={onNewView}
          >
            New view
          </Button>
        </div>
        {views.map((view) => (
          <Button
            variant="ghost"
            key={view.id}
            aria-label={view.name}
            aria-current={state.view?.view === view.id ? 'page' : undefined}
            className={state.view?.view === view.id ? 'active' : ''}
            disabled={state.busy}
            title={view.id}
            onClick={() => onView(view.id)}
          >
            <Eye aria-hidden="true" />
            {view.name}
          </Button>
        ))}
        {!views.length && (
          <p>No named views. Explore the model or create a view.</p>
        )}
      </section>
      <section aria-label="Documents">
        <h2>Documents</h2>
        {documents.map((entry) => (
          <Button
            variant="ghost"
            key={entry.id}
            aria-label={entry.name}
            aria-current={
              state.renderedDocument?.document === entry.id ? 'page' : undefined
            }
            className={
              state.renderedDocument?.document === entry.id ? 'active' : ''
            }
            disabled={state.busy}
            title={entry.id}
            onClick={() => onDocument(entry.id)}
          >
            <FileText aria-hidden="true" />
            <span className="explorer-filename">{entry.name}</span>
            {entry.file && <small>{entry.file}</small>}
          </Button>
        ))}
        {!documents.length && (
          <p>
            No documents. Declare a part def specializing
            DocumentQueries::Document.
          </p>
        )}
      </section>
      <ModelTree
        key={state.project?.name}
        elements={state.model?.elements ?? []}
        selected={selected}
        selectionRequest={selectionRequest}
        onSelect={onSelect}
      />
    </aside>
  );
}
