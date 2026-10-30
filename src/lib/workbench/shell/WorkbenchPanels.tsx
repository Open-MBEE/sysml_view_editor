import {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type {
  GroupImperativeHandle,
  Layout,
  LayoutChangedMeta,
  PanelImperativeHandle,
} from 'react-resizable-panels';
import {
  PanelLeftOpen,
  PanelLeftClose,
  PanelRightOpen,
  PanelRightClose,
  PanelBottomClose,
  PanelsTopLeft,
  Ellipsis,
  ArrowLeftRight,
  ArrowUpDown,
  RotateCcw,
  TriangleAlert,
} from 'lucide-react';
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from '$lib/ui/primitives/resizable';
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from '$lib/ui/primitives/popover';
import { Button } from '$lib/ui/primitives/button';
import { IconButton } from '$lib/ui/IconButton';
import {
  defaultLayout,
  loadLayout,
  saveLayout,
  type WorkbenchLayout,
} from './layout';

type Mode = 'code' | 'split' | 'diagram';
type Side = 'explorer' | 'inspector' | 'issues';
const titles = {
  explorer: 'Explorer',
  inspector: 'Inspector',
  issues: 'Issues',
};
const closedKey = {
  explorer: 'explorerClosed',
  inspector: 'inspectorClosed',
  issues: 'issuesClosed',
} as const;
function useNarrow() {
  const [narrow, setNarrow] = useState(
    () => window.matchMedia('(max-width: 900px)').matches,
  );
  useEffect(() => {
    const media = window.matchMedia('(max-width: 900px)');
    const changed = () => setNarrow(media.matches);
    media.addEventListener('change', changed);
    return () => media.removeEventListener('change', changed);
  }, []);
  return narrow;
}
function useLayoutController(mode: Mode) {
  const narrow = useNarrow();
  const [initial] = useState(() => {
    try {
      return { value: loadLayout(window.localStorage, narrow), failed: false };
    } catch {
      return {
        value: { ...defaultLayout, inspectorClosed: narrow },
        failed: true,
      };
    }
  });
  const [bounds, setBounds] = useState({
    explorer: initial.value.explorerClosed
      ? 0
      : (window.innerWidth * initial.value.explorer) / 100,
    inspector: initial.value.inspectorClosed
      ? 0
      : (window.innerWidth * initial.value.inspector) / 100,
    split: initial.value.split,
  });
  function measure(id: 'explorer' | 'inspector' | 'split', value: number) {
    setBounds((before) =>
      Math.abs(before[id] - value) < 0.01 ? before : { ...before, [id]: value },
    );
  }
  const preferences = useRef(initial.value);
  const [closed, setClosed] = useState<Record<Side, boolean>>({
    explorer: initial.value.explorerClosed,
    inspector: initial.value.inspectorClosed,
    issues: initial.value.issuesClosed,
  });
  const [storageFailed, setStorageFailed] = useState(initial.failed);
  const explorer = useRef<PanelImperativeHandle>(null),
    inspector = useRef<PanelImperativeHandle>(null),
    issues = useRef<PanelImperativeHandle>(null);
  const source = useRef<PanelImperativeHandle>(null),
    diagram = useRef<PanelImperativeHandle>(null);
  const outerGroup = useRef<GroupImperativeHandle>(null),
    editorGroup = useRef<GroupImperativeHandle>(null),
    verticalGroup = useRef<GroupImperativeHandle>(null);
  const explorerToggle = useRef<HTMLButtonElement>(null),
    inspectorToggle = useRef<HTMLButtonElement>(null),
    issuesToggle = useRef<HTMLButtonElement>(null);
  const explorerCollapse = useRef<HTMLButtonElement>(null),
    inspectorCollapse = useRef<HTMLButtonElement>(null),
    issuesCollapse = useRef<HTMLButtonElement>(null);
  const panels = { explorer, inspector, issues };
  const toggles = {
    explorer: explorerToggle,
    inspector: inspectorToggle,
    issues: issuesToggle,
  };
  const collapseButtons = {
    explorer: explorerCollapse,
    inspector: inspectorCollapse,
    issues: issuesCollapse,
  };
  function remember(patch: Partial<WorkbenchLayout>) {
    const next = { ...preferences.current, ...patch };
    if (JSON.stringify(next) === JSON.stringify(preferences.current)) return;
    preferences.current = next;
    try {
      setStorageFailed(!saveLayout(window.localStorage, next));
    } catch {
      setStorageFailed(true);
    }
  }
  const [focusRequest, setFocusRequest] = useState<{
    id: Side;
    collapsed: boolean;
  } | null>(null);
  useLayoutEffect(() => {
    if (!focusRequest || closed[focusRequest.id] !== focusRequest.collapsed)
      return;
    const target = focusRequest.collapsed
      ? toggles[focusRequest.id]
      : collapseButtons[focusRequest.id];
    target.current?.focus({ preventScroll: true });
    setFocusRequest(null);
  }, [focusRequest, closed]);
  function show(id: Side, transferFocus = true) {
    const panel = panels[id].current;
    if (!panel) return;
    // On small screens a side tool must leave room for the editor.
    if (window.innerWidth < 600 && id !== 'issues') {
      const other = id === 'explorer' ? 'inspector' : 'explorer';
      panels[other].current?.collapse();
      remember({ [closedKey[other]]: true });
    }
    panel.resize(`${preferences.current[id]}%`);
    remember({ [closedKey[id]]: false });
    if (transferFocus) setFocusRequest({ id, collapsed: false });
  }
  function hide(id: Side) {
    panels[id].current?.collapse();
    remember({ [closedKey[id]]: true });
    setFocusRequest({ id, collapsed: true });
  }
  function resize(id: Side, delta: number) {
    const panel = panels[id].current;
    if (!panel) return;
    const value = Math.max(
      id === 'issues' ? 12 : 5,
      Math.min(id === 'issues' ? 60 : 45, panel.getSize().asPercentage + delta),
    );
    panel.resize(`${value}%`);
    remember({ [id]: value, [closedKey[id]]: false });
  }
  function resizeSplit(delta: number) {
    const value = Math.max(10, Math.min(90, preferences.current.split + delta));
    editorGroup.current?.setLayout({ source: value, diagram: 100 - value });
    remember({ split: value });
  }
  function changed(
    kind: 'outer' | 'editors' | 'vertical',
    layout: Layout,
    meta: LayoutChangedMeta,
  ) {
    if (!meta.isUserInteraction) return;
    const wanted = meta.requestedLayout ?? layout;
    if (kind === 'editors') {
      if (mode === 'split' && wanted.source! >= 10 && wanted.source! <= 90)
        remember({ split: wanted.source });
      return;
    }
    const ids: Side[] =
      kind === 'outer' ? ['explorer', 'inspector'] : ['issues'];
    const patch: Partial<WorkbenchLayout> = {};
    for (const id of ids) {
      const collapsed = layout[id] === 0;
      patch[closedKey[id]] = collapsed;
      if (!collapsed)
        patch[id] = Math.max(
          id === 'issues' ? 12 : 5,
          Math.min(id === 'issues' ? 60 : 45, wanted[id]!),
        );
      if (
        collapsed &&
        document.activeElement?.getAttribute('aria-label') ===
          `Resize ${titles[id]}`
      )
        setFocusRequest({ id, collapsed: true });
    }
    remember(patch);
  }
  function observe(id: Side, size: number) {
    const value = size === 0;
    setClosed((before) =>
      before[id] === value ? before : { ...before, [id]: value },
    );
  }
  function reset() {
    const next = { ...defaultLayout, inspectorClosed: narrow };
    preferences.current = next;
    outerGroup.current?.setLayout({
      explorer: next.explorer,
      editors:
        100 - next.explorer - (next.inspectorClosed ? 0 : next.inspector),
      inspector: next.inspectorClosed ? 0 : next.inspector,
    });
    editorGroup.current?.setLayout(
      mode === 'split'
        ? { source: next.split, diagram: 100 - next.split }
        : {
            source: mode === 'code' ? 100 : 0,
            diagram: mode === 'diagram' ? 100 : 0,
          },
    );
    verticalGroup.current?.setLayout({ workspace: 100, issues: 0 });
    try {
      setStorageFailed(!saveLayout(window.localStorage, next));
    } catch {
      setStorageFailed(true);
    }
  }
  useEffect(() => {
    const ratio = preferences.current.split;
    editorGroup.current?.setLayout({
      source: mode === 'diagram' ? 0 : mode === 'code' ? 100 : ratio,
      diagram: mode === 'code' ? 0 : mode === 'diagram' ? 100 : 100 - ratio,
    });
  }, [mode, narrow]);
  return {
    bounds,
    measure,
    mode,
    narrow,
    initial: initial.value,
    closed,
    storageFailed,
    panels,
    source,
    diagram,
    outerGroup,
    editorGroup,
    verticalGroup,
    toggles,
    collapseButtons,
    show,
    hide,
    resize,
    resizeSplit,
    changed,
    observe,
    reset,
  };
}
type Controller = ReturnType<typeof useLayoutController>;
const PanelContext = createContext<Controller | null>(null);
function usePanels() {
  const layout = useContext(PanelContext);
  if (!layout) throw new Error('Workspace panel provider is missing.');
  return layout;
}
export function WorkbenchLayout({
  mode,
  children,
}: {
  mode: Mode;
  children: ReactNode;
}) {
  return (
    <PanelContext value={useLayoutController(mode)}>{children}</PanelContext>
  );
}
export function PanelControls() {
  const layout = usePanels();
  return (
    <div className="panel-controls" aria-label="Workspace panels">
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label="Workspace layout">
            <PanelsTopLeft aria-hidden="true" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          align="end"
          className="layout-options"
          aria-label="Workspace layout options"
        >
          <h2>Workspace layout</h2>
          <p>Resize panels without changing your project.</p>
          <Button
            variant="ghost"
            disabled={layout.mode !== 'split'}
            onClick={() => layout.resizeSplit(5)}
          >
            More source space
          </Button>
          <Button
            variant="ghost"
            disabled={layout.mode !== 'split'}
            onClick={() => layout.resizeSplit(-5)}
          >
            More diagram space
          </Button>
          <Button variant="ghost" onClick={layout.reset}>
            <RotateCcw aria-hidden="true" />
            Reset layout
          </Button>
          {layout.storageFailed && (
            <p role="status">
              Layout preferences cannot be saved. Changes remain available for
              this visit.
            </p>
          )}
        </PopoverContent>
      </Popover>
    </div>
  );
}
/** Align command groups with the measured panes rather than viewport-wide gaps. */
export function WorkbenchToolbar({
  history,
  sourceActions,
  modes,
}: {
  history: ReactNode;
  sourceActions: ReactNode;
  modes: ReactNode;
}) {
  const layout = usePanels();
  const stacked = layout.narrow;
  return (
    <div
      className="workbench-toolbar"
      style={{
        gridTemplateColumns: `${layout.bounds.explorer + (layout.closed.explorer ? 32 : 0) + 5}px minmax(0, 1fr) ${layout.bounds.inspector + (layout.closed.inspector ? 32 : 0) + 5}px`,
      }}
    >
      <div aria-hidden="true" />
      <div
        className={`toolbar-editors ${stacked ? 'stacked' : layout.mode === 'split' ? 'split' : 'single'}`}
        style={
          layout.mode === 'split' && !stacked
            ? {
                gridTemplateColumns: `${layout.bounds.split}fr 5px ${100 - layout.bounds.split}fr`,
              }
            : undefined
        }
      >
        <div className="toolbar-source">
          <div className="source-command-grid">
            {history}
            {sourceActions}
            <span className="source-action-balance" aria-hidden="true" />
          </div>
        </div>
        {layout.mode === 'split' && !stacked && <div aria-hidden="true" />}
        <div className="toolbar-mode">
          <span aria-hidden="true" />
          {modes}
          <PanelControls />
        </div>
      </div>
      <div aria-hidden="true" />
    </div>
  );
}
function CollapsedRail({ id }: { id: 'explorer' | 'inspector' }) {
  const layout = usePanels();
  if (!layout.closed[id]) return null;
  return (
    <div className="panel-rail">
      <IconButton
        ref={layout.toggles[id]}
        label={`Show ${titles[id]}`}
        icon={id === 'explorer' ? PanelLeftOpen : PanelRightOpen}
        aria-expanded={false}
        onClick={() => layout.show(id)}
      />
    </div>
  );
}
export function IssuesToggle({ count }: { count: number }) {
  const layout = usePanels();
  return (
    <Button
      ref={layout.toggles.issues}
      variant="ghost"
      size="xs"
      aria-label={`${layout.closed.issues ? 'Show' : 'Hide'} Issues`}
      aria-expanded={!layout.closed.issues}
      onClick={() =>
        layout.closed.issues ? layout.show('issues') : layout.hide('issues')
      }
    >
      <TriangleAlert aria-hidden="true" />
      Issues ({count})
    </Button>
  );
}
function SideHeader({ id }: { id: Side }) {
  const layout = usePanels();
  return (
    <header className="panel-header">
      <h2>{titles[id]}</h2>
      <div className="panel-header-actions">
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="icon-xs"
              aria-label={`${titles[id]} panel options`}
            >
              <Ellipsis aria-hidden="true" />
            </Button>
          </PopoverTrigger>
          <PopoverContent
            align="end"
            className="layout-options"
            aria-label={`${titles[id]} panel size`}
          >
            <Button variant="ghost" onClick={() => layout.resize(id, -4)}>
              {id === 'issues' ? (
                <ArrowUpDown aria-hidden="true" />
              ) : (
                <ArrowLeftRight aria-hidden="true" />
              )}
              {id === 'issues' ? 'Shorter' : 'Narrow'} {titles[id]}
            </Button>
            <Button variant="ghost" onClick={() => layout.resize(id, 4)}>
              {id === 'issues' ? (
                <ArrowUpDown aria-hidden="true" />
              ) : (
                <ArrowLeftRight aria-hidden="true" />
              )}
              {id === 'issues' ? 'Taller' : 'Widen'} {titles[id]}
            </Button>
          </PopoverContent>
        </Popover>
        <IconButton
          ref={layout.collapseButtons[id]}
          size="icon-xs"
          label={`Collapse ${titles[id]}`}
          icon={
            id === 'explorer'
              ? PanelLeftClose
              : id === 'inspector'
                ? PanelRightClose
                : PanelBottomClose
          }
          onClick={() => layout.hide(id)}
        />
      </div>
    </header>
  );
}
const hitTarget = { coarse: 24, fine: 10 };
export function WorkbenchPanels({
  explorer,
  source,
  diagram,
  inspector,
  issues,
  issueKey,
}: {
  explorer: ReactNode;
  source: ReactNode;
  diagram: ReactNode;
  inspector: ReactNode;
  issues: ReactNode;
  issueKey: string;
}) {
  const layout = usePanels();
  const initial = layout.initial;
  const lastIssue = useRef('');
  useEffect(() => {
    if (issueKey && issueKey !== lastIssue.current)
      layout.show('issues', false);
    lastIssue.current = issueKey;
  }, [issueKey]);
  const side = (id: 'explorer' | 'inspector', content: ReactNode) => (
    <ResizablePanel
      id={id}
      panelRef={layout.panels[id]}
      defaultSize={initial[closedKey[id]] ? '0%' : `${initial[id]}%`}
      minSize={id === 'explorer' ? '145px' : '190px'}
      maxSize="420px"
      collapsible
      collapsedSize="0%"
      onResize={(size) => {
        layout.observe(id, size.asPercentage);
        layout.measure(id, size.inPixels);
      }}
    >
      <div
        className="panel-content"
        hidden={layout.closed[id]}
        inert={layout.closed[id]}
      >
        <SideHeader id={id} />
        {content}
      </div>
    </ResizablePanel>
  );
  return (
    <ResizablePanelGroup
      id="workspace-vertical"
      className="workspace-panels"
      orientation="vertical"
      groupRef={layout.verticalGroup}
      resizeTargetMinimumSize={hitTarget}
      onLayoutChanged={(value, meta) => layout.changed('vertical', value, meta)}
    >
      <ResizablePanel
        id="workspace"
        defaultSize={initial.issuesClosed ? '100%' : `${100 - initial.issues}%`}
        minSize="240px"
      >
        <ResizablePanelGroup
          id="workspace-horizontal"
          orientation="horizontal"
          groupRef={layout.outerGroup}
          resizeTargetMinimumSize={hitTarget}
          onLayoutChanged={(value, meta) =>
            layout.changed('outer', value, meta)
          }
        >
          {side('explorer', explorer)}
          <CollapsedRail id="explorer" />
          <ResizableHandle
            className="workbench-resizer"
            aria-label="Resize Explorer"
          />
          <ResizablePanel
            id="editors"
            minSize={layout.narrow ? '120px' : '360px'}
          >
            <ResizablePanelGroup
              id="workspace-editors"
              orientation={layout.narrow ? 'vertical' : 'horizontal'}
              groupRef={layout.editorGroup}
              resizeTargetMinimumSize={hitTarget}
              onLayoutChanged={(value, meta) =>
                layout.changed('editors', value, meta)
              }
            >
              <ResizablePanel
                id="source"
                panelRef={layout.source}
                onResize={(size) => layout.measure('split', size.asPercentage)}
                defaultSize={
                  layout.mode === 'diagram'
                    ? '0%'
                    : layout.mode === 'code'
                      ? '100%'
                      : `${initial.split}%`
                }
                minSize={layout.narrow ? '100px' : '160px'}
                collapsible={layout.mode !== 'split'}
                collapsedSize="0%"
              >
                <div
                  className="editor-content"
                  hidden={layout.mode === 'diagram'}
                  inert={layout.mode === 'diagram'}
                >
                  {source}
                </div>
              </ResizablePanel>
              <ResizableHandle
                withHandle={layout.mode === 'split'}
                className="workbench-resizer"
                disabled={layout.mode !== 'split'}
                aria-hidden={layout.mode !== 'split'}
                aria-label="Resize Source and Diagram"
              />
              <ResizablePanel
                id="diagram"
                panelRef={layout.diagram}
                defaultSize={
                  layout.mode === 'code'
                    ? '0%'
                    : layout.mode === 'diagram'
                      ? '100%'
                      : `${100 - initial.split}%`
                }
                minSize={layout.narrow ? '100px' : '200px'}
                collapsible={layout.mode !== 'split'}
                collapsedSize="0%"
              >
                <div
                  className="editor-content"
                  hidden={layout.mode === 'code'}
                  inert={layout.mode === 'code'}
                >
                  {diagram}
                </div>
              </ResizablePanel>
            </ResizablePanelGroup>
          </ResizablePanel>
          <ResizableHandle
            className="workbench-resizer"
            aria-label="Resize Inspector"
          />
          <CollapsedRail id="inspector" />
          {side('inspector', inspector)}
        </ResizablePanelGroup>
      </ResizablePanel>
      <ResizableHandle
        className="workbench-resizer"
        aria-label="Resize Issues"
      />
      <ResizablePanel
        id="issues"
        panelRef={layout.panels.issues}
        defaultSize={initial.issuesClosed ? '0%' : `${initial.issues}%`}
        minSize="96px"
        maxSize="60%"
        collapsible
        collapsedSize="0%"
        onResize={(size) => layout.observe('issues', size.asPercentage)}
      >
        <div
          className="panel-content"
          hidden={layout.closed.issues}
          inert={layout.closed.issues}
        >
          <SideHeader id="issues" />
          {issues}
        </div>
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}
