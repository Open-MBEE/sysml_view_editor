import type { ProjectBundle } from '$lib/workspace/persistence';
import {
  readRecovery,
  serializeRecovery,
  type RecoveryEntry,
} from './envelope';
import type { RecoveryStorage } from './storage';

export interface RecoveryObservation {
  readonly project: ProjectBundle;
  readonly activeFile: string | null;
  readonly activeView: string | null;
  readonly dirty: boolean;
}
export interface RecoveryState {
  readonly status:
    'loading' | 'idle' | 'pending' | 'saving' | 'saved' | 'error';
  readonly enabled: boolean;
  /** Existing startup data requires an explicit restore/discard decision. */
  readonly pending: boolean;
  readonly entry: RecoveryEntry | null;
  readonly error: string | null;
}

/** Browser-independent coordinator. Observations must contain immutable project snapshots. */
export function createRecoveryManager(
  storage: RecoveryStorage,
  options: { delay?: number; now?: () => number } = {},
) {
  let state: RecoveryState = {
    status: 'loading',
    enabled: true,
    pending: false,
    entry: null,
    error: null,
  };
  const listeners = new Set<() => void>();
  let expected: string | null = null;
  let observation: RecoveryObservation | null = null;
  let queued: RecoveryObservation | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let initialized = false,
    disposed = false,
    conflict = false;
  let operation: Promise<void> = Promise.resolve();
  const update = (patch: Partial<RecoveryState>) => {
    if (disposed) return;
    state = { ...state, ...patch };
    listeners.forEach((listener) => listener());
  };
  const cancelTimer = () => {
    clearTimeout(timer);
    timer = undefined;
  };
  const fail = (error: unknown) =>
    update({
      status: 'error',
      error: error instanceof Error ? error.message : 'Local recovery failed.',
    });
  const enqueue = (job: () => Promise<void>) => {
    operation = operation
      .then(async () => {
        if (!disposed) await job();
      })
      .catch(fail);
    return operation;
  };
  const allowed = () =>
    initialized && state.enabled && !state.pending && !conflict && !disposed;
  const save = async () => {
    if (!allowed() || !queued) return;
    const current = queued;
    queued = null;
    const entry: RecoveryEntry = {
      project: current.project,
      activeFile: current.activeFile,
      activeView: current.activeView,
      savedAt: (options.now ?? Date.now)(),
    };
    update({ status: 'saving', error: null });
    try {
      if (!current.dirty) {
        // A saved draft must not outlive an explicit discard/undo-to-clean or
        // successful download. This job shares the write queue, so an older
        // in-flight save cannot recreate it after the clear.
        if (
          expected !== null &&
          !(await storage.compareAndSwap(expected, null))
        ) {
          conflict = true;
          throw new Error(
            'Another tab changed local recovery. Retry to inspect its saved copy before continuing.',
          );
        }
        expected = null;
        update({ status: 'idle', entry: null, error: null });
        return;
      }
      const raw = serializeRecovery(entry);
      if (!(await storage.compareAndSwap(expected, raw))) {
        conflict = true;
        throw new Error(
          'Another tab changed local recovery. Retry to inspect its saved copy before continuing.',
        );
      }
      expected = raw;
      update({ status: 'saved', entry, error: null });
    } catch (error) {
      // A newer observation supersedes this failed snapshot.
      if (
        observation &&
        (observation === current || (!current.dirty && !observation.dirty))
      )
        queued ??= observation;
      fail(error);
    }
  };
  const schedule = () => {
    cancelTimer();
    if (!allowed() || !queued) return;
    timer = setTimeout(() => {
      timer = undefined;
      void enqueue(save);
    }, options.delay ?? 750);
  };
  const load = async () => {
    cancelTimer();
    update({ status: 'loading', error: null });
    try {
      const raw = await storage.read();
      expected = raw;
      initialized = true;
      conflict = false;
      if (raw !== null) {
        // Protect even malformed/future records until an explicit discard.
        update({ pending: true, entry: null });
        const entry = readRecovery(raw);
        update({ status: 'pending', entry, error: null });
      } else {
        update({ status: 'idle', pending: false, entry: null, error: null });
        schedule();
      }
    } catch (error) {
      fail(error);
    }
  };
  return {
    getSnapshot: () => state,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    start: () => enqueue(load),
    observe(next: RecoveryObservation) {
      if (disposed) return;
      if (
        observation?.project === next.project &&
        observation.activeFile === next.activeFile &&
        observation.activeView === next.activeView &&
        observation.dirty === next.dirty
      )
        return;
      const wasDirty = observation?.dirty ?? false;
      observation = next;
      queued = next.dirty || wasDirty || queued?.dirty === false ? next : null;
      schedule();
    },
    setEnabled(enabled: boolean) {
      update({ enabled });
      if (!enabled) cancelTimer();
      else schedule();
    },
    /** Call synchronously after workspace.open succeeds, before React effects observe the restored project. */
    acceptRestored(next: RecoveryObservation) {
      cancelTimer();
      observation = next;
      queued = next.dirty ? next : null;
      update({
        pending: false,
        status: expected === null ? 'idle' : 'saved',
        error: null,
      });
      schedule();
    },
    discard() {
      cancelTimer();
      return enqueue(async () => {
        if (!initialized) return;
        if (!(await storage.compareAndSwap(expected, null))) {
          conflict = true;
          fail(
            new Error(
              'Another tab changed local recovery. Retry to inspect its saved copy before discarding.',
            ),
          );
          return;
        }
        expected = null;
        conflict = false;
        update({ pending: false, entry: null, status: 'idle', error: null });
        schedule();
      });
    },
    retry() {
      // Conflicts must re-read and protect the other tab's record. Ordinary write
      // failures retain the latest queued work and can retry without replacement.
      return enqueue(async () => {
        if (!initialized || conflict || state.pending) await load();
        else if (!state.pending) await save();
      });
    },
    flush() {
      cancelTimer();
      return enqueue(save);
    },
    whenSettled: () => operation,
    dispose() {
      disposed = true;
      cancelTimer();
      listeners.clear();
      storage.close?.();
    },
  };
}
export type RecoveryManager = ReturnType<typeof createRecoveryManager>;
