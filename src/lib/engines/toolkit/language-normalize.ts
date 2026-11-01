import { Type } from 'typebox';
import { validator } from '$lib/contracts/validation';
import {
  readLanguageResult,
  type LanguageQuery,
  type LanguageResult,
} from '$lib/workspace/language';
import { positionOffset, sourceURI } from '$lib/workspace/language/positions';
import type { SourceDocument } from '$lib/workspace/project';
const position = Type.Object({
  line: Type.Integer({ minimum: 0 }),
  character: Type.Integer({ minimum: 0 }),
});
const range = Type.Object({ start: position, end: position });
const readRange = validator(range, 'Invalid LSP range');
const object = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('Invalid language server response.');
  return value as Record<string, unknown>;
};
function offsets(text: string, value: unknown) {
  const r = readRange(value),
    from = positionOffset(text, r.start),
    to = positionOffset(text, r.end);
  if (from > to) throw new Error('Reversed LSP range.');
  return { from, to };
}
function plain(value: unknown): string {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value.map(plain).join('\n\n');
  const item = object(value);
  if (typeof item.value !== 'string') throw new Error('Invalid hover content.');
  return item.value;
}
export function normalizeLanguage(
  sources: readonly SourceDocument[],
  query: LanguageQuery,
  raw: unknown,
): LanguageResult {
  const file = sources.find((s) => s.name === query.file);
  if (!file) throw new Error('Language query source is unavailable.');
  const text = file.text;
  if (query.kind === 'definition') {
    const candidates = raw == null ? [] : Array.isArray(raw) ? raw : [raw];
    if (candidates.length !== 1)
      return readLanguageResult({
        kind: 'definition',
        target: null,
        message: candidates.length
          ? 'Definition is ambiguous.'
          : 'No definition found.',
      });
    const item = object(candidates[0]),
      target = sources.find((s) => sourceURI(s.name) === item.uri);
    if (!target)
      return readLanguageResult({
        kind: 'definition',
        target: null,
        message: 'Definition is outside this project.',
      });
    return readLanguageResult({
      kind: 'definition',
      target: { file: target.name, ...offsets(target.text, item.range) },
      message: '',
    });
  }
  if (query.kind === 'hover') {
    if (raw == null)
      return readLanguageResult({
        kind: 'hover',
        text: '',
        from: query.offset,
        to: query.offset,
      });
    const item = object(raw);
    const content = plain(item.contents)
      .replace(/\r\n?/g, '\n')
      .replace(/^\s*---+\s*$/gm, '')
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      .replace(/`([^`]+)`/g, '$1')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
    return readLanguageResult({
      kind: 'hover',
      text: content,
      ...(item.range
        ? offsets(text, item.range)
        : { from: query.offset, to: query.offset }),
    });
  }
  const list = Array.isArray(raw)
    ? raw
    : raw == null
      ? []
      : (() => {
          const result = object(raw);
          if (result.itemDefaults !== undefined)
            throw new Error('Completion defaults are unsupported.');
          if (!Array.isArray(result.items))
            throw new Error('Invalid completion list.');
          return result.items;
        })();
  if (list.length > 2000)
    throw new Error('Completion result exceeds the supported limit.');
  let from = query.offset,
    to = query.offset;
  while (from > 0 && /[\p{L}\p{N}_]/u.test(text[from - 1]!)) from--;
  while (to < text.length && /[\p{L}\p{N}_]/u.test(text[to]!)) to++;
  const items = [];
  for (const entry of list) {
    const item = object(entry);
    if (
      item.insertTextFormat === 2 ||
      item.command !== undefined ||
      (item.additionalTextEdits !== undefined &&
        (!Array.isArray(item.additionalTextEdits) ||
          item.additionalTextEdits.length))
    )
      continue;
    if (typeof item.label !== 'string')
      throw new Error('Invalid completion label.');
    let edit = { from, to };
    let insert: unknown = item.insertText ?? item.label;
    if (item.textEdit !== undefined) {
      const e = object(item.textEdit);
      if (e.insert !== undefined || e.replace !== undefined) continue;
      edit = offsets(text, e.range);
      insert = e.newText;
    }
    if (typeof insert !== 'string') throw new Error('Invalid completion text.');
    items.push({
      label: item.label,
      text: insert,
      ...edit,
      ...(typeof item.detail === 'string' ? { detail: item.detail } : {}),
    });
  }
  return readLanguageResult({ kind: 'completion', items });
}
