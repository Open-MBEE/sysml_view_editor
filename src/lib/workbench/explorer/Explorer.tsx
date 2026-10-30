import { Button } from '$lib/ui/primitives/button';
import { Eye, FileCode2, Package, Box, Cuboid, Circle } from 'lucide-react';
import type { WorkspaceState } from '$lib/workspace/createWorkspace';
import type { ModelElement } from '$lib/workspace/project';
export function Explorer({
  state,
  file,
  selected,
  onFile,
  onView,
  onSelect,
  onNewView,
}: {
  state: WorkspaceState;
  file: string;
  selected: string;
  onFile: (name: string) => void;
  onView: (id: string) => void;
  onSelect: (element: ModelElement) => void;
  onNewView: () => void;
}) {
  const views =
    state.model?.elements.filter((item) => item.kind === 'viewUsage') ?? [];
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
        {!views.length && <p>Create a view of a model element to begin.</p>}
      </section>
      <section>
        <h2>Model</h2>
        {state.model?.elements
          .filter((item) => !['viewUsage', 'viewDef'].includes(item.kind))
          .map((element) => (
            <Button
              variant="ghost"
              key={element.id}
              className={selected === element.id ? 'active' : ''}
              aria-pressed={selected === element.id}
              title={element.id}
              onClick={() => onSelect(element)}
            >
              <span className="kind-mark" aria-hidden="true">
                {element.kind === 'package' ? (
                  <Package />
                ) : element.kind === 'partDef' ? (
                  <Box />
                ) : element.kind === 'partUsage' ? (
                  <Cuboid />
                ) : (
                  <Circle />
                )}
              </span>
              <span>
                {element.name}
                <small>{element.kind}</small>
              </span>
            </Button>
          ))}
      </section>
    </aside>
  );
}
