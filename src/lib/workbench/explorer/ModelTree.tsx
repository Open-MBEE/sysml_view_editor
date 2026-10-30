import {
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
} from 'react';
import {
  Folder,
  FolderOpen,
  Box,
  Cuboid,
  Workflow,
  CircleDot,
  ClipboardCheck,
  Users,
  Plug,
  SlidersHorizontal,
  Cable,
  ArrowRightLeft,
  SquareFunction,
  Link,
  Circle,
  ChevronRight,
  ChevronsUpDown,
  ChevronsDownUp,
  type LucideIcon,
} from 'lucide-react';
import { Button } from '$lib/ui/primitives/button';
import { IconButton } from '$lib/ui/IconButton';
import type { ModelElement } from '$lib/workspace/project';
import {
  indexModelTree,
  modelAncestors,
  modelKindLabel,
  modelTypeLabel,
  visibleModelRows,
} from './model-tree';

const kindIcons: Record<string, LucideIcon> = {
  action: Workflow,
  state: CircleDot,
  requirement: ClipboardCheck,
  verificationCase: ClipboardCheck,
  satisfyRequirement: ClipboardCheck,
  useCase: Users,
  port: Plug,
  attribute: SlidersHorizontal,
  connection: Cable,
  flow: ArrowRightLeft,
  allocation: ArrowRightLeft,
  constraint: SquareFunction,
  reference: Link,
};
function KindIcon({ kind, expanded }: { kind: string; expanded: boolean }) {
  const family = kind.replace(/(Def|Usage)$/, '');
  const Icon =
    family === 'package'
      ? expanded
        ? FolderOpen
        : Folder
      : family === 'part'
        ? kind === 'partDef'
          ? Box
          : Cuboid
        : (kindIcons[family] ?? Circle);
  return <Icon aria-hidden="true" />;
}

export function ModelTree({
  elements,
  selected,
  selectionRequest,
  onSelect,
}: {
  elements: readonly ModelElement[];
  selected: string;
  selectionRequest: number;
  onSelect: (element: ModelElement) => void;
}) {
  const tree = useMemo(() => indexModelTree(elements), [elements]);
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set());
  const [active, setActive] = useState('');
  const refs = useRef(new Map<string, HTMLLIElement>());
  const reveal = useRef('');
  const typed = useRef({ value: '', time: 0 });
  const help = useId();
  const rows = useMemo(
    () => visibleModelRows(tree, expanded),
    [tree, expanded],
  );
  const visible = new Set(rows.map((row) => row.id));
  const branches = [...tree.nodes]
    .filter(([, node]) => node.children.length > 0)
    .map(([id]) => id);
  const tabStop = visible.has(active)
    ? active
    : (modelAncestors(tree, active).find((id) => visible.has(id)) ??
      (visible.has(selected) ? selected : rows[0]?.id));

  useLayoutEffect(() => {
    if (!tree.nodes.has(selected)) return;
    setExpanded(
      (before) => new Set([...before, ...modelAncestors(tree, selected)]),
    );
    setActive(selected);
    reveal.current = selected;
  }, [tree, selected, selectionRequest]);
  useLayoutEffect(() => {
    const row = refs.current.get(reveal.current)?.firstElementChild;
    if (row?.getClientRects().length) {
      row.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      reveal.current = '';
    }
  }, [rows]);

  function focus(id: string) {
    setActive(id);
    refs.current.get(id)?.focus();
  }
  function toggle(id: string) {
    setExpanded((before) => {
      const next = new Set(before);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function onKeyDown(event: KeyboardEvent<HTMLUListElement>) {
    if (event.altKey || event.ctrlKey || event.metaKey || !tabStop) return;
    if (event.key.length !== 1 || event.key === ' ')
      typed.current = { value: '', time: 0 };
    const node = tree.nodes.get(tabStop)!;
    const at = rows.findIndex((row) => row.id === tabStop);
    switch (event.key) {
      case 'ArrowDown':
        focus(rows[Math.min(at + 1, rows.length - 1)]!.id);
        break;
      case 'ArrowUp':
        focus(rows[Math.max(at - 1, 0)]!.id);
        break;
      case 'Home':
        focus(rows[0]!.id);
        break;
      case 'End':
        focus(rows.at(-1)!.id);
        break;
      case 'ArrowRight':
        if (node.children.length) {
          if (expanded.has(tabStop)) focus(node.children[0]!);
          else toggle(tabStop);
        }
        break;
      case 'ArrowLeft':
        if (node.children.length && expanded.has(tabStop)) toggle(tabStop);
        else if (node.parent) focus(node.parent);
        break;
      case 'Enter':
      case ' ':
        onSelect(node.element);
        break;
      default: {
        if (event.key.length !== 1) return;
        const now = performance.now();
        const value =
          (now - typed.current.time < 700 ? typed.current.value : '') +
          event.key.toLocaleLowerCase();
        typed.current = { value, time: now };
        const query = [...value].every((letter) => letter === value[0])
          ? value[0]!
          : value;
        const start = query.length === 1 ? at + 1 : at;
        const match = [...rows.slice(start), ...rows.slice(0, start)].find(
          (row) =>
            tree.nodes
              .get(row.id)!
              .element.name.toLocaleLowerCase()
              .startsWith(query),
        );
        if (match) focus(match.id);
      }
    }
    event.preventDefault();
    event.stopPropagation();
  }
  function renderBranch(
    id: string,
    depth: number,
    position: number,
    siblings: number,
  ) {
    const node = tree.nodes.get(id)!;
    const { element } = node;
    const open = expanded.has(id);
    const kind = modelKindLabel(element.kind);
    const type = modelTypeLabel(element, tree);
    const label = element.name || `(unnamed ${kind})`;
    return (
      <li
        key={id}
        role="treeitem"
        aria-label={`${label}, ${kind}${type ? `, ${type}` : ''}`}
        aria-description={element.id}
        aria-selected={selected === id}
        aria-expanded={node.children.length ? open : undefined}
        aria-level={depth + 1}
        aria-posinset={position + 1}
        aria-setsize={siblings}
        tabIndex={tabStop === id ? 0 : -1}
        ref={(item) => {
          if (item) refs.current.set(id, item);
          else refs.current.delete(id);
        }}
        onFocus={(event) => {
          if (event.target === event.currentTarget) setActive(id);
        }}
      >
        <Button
          asChild
          variant="ghost"
          className={`model-tree-row${depth ? ' has-parent' : ''}`}
        >
          <div
            title={id}
            style={
              {
                '--tree-indent': `${Math.min(depth, 6) * 14}px`,
              } as CSSProperties
            }
            onClick={() => {
              focus(id);
              onSelect(element);
            }}
          >
            <span className="model-tree-guides" aria-hidden="true" />
            <span
              className="model-tree-disclosure"
              aria-hidden="true"
              onClick={
                node.children.length
                  ? (event) => {
                      event.stopPropagation();
                      focus(id);
                      toggle(id);
                    }
                  : undefined
              }
            >
              {node.children.length > 0 && (
                <ChevronRight className={open ? 'expanded' : undefined} />
              )}
            </span>
            <span className="model-tree-kind">
              <KindIcon kind={element.kind} expanded={open} />
            </span>
            <span className="model-tree-name">{label}</span>
            <span
              className="model-tree-detail"
              title={type ? `Type: ${element.typeId}` : kind}
            >
              {type ?? kind}
            </span>
          </div>
        </Button>
        {open && node.children.length > 0 && (
          <ul role="group">
            {node.children.map((child, index) =>
              renderBranch(child, depth + 1, index, node.children.length),
            )}
          </ul>
        )}
      </li>
    );
  }
  return (
    <section className="model-tree-section">
      <div className="section-heading">
        <h2>Model</h2>
        <div className="model-tree-actions">
          <IconButton
            size="icon-xs"
            label="Expand all model elements"
            icon={ChevronsUpDown}
            disabled={!branches.some((id) => !expanded.has(id))}
            onClick={() => setExpanded(new Set(branches))}
          />
          <IconButton
            size="icon-xs"
            label="Collapse all model elements"
            icon={ChevronsDownUp}
            disabled={!branches.some((id) => expanded.has(id))}
            onClick={() => setExpanded(new Set())}
          />
        </div>
      </div>
      <p id={help} className="sr-only">
        Use arrow keys to navigate and expand. Press Enter or Space to select a
        declaration. Type a name to find a visible declaration.
      </p>
      {tree.unavailable.size > 0 && (
        <p role="status">
          Some ownership is unavailable. Affected declarations are shown at the
          top level.
        </p>
      )}
      {tree.roots.length ? (
        <ul
          className="model-tree"
          role="tree"
          aria-label="Model"
          aria-describedby={help}
          onKeyDown={onKeyDown}
        >
          {tree.roots.map((id, index) =>
            renderBranch(id, 0, index, tree.roots.length),
          )}
        </ul>
      ) : (
        <p>No model declarations to display.</p>
      )}
    </section>
  );
}
