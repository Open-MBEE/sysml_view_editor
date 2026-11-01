/** LSP positions count UTF-16 code units, with line separators excluded. */
export function sourcePosition(text: string, offset: number) {
  if (!Number.isInteger(offset) || offset < 0 || offset > text.length)
    throw new Error('Source offset is out of bounds.');
  let line = 0,
    start = 0;
  for (const match of text.matchAll(/\r\n|\r|\n/g)) {
    if (match.index >= offset) break;
    const end = match.index + match[0].length;
    if (offset < end) throw new Error('Source offset splits a line separator.');
    line++;
    start = end;
  }
  return { line, character: offset - start };
}
export function positionOffset(
  text: string,
  position: { line: number; character: number },
) {
  const { line, character } = position;
  if (
    !Number.isInteger(line) ||
    !Number.isInteger(character) ||
    line < 0 ||
    character < 0
  )
    throw new Error('Invalid LSP position.');
  const lines = text.split(/\r\n|\r|\n/);
  if (line >= lines.length || character > lines[line]!.length)
    throw new Error('LSP position is out of bounds.');
  let start = 0,
    current = 0;
  for (const match of text.matchAll(/\r\n|\r|\n/g)) {
    if (current++ === line) break;
    start = match.index + match[0].length;
  }
  return start + character;
}
export function sourceURI(name: string) {
  return (
    'file:///workspace/' + name.split('/').map(encodeURIComponent).join('/')
  );
}
