import { useEffectEvent, useLayoutEffect, useRef } from 'react';
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
}: {
  file: SourceDocument;
  disabled?: boolean;
  selection?: { start: number; end: number };
  onChange: (value: string) => void;
}) {
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
  useLayoutEffect(() => {
    const access = new Compartment();
    const state = (document: SourceDocument) =>
      EditorState.create({
        doc: document.text,
        extensions: [
          basicSetup,
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
      editor.current = undefined;
      view.destroy();
    };
  }, []);
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
    view.focus();
  }, [selection, file.name]);
  return (
    <section className="editor-pane" aria-label="Source editor">
      <header className="pane-heading">
        <strong title={file.name}>{file.name}</strong>
        <span>SysML v2</span>
      </header>
      <p id="source-help" className="sr-only">
        Find and replace with Control+F or Command+F. Tab leaves the editor.
        Editing undo affects this draft; toolbar Undo source restores applied
        revisions.
      </p>
      <div className="source-editor" ref={host} />
    </section>
  );
}
