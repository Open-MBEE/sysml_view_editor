import { readFile, readdir } from 'node:fs/promises';
import { resolve, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const root = fileURLToPath(new URL('../', import.meta.url));
export function violation(file, specifier) {
  const normalized = file.replaceAll('\\', '/');
  const target = specifier.startsWith('$lib/')
    ? 'src/lib/' + specifier.slice(5)
    : specifier.startsWith('.')
      ? relative(root, resolve(root, dirname(file), specifier)).replaceAll(
          '\\',
          '/',
        )
      : specifier;
  if (normalized.startsWith('src/lib/workspace/')) {
    if (
      [
        'react',
        'react-dom',
        'svelte',
        '@xyflow/',
        'elkjs',
        'src/lib/engines/',
        'src/lib/workbench/',
        'src/lib/ui/',
      ].some((prefix) => target.startsWith(prefix))
    )
      return 'Workspace modules must remain independent of UI and engine implementations.';
    if (['node:', 'fs', 'path'].some((prefix) => target.startsWith(prefix)))
      return 'Workspace modules use supplied capabilities rather than Node filesystem modules.';
  }
  if (
    normalized.startsWith('src/lib/engines/') &&
    target.startsWith('src/lib/workbench/')
  )
    return 'Engine adapters cannot import the workbench.';
  if (
    normalized.startsWith('src/lib/workbench/') &&
    !normalized.endsWith('/shell/session.ts') &&
    target.startsWith('src/lib/engines/')
  )
    return 'Only session composition constructs engine adapters.';
  return undefined;
}
export async function checkArchitecture() {
  const failures = [];
  async function visit(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const path = resolve(directory, entry.name);
      if (entry.isDirectory()) {
        await visit(path);
        continue;
      }
      if (!/\.(ts|tsx)$/.test(entry.name)) continue;
      const file = relative(root, path).replaceAll('\\', '/'),
        text = await readFile(path, 'utf8');
      const source = ts.createSourceFile(
        path,
        text,
        ts.ScriptTarget.Latest,
        true,
        entry.name.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
      );
      function walk(node) {
        if (
          (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
          node.moduleSpecifier &&
          ts.isStringLiteral(node.moduleSpecifier)
        ) {
          const reason = violation(file, node.moduleSpecifier.text);
          if (reason)
            failures.push(`${file}: ${node.moduleSpecifier.text}: ${reason}`);
        }
        if (
          ts.isCallExpression(node) &&
          node.expression.kind === ts.SyntaxKind.ImportKeyword &&
          node.arguments[0] &&
          ts.isStringLiteral(node.arguments[0])
        ) {
          const reason = violation(file, node.arguments[0].text);
          if (reason)
            failures.push(`${file}: ${node.arguments[0].text}: ${reason}`);
        }
        if (
          file.startsWith('src/lib/workspace/') &&
          ts.isIdentifier(node) &&
          [
            'window',
            'document',
            'localStorage',
            'sessionStorage',
            'Worker',
            'indexedDB',
          ].includes(node.text)
        )
          failures.push(
            `${file}: browser global ${node.text} belongs in an adapter.`,
          );
        ts.forEachChild(node, walk);
      }
      walk(source);
    }
  }
  await visit(resolve(root, 'src/lib'));
  if (failures.length) throw new Error(failures.join('\n'));
}
if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  await checkArchitecture();
  console.log('Architecture import and platform rules passed.');
}
