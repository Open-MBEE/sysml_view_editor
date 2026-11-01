import { describe, expect, it } from 'vitest';
import { ChangeSet, EditorState } from '@codemirror/state';
import {
  ensureSyntaxTree,
  getIndentation,
  indentUnit,
} from '@codemirror/language';
import { highlightTree, tagHighlighter, tags } from '@lezer/highlight';
import { applyEditorChanges, editorOffset } from './source-text';
import { sysmlLanguage } from './sysml-language';

function tokens(text: string) {
  const state = EditorState.create({ doc: text, extensions: [sysmlLanguage] });
  const tree = ensureSyntaxTree(state, state.doc.length, 1000)!;
  const result: { text: string; kind: string }[] = [];
  highlightTree(
    tree,
    tagHighlighter([
      { tag: tags.keyword, class: 'keyword' },
      { tag: tags.comment, class: 'comment' },
      { tag: tags.string, class: 'string' },
      { tag: tags.number, class: 'number' },
      { tag: tags.variableName, class: 'name' },
    ]),
    (from, to, kind) => result.push({ text: text.slice(from, to), kind }),
  );
  return result;
}
describe('SysML lexical assistance', () => {
  it('distinguishes declarations, quoted names, escaped strings, Unicode and numeric literals', () => {
    const result = tokens(
      `part 'Motor A' { attribute café = 12.5e-2; attribute label = "a \\\"part\\\""; }`,
    );
    for (const token of [
      { text: 'part', kind: 'keyword' },
      { text: "'Motor A'", kind: 'name' },
      { text: 'café', kind: 'name' },
      { text: '12.5e-2', kind: 'number' },
      { text: '"a \\\"part\\\""', kind: 'string' },
    ])
      expect(result).toContainEqual(token);
  });
  it('keeps multiline and unfinished comments or strings out of keyword styling', () => {
    const result = tokens(
      'doc /* part {\n def } */ part X; // action\n"unfinished part',
    );
    expect(
      result.filter((t) => t.kind === 'keyword').map((t) => t.text),
    ).toEqual(['doc', 'part']);
    expect(
      result.some((t) => t.kind === 'comment' && t.text.includes('def }')),
    ).toBe(true);
    expect(result.at(-1)).toEqual({ text: '"unfinished part', kind: 'string' });
  });
  it('indents braces without counting braces in comments and strings', () => {
    const state = EditorState.create({
      doc: 'package P {\n    // }\n    attribute label = "{";\n\n}',
      extensions: [sysmlLanguage, indentUnit.of('    ')],
    });
    ensureSyntaxTree(state, state.doc.length, 1000);
    expect(getIndentation(state, state.doc.line(4).from)).toBe(4);
    expect(getIndentation(state, state.doc.line(5).from)).toBe(0);
  });
});
describe('source text boundary', () => {
  it('maps CRLF and Unicode reveal offsets to CodeMirror UTF-16 positions', () => {
    const text = '// 🛠\r\npart café;\r\n';
    expect(editorOffset(text, text.indexOf('café'))).toBe('// 🛠\npart '.length);
  });
  it('preserves untouched mixed separators during multiple edits and uses the first for inserted lines', () => {
    const text = '// 🛠\r\npart A;\npart B;\rpart C;';
    const doc = EditorState.create({ doc: text }).doc;
    const a = doc.toString().indexOf('A'),
      b = doc.toString().indexOf('B');
    const changes = ChangeSet.of(
      [
        { from: a, to: a + 1, insert: 'Drive' },
        { from: b, to: b + 1, insert: 'Backup;\npart Extra' },
      ],
      doc.length,
    );
    expect(applyEditorChanges(text, changes)).toBe(
      '// 🛠\r\npart Drive;\npart Backup;\r\npart Extra;\rpart C;',
    );
  });
  it('removes a whole CRLF when joining lines and retains plain LF in new files', () => {
    expect(
      applyEditorChanges('A\r\nB', ChangeSet.of({ from: 1, to: 2 }, 3)),
    ).toBe('AB');
    expect(
      applyEditorChanges('A', ChangeSet.of({ from: 1, insert: '\nB' }, 1)),
    ).toBe('A\nB');
  });
});
