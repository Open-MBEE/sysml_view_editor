import {
  Undo2,
  Redo2,
  Check,
  X,
  CodeXml,
  Columns2,
  Network,
} from 'lucide-react';
import { IconButton } from '$lib/ui/IconButton';
import { Button } from '$lib/ui/primitives/button';
import type { WorkspaceState } from '$lib/workspace/createWorkspace';
import { WorkbenchToolbar } from './WorkbenchPanels';
type Mode = 'code' | 'split' | 'diagram';

export function SourceToolbar({
  state,
  mode,
  onMode,
  onUndo,
  onRedo,
  onDiscard,
  onApply,
}: {
  state: Pick<WorkspaceState, 'busy' | 'unapplied' | 'canUndo' | 'canRedo'>;
  mode: Mode;
  onMode: (mode: Mode) => void;
  onUndo: () => void;
  onRedo: () => void;
  onDiscard: () => void;
  onApply: () => void;
}) {
  return (
    <WorkbenchToolbar
      history={
        <div
          className="source-history"
          role="group"
          aria-label="Source transaction history"
        >
          <IconButton
            variant="ghost"
            disabled={state.busy || state.unapplied || !state.canUndo}
            onClick={onUndo}
            label="Undo source"
            size="icon-xs"
            icon={Undo2}
          />
          <IconButton
            variant="ghost"
            disabled={state.busy || state.unapplied || !state.canRedo}
            onClick={onRedo}
            label="Redo source"
            size="icon-xs"
            icon={Redo2}
          />
        </div>
      }
      sourceActions={
        <div
          className="source-actions"
          role="group"
          aria-label="Source actions"
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
      }
      modes={
        <div className="modes" role="group" aria-label="Editor layout">
          {(['code', 'split', 'diagram'] as const).map((value) => (
            <IconButton
              key={value}
              label={value.charAt(0).toUpperCase() + value.slice(1)}
              icon={{ code: CodeXml, split: Columns2, diagram: Network }[value]}
              aria-pressed={mode === value}
              onClick={() => onMode(value)}
            />
          ))}
        </div>
      }
    />
  );
}
