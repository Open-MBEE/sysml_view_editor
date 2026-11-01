import {
  EditorState,
  StateEffect,
  StateField,
  type Extension,
} from '@codemirror/state';
import {
  EditorView,
  hoverTooltip,
  keymap,
  showTooltip,
  closeHoverTooltips,
  type Tooltip,
} from '@codemirror/view';
import type { LanguageQuery, LanguageResult } from '$lib/workspace/language';
import { editorOffset, sourceOffset } from './source-text';
export interface LanguageReply {
  result: LanguageResult;
  isCurrent: () => boolean;
}
export interface AssistanceOptions {
  current: () => { view: EditorView; name: string; text: string } | undefined;
  query: (query: LanguageQuery, signal: AbortSignal) => Promise<LanguageReply>;
  navigate: (target: { file: string; from: number; to: number }) => void;
  notify: (message: string) => void;
}
const info = StateEffect.define<Tooltip | null>();
const information = StateField.define<Tooltip | null>({
  create: () => null,
  update(value, tr) {
    if (tr.docChanged || tr.selection) value = null;
    for (const effect of tr.effects) if (effect.is(info)) value = effect.value;
    return value;
  },
  provide: (field) => showTooltip.from(field),
});
function tooltip(pos: number, text: string, id?: string): Tooltip {
  return {
    pos,
    above: true,
    create() {
      const dom = document.createElement('div');
      dom.className = 'source-symbol-information';
      dom.setAttribute('role', 'tooltip');
      dom.setAttribute('aria-label', 'Symbol information');
      if (id) dom.id = id;
      dom.textContent = text;
      return { dom };
    },
  };
}
export function createSourceAssistance(options: AssistanceOptions) {
  const pending = new Map<string, AbortController>();
  function clear() {
    for (const controller of pending.values()) controller.abort();
    pending.clear();
    const current = options.current();
    if (current) {
      current.view.dispatch({
        selection: current.view.state.selection,
        effects: info.of(null),
      });
      current.view.dispatch({ effects: closeHoverTooltips });
    }
  }
  async function request(
    kind: LanguageQuery['kind'],
    pos: number,
    quiet = false,
  ) {
    const current = options.current();
    if (!current || current.view.state.readOnly) return null;
    const snapshot = { ...current };
    pending.get(kind)?.abort();
    const controller = new AbortController();
    pending.set(kind, controller);
    const valid = () => {
      const next = options.current();
      return (
        !controller.signal.aborted &&
        next?.view === snapshot.view &&
        next?.name === snapshot.name &&
        next?.text === snapshot.text
      );
    };
    try {
      const reply = await options.query(
        { kind, file: snapshot.name, offset: sourceOffset(snapshot.text, pos) },
        controller.signal,
      );
      const isCurrent = () => valid() && reply.isCurrent();
      return isCurrent() ? { ...reply, snapshot, isCurrent } : null;
    } catch (error) {
      if (!controller.signal.aborted && !quiet)
        options.notify(
          error instanceof Error ? error.message : 'Source assistance failed.',
        );
      return null;
    } finally {
      if (pending.get(kind) === controller) pending.delete(kind);
    }
  }
  async function symbolInfo() {
    const current = options.current();
    if (!current) return;
    const pos = current.view.state.selection.main.head;
    const reply = await request('hover', pos);
    if (
      !reply ||
      reply.result.kind !== 'hover' ||
      reply.snapshot.view.state.selection.main.head !== pos
    )
      return;
    reply.snapshot.view.dispatch({ effects: closeHoverTooltips });
    if (!reply.result.text) {
      options.notify('No symbol information found.');
      return;
    }
    reply.snapshot.view.dispatch({
      effects: info.of(
        tooltip(
          editorOffset(reply.snapshot.text, reply.result.from),
          reply.result.text,
          'source-symbol-info',
        ),
      ),
    });
  }
  async function definition() {
    const current = options.current();
    if (!current) return;
    const pos = current.view.state.selection.main.head;
    const reply = await request('definition', pos);
    if (
      !reply ||
      reply.result.kind !== 'definition' ||
      reply.snapshot.view.state.selection.main.head !== pos
    )
      return;
    if (reply.result.target) options.navigate(reply.result.target);
    else options.notify(reply.result.message);
  }
  const autocomplete = async (context: {
    state: EditorState;
    pos: number;
    explicit: boolean;
    aborted: boolean;
  }) => {
    if (!context.explicit) return null;
    const reply = await request('completion', context.pos);
    if (!reply || context.aborted || reply.result.kind !== 'completion')
      return null;
    const word = context.state.wordAt(context.pos);
    return {
      from: word?.from ?? context.pos,
      to: word?.to ?? context.pos,
      options: reply.result.items.map((item) => ({
        label: item.label,
        detail: item.detail,
        apply(view: EditorView) {
          if (
            !reply.isCurrent() ||
            view !== reply.snapshot.view ||
            view.state.readOnly
          ) {
            view.dispatch({ selection: view.state.selection });
            options.notify('Source changed; request completion again.');
            return;
          }
          const from = editorOffset(reply.snapshot.text, item.from),
            to = editorOffset(reply.snapshot.text, item.to);
          const insert = item.text.replace(/\r\n?/g, '\n');
          view.dispatch({
            changes: { from, to, insert },
            selection: { anchor: from + insert.length },
            userEvent: 'input.complete',
          });
        },
      })),
    };
  };
  const extensions: Extension[] = [
    information,
    EditorView.contentAttributes.of((view) =>
      view.state.field(information)
        ? { 'aria-describedby': 'source-help source-symbol-info' }
        : null,
    ),
    EditorState.languageData.of(() => [{ autocomplete }]),
    hoverTooltip(async (view, pos) => {
      if (view.state.readOnly) return null;
      const reply = await request('hover', pos, true);
      return reply && reply.result.kind === 'hover' && reply.result.text
        ? tooltip(
            editorOffset(reply.snapshot.text, reply.result.from),
            reply.result.text,
          )
        : null;
    }),
    keymap.of([
      {
        key: 'F1',
        run: () => {
          void symbolInfo();
          return true;
        },
      },
      {
        key: 'F12',
        run: () => {
          void definition();
          return true;
        },
      },
      {
        key: 'Escape',
        run: (view) => {
          if (!view.state.field(information)) return false;
          view.dispatch({ effects: info.of(null) });
          return true;
        },
      },
    ]),
  ];
  return {
    extensions,
    clear,
    dispose: () => {
      for (const c of pending.values()) c.abort();
      pending.clear();
    },
    information: symbolInfo,
    definition,
  };
}
