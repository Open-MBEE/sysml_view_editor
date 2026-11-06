/** Presentation only: complex declarations retain their exact source spelling. */
export function attributeLabel(declaration: string): string {
  const match = declaration
    .trim()
    .match(
      /^attribute\s+([A-Za-z_]\w*)\s*:\s*([A-Za-z_]\w*(?:::\w+)*)\s+default\s*=\s*([+-]?\d+(?:\.\d+)?|true|false);$/,
    );
  if (!match) return declaration;
  return `${match[1]}: ${match[2]} = ${match[3]!.replace(/\.0+$/, '')}`;
}
