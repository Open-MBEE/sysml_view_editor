import {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
  type Ref,
} from 'react';
import type {
  GroupImperativeHandle,
  Layout,
  LayoutChangedMeta,
} from 'react-resizable-panels';
import {
  PanelLeft,
  PanelRight,
  PanelBottom,
  Maximize2,
  Minimize2,
  X,
  Focus,
  PanelsTopLeft,
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
  type WorkbenchLayout as Preferences,
} from './layout';

type Mode = 'code' | 'split' | 'diagram';
type Tool = 'explorer' | 'source' | 'inspection';
type Expanded = Tool | 'canvas' | null;
function useLayoutController(mode: Mode, onMode: (mode: Mode) => void) {
  const [initial] = useState(() => {
    try {
      return { value: loadLayout(window.localStorage, false), failed: false };
    } catch {
      return { value: { ...defaultLayout }, failed: true };
    }
  });
  const [preferences, setPreferences] = useState(initial.value);
  const saved = useRef(initial.value);
  const [storageFailed, setStorageFailed] = useState(initial.failed);
  const [expanded, setExpanded] = useState<Expanded>(null);
  const [narrow, setNarrow] = useState(() => window.innerWidth <= 900);
  const outer = useRef<GroupImperativeHandle>(null);
  const editors = useRef<GroupImperativeHandle>(null);
  const vertical = useRef<GroupImperativeHandle>(null);
  const toggleExplorer = useRef<HTMLButtonElement>(null);
  const toggleSource = useRef<HTMLButtonElement>(null);
  const toggleInspection = useRef<HTMLButtonElement>(null);
  const toggleFocus = useRef<HTMLButtonElement>(null);
  const triggers = {
    explorer: toggleExplorer,
    source: toggleSource,
    inspection: toggleInspection,
  };
  const focusTarget = useRef<HTMLButtonElement | null>(null);
  function remember(patch: Partial<Preferences>) {
    const next = { ...saved.current, ...patch };
    saved.current = next;
    setPreferences(next);
    try {
      setStorageFailed(!saveLayout(window.localStorage, next));
    } catch {
      setStorageFailed(true);
    }
  }
  useEffect(() => {
    const media = window.matchMedia('(max-width: 900px)');
    const changed = () => setNarrow(media.matches);
    media.addEventListener('change', changed);
    return () => media.removeEventListener('change', changed);
  }, []);
  const visible = {
    explorer: expanded
      ? expanded === 'explorer'
      : !preferences.explorerClosed && (!narrow || mode === 'diagram'),
    source: expanded ? expanded === 'source' : mode !== 'diagram',
    inspection: expanded
      ? expanded === 'inspection'
      : mode !== 'code' && !preferences.inspectionClosed,
    canvas: expanded ? expanded === 'canvas' : mode !== 'code',
  };
  useEffect(() => {
    const closed = mode === 'diagram';
    if (saved.current.sourceClosed !== closed)
      remember({ sourceClosed: closed });
  }, [mode]);
  // Apply after the panel library registers changed size constraints. Normal
  // preferences remain independent of temporary focus/maximise layouts.
  useEffect(() => {
    const apply = () => {
      outer.current?.setLayout({
        explorer:
          expanded === 'explorer'
            ? 100
            : visible.explorer
              ? preferences.explorer
              : 0,
        editors:
          expanded === 'explorer'
            ? 0
            : visible.explorer
              ? 100 - preferences.explorer
              : 100,
      });
      editors.current?.setLayout({
        centre: visible.source
          ? visible.canvas || visible.inspection
            ? 100 - preferences.source
            : 0
          : 100,
        source: visible.source
          ? visible.canvas || visible.inspection
            ? preferences.source
            : 100
          : 0,
      });
      vertical.current?.setLayout({
        diagram: visible.canvas
          ? visible.inspection
            ? 100 - preferences.inspection
            : 100
          : 0,
        inspection: visible.inspection
          ? visible.canvas
            ? preferences.inspection
            : 100
          : 0,
      });
    };
    const frame = requestAnimationFrame(apply);
    focusTarget.current?.focus({ preventScroll: true });
    focusTarget.current = null;
    return () => cancelAnimationFrame(frame);
  }, [
    expanded,
    visible.explorer,
    visible.source,
    visible.inspection,
    visible.canvas,
    preferences.explorer,
    preferences.source,
    preferences.inspection,
    narrow,
  ]);
  function show(id: Tool, focus = false) {
    setExpanded(null);
    if (id === 'source') {
      if (mode === 'diagram') onMode('split');
    } else if (id === 'explorer') {
      remember({ explorerClosed: false });
      if (narrow) onMode('diagram');
    } else {
      remember({ inspectionClosed: false });
      if (mode === 'code') onMode('split');
    }
    if (focus) focusTarget.current = triggers[id].current;
  }
  function hide(id: Tool) {
    setExpanded(null);
    if (id === 'source') onMode('diagram');
    else
      remember(
        id === 'explorer'
          ? { explorerClosed: true }
          : { inspectionClosed: true },
      );
    triggers[id].current?.focus({ preventScroll: true });
  }
  function toggle(id: Tool) {
    if (visible[id]) hide(id);
    else show(id);
  }
  function inspect(tab: Preferences['inspectionTab'], focus = false) {
    remember({ inspectionClosed: false, inspectionTab: tab });
    if (mode === 'code') onMode('split');
    setExpanded(null);
    if (focus) focusTarget.current = toggleInspection.current;
  }
  function maximize(id: Tool) {
    setExpanded((before) => (before === id ? null : id));
    focusTarget.current = triggers[id].current;
  }
  function focus() {
    setExpanded((before) => (before === 'canvas' ? null : 'canvas'));
    focusTarget.current = toggleFocus.current;
  }
  function changed(
    group: 'outer' | 'editors' | 'vertical',
    value: Layout,
    meta: LayoutChangedMeta,
  ) {
    if (!meta.isUserInteraction || expanded) return;
    const wanted = meta.requestedLayout ?? value;
    if (group === 'outer')
      remember({
        explorerClosed: value.explorer === 0,
        ...(wanted.explorer! >= 5 && wanted.explorer! <= 45
          ? { explorer: wanted.explorer }
          : {}),
      });
    if (group === 'editors' && mode === 'split') {
      if (value.source === 0) onMode('diagram');
      else if (wanted.source! >= 10 && wanted.source! <= 65)
        remember({ source: wanted.source });
    }
    if (group === 'vertical')
      remember({
        inspectionClosed: value.inspection === 0,
        ...(wanted.inspection! >= 12 && wanted.inspection! <= 60
          ? { inspection: wanted.inspection }
          : {}),
      });
  }
  function reset() {
    remember({ ...defaultLayout });
    setExpanded(null);
    onMode('diagram');
  }
  return {
    mode,
    onMode,
    preferences,
    visible,
    initial: initial.value,
    storageFailed,
    expanded,
    narrow,
    outer,
    editors,
    vertical,
    triggers,
    toggleFocus,
    remember,
    show,
    hide,
    toggle,
    inspect,
    maximize,
    focus,
    changed,
    reset,
  };
}
type Controller = ReturnType<typeof useLayoutController>;
const PanelContext = createContext<Controller | null>(null);
function usePanels() {
  const value = useContext(PanelContext);
  if (!value) throw new Error('Workspace panel provider is missing.');
  return value;
}
export function WorkbenchLayout({
  mode,
  onMode,
  children,
}: {
  mode: Mode;
  onMode: (mode: Mode) => void;
  children: ReactNode;
}) {
  return (
    <PanelContext value={useLayoutController(mode, onMode)}>
      {children}
    </PanelContext>
  );
}
export function PanelControls() {
  const c = usePanels();
  return (
    <div className="panel-controls" role="group" aria-label="Workspace panels">
      {(['explorer', 'inspection', 'source'] as const).map((id) => (
        <IconButton
          key={id}
          ref={c.triggers[id]}
          label={`${c.visible[id] ? 'Hide' : 'Show'} ${id === 'inspection' ? 'Inspector' : id === 'explorer' ? 'Explorer' : 'Source'}`}
          icon={
            id === 'explorer'
              ? PanelLeft
              : id === 'source'
                ? PanelRight
                : PanelBottom
          }
          aria-pressed={c.visible[id]}
          aria-controls={`workspace-${id}`}
          onClick={() => c.toggle(id)}
        />
      ))}
      <IconButton
        ref={c.toggleFocus}
        label={c.expanded === 'canvas' ? 'Restore workspace' : 'Focus model'}
        icon={Focus}
        aria-pressed={c.expanded === 'canvas'}
        onClick={c.focus}
      />
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
          <Button variant="ghost" onClick={c.reset}>
            <RotateCcw aria-hidden="true" />
            Reset layout
          </Button>
          {c.storageFailed && (
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
export function InspectButton() {
  const c = usePanels();
  return (
    <Button variant="ghost" size="xs" onClick={() => c.inspect('properties')}>
      Inspect selection
    </Button>
  );
}
export function IssuesToggle({ count }: { count: number }) {
  const c = usePanels();
  const open = c.visible.inspection && c.preferences.inspectionTab === 'issues';
  return (
    <Button
      variant="ghost"
      size="xs"
      aria-label={`${open ? 'Hide' : 'Show'} Issues`}
      aria-expanded={open}
      onClick={() => (open ? c.hide('inspection') : c.inspect('issues'))}
    >
      <TriangleAlert aria-hidden="true" />
      Issues ({count})
    </Button>
  );
}
function ToolActions({
  id,
  closeRef,
}: {
  id: Tool;
  closeRef?: Ref<HTMLButtonElement>;
}) {
  const c = usePanels();
  const name =
    id === 'inspection' ? 'Inspector' : id === 'source' ? 'Source' : 'Explorer';
  return (
    <div className="panel-header-actions">
      <IconButton
        size="icon-xs"
        label={`${c.expanded === id ? 'Restore' : 'Maximize'} ${name}`}
        icon={c.expanded === id ? Minimize2 : Maximize2}
        onClick={() => c.maximize(id)}
      />
      <IconButton
        size="icon-xs"
        ref={closeRef}
        label={`Collapse ${name}`}
        icon={X}
        onClick={() => c.hide(id)}
      />
    </div>
  );
}
const hitTarget = { coarse: 24, fine: 10 };
export function WorkbenchPanels({
  explorer,
  source,
  diagram,
  inspector,
  relationships,
  issues,
  issueKey,
  inspectionRequest,
  sourceRequest,
}: {
  explorer: ReactNode;
  source: ReactNode;
  diagram: ReactNode;
  inspector: ReactNode;
  relationships: ReactNode;
  issues: ReactNode;
  issueKey: string;
  inspectionRequest: number;
  sourceRequest: number;
}) {
  const c = usePanels();
  const lastIssue = useRef('');
  const inspectionClose = useRef<HTMLButtonElement>(null);
  // Explicit reveal requests belong to this project surface. Mounting its
  // replacement must not replay requests consumed by the previous project.
  const requests = useRef({
    source: sourceRequest,
    inspection: inspectionRequest,
  });
  useEffect(() => {
    if (
      sourceRequest !== requests.current.source &&
      sourceRequest &&
      !c.visible.source
    )
      c.show('source');
    requests.current.source = sourceRequest;
  }, [sourceRequest]);
  const sourceContent = useRef<HTMLDivElement>(null);
  const [sourceMinimum, setSourceMinimum] = useState(240);
  useLayoutEffect(() => {
    const content = sourceContent.current;
    if (!content) return;
    const headers = [
      ...content.querySelectorAll<HTMLElement>(
        '.panel-header, .content-tabs, .source-pane-header',
      ),
    ];
    const measure = () => {
      const height = headers.reduce(
        (sum, item) => sum + item.getBoundingClientRect().height,
        0,
      );
      if (height > 0) setSourceMinimum(Math.ceil(height) + 80);
    };
    const observer = new ResizeObserver(measure);
    headers.forEach((item) => observer.observe(item));
    measure();
    return () => observer.disconnect();
  }, [source]);

  useEffect(() => {
    let frame = 0;
    let settled = 0;
    if (
      inspectionRequest !== requests.current.inspection &&
      inspectionRequest
    ) {
      const focusOpenedTool = c.narrow && !c.visible.inspection;
      c.inspect('properties');
      // The newly opened bottom dock can clip the table row that requested it.
      // Transfer phone keyboard focus after the resized panels have committed.
      if (focusOpenedTool)
        frame = requestAnimationFrame(() => {
          settled = requestAnimationFrame(() => {
            if (inspectionClose.current?.getClientRects().length)
              inspectionClose.current.focus({ preventScroll: true });
          });
        });
    }
    requests.current.inspection = inspectionRequest;
    return () => {
      cancelAnimationFrame(frame);
      cancelAnimationFrame(settled);
    };
  }, [inspectionRequest]);
  useEffect(() => {
    if (issueKey && issueKey !== lastIssue.current) c.inspect('issues');
    lastIssue.current = issueKey;
  }, [issueKey]);
  const inspectionTab = c.preferences.inspectionTab;
  return (
    <ResizablePanelGroup
      id="workspace-horizontal"
      className="workspace-panels"
      orientation="horizontal"
      groupRef={c.outer}
      resizeTargetMinimumSize={hitTarget}
      onLayoutChanged={(v, m) => c.changed('outer', v, m)}
    >
      <ResizablePanel
        id="explorer"
        defaultSize={c.initial.explorerClosed ? '0%' : `${c.initial.explorer}%`}
        minSize={c.narrow ? '140px' : '200px'}
        maxSize={c.expanded === 'explorer' ? '100%' : '45%'}
        collapsible
        collapsedSize="0%"
      >
        <div
          id="workspace-explorer"
          className="panel-content"
          hidden={!c.visible.explorer}
          inert={!c.visible.explorer}
        >
          <header className="panel-header">
            <h2 data-tour-explorer="">Explorer</h2>
            <ToolActions id="explorer" />
          </header>
          {explorer}
        </div>
      </ResizablePanel>
      <ResizableHandle
        className="workbench-resizer"
        aria-label="Resize Explorer"
      />
      <ResizablePanel
        id="editors"
        minSize={c.narrow ? '120px' : '360px'}
        collapsible
        collapsedSize="0%"
      >
        <ResizablePanelGroup
          id="workspace-editors"
          orientation={c.narrow ? 'vertical' : 'horizontal'}
          groupRef={c.editors}
          resizeTargetMinimumSize={hitTarget}
          onLayoutChanged={(v, m) => c.changed('editors', v, m)}
        >
          <ResizablePanel
            id="centre"
            defaultSize="100%"
            minSize={c.narrow ? '100px' : '240px'}
            collapsible={c.mode === 'code' || c.expanded === 'source'}
            collapsedSize="0%"
          >
            <ResizablePanelGroup
              id="workspace-vertical"
              orientation="vertical"
              groupRef={c.vertical}
              resizeTargetMinimumSize={hitTarget}
              onLayoutChanged={(v, m) => c.changed('vertical', v, m)}
            >
              <ResizablePanel
                id="diagram"
                defaultSize={
                  c.initial.inspectionClosed
                    ? '100%'
                    : `${100 - c.initial.inspection}%`
                }
                minSize="100px"
                collapsible
                collapsedSize="0%"
              >
                <div
                  className="editor-content"
                  hidden={!c.visible.canvas}
                  inert={!c.visible.canvas}
                >
                  {diagram}
                </div>
              </ResizablePanel>
              <ResizableHandle
                className="workbench-resizer"
                aria-label={
                  c.preferences.inspectionTab === 'issues'
                    ? 'Resize Issues'
                    : 'Resize Inspector'
                }
              />
              <ResizablePanel
                id="inspection"
                defaultSize={
                  c.initial.inspectionClosed ? '0%' : `${c.initial.inspection}%`
                }
                minSize="140px"
                collapsible
                collapsedSize="0%"
              >
                <div
                  id="workspace-inspection"
                  role="region"
                  aria-label="Inspection dock"
                  className="panel-content inspection-dock"
                  hidden={!c.visible.inspection}
                  inert={!c.visible.inspection}
                >
                  <header className="panel-header">
                    <div
                      role="tablist"
                      aria-label="Inspection panels"
                      onKeyDown={(event) => {
                        if (
                          !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(
                            event.key,
                          )
                        )
                          return;
                        const tabs = [
                          ...event.currentTarget.querySelectorAll<HTMLButtonElement>(
                            '[role="tab"]',
                          ),
                        ];
                        const current = tabs.indexOf(
                          document.activeElement as HTMLButtonElement,
                        );
                        const next =
                          event.key === 'Home'
                            ? 0
                            : event.key === 'End'
                              ? tabs.length - 1
                              : (current +
                                  (event.key === 'ArrowRight' ? 1 : -1) +
                                  tabs.length) %
                                tabs.length;
                        event.preventDefault();
                        tabs[next]?.click();
                        tabs[next]?.focus();
                      }}
                    >
                      {(['properties', 'relationships', 'issues'] as const).map(
                        (tab) => (
                          <Button
                            key={tab}
                            role="tab"
                            tabIndex={inspectionTab === tab ? 0 : -1}
                            aria-selected={inspectionTab === tab}
                            aria-controls={`inspection-${tab}`}
                            id={`inspection-tab-${tab}`}
                            variant="ghost"
                            size="xs"
                            onClick={() => c.remember({ inspectionTab: tab })}
                          >
                            {tab === 'properties'
                              ? 'Properties'
                              : tab === 'relationships'
                                ? 'Relationships'
                                : 'Issues'}
                          </Button>
                        ),
                      )}
                    </div>
                    <ToolActions id="inspection" closeRef={inspectionClose} />
                  </header>
                  <div
                    id="inspection-properties"
                    role="tabpanel"
                    aria-labelledby="inspection-tab-properties"
                    hidden={inspectionTab !== 'properties'}
                    inert={inspectionTab !== 'properties'}
                  >
                    {inspector}
                  </div>
                  <div
                    id="inspection-relationships"
                    role="tabpanel"
                    aria-labelledby="inspection-tab-relationships"
                    hidden={inspectionTab !== 'relationships'}
                    inert={inspectionTab !== 'relationships'}
                  >
                    {relationships}
                  </div>
                  <div
                    id="inspection-issues"
                    role="tabpanel"
                    aria-labelledby="inspection-tab-issues"
                    hidden={inspectionTab !== 'issues'}
                    inert={inspectionTab !== 'issues'}
                  >
                    {issues}
                  </div>
                </div>
              </ResizablePanel>
            </ResizablePanelGroup>
          </ResizablePanel>
          <ResizableHandle
            className="workbench-resizer"
            aria-label="Resize Source and Diagram"
          />
          <ResizablePanel
            id="source"
            defaultSize="0%"
            minSize={c.narrow ? `${sourceMinimum}px` : '280px'}
            maxSize="100%"
            collapsible={c.mode !== 'split' || c.expanded !== null}
            collapsedSize="0%"
          >
            <div
              id="workspace-source"
              ref={sourceContent}
              className="editor-content"
              hidden={!c.visible.source}
              inert={!c.visible.source}
            >
              <header className="panel-header">
                <h2>Source</h2>
                <ToolActions id="source" />
              </header>
              {source}
            </div>
          </ResizablePanel>
        </ResizablePanelGroup>
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}
