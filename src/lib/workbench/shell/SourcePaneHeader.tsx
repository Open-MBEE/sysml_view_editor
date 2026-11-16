import type { ReactNode } from 'react';
import { Undo2, Redo2, Check, X, FileCode2 } from 'lucide-react';
import { IconButton } from '$lib/ui/IconButton';
import { Button } from '$lib/ui/primitives/button';
import type { WorkspaceState } from '$lib/workspace/createWorkspace';

export function SourcePaneHeader({
  fileName,
  fileUnapplied,
  tools,
  state,
  onUndo,
  onRedo,
  onDiscard,
  onApply,
}: {
  fileName: string;
  fileUnapplied: boolean;
  tools: ReactNode;
  state: Pick<WorkspaceState, 'busy' | 'unapplied' | 'canUndo' | 'canRedo'>;
  onUndo: () => void;
  onRedo: () => void;
  onDiscard: () => void;
  onApply: () => void;
}) {
  return (
    <header className="source-pane-header">
      <div className="source-pane-identity">
        <div className="source-file">
          <FileCode2 aria-hidden="true" />
          <strong title={fileName}>{fileName}</strong>
          {fileUnapplied && (
            <span
              className="source-file-draft"
              aria-label={`Unapplied draft in ${fileName}`}
            >
              Draft
            </span>
          )}
        </div>
        {tools}
      </div>
      <div className="source-command-grid">
        <div
          className="source-history"
          role="group"
          aria-label="Source transaction history"
        >
          <IconButton
            variant="ghost"
            size="icon-xs"
            label="Undo source"
            icon={Undo2}
            disabled={state.busy || state.unapplied || !state.canUndo}
            onClick={onUndo}
          />
          <IconButton
            variant="ghost"
            size="icon-xs"
            label="Redo source"
            icon={Redo2}
            disabled={state.busy || state.unapplied || !state.canRedo}
            onClick={onRedo}
          />
        </div>
        <div
          className="source-actions"
          role="group"
          aria-label="Source actions"
          title="Apply and discard affect all project source drafts"
        >
          <span className={state.unapplied ? 'pending' : ''}>
            {state.busy
              ? 'Working…'
              : state.unapplied
                ? 'Draft not applied'
                : 'Source applied'}
          </span>
          <Button
            variant="ghost"
            size="xs"
            aria-label="Discard draft"
            disabled={state.busy || !state.unapplied}
            onClick={onDiscard}
          >
            <X aria-hidden="true" />
            Discard
          </Button>
          <Button
            variant="outline"
            size="xs"
            disabled={state.busy || !state.unapplied}
            onClick={onApply}
          >
            <Check aria-hidden="true" />
            Apply source
          </Button>
        </div>
        <span className="source-action-balance" aria-hidden="true" />
      </div>
    </header>
  );
}
