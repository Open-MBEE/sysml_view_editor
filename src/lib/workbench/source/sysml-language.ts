// Keyword inventory adapted from sysml_ide source-highlight.ts; see NOTICE.
import { StreamLanguage, type StreamParser } from '@codemirror/language';

// Lexical assistance only. The pinned engines own parsing and semantic validity.
const keywords = new Set(
  `about abstract accept action actor alias all allocate allocation analysis and as assert assign assume at attribute bind binding by calc case comment concern conjugate connect connection constraint crosses decide def default defined dependency derived differences disjoint doc else end entry enum event exhibit exit expose false feature filter first flow for fork frame from if implies import in include individual inout interface is item join language library loop merge metadata nonunique not null objective occurrence of or ordered out package parallel part perform port private protected public redefines references ref render rendering require requirement return satisfy send snapshot specializes standard state subject subsets succession terminate then timeslice to transition true type union unique until use variation variant verification verify via view viewpoint when while xor`.split(
    /\s+/,
  ),
);
type State = { comment: boolean; quote: string; depth: number };
export const sysmlParser: StreamParser<State> = {
  name: 'SysML v2',
  startState: () => ({ comment: false, quote: '', depth: 0 }),
  token(stream, state) {
    if (!state.comment && !state.quote) {
      if (stream.eatSpace()) return null;
      if (stream.match('//')) {
        stream.skipToEnd();
        return 'lineComment';
      }
      if (stream.match('/*')) state.comment = true;
      else if (stream.match(/^["']/)) state.quote = stream.current();
      else if (stream.match(/^(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?/))
        return 'number';
      else if (stream.match(/^[\p{L}_][\p{L}\p{N}_]*/u))
        return keywords.has(stream.current()) ? 'keyword' : 'variableName';
      else {
        const character = stream.next();
        if (character === '{') state.depth++;
        if (character === '}') state.depth = Math.max(0, state.depth - 1);
        return /[{}[\]()]/.test(character ?? '') ? 'bracket' : 'operator';
      }
    }
    if (state.comment) {
      while (!stream.eol()) {
        if (stream.match('*/')) {
          state.comment = false;
          break;
        }
        stream.next();
      }
      return 'blockComment';
    }
    const style = state.quote === '"' ? 'string' : 'variableName';
    while (!stream.eol()) {
      const character = stream.next();
      if (character === '\\') stream.next();
      else if (character === state.quote) {
        state.quote = '';
        break;
      }
    }
    return style;
  },
  indent: (state, textAfter, context) =>
    state.comment || state.quote
      ? null
      : Math.max(
          0,
          state.depth - (textAfter.trimStart().startsWith('}') ? 1 : 0),
        ) * context.unit,
  languageData: {
    commentTokens: { line: '//', block: { open: '/*', close: '*/' } },
    closeBrackets: { brackets: ['(', '[', '{', '"', "'"] },
    indentOnInput: /^\s*\}/,
  },
};
export const sysmlLanguage = StreamLanguage.define(sysmlParser);
