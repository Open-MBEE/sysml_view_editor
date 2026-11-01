import { describe, it, expect } from 'vitest';
import { normalizeLanguage } from './language-normalize';
import {
  positionOffset,
  sourcePosition,
  sourceURI,
} from '$lib/workspace/language/positions';
import { readLanguageResult } from '$lib/workspace/language';
const sources = [
  {
    name: 'nested/a space.sysml',
    text: '// 😀\r\npart primary : Motor;\rpart other;\n',
  },
];
const offset = sources[0]!.text.indexOf('Motor') + 2;
const query = { kind: 'completion', file: sources[0]!.name, offset } as const;
describe('language normalization', () => {
  it('roundtrips raw UTF16 with CRLF, CR and astral characters', () => {
    const text = sources[0]!.text;
    for (let i = 0; i <= text.length; i++) {
      if (text[i - 1] === '\r' && text[i] === '\n') continue;
      expect(positionOffset(text, sourcePosition(text, i))).toBe(i);
    }
    expect(() => sourcePosition(text, 6)).toThrow();
    expect(() => positionOffset(text, { line: 20, character: 0 })).toThrow();
    expect(() => positionOffset(text, { line: 0, character: 200 })).toThrow();
  });
  it('completes the whole identifier rather than duplicating its suffix', () => {
    expect(
      normalizeLanguage(sources, query, [
        { label: 'Motor', detail: 'Lib::Motor' },
      ]),
    ).toEqual({
      kind: 'completion',
      items: [
        {
          label: 'Motor',
          text: 'Motor',
          detail: 'Lib::Motor',
          from: offset - 2,
          to: offset + 3,
        },
      ],
    });
  });
  it('rejects compound, snippet, insert/replace, defaults and command edits', () => {
    expect(
      normalizeLanguage(sources, query, [
        { label: 'snippet', insertTextFormat: 2 },
        { label: 'command', command: { command: 'anything' } },
        { label: 'compound', additionalTextEdits: [{}] },
        { label: 'dual', textEdit: { insert: {}, replace: {}, newText: 'x' } },
      ]),
    ).toEqual({ kind: 'completion', items: [] });
    expect(() =>
      normalizeLanguage(sources, query, { items: [], itemDefaults: {} }),
    ).toThrow();
  });
  it('accepts a single plain edit and rejects out-of-bounds or reversed ranges', () => {
    const start = sourcePosition(sources[0]!.text, offset - 2),
      end = sourcePosition(sources[0]!.text, offset + 3);
    expect(
      normalizeLanguage(sources, query, [
        {
          label: 'Motor',
          textEdit: { range: { start, end }, newText: 'Motor' },
        },
      ]),
    ).toMatchObject({
      items: [{ from: offset - 2, to: offset + 3, text: 'Motor' }],
    });
    expect(() =>
      normalizeLanguage(sources, query, [
        {
          label: 'bad',
          textEdit: { range: { start: end, end: start }, newText: 'x' },
        },
      ]),
    ).toThrow();
    expect(() =>
      normalizeLanguage(sources, query, [
        {
          label: 'bad',
          textEdit: {
            range: { start, end: { line: 1, character: 999 } },
            newText: 'x',
          },
        },
      ]),
    ).toThrow();
  });
  it('only navigates exact URIs for the current project, with unique definitions', () => {
    const q = { ...query, kind: 'definition' } as const;
    const range = {
      start: { line: 1, character: 5 },
      end: { line: 1, character: 12 },
    };
    expect(
      normalizeLanguage(sources, q, { uri: sourceURI(query.file), range }),
    ).toMatchObject({ target: { file: query.file, from: 12, to: 19 } });
    expect(
      normalizeLanguage(sources, q, {
        uri: 'file:///workspace/nested/a%20space.sysml/../other.sysml',
        range,
      }),
    ).toMatchObject({
      target: null,
      message: 'Definition is outside this project.',
    });
    expect(
      normalizeLanguage(sources, q, [
        { uri: sourceURI(query.file), range },
        { uri: sourceURI(query.file), range },
      ]),
    ).toMatchObject({ target: null, message: 'Definition is ambiguous.' });
  });
  it('keeps hover markup as safe plain content with only a confirmed range', () => {
    expect(
      normalizeLanguage(
        sources,
        { ...query, kind: 'hover' },
        {
          contents: {
            kind: 'markdown',
            value:
              '**Lib::Motor**  \n`PartDefinition`\n\n---\nDrive machine. <script>x</script>',
          },
        },
      ),
    ).toEqual({
      kind: 'hover',
      text: 'Lib::Motor  \nPartDefinition\n\nDrive machine. <script>x</script>',
      from: offset,
      to: offset,
    });
    expect(() =>
      normalizeLanguage(
        sources,
        { ...query, kind: 'hover' },
        { contents: { value: 42 } },
      ),
    ).toThrow();
  });
  it('rejects unknown normalized transport fields', () => {
    expect(() =>
      readLanguageResult({ kind: 'completion', items: [], command: 'x' }),
    ).toThrow();
  });
});
