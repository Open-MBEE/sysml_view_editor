import { afterEach, expect, it, vi } from 'vitest';
import type { ProjectBundle } from '$lib/workspace/persistence';
import { readRecovery, serializeRecovery } from './envelope';
import { createRecoveryManager, type RecoveryObservation } from './manager';
import { indexedDbRecoveryStorage, type RecoveryStorage } from './storage';
import {
  readRecoveryEnabled,
  writeRecoveryEnabled,
  recoveryPreferenceKey,
} from './preferences';

const project = (name: string): ProjectBundle => ({
  format: 'sysmlv2-view-project',
  version: 1,
  name,
  documents: [{ name: 'model.sysml', text: 'package Applied {}' }],
  drafts: [{ name: 'model.sysml', text: `package ${name} {` }],
  presentations: {},
});
const observation = (name: string): RecoveryObservation => ({
  project: project(name),
  activeFile: 'model.sysml',
  activeView: 'overview',
  dirty: true,
});
const rawEntry = (name: string) =>
  serializeRecovery({ ...observation(name), savedAt: 123 });
class MemoryStorage implements RecoveryStorage {
  value: string | null = null;
  writes: (string | null)[] = [];
  failure = false;
  hold: (() => Promise<void>) | null = null;
  async read() {
    return this.value;
  }
  async compareAndSwap(expected: string | null, next: string | null) {
    await this.hold?.();
    if (this.failure) throw new Error('Quota exceeded');
    if (this.value !== expected) return false;
    this.value = next;
    this.writes.push(next);
    return true;
  }
}
afterEach(() => vi.useRealTimers());

it('persists only the enabled preference with a safe default', () => {
  let value: string | null = null;
  const storage = {
    getItem: (key: string) => {
      expect(key).toBe(recoveryPreferenceKey);
      return value;
    },
    setItem: (key: string, next: string) => {
      expect(key).toBe(recoveryPreferenceKey);
      value = next;
    },
  };
  expect(readRecoveryEnabled(storage)).toBe(true);
  writeRecoveryEnabled(storage, false);
  expect(readRecoveryEnabled(storage)).toBe(false);
  writeRecoveryEnabled(storage, true);
  expect(readRecoveryEnabled(storage)).toBe(true);
});

it('retries opening IndexedDB after an unavailable-storage failure', async () => {
  const open = vi.fn(() => {
    throw new Error('Storage denied');
  });
  const storage = indexedDbRecoveryStorage({ open } as unknown as IDBFactory);
  await expect(storage.read()).rejects.toThrow('Storage denied');
  await expect(storage.read()).rejects.toThrow('Storage denied');
  expect(open).toHaveBeenCalledTimes(2);
  storage.close?.();
});

it('round trips invalid drafts, applied source and metadata without changing portable version', () => {
  const decoded = readRecovery(rawEntry('Draft'));
  expect(decoded.project).toEqual(project('Draft'));
  expect(decoded.savedAt).toBe(123);
  expect(decoded.activeFile).toBe('model.sysml');
  expect(decoded.project.version).toBe(1);
});
it.each([
  'not json',
  JSON.stringify({ format: 'sysml-view-recovery', version: 2 }),
  JSON.stringify({ ...JSON.parse(rawEntry('Draft')), project: '{}' }),
])('rejects corrupt or future envelopes: %s', (raw) => {
  expect(() => readRecovery(raw)).toThrow();
});
it('protects pending startup recovery from initial and later observations', async () => {
  const storage = new MemoryStorage();
  storage.value = rawEntry('Old');
  const manager = createRecoveryManager(storage);
  manager.observe(observation('Default'));
  await manager.start();
  manager.observe(observation('New'));
  await manager.flush();
  expect(manager.getSnapshot().pending).toBe(true);
  expect(storage.writes).toEqual([]);
  expect(readRecovery(storage.value!).project.name).toBe('Old');
  await manager.discard();
  await manager.flush();
  expect(readRecovery(storage.value!).project.name).toBe('New');
  manager.dispose();
});
it('retains malformed data and exposes an explicit discard choice', async () => {
  const storage = new MemoryStorage();
  storage.value = 'future or corrupt';
  const manager = createRecoveryManager(storage);
  await manager.start();
  manager.observe(observation('New'));
  await manager.flush();
  expect(manager.getSnapshot()).toMatchObject({
    status: 'error',
    pending: true,
    entry: null,
  });
  expect(storage.value).toBe('future or corrupt');
  await manager.discard();
  await manager.flush();
  expect(readRecovery(storage.value!).project.name).toBe('New');
  manager.dispose();
});
it('retry rechecks malformed recovery without replacing the current project', async () => {
  const storage = new MemoryStorage();
  storage.value = 'corrupt';
  const manager = createRecoveryManager(storage);
  await manager.start();
  manager.observe(observation('Mine'));
  storage.value = rawEntry('Repaired');
  await manager.retry();
  expect(manager.getSnapshot()).toMatchObject({
    pending: true,
    error: null,
    entry: { project: { name: 'Repaired' } },
  });
  expect(storage.writes).toEqual([]);
  manager.dispose();
});
it('does not replace or delete another tab snapshot and retry protects the new entry', async () => {
  const storage = new MemoryStorage();
  const manager = createRecoveryManager(storage);
  await manager.start();
  storage.value = rawEntry('Other');
  manager.observe(observation('Mine'));
  await manager.flush();
  expect(manager.getSnapshot().error).toContain('Another tab');
  expect(readRecovery(storage.value).project.name).toBe('Other');
  await manager.discard();
  expect(readRecovery(storage.value).project.name).toBe('Other');
  await manager.retry();
  expect(manager.getSnapshot()).toMatchObject({
    pending: true,
    entry: { project: { name: 'Other' } },
  });
  manager.dispose();
});
it('serializes delayed writes so the latest immutable observation wins', async () => {
  const storage = new MemoryStorage();
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  storage.hold = () => gate;
  const manager = createRecoveryManager(storage);
  await manager.start();
  manager.observe(observation('First'));
  const first = manager.flush();
  await Promise.resolve();
  await Promise.resolve();
  manager.observe(observation('Latest'));
  const latest = manager.flush();
  release();
  await first;
  await latest;
  expect(storage.writes.map((raw) => readRecovery(raw!).project.name)).toEqual([
    'First',
    'Latest',
  ]);
  manager.dispose();
});
it('debounces edits, ignores clean startup, and disabling stops scheduled writes', async () => {
  vi.useFakeTimers();
  const storage = new MemoryStorage();
  const manager = createRecoveryManager(storage);
  await manager.start();
  manager.observe({ ...observation('Clean'), dirty: false });
  await vi.advanceTimersByTimeAsync(1000);
  expect(storage.writes).toHaveLength(0);
  manager.observe(observation('First'));
  await vi.advanceTimersByTimeAsync(500);
  manager.observe(observation('Latest'));
  await vi.advanceTimersByTimeAsync(500);
  expect(storage.writes).toHaveLength(0);
  await vi.advanceTimersByTimeAsync(250);
  expect(storage.writes).toHaveLength(1);
  manager.observe(observation('Disabled'));
  manager.setEnabled(false);
  await vi.advanceTimersByTimeAsync(1000);
  expect(storage.writes).toHaveLength(1);
  manager.dispose();
});
it('retries storage failure with the latest work without mutating the project', async () => {
  const storage = new MemoryStorage();
  const manager = createRecoveryManager(storage);
  await manager.start();
  const current = observation('Draft');
  storage.failure = true;
  manager.observe(current);
  await manager.flush();
  expect(manager.getSnapshot().error).toBe('Quota exceeded');
  expect(current.project).toEqual(project('Draft'));
  expect(storage.value).toBeNull();
  storage.failure = false;
  await manager.retry();
  expect(readRecovery(storage.value!).project).toEqual(current.project);
  manager.dispose();
});
it('acceptRestored synchronously supersedes queued pre-restore work', async () => {
  const storage = new MemoryStorage();
  storage.value = rawEntry('Recovered');
  const manager = createRecoveryManager(storage);
  await manager.start();
  manager.observe(observation('OldDefault'));
  manager.acceptRestored(observation('Recovered'));
  await manager.flush();
  expect(readRecovery(storage.value!).project.name).toBe('Recovered');
  manager.dispose();
});
it('clears an owned saved draft after discard returns the project to clean', async () => {
  const storage = new MemoryStorage();
  const manager = createRecoveryManager(storage);
  await manager.start();
  manager.observe(observation('DiscardedDraft'));
  await manager.flush();
  manager.observe({ ...observation('Clean'), dirty: false });
  // Changing a tab while clean must not cancel the queued clear.
  manager.observe({
    ...observation('Clean'),
    activeView: 'other',
    dirty: false,
  });
  await manager.flush();
  expect(storage.value).toBeNull();
  expect(manager.getSnapshot()).toMatchObject({ status: 'idle', entry: null });
  manager.dispose();
});
it('orders clean-transition clearing after an older in-flight save', async () => {
  const storage = new MemoryStorage();
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  storage.hold = () => gate;
  const manager = createRecoveryManager(storage);
  await manager.start();
  manager.observe(observation('Old'));
  const first = manager.flush();
  await Promise.resolve();
  await Promise.resolve();
  manager.observe({ ...observation('Clean'), dirty: false });
  const clear = manager.flush();
  release();
  await first;
  await clear;
  expect(
    storage.writes.map((raw) => (raw ? readRecovery(raw).project.name : null)),
  ).toEqual(['Old', null]);
  manager.dispose();
});
it('never clears pending foreign recovery when the current project becomes clean', async () => {
  const storage = new MemoryStorage();
  storage.value = rawEntry('Foreign');
  const manager = createRecoveryManager(storage);
  await manager.start();
  manager.observe(observation('Mine'));
  manager.observe({ ...observation('Clean'), dirty: false });
  await manager.flush();
  expect(storage.value).toBe(rawEntry('Foreign'));
  expect(storage.writes).toEqual([]);
  manager.dispose();
});
it('clean-transition clearing uses CAS and retains another tab snapshot', async () => {
  const storage = new MemoryStorage();
  const manager = createRecoveryManager(storage);
  await manager.start();
  manager.observe(observation('Mine'));
  await manager.flush();
  storage.value = rawEntry('Other');
  manager.observe({ ...observation('Clean'), dirty: false });
  await manager.flush();
  expect(storage.value).toBe(rawEntry('Other'));
  expect(manager.getSnapshot().error).toContain('Another tab');
  manager.dispose();
});
it('a failed old write cannot requeue discarded draft work', async () => {
  const storage = new MemoryStorage();
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  storage.hold = () => gate;
  storage.failure = true;
  const manager = createRecoveryManager(storage);
  await manager.start();
  manager.observe(observation('Old'));
  const first = manager.flush();
  await Promise.resolve();
  await Promise.resolve();
  manager.observe({ ...observation('Clean'), dirty: false });
  release();
  await first;
  storage.failure = false;
  await manager.retry();
  expect(storage.value).toBeNull();
  manager.dispose();
});
