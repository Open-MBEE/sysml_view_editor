import { describe, it, expect, vi } from 'vitest';
import { EditorState } from '@codemirror/state';
import type { EditorView } from '@codemirror/view';
import { createSourceAssistance, type LanguageReply } from './assistance';
function setup(query: (signal: AbortSignal) => Promise<LanguageReply>) {
  const dispatch = vi.fn(),
    notify = vi.fn();
  const view = {
    state: EditorState.create({ doc: 'part x : Mo;' }),
    dispatch,
  } as unknown as EditorView;
  let current = { view, name: 'a.sysml', text: 'part x : Mo;' };
  const assistance = createSourceAssistance({
    current: () => current,
    query: (_q, signal) => query(signal),
    navigate: vi.fn(),
    notify,
  });
  const state = EditorState.create({
    doc: current.text,
    extensions: assistance.extensions,
  });
  Object.assign(view, { state });
  const provider = state.languageDataAt('autocomplete', 11)[0] as (context: {
    state: EditorState;
    pos: number;
    explicit: boolean;
    aborted: boolean;
  }) => Promise<{ options: { apply(view: EditorView): void }[] } | null>;
  return {
    view,
    dispatch,
    notify,
    assistance,
    provider,
    context: { state, pos: 11, explicit: true, aborted: false },
    replace: () => {
      current = { ...current, name: 'other.sysml' };
    },
  };
}
const result = {
  kind: 'completion',
  items: [{ label: 'Motor', text: 'Motor', from: 9, to: 11 }],
} as const;
describe('source assistance snapshot lifetime', () => {
  it('refuses a completion when the full source set becomes stale after display', async () => {
    let valid = true;
    const test = setup(async () => ({ result, isCurrent: () => valid }));
    const reply = await test.provider(test.context);
    valid = false;
    reply!.options[0]!.apply(test.view);
    expect(test.dispatch).toHaveBeenCalledWith({
      selection: test.view.state.selection,
    });
    expect(test.notify).toHaveBeenCalledWith(
      'Source changed; request completion again.',
    );
  });
  it('drops late results after changing files', async () => {
    let resolve!: (reply: LanguageReply) => void;
    const test = setup(
      () =>
        new Promise((r) => {
          resolve = r;
        }),
    );
    const pending = test.provider(test.context);
    test.replace();
    resolve({ result, isCurrent: () => true });
    expect(await pending).toBeNull();
    expect(test.dispatch).not.toHaveBeenCalled();
  });
  it('aborts requests when the parent invalidates the context', async () => {
    let signal!: AbortSignal, resolve!: (reply: LanguageReply) => void;
    const test = setup((s) => {
      signal = s;
      return new Promise((r) => {
        resolve = r;
      });
    });
    const pending = test.provider(test.context);
    test.assistance.dispose();
    expect(signal.aborted).toBe(true);
    resolve({ result, isCurrent: () => true });
    expect(await pending).toBeNull();
  });
  it('keeps source content untouched on engine failure', async () => {
    const test = setup(async () => {
      throw new Error('Engine unavailable.');
    });
    expect(await test.provider(test.context)).toBeNull();
    expect(test.notify).toHaveBeenCalledWith('Engine unavailable.');
    expect(test.dispatch).not.toHaveBeenCalled();
    expect(test.view.state.doc.toString()).toBe('part x : Mo;');
  });
});
