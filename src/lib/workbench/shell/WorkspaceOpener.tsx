import { useEffect, useRef, useState } from 'react';
import { Plus, Eye, Table2, Grid3X3, FileText } from 'lucide-react';
import { Button } from '$lib/ui/primitives/button';
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from '$lib/ui/primitives/popover';
import { documentEntries } from '$lib/workspace/documents';
import type { WorkspaceState } from '$lib/workspace/createWorkspace';
import type { WorkspaceTab } from './workspace-tabs';

/** Discover content once; opened content is navigated with workspace tabs. */
export function WorkspaceOpener({
  state,
  active,
  onOpen,
}: {
  active: boolean;
  state: Pick<WorkspaceState, 'busy' | 'model'>;
  onOpen: (tab: WorkspaceTab) => Promise<boolean>;
}) {
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const choosing = useRef(false);
  useEffect(() => {
    if (!active) setOpen(false);
  }, [active]);
  const views =
    state.model?.elements.filter((item) => item.kind === 'viewUsage') ?? [];
  const documents = documentEntries(state.model?.documents);
  async function choose(tab: WorkspaceTab) {
    choosing.current = true;
    setOpen(false);
    if (!(await onOpen(tab)))
      requestAnimationFrame(() => {
        if (trigger.current?.getClientRects().length)
          trigger.current.focus({ preventScroll: true });
      });
  }
  return (
    <Popover
      open={active && open}
      onOpenChange={(next) => {
        if (next) choosing.current = false;
        setOpen(next);
      }}
    >
      <PopoverTrigger asChild>
        <Button
          ref={trigger}
          variant="ghost"
          size="icon-xs"
          aria-label="Open workspace tab"
          title="Open workspace tab"
          disabled={state.busy || !state.model}
        >
          <Plus aria-hidden="true" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="workspace-opener"
        aria-label="Open workspace tab"
        onCloseAutoFocus={(event) => {
          // Selection transfers focus to content; Escape retains normal trigger focus.
          if (choosing.current) event.preventDefault();
        }}
      >
        <h2>Open workspace tab</h2>
        <h3>Project data</h3>
        <Button
          variant="ghost"
          onClick={() =>
            choose({ id: 'table', kind: 'table', label: 'Requirements table' })
          }
        >
          <Table2 aria-hidden="true" />
          Requirements table
        </Button>
        <Button
          variant="ghost"
          onClick={() =>
            choose({
              id: 'matrix',
              kind: 'matrix',
              label: 'Traceability matrix',
            })
          }
        >
          <Grid3X3 aria-hidden="true" />
          Traceability matrix
        </Button>
        <h3>Views</h3>
        {views.map((view) => (
          <Button
            variant="ghost"
            key={view.id}
            title={view.id}
            onClick={() =>
              choose({
                id: 'view:' + view.id,
                kind: 'view',
                target: view.id,
                label: view.name,
              })
            }
          >
            <Eye aria-hidden="true" />
            {view.name}
          </Button>
        ))}
        {!views.length && (
          <p>No named views. Use Project overview to explore.</p>
        )}
        {!!documents.length && <h3>Documents</h3>}
        {documents.map((doc) => (
          <Button
            variant="ghost"
            key={doc.id}
            title={doc.id}
            onClick={() =>
              choose({
                id: 'document:' + doc.id,
                kind: 'document',
                target: doc.id,
                label: doc.name,
              })
            }
          >
            <FileText aria-hidden="true" />
            {doc.name}
          </Button>
        ))}
      </PopoverContent>
    </Popover>
  );
}
