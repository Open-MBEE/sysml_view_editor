import { useEffect, useRef, useState } from 'react';
import { HardDriveDownload } from 'lucide-react';
import type { WorkspaceState } from '$lib/workspace/createWorkspace';
import { Button } from '$lib/ui/primitives/button';
import { Dialog } from '$lib/ui/Dialog';
import {
  createRecoveryManager,
  type RecoveryManager,
  type RecoveryObservation,
  type RecoveryState,
} from './manager';
import { indexedDbRecoveryStorage } from './storage';
import { readRecoveryEnabled, writeRecoveryEnabled } from './preferences';
import type { RecoveryEntry } from './envelope';

const initialState: RecoveryState = {
  status: 'loading',
  enabled: true,
  pending: false,
  entry: null,
  error: null,
};

export function useLocalRecovery({
  state,
  activeFile,
  activeView,
}: {
  state: WorkspaceState;
  activeFile: string | null;
  activeView: string | null;
}) {
  const manager = useRef<RecoveryManager | null>(null);
  const latest = useRef({ state, activeFile, activeView });
  latest.current = { state, activeFile, activeView };
  const [recoveryState, setRecoveryState] = useState(initialState);
  const [preferenceError, setPreferenceError] = useState('');
  const [actionError, setActionError] = useState('');
  const [acting, setActing] = useState(false);
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    const local = createRecoveryManager(indexedDbRecoveryStorage());
    manager.current = local;
    const unsubscribe = local.subscribe(() =>
      setRecoveryState(local.getSnapshot()),
    );
    try {
      local.setEnabled(readRecoveryEnabled(window.localStorage));
    } catch {
      setPreferenceError(
        'The recovery preference cannot be read. Changes apply for this visit.',
      );
    }
    const current = latest.current;
    if (current.state.project)
      local.observe({
        project: current.state.project,
        activeFile: current.activeFile,
        activeView: current.activeView,
        dirty: current.state.dirty || current.state.unapplied,
      });
    void local.start();
    return () => {
      mounted.current = false;
      manager.current = null;
      unsubscribe();
      local.dispose();
    };
  }, []);
  useEffect(() => {
    if (state.project && !state.busy)
      manager.current?.observe({
        project: state.project,
        activeFile,
        activeView,
        dirty: state.dirty || state.unapplied,
      });
  }, [
    state.project,
    state.dirty,
    state.unapplied,
    state.busy,
    activeFile,
    activeView,
  ]);

  return {
    state: recoveryState,
    preferenceError,
    actionError,
    acting,
    acceptRestored(observation: RecoveryObservation) {
      manager.current?.acceptRestored(observation);
    },
    setEnabled(enabled: boolean) {
      manager.current?.setEnabled(enabled);
      try {
        writeRecoveryEnabled(window.localStorage, enabled);
        setPreferenceError('');
      } catch {
        setPreferenceError(
          'The recovery preference cannot be saved. This setting applies for this visit.',
        );
      }
    },
    async run(action: () => Promise<void>) {
      setActing(true);
      setActionError('');
      try {
        await action();
      } catch (error) {
        if (mounted.current)
          setActionError(
            error instanceof Error ? error.message : 'Recovery action failed.',
          );
      } finally {
        if (mounted.current) setActing(false);
      }
    },
    async discard() {
      await manager.current?.discard();
    },
    async retry() {
      await manager.current?.retry();
    },
  };
}
export type LocalRecovery = ReturnType<typeof useLocalRecovery>;
export interface RecoveryControlsProps {
  recovery: LocalRecovery;
  /** Confirm replacement, open, then call recovery.acceptRestored synchronously before awaiting view setup. */
  onRestore: (entry: RecoveryEntry) => Promise<void>;
  busy?: boolean;
  active?: boolean;
}

function RecoveryActions({ recovery, onRestore, busy }: RecoveryControlsProps) {
  const { state } = recovery;
  const disabled =
    busy ||
    recovery.acting ||
    state.status === 'loading' ||
    state.status === 'saving';
  return (
    <div className="flex flex-wrap items-center gap-2">
      {state.pending && (
        <Button
          disabled={disabled || !state.entry}
          onClick={() => {
            const entry = state.entry;
            if (entry) void recovery.run(() => onRestore(entry));
          }}
        >
          Restore recovery
        </Button>
      )}
      {(state.pending || state.entry) && (
        <Button
          variant="outline"
          disabled={disabled}
          onClick={() => void recovery.run(recovery.discard)}
        >
          Discard recovery
        </Button>
      )}
      {state.error && (
        <Button
          variant="outline"
          disabled={disabled}
          onClick={() => void recovery.run(recovery.retry)}
        >
          Retry recovery
        </Button>
      )}
    </div>
  );
}

function RecoveryErrors({ recovery }: { recovery: LocalRecovery }) {
  const errors = [
    recovery.state.error,
    recovery.actionError,
    recovery.preferenceError,
  ].filter(Boolean);
  return errors.length ? (
    <p role="alert" className="dialog-error">
      {errors.join(' ')}
    </p>
  ) : null;
}

function recoveryStatus(state: RecoveryState): string {
  if (state.pending && !state.entry && state.error)
    return 'The saved recovery cannot be restored. It is retained until you discard it; retry to check it again. New edits are not saved locally until you choose.';
  if (state.pending)
    return 'Choose whether to restore or discard the saved recovery. New edits are protected in this session but are not saved locally until you choose.';
  if (!state.enabled)
    return 'Local recovery is off. Existing saved recovery is retained until you discard it.';
  if (state.status === 'saving') return 'Saving recovery locally…';
  if (state.status === 'saved' && state.entry)
    return (
      'Recovery saved locally at ' +
      new Date(state.entry.savedAt).toLocaleString() +
      '.'
    );
  if (state.status === 'loading') return 'Checking local recovery…';
  if (state.status === 'error')
    return 'Recovery could not be saved. Your current project is unchanged.';
  return 'Local recovery is ready. Unsaved source drafts and diagram positions are saved after edits.';
}

export function RecoveryBanner(props: RecoveryControlsProps) {
  const { recovery } = props;
  if (!recovery.state.pending && !recovery.state.error && !recovery.actionError)
    return null;
  return (
    <section
      aria-label="Saved recovery"
      className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b bg-muted/30 px-4 py-3 text-sm"
    >
      <div className="min-w-0 flex-1">
        <p className="font-medium">
          {recovery.state.entry
            ? 'Saved recovery: ' + recovery.state.entry.project.name
            : 'Local recovery needs attention'}
        </p>
        <p className="text-muted-foreground">
          {recoveryStatus(recovery.state)}
        </p>
        <RecoveryErrors recovery={recovery} />
      </div>
      <RecoveryActions {...props} />
    </section>
  );
}

export function RecoveryButton(props: RecoveryControlsProps) {
  const { recovery } = props;
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (props.active === false) setOpen(false);
  }, [props.active]);
  return (
    <>
      <Button
        variant="ghost"
        aria-label="Local recovery"
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
      >
        <HardDriveDownload aria-hidden="true" />
        <span className="button-label">Local recovery</span>
      </Button>
      <Dialog open={open} title="Local recovery" onClose={() => setOpen(false)}>
        <p className="text-sm text-muted-foreground">
          Keep one recovery copy in this browser until you replace or discard
          it. It includes applied source, unapplied drafts and diagram
          positions. Download a project file for a portable backup; browser
          storage may be cleared or unavailable.
        </p>
        <label className="recovery-preference text-sm">
          <input
            type="checkbox"
            checked={recovery.state.enabled}
            onChange={(event) => recovery.setEnabled(event.target.checked)}
          />
          Save recovery locally
        </label>
        <p role="status" className="text-sm">
          {recoveryStatus(recovery.state)}
        </p>
        <RecoveryErrors recovery={recovery} />
        <RecoveryActions {...props} />
        <div className="dialog-actions">
          <Button onClick={() => setOpen(false)}>Done</Button>
        </div>
      </Dialog>
    </>
  );
}
