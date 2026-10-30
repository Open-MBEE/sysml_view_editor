import type { ModelElement } from '$lib/workspace/project';

export interface ModelTreeNode {
  element: ModelElement;
  parent: string | null;
  children: string[];
}
export function indexModelTree(elements: readonly ModelElement[]) {
  const declarations = new Map(
    elements.map((element) => [element.id, element]),
  );
  // Views have their own navigation list. Their internal rendering declarations
  // are not promoted into unrelated model packages when views are omitted.
  const hidden = new Set(
    elements
      .filter((element) => ['viewDef', 'viewUsage'].includes(element.kind))
      .map((element) => element.id),
  );
  let changed = true;
  while (changed) {
    changed = false;
    for (const element of elements)
      if (
        element.ownerId &&
        hidden.has(element.ownerId) &&
        !hidden.has(element.id)
      ) {
        hidden.add(element.id);
        changed = true;
      }
  }
  const nodes = new Map<string, ModelTreeNode>();
  const unavailable = new Set<string>();
  for (const element of declarations.values()) {
    if (hidden.has(element.id)) continue;
    const parent =
      element.ownerId && declarations.has(element.ownerId)
        ? element.ownerId
        : null;
    if (element.ownerId && !parent) unavailable.add(element.id);
    nodes.set(element.id, { element, parent, children: [] });
  }
  // An invalid engine ownership graph must not make declarations disappear or
  // recurse indefinitely. Show affected declarations at the top with a notice.
  const visited = new Set<string>();
  for (const id of nodes.keys()) {
    const path = new Set<string>();
    let current: string | null = id;
    while (current && !visited.has(current) && !path.has(current)) {
      path.add(current);
      current = nodes.get(current)?.parent ?? null;
    }
    if (current && path.has(current)) {
      const start = current;
      do {
        const node: ModelTreeNode = nodes.get(current)!;
        const next: string | null = node.parent;
        node.parent = null;
        unavailable.add(current);
        current = next;
      } while (current && current !== start);
    }
    for (const item of path) visited.add(item);
  }
  const roots: string[] = [];
  for (const [id, node] of nodes) {
    if (node.parent) nodes.get(node.parent)!.children.push(id);
    else roots.push(id);
  }
  return { nodes, roots, unavailable };
}
export type ModelTreeIndex = ReturnType<typeof indexModelTree>;

export function modelAncestors(tree: ModelTreeIndex, id: string) {
  const result: string[] = [];
  let parent = tree.nodes.get(id)?.parent;
  while (parent) {
    result.push(parent);
    parent = tree.nodes.get(parent)?.parent;
  }
  return result;
}

export function visibleModelRows(
  tree: ModelTreeIndex,
  expanded: ReadonlySet<string>,
) {
  const rows: { id: string; depth: number }[] = [];
  const pending = tree.roots.map((id) => ({ id, depth: 0 })).reverse();
  while (pending.length) {
    const row = pending.pop()!;
    rows.push(row);
    if (expanded.has(row.id))
      for (const id of [...tree.nodes.get(row.id)!.children].reverse())
        pending.push({ id, depth: row.depth + 1 });
  }
  return rows;
}

export function modelKindLabel(kind: string) {
  return kind
    .replace(/Usage$/, '')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .toLowerCase();
}
export function modelTypeLabel(element: ModelElement, tree: ModelTreeIndex) {
  return element.typeId
    ? tree.nodes.get(element.typeId)?.element.name ||
        element.typeId.split('::').at(-1)
    : undefined;
}
