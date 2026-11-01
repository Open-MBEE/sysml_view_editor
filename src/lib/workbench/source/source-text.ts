import type { ChangeSet } from '@codemirror/state';

/** CodeMirror positions use LF internally; workspace/engine ranges use raw UTF-16. */
export function editorOffset(text: string, sourceOffset: number) {
  return text.slice(0, sourceOffset).replace(/\r\n?/g, '\n').length;
}
function sourceOffset(text: string, offset: number) {
  let removed = 0;
  for (const match of text.matchAll(/\r\n/g)) {
    if (match.index - removed >= offset) break;
    removed++;
  }
  return offset + removed;
}

/** Retain untouched separators, including mixed endings; new lines use the first. */
export function applyEditorChanges(text: string, changes: ChangeSet) {
  const separator = text.match(/\r\n?|\n/)?.[0] ?? '\n';
  let result = '',
    previous = 0;
  changes.iterChanges((from, to, _fromNew, _toNew, inserted) => {
    const start = sourceOffset(text, from),
      end = sourceOffset(text, to);
    result +=
      text.slice(previous, start) +
      inserted.sliceString(0, inserted.length, separator);
    previous = end;
  });
  return result + text.slice(previous);
}
