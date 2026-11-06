import { Button } from '$lib/ui/primitives/button';
import { useEffectEvent, useLayoutEffect, useRef, useState } from 'react';
import { basicSetup } from 'codemirror';
import { Compartment, EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import {
  HighlightStyle,
  indentUnit,
  syntaxHighlighting,
} from '@codemirror/language';
import { tags } from '@lezer/highlight';
import type { SourceDocument } from '$lib/workspace/project';
import { createSourceAssistance, type LanguageReply } from './assistance';
import type { LanguageQuery, LanguageResult } from '$lib/workspace/language';
import { sysmlLanguage } from './sysml-language';
import { applyEditorChanges, editorOffset } from './source-text';

const highlighting = HighlightStyle.define([
  { tag: tags.keyword, class: 'syntax-keyword' },
  { tag: tags.comment, class: 'syntax-comment' },
  { tag: tags.string, class: 'syntax-string' },
  { tag: tags.number, class: 'syntax-number' },
  { tag: [tags.operator, tags.bracket], class: 'syntax-punctuation' },
]);

export function SourceEditor({
  file,
  disabled = false,
  selection,
  onChange,
  onLanguage,
  onDefinition,
  onLanguageMessage,
  languageContext,
}: {
  file: SourceDocument;
  disabled?: boolean;
  selection?: { start: number; end: number; focus?: boolean };
  onChange: (value: string) => void;
  onLanguage?: (
    query: LanguageQuery,
    signal: AbortSignal,
  ) => Promise<LanguageReply>;
  onDefinition?: (target: { file: string; from: number; to: number }) => void;
  onLanguageMessage?: (message: string) => void;
  languageContext?: unknown;
}) {
  const [references, setReferences] = useState<{
    result: Extract<LanguageResult, { kind: 'references' }>;
    isCurrent: () => boolean;
  }>();
  const host = useRef<HTMLDivElement>(null);
  const editor = useRef<{
    view: EditorView;
    name: string;
    text: string;
    access: Compartment;
    disabled?: boolean;
    state: (file: SourceDocument) => EditorState;
  }>(undefined);
  const edited = useEffectEvent(onChange);
  const query = useEffectEvent(
    async (request: LanguageQuery, signal: AbortSignal) => {
      if (!onLanguage) throw new Error('Source assistance is unavailable.');
      return onLanguage(request, signal);
    },
  );
  const navigate = useEffectEvent(
    (target: { file: string; from: number; to: number }) =>
      onDefinition?.(target),
  );
  const notify = useEffectEvent((message: string) =>
    onLanguageMessage?.(message),
  );
  const assistance =
    useRef<ReturnType<typeof createSourceAssistance>>(undefined);
  useLayoutEffect(() => {
    const access = new Compartment();
    const language = createSourceAssistance({
      current: () => editor.current,
      query,
      navigate,
      notify,
      references: (result, isCurrent) => setReferences({ result, isCurrent }),
    });
    assistance.current = language;
    const state = (document: SourceDocument) =>
      EditorState.create({
        doc: document.text,
        extensions: [
          basicSetup,
          language.extensions,
          sysmlLanguage,
          syntaxHighlighting(highlighting),
          indentUnit.of('    '),
          EditorState.tabSize.of(4),
          EditorView.contentAttributes.of({
            'aria-label': 'SysML source',
            'aria-describedby': 'source-help',
          }),
          access.of(EditorState.readOnly.of(false)),
          EditorView.updateListener.of((update) => {
            const current = editor.current;
            if (!current || !update.docChanged) return;
            current.text = applyEditorChanges(current.text, update.changes);
            edited(current.text);
          }),
        ],
      });
    const view = new EditorView({ state: state(file), parent: host.current! });
    editor.current = { view, name: file.name, text: file.text, access, state };
    return () => {
      language.dispose();
      assistance.current = undefined;
      editor.current = undefined;
      view.destroy();
    };
  }, []);
  useLayoutEffect(() => {
    assistance.current?.clear();
    setReferences(undefined);
  }, [languageContext, file.name, file.text, disabled]);
  useLayoutEffect(() => {
    const current = editor.current!;
    if (current.name !== file.name || current.text !== file.text) {
      // External replacements start a fresh local history: undo cannot revive a
      // discarded draft, another file, or an earlier accepted model revision.
      current.name = file.name;
      current.text = file.text;
      current.view.setState(current.state(file));
      current.disabled = undefined;
    }
    if (current.disabled !== disabled) {
      current.disabled = disabled;
      current.view.dispatch({
        effects: current.access.reconfigure([
          EditorState.readOnly.of(disabled),
          EditorView.editable.of(!disabled),
          EditorView.contentAttributes.of({
            'aria-readonly': String(disabled),
            tabindex: '0',
          }),
        ]),
      });
    }
  });
  useLayoutEffect(() => {
    if (!selection) return;
    const { view } = editor.current!;
    view.dispatch({
      selection: {
        anchor: editorOffset(file.text, selection.start),
        head: editorOffset(file.text, selection.end),
      },
      scrollIntoView: true,
    });
    if (selection.focus !== false) view.focus();
  }, [selection, file.name]);
  return (
    <section className="editor-pane" aria-label="Source editor">
      <header className="pane-heading">
        <strong title={file.name}>{file.name}</strong>
        <div className="source-query-actions">
          <Button
            size="xs"
            variant="ghost"
            disabled={disabled}
            onClick={() => void assistance.current?.references()}
          >
            Find references
          </Button>
          <Button
            size="xs"
            variant="ghost"
            disabled={disabled}
            onClick={() => void assistance.current?.format()}
          >
            Format source
          </Button>
        </div>
      </header>
      <p id="source-help" className="sr-only">
        Find and replace with Control+F or Command+F. Tab leaves the editor.
        Request completion with Control+Space. Press F1 for symbol information
        or F12 for its definition; Shift+F12 finds references. Escape dismisses
        symbol information. Editing undo affects this draft; toolbar Undo source
        restores applied revisions.
      </p>
      {references && (
        <section className="source-references" aria-label="References">
          <div>
            <strong>{references.result.targets.length} references</strong>{' '}
            <Button
              size="xs"
              variant="ghost"
              onClick={() => {
                setReferences(undefined);
                editor.current?.view.focus();
              }}
            >
              Close references
            </Button>
          </div>
          {references.result.omitted > 0 && (
            <p>
              {references.result.omitted} references outside this project are
              unavailable.
            </p>
          )}
          <ul>
            {references.result.targets.map((target, i) => (
              <li key={i}>
                <button
                  onClick={() => {
                    if (references.isCurrent()) navigate(target);
                    else {
                      setReferences(undefined);
                      notify('Source changed; find references again.');
                    }
                  }}
                >
                  {target.file} · line {target.line}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
      <div className="source-editor" ref={host} />
    </section>
  );
}
