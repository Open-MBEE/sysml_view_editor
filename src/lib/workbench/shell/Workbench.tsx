import type { ExplorationRequest } from '$lib/workspace/exploration';
import { Button } from '$lib/ui/primitives/button';
import { ArrowLeft, ArrowRight, House } from 'lucide-react';
import { ContentTabs } from './ContentTabs';
import { openTab, type WorkspaceTab } from './workspace-tabs';
import { RequirementsPanel } from '../requirements/RequirementsPanel';
import { inspectionSource } from '../properties/inspection-source';
import type {
  RequirementsResult,
  RequirementSubject,
} from '$lib/workspace/requirements';
import {
  WorkbenchLayout,
  WorkbenchPanels,
  IssuesToggle,
  InspectButton,
} from './WorkbenchPanels';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createBrowserSession } from './session';
import { exampleProject, exampleView } from './example';
import type { Workspace, WorkspaceState } from '$lib/workspace/createWorkspace';
import type { ProjectBundle } from '$lib/workspace/persistence';
import type { EditProposal, SemanticCommand } from '$lib/workspace/editing';
import type {
  ModelElement,
  Diagnostic,
  SourceLocation,
} from '$lib/workspace/project';
import { Explorer } from '../explorer/Explorer';
import { SourceEditor } from '../source/SourceEditor';
import { Diagram } from '../diagrams/Diagram';
import { Relationships } from '../properties/Relationships';
import { Properties } from '../properties/Properties';
import { diagramRelationshipSelection } from '../properties/diagram-selection';
import { Issues } from '../issues/Issues';
import { issueLocation } from '../issues/navigation';
import { WorkbenchDialogs } from './WorkbenchDialogs';
import {
  useLocalRecovery,
  RecoveryButton,
  RecoveryBanner,
} from '../recovery/RecoveryControls';
import type { RecoveryEntry } from '../recovery/envelope';
import { ProjectLauncher } from '../entry/ProjectLauncher';
import { ProjectHeader } from './ProjectHeader';
import { loadLayout } from './layout';
import { WorkspaceToolbar } from './WorkspaceToolbar';
import { SourcePaneHeader } from './SourcePaneHeader';
import { WorkspaceOpener } from './WorkspaceOpener';
import { ModelPaneHeader } from './ModelPaneHeader';
import { DiagramTargetControls } from '../diagrams/DiagramTargetControls';
import {
  createLocalProject,
  readProjectFiles,
  downloadProject,
} from './projectFiles';
import type { EntryRequest } from '../entry/Application';
import { DocumentPane } from '../documents/DocumentPane';
import {
  documentSourceTarget,
  type DocumentClick,
} from '$lib/workspace/documents';

const initial: WorkspaceState = {
  project: null,
  model: null,
  revision: 0,
  busy: false,
  dirty: false,
  unapplied: false,
  canUndo: false,
  canRedo: false,
  diagnostics: [],
  diagnosticDocuments: [],
  view: null,
  exploration: null,
  renderedDocument: null,
  layoutNotices: [],
};
type Mode = 'split' | 'code' | 'diagram';
export function Workbench({
  active,
  entryRequest,
  onHome,
}: {
  active: boolean;
  entryRequest: EntryRequest;
  onHome: () => void;
}) {
  const [rerenderingDocument, setRerenderingDocument] = useState<string | null>(
    null,
  );
  const [documentFailure, setDocumentFailure] = useState<string | null>(null);
  const [projectGeneration, setProjectGeneration] = useState(0);
  const [workspaceFocusRequest, setWorkspaceFocusRequest] = useState(0);
  const [workspaceTabs, setWorkspaceTabs] = useState<WorkspaceTab[]>([]);
  const [sourceTabs, setSourceTabs] = useState<{ id: string; label: string }[]>(
    [],
  );

  const cameras = useRef(
    new Map<string, { x: number; y: number; zoom: number }>(),
  );
  const [navigation, setNavigation] = useState<{
    entries: WorkspaceTab[];
    index: number;
  }>({ entries: [], index: -1 });
  const [dataMode, setDataMode] = useState<
    'diagram' | 'table' | 'matrix' | 'document'
  >('diagram');
  const [readySession, setReadySession] = useState<Workspace | null>(null);
  const [launcherOpen, setLauncherOpen] = useState(true);
  const [everOpened, setEverOpened] = useState(false);
  const [origin, setOrigin] = useState('Local project');
  const launcherTrigger = useRef<HTMLButtonElement>(null);
  const handledEntry = useRef<{ session: Workspace; id: number } | null>(null);
  const resumed = useRef(false);
  const ref = useRef<Workspace | null>(null),
    picker = useRef<HTMLInputElement>(null);
  const languageRef = useRef<
    ReturnType<typeof createBrowserSession>['language'] | null
  >(null);
  const workspaceSurface = useRef<HTMLElement>(null);
  const reviewGeneration = useRef(0);
  const actionGeneration = useRef(0);
  const [state, setState] = useState(initial),
    [file, setFile] = useState(exampleProject.documents[0]!.name),
    [selected, setSelected] = useState(''),
    [treeSelectionRequest, setTreeSelectionRequest] = useState(0),
    [inspectionRequest, setInspectionRequest] = useState(0),
    [sourceRequest, setSourceRequest] = useState(0),
    [error, setError] = useState(''),
    [message, setMessage] = useState('Choose a project to begin.');
  const [inspectionTarget, setInspectionTarget] = useState<{
    modelHash: string;
    origin?: SourceLocation;
  }>();
  const [requirementSelection, setRequirementSelection] = useState<{
    modelHash: string;
    subject: RequirementSubject;
    row?: RequirementsResult['requirements'][number];
  }>();
  const [symbolSelection, setSymbolSelection] = useState<{
    view: string;
    modelHash: string;
    symbol: string;
  }>();
  const [explorationFocus, setExplorationFocus] = useState<
    'scope' | 'representation'
  >();
  const [mode, setMode] = useState<Mode>(() => {
      try {
        return loadLayout(window.localStorage, false).sourceClosed
          ? 'diagram'
          : 'split';
      } catch {
        return 'diagram';
      }
    }),
    [dialog, setDialog] = useState<
      'project' | 'view' | 'part' | 'connection' | 'proposal' | null
    >(null);
  const [proposal, setProposal] = useState<EditProposal>(),
    [focusRange, setFocusRange] = useState<{
      file: string;
      start: number;
      end: number;
      focus?: boolean;
    }>();
  const recovery = useLocalRecovery({
    state,
    activeFile: file,
    activeView: state.view?.view ?? null,
  });
  async function restoreRecovery(entry: RecoveryEntry) {
    if (!replaceAllowed()) return;
    const session = workspace();
    await session.open(entry.project, { unsaved: true });
    setDataMode('diagram');
    const restored = session.snapshot();
    setProjectGeneration((value) => value + 1);
    setWorkspaceTabs([]);
    setSourceTabs([]);
    cameras.current.clear();
    setNavigation({ entries: [], index: -1 });
    recovery.acceptRestored({
      project: restored.project!,
      activeFile: entry.activeFile,
      activeView: entry.activeView,
      dirty: restored.dirty || restored.unapplied,
    });
    setSelected('');
    setInspectionTarget(undefined);
    setRequirementSelection(undefined);
    setSymbolSelection(undefined);
    setFile(entry.activeFile ?? entry.project.drafts[0]!.name);
    setFocusRange(undefined);
    setMode('split');
    setMessage('Local recovery restored.');
    setOrigin('Browser recovery');
    setEverOpened(true);
    setLauncherOpen(false);
    // Recovery is accepted; visualization failures belong to Workbench actions.
    await run(() => refreshView(session, entry.activeView ?? undefined));
  }
  const element = state.model?.elements.find((item) => item.id === selected);
  const inspectedSubject =
    requirementSelection &&
    requirementSelection.modelHash === state.model?.modelHash &&
    (requirementSelection.subject.qualifiedName ?? '') === selected
      ? requirementSelection
      : undefined;
  const inspectedRequirement = inspectedSubject?.row;
  const inspectionRange =
    inspectionTarget?.modelHash === state.model?.modelHash
      ? inspectionSource(
          inspectionTarget?.origin,
          state.project?.documents ?? [],
          state.project?.drafts ?? [],
        )
      : undefined;

  // Adapt only for shared rendering/selection; workspace state and saved views stay distinct.
  const displayedView = useMemo(
    () =>
      state.view ??
      (state.exploration ? { ...state.exploration, view: '' } : null),
    [state.view, state.exploration],
  );
  const diagramIdentity = state.exploration
    ? JSON.stringify(state.exploration.request)
    : state.view?.view;
  const currentTab: WorkspaceTab | undefined =
    dataMode === 'table' || dataMode === 'matrix'
      ? {
          id: dataMode,
          kind: dataMode,
          label:
            dataMode === 'table' ? 'Requirements table' : 'Traceability matrix',
        }
      : dataMode === 'document' && state.renderedDocument
        ? {
            id: 'document:' + state.renderedDocument.document,
            kind: 'document',
            target: state.renderedDocument.document,
            label:
              state.model?.documents?.find(
                (item) =>
                  item.qualifiedName === state.renderedDocument?.document,
              )?.name ?? 'Document',
          }
        : dataMode === 'document'
          ? undefined
          : state.exploration
            ? {
                id:
                  'exploration:' +
                  JSON.stringify(state.exploration.request.scope),
                kind: 'exploration',
                request: state.exploration.request,
                label:
                  state.exploration.request.scope.kind === 'project'
                    ? 'Project overview'
                    : (state.exploration.request.scope.subject
                        .split('::')
                        .at(-1) ?? 'Exploration'),
              }
            : state.view
              ? {
                  id: 'view:' + state.view.view,
                  kind: 'view',
                  target: state.view.view,
                  label:
                    state.model?.elements.find(
                      (item) => item.id === state.view?.view,
                    )?.name ??
                    state.view.view.split('::').at(-1) ??
                    'Diagram',
                }
              : undefined;
  const cameraKey = `${projectGeneration}:${displayedView?.modelHash ?? ''}:${diagramIdentity ?? ''}`;
  const currentTabKey = currentTab ? JSON.stringify(currentTab) : '';
  useEffect(() => {
    if (currentTab) setWorkspaceTabs((tabs) => openTab(tabs, currentTab));
  }, [currentTabKey, projectGeneration]);
  useEffect(() => {
    if (state.project?.drafts.some((item) => item.name === file))
      setSourceTabs((tabs) => openTab(tabs, { id: file, label: file }));
  }, [file, projectGeneration]);
  useEffect(() => {
    if (!currentTab) return;
    setNavigation((before) =>
      before.entries[before.index]?.id === currentTab.id
        ? before
        : {
            entries: [...before.entries.slice(0, before.index + 1), currentTab],
            index: before.index + 1,
          },
    );
  }, [currentTabKey, projectGeneration]);
  async function navigateHistory(delta: number) {
    const index = navigation.index + delta;
    const tab = navigation.entries[index];
    if (tab && (await activateTab(tab)))
      setNavigation((before) => ({ ...before, index }));
  }
  function exploreScope(subject?: ModelElement) {
    const request: ExplorationRequest = !subject
      ? { scope: { kind: 'project' }, representation: 'tree' }
      : subject.kind === 'package'
        ? {
            scope: { kind: 'package', subject: subject.id },
            representation: 'tree',
          }
        : {
            scope: { kind: 'element', subject: subject.id },
            representation: 'interconnection',
          };
    void run(async () => {
      await workspace().explore(request);
      setDataMode('diagram');
    });
  }
  const breadcrumbScope = state.exploration?.request.scope;
  async function activateTab(tab: WorkspaceTab) {
    let success = false;
    await run(async () => {
      if (tab.kind === 'view') {
        if (
          state.view?.view !== tab.target ||
          state.view.modelHash !== state.model?.modelHash
        )
          await workspace().openView(tab.target);
        setDataMode('diagram');
      } else if (tab.kind === 'exploration') {
        if (
          JSON.stringify(state.exploration?.request) !==
            JSON.stringify(tab.request) ||
          state.exploration?.modelHash !== state.model?.modelHash
        )
          await workspace().explore(tab.request);
        setDataMode('diagram');
      } else if (tab.kind === 'document') {
        if (
          state.renderedDocument?.document !== tab.target ||
          state.renderedDocument.modelHash !== state.model?.modelHash
        )
          await workspace().openDocument(tab.target);
        setDataMode('document');
      } else setDataMode(tab.kind);
      success = true;
    });
    return success;
  }
  async function closeWorkspaceTab(id: string) {
    const remaining = workspaceTabs.filter((tab) => tab.id !== id);
    if (!remaining.length) return;
    if (id === currentTab?.id && !(await activateTab(remaining.at(-1)!)))
      return;
    setWorkspaceTabs(remaining);
  }
  function closeSourceTab(id: string) {
    const remaining = sourceTabs.filter((tab) => tab.id !== id);
    if (!remaining.length) return;
    if (file === id) {
      setFocusRange(undefined);
      setFile(remaining.at(-1)!.id);
    }
    setSourceTabs(remaining);
  }
  const selectedCorrespondence =
    symbolSelection?.view === diagramIdentity &&
    symbolSelection?.modelHash === displayedView?.modelHash
      ? displayedView?.correspondence.find(
          (item) => item.symbol === symbolSelection?.symbol,
        )
      : undefined;
  const relationshipSelection = diagramRelationshipSelection(
    displayedView,
    selectedCorrespondence?.symbol,
    !!state.exploration,
  );
  const selectedArtifactNode = displayedView?.artifact?.nodes.find(
    (item) => item.id === selectedCorrespondence?.symbol,
  );
  const usageContext = selectedCorrespondence?.context
    .slice(0, -1)
    .map(
      (origin) =>
        displayedView?.correspondence.find((item) => item.subject.id === origin)
          ?.subject.qualifiedName ?? 'Unresolved context',
    );
  const source =
    state.project?.drafts.find((item) => item.name === file) ??
    state.project?.drafts[0];
  const presentation =
    state.view && state.project
      ? state.project.presentations[state.view.view]
      : undefined;
  const compatiblePresentation =
    presentation?.sourceHash === state.model?.sourceHash
      ? presentation
      : undefined;
  function workspace() {
    if (!ref.current) throw new Error('The workspace is starting.');
    return ref.current;
  }
  async function refreshView(
    session: Workspace,
    preferred?: string,
    preferredDocument?: string,
  ) {
    const generation = actionGeneration.current;
    const document =
      preferredDocument &&
      session
        .snapshot()
        .model?.documents?.some(
          (item) => item.qualifiedName === preferredDocument,
        )
        ? preferredDocument
        : undefined;
    setDocumentFailure(null);
    setRerenderingDocument(document ?? null);
    try {
      const views =
        session
          .snapshot()
          .model?.elements.filter((item) => item.kind === 'viewUsage') ?? [];
      const target = views.find((item) => item.id === preferred) ?? views[0];
      if (target) await session.openView(target.id);
      else
        await session.explore({
          scope: { kind: 'project' },
          representation: 'tree',
        });
    } finally {
      // A separate display failure must not skip the document of this revision.
      if (generation === actionGeneration.current) {
        try {
          if (document) await session.openDocument(document);
          else if (dataMode === 'document') setDataMode('diagram');
        } catch (error) {
          if (generation === actionGeneration.current)
            setDocumentFailure(
              error instanceof Error ? error.message : String(error),
            );
          throw error;
        } finally {
          if (generation === actionGeneration.current)
            setRerenderingDocument(null);
        }
      }
    }
  }

  useEffect(() => {
    const { workspace: session, language } = createBrowserSession();
    languageRef.current = language;
    ref.current = session;
    const unsubscribe = session.subscribe(setState);
    setReadySession(session);
    return () => {
      unsubscribe();
      session.dispose();
      if (ref.current === session) {
        ref.current = null;
        languageRef.current = null;
      }
    };
  }, []);
  useEffect(() => {
    if (
      !readySession ||
      ref.current !== readySession ||
      (handledEntry.current?.session === readySession &&
        handledEntry.current.id === entryRequest.id)
    )
      return;
    handledEntry.current = { session: readySession, id: entryRequest.id };
    setLauncherOpen(true);
    if (entryRequest.kind === 'example') void run(loadExample);
  }, [readySession, entryRequest]);
  useEffect(() => {
    if (!active) {
      reviewGeneration.current++;
      setDialog(null);
      setProposal(undefined);
    }
  }, [active]);
  useLayoutEffect(() => {
    if (launcherOpen || !active) return;
    if (resumed.current) launcherTrigger.current?.focus();
    else workspaceSurface.current?.focus();
    resumed.current = false;
  }, [launcherOpen, active]);
  function resume() {
    resumed.current = true;
    setError('');
    setLauncherOpen(false);
  }
  async function loadExample() {
    if (!replaceAllowed()) return;
    await open(exampleProject, {
      origin: 'Built-in example',
      preferred: exampleView,
    });
  }
  async function run(action: () => unknown | Promise<unknown>) {
    const generation = ++actionGeneration.current;
    setError('');
    try {
      await action();
    } catch (reason) {
      if (generation === actionGeneration.current)
        setError(reason instanceof Error ? reason.message : String(reason));
    }
  }
  async function open(
    project: ProjectBundle,
    options: {
      origin?: string;
      preferred?: string;
      mode?: Mode;
      unsaved?: boolean;
    } = {},
  ) {
    const session = workspace();
    await session.open(project, { unsaved: options.unsaved });
    setProjectGeneration((value) => value + 1);
    setWorkspaceTabs([]);
    setSourceTabs([]);
    cameras.current.clear();
    setNavigation({ entries: [], index: -1 });
    setDataMode('diagram');
    setSelected('');
    setInspectionTarget(undefined);
    setRequirementSelection(undefined);
    setSymbolSelection(undefined);
    setFile(project.drafts[0]!.name);
    setFocusRange(undefined);
    setMessage('Project opened locally.');
    setOrigin(options.origin ?? 'Imported copy');
    if (options.mode) setMode(options.mode);
    else if (
      !session
        .snapshot()
        .model?.elements.some((item) => item.kind === 'viewUsage')
    )
      setMode('split');
    setEverOpened(true);
    setLauncherOpen(false);
    await refreshView(session, options.preferred);
  }
  function replaceAllowed() {
    return (
      !workspace().snapshot().dirty ||
      confirm(
        'Replace this project and discard changes that have not been downloaded?',
      )
    );
  }
  function newProject(projectName: string) {
    setDialog(null);
    void run(() =>
      open(createLocalProject(projectName), {
        origin: 'New local project',
        mode: 'code',
        unsaved: true,
      }),
    );
  }
  async function importFiles(files: FileList | null) {
    if (!files?.length) return;
    const chosen = Array.from(files);
    if (!replaceAllowed()) return;
    await open(await readProjectFiles(chosen));
  }
  function download() {
    downloadProject(workspace());
    setMessage(
      'Project download prepared. Keep the downloaded file to reopen your work.',
    );
  }
  useEffect(() => {
    function unload(event: BeforeUnloadEvent) {
      if (state.dirty) {
        event.preventDefault();
        event.returnValue = '';
      }
    }
    function keyboard(event: KeyboardEvent) {
      const current = ref.current?.snapshot();
      if (
        active &&
        !launcherOpen &&
        !current?.busy &&
        current?.project &&
        !event.defaultPrevented &&
        !(
          event.target instanceof Element &&
          event.target.closest('[role="dialog"]')
        ) &&
        (event.ctrlKey || event.metaKey) &&
        event.key.toLowerCase() === 's'
      ) {
        event.preventDefault();
        void run(download);
      }
    }
    window.addEventListener('beforeunload', unload);
    window.addEventListener('keydown', keyboard);
    return () => {
      window.removeEventListener('beforeunload', unload);
      window.removeEventListener('keydown', keyboard);
    };
  }, [state.dirty, active, launcherOpen]);
  function newView() {
    setDialog('view');
  }
  function newPart() {
    setDialog('part');
  }
  function newConnection() {
    setDialog('connection');
  }
  async function reviewRename(name: string) {
    if (!element) return;
    await reviewView({ kind: 'rename', target: element.id, name: name.trim() });
  }
  async function reviewView(command: SemanticCommand) {
    const generation = ++reviewGeneration.current;
    try {
      const candidate = await workspace().prepare(command);
      if (generation !== reviewGeneration.current) return;
      setProposal(candidate);
      setDialog('proposal');
    } catch (reason) {
      if (generation === reviewGeneration.current) throw reason;
    }
  }
  async function accept() {
    if (!proposal) return;
    const session = workspace(),
      active = session.snapshot().view?.view,
      command = proposal.command;
    session.accept(proposal);
    setProposal(undefined);
    setDialog(null);
    setMessage('Applied source transaction.');
    setFocusRange(undefined);
    setSymbolSelection(undefined);
    if (command.kind === 'rename') {
      const split = command.target.lastIndexOf('::');
      setSelected(
        (split >= 0 ? command.target.slice(0, split + 2) : '') + command.name,
      );
    }
    if (command.kind === 'createPart' || command.kind === 'connectPorts')
      setSelected(command.owner + '::' + command.name);
    await refreshView(
      session,
      command.kind === 'createView'
        ? command.owner + '::' + command.name
        : active,
    );
    if (command.kind === 'createView') setDataMode('diagram');
  }
  function selectSymbol(symbol: string, inspect = false) {
    setRequirementSelection(undefined);
    const correspondence = displayedView?.correspondence.find(
      (item) => item.symbol === symbol,
    );
    setSymbolSelection(undefined);
    setSelected(correspondence?.subject.qualifiedName ?? '');
    if (correspondence && displayedView)
      setSymbolSelection({
        view: diagramIdentity ?? '',
        modelHash: displayedView.modelHash,
        symbol,
      });
    if (correspondence?.subject.qualifiedName) {
      setSelected(correspondence.subject.qualifiedName);
      setTreeSelectionRequest((request) => request + 1);
    }
    setInspectionTarget({
      modelHash: state.model?.modelHash ?? '',
      origin:
        displayedView?.modelHash === state.model?.modelHash
          ? correspondence?.subject.origin
          : undefined,
    });
    setFocusRange(undefined);
    if (inspect && correspondence) setInspectionRequest((value) => value + 1);
  }
  function selectElement(item: ModelElement) {
    setRequirementSelection(undefined);
    setSelected(item.id);
    const occurrences =
      displayedView?.correspondence.filter(
        (entry) =>
          entry.subject.qualifiedName === item.id &&
          displayedView.artifact?.nodes.some(
            (node) =>
              node.id === entry.symbol ||
              node.ports?.some((port) => port.id === entry.symbol),
          ),
      ) ?? [];
    const occurrence = occurrences.length === 1 ? occurrences[0] : undefined;
    setSymbolSelection(
      occurrence &&
        displayedView &&
        displayedView.modelHash === state.model?.modelHash
        ? {
            view: diagramIdentity ?? '',
            modelHash: displayedView.modelHash,
            symbol: occurrence.symbol,
          }
        : undefined,
    );
    const origins =
      displayedView?.correspondence
        .filter((entry) => entry.subject.qualifiedName === item.id)
        .map((entry) => entry.subject.origin) ?? [];
    const origin = origins[0];
    const unique =
      origin &&
      origins.every(
        (other) =>
          other?.file === origin.file &&
          other.offset === origin.offset &&
          other.length === origin.length,
      );
    setInspectionTarget({
      modelHash: state.model?.modelHash ?? '',
      origin:
        unique && displayedView?.modelHash === state.model?.modelHash
          ? origin
          : undefined,
    });
    setFocusRange(undefined);
  }
  function showSourcePanel() {
    setSourceRequest((value) => value + 1);
    if (mode === 'diagram') setMode('split');
  }
  function navigateIssue(issue: Diagnostic) {
    const current = workspace().snapshot();
    if (!current.diagnostics.includes(issue)) {
      setMessage(
        'This issue is no longer current. Apply the draft to refresh diagnostics.',
      );
      return;
    }
    const location = issueLocation(
      issue,
      current.diagnosticDocuments,
      current.project?.drafts ?? [],
    );
    if (!('target' in location)) {
      setMessage(location.reason);
      return;
    }
    setFile(location.target.file);
    showSourcePanel();
    setFocusRange(location.target);
  }
  function inspectRequirement(
    subject: RequirementSubject,
    modelHash: string,
    row?: RequirementsResult['requirements'][number],
  ) {
    const current = workspace().snapshot();
    if (current.model?.modelHash !== modelHash) {
      setMessage(
        'This selection belongs to an earlier model. Select a current row to inspect it.',
      );
      return;
    }
    setSelected(subject.qualifiedName ?? '');
    setSymbolSelection(undefined);
    setRequirementSelection({
      modelHash: current.model?.modelHash ?? '',
      subject,
      row,
    });
    setInspectionTarget({
      modelHash: current.model?.modelHash ?? '',
      origin: subject.origin,
    });
    setFocusRange(undefined);
    setInspectionRequest((request) => request + 1);
  }
  function revealDocument(click: DocumentClick) {
    const current = workspace().snapshot();
    if (!current.renderedDocument || !current.project) return;
    const location = documentSourceTarget(
      click,
      current.renderedDocument,
      current.project.documents,
      current.project.drafts,
    );
    if (!('target' in location)) {
      setMessage(location.reason);
      return;
    }
    setSelected(location.qualifiedName ?? '');
    setSymbolSelection(undefined);
    setFile(location.target.file);
    showSourcePanel();
    setFocusRange({ ...location.target, focus: true });
  }
  function revealSource() {
    if (inspectionRange) {
      setFile(inspectionRange.file);
      showSourcePanel();
      // Repeat the reveal even when the same file and layout are already open.
      setFocusRange({ ...inspectionRange, focus: true });
    } else
      setMessage(
        'Select this element in a diagram to reveal its recorded source range.',
      );
  }
  function closeDialog() {
    reviewGeneration.current++;
    workspace().cancelPending();
    setDialog(null);
    setError('');
  }
  return (
    <WorkbenchLayout key={projectGeneration} mode={mode} onMode={setMode}>
      <input
        hidden
        ref={picker}
        type="file"
        accept=".sysml,.json"
        multiple
        onChange={(event) => {
          const files = event.currentTarget.files;
          void run(() => importFiles(files));
          event.currentTarget.value = '';
        }}
      />
      {launcherOpen && active && (
        <ProjectLauncher
          onHome={onHome}
          onExample={() => void run(() => loadExample())}
          onNew={() => {
            if (replaceAllowed()) {
              setError('');
              setDialog('project');
            }
          }}
          onOpen={() => picker.current?.click()}
          onResume={resume}
          projectName={state.project?.name}
          busy={state.busy || !readySession}
          error={error}
          recovery={
            <RecoveryBanner
              recovery={recovery}
              onRestore={restoreRecovery}
              busy={state.busy}
            />
          }
          recoveryAction={
            <RecoveryButton
              recovery={recovery}
              onRestore={restoreRecovery}
              busy={state.busy}
              active={active && launcherOpen}
            />
          }
        />
      )}
      {everOpened && (
        <div className="app" hidden={launcherOpen} inert={launcherOpen}>
          <ProjectHeader
            state={state}
            origin={origin}
            active={active && !launcherOpen}
            projectsRef={launcherTrigger}
            onHome={onHome}
            onProjects={() => {
              setError('');
              setLauncherOpen(true);
            }}
            onNew={() => {
              if (replaceAllowed()) setDialog('project');
            }}
            onOpen={() => picker.current?.click()}
            onDownload={() => void run(download)}
            recovery={
              <RecoveryButton
                recovery={recovery}
                onRestore={restoreRecovery}
                busy={state.busy}
                active={active && !launcherOpen}
              />
            }
          />
          <RecoveryBanner
            recovery={recovery}
            onRestore={restoreRecovery}
            busy={state.busy}
          />
          <WorkspaceToolbar mode={mode} onMode={setMode} />
          <main
            className="workbench"
            aria-label="Model workspace"
            tabIndex={-1}
            ref={workspaceSurface}
          >
            <WorkbenchPanels
              inspectionRequest={inspectionRequest}
              sourceRequest={sourceRequest}
              explorer={
                <Explorer
                  state={state}
                  file={file}
                  selected={selected}
                  selectionRequest={treeSelectionRequest}
                  onFile={(name) => {
                    setFocusRange(undefined);
                    setFile(name);
                    showSourcePanel();
                  }}
                  onView={(id) =>
                    void run(async () => {
                      await workspace().openView(id);
                      setDataMode('diagram');
                    })
                  }
                  onDocument={(id) =>
                    void run(async () => {
                      setDocumentFailure(null);
                      await workspace().openDocument(id);
                      setDataMode('document');
                    })
                  }
                  onSelect={selectElement}
                  onNewView={newView}
                />
              }
              source={
                source ? (
                  <SourceEditor
                    key={projectGeneration}
                    renderHeader={(tools) => (
                      <>
                        <ContentTabs
                          label="Source files"
                          tabs={sourceTabs}
                          active={file}
                          onSelect={(id) => {
                            setFocusRange(undefined);
                            setFile(id);
                          }}
                          onClose={closeSourceTab}
                        />
                        <SourcePaneHeader
                          state={state}
                          fileName={source.name}
                          fileUnapplied={
                            source.text !==
                            state.project?.documents.find(
                              (document) => document.name === source.name,
                            )?.text
                          }
                          tools={tools}
                          onUndo={() =>
                            void run(async () => {
                              const session = workspace(),
                                id = session.snapshot().view?.view,
                                document =
                                  session.snapshot().renderedDocument?.document;
                              session.undo();
                              await refreshView(session, id, document);
                            })
                          }
                          onRedo={() =>
                            void run(async () => {
                              const session = workspace(),
                                id = session.snapshot().view?.view,
                                document =
                                  session.snapshot().renderedDocument?.document;
                              session.redo();
                              await refreshView(session, id, document);
                            })
                          }
                          onDiscard={() =>
                            void run(() => workspace().discardDrafts())
                          }
                          onApply={() =>
                            void run(async () => {
                              const session = workspace(),
                                id = session.snapshot().view?.view,
                                document =
                                  session.snapshot().renderedDocument?.document;
                              await session.apply();
                              setMessage('Source applied.');
                              setFocusRange(undefined);
                              await refreshView(session, id, document);
                            })
                          }
                        />
                      </>
                    )}
                    file={source}
                    disabled={state.busy}
                    languageContext={state.project?.drafts}
                    onLanguage={async (query, signal) => {
                      const session = workspace();
                      const drafts = session.snapshot().project?.drafts;
                      const language = languageRef.current;
                      if (!drafts || !language || session.snapshot().busy)
                        throw new Error(
                          'Source assistance is unavailable while the workspace is busy.',
                        );
                      const isCurrent = () =>
                        ref.current === session &&
                        !signal.aborted &&
                        !session.snapshot().busy &&
                        session.snapshot().project?.drafts === drafts;
                      const result = await language.query(
                        drafts,
                        query,
                        signal,
                      );
                      return { result, isCurrent };
                    }}
                    onDefinition={(target) => {
                      setFile(target.file);
                      showSourcePanel();
                      setFocusRange({
                        file: target.file,
                        start: target.from,
                        end: target.to,
                      });
                    }}
                    onLanguageMessage={setMessage}
                    selection={
                      focusRange?.file === source.name ? focusRange : undefined
                    }
                    onChange={(text) =>
                      void run(() => {
                        setFocusRange(undefined);
                        workspace().updateDraft(source.name, text);
                      })
                    }
                  />
                ) : null
              }
              diagram={
                <div className="model-data-surface">
                  <div className="model-workspace-chrome">
                    <div className="workspace-tabbar">
                      <ContentTabs
                        label="Workspace documents"
                        focusRequest={workspaceFocusRequest}
                        tabs={workspaceTabs}
                        active={currentTab?.id}
                        disabled={state.busy}
                        onSelect={(id) => {
                          const tab = workspaceTabs.find(
                            (item) => item.id === id,
                          );
                          if (tab) void activateTab(tab);
                        }}
                        onClose={(id) => void closeWorkspaceTab(id)}
                      />
                      <WorkspaceOpener
                        active={active && !launcherOpen}
                        state={state}
                        onOpen={async (tab) => {
                          const success = await activateTab(tab);
                          if (success)
                            setWorkspaceFocusRequest((value) => value + 1);
                          return success;
                        }}
                      />
                    </div>

                    <ModelPaneHeader
                      title={currentTab?.label}
                      actions={<InspectButton />}
                      representation={dataMode}
                      navigation={
                        <nav
                          className="model-navigation"
                          aria-label="Model navigation"
                        >
                          <Button
                            variant="ghost"
                            size="icon-xs"
                            aria-label="Back in model"
                            disabled={state.busy || navigation.index <= 0}
                            onClick={() => void navigateHistory(-1)}
                          >
                            <ArrowLeft aria-hidden="true" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon-xs"
                            aria-label="Forward in model"
                            disabled={
                              state.busy ||
                              navigation.index >= navigation.entries.length - 1
                            }
                            onClick={() => void navigateHistory(1)}
                          >
                            <ArrowRight aria-hidden="true" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="xs"
                            disabled={state.busy || !state.model}
                            aria-label="Project overview"
                            title="Project overview"
                            onClick={() => exploreScope()}
                          >
                            <House aria-hidden="true" />
                          </Button>
                          {element &&
                            ['package', 'partDef', 'partUsage'].includes(
                              element.kind,
                            ) &&
                            (breadcrumbScope?.kind === 'project' ||
                              breadcrumbScope?.subject !== element.id) && (
                              <Button
                                variant="ghost"
                                size="xs"
                                disabled={
                                  state.busy ||
                                  !element ||
                                  !['package', 'partDef', 'partUsage'].includes(
                                    element.kind,
                                  )
                                }
                                onClick={() => element && exploreScope(element)}
                              >
                                Explore selection
                              </Button>
                            )}
                        </nav>
                      }
                      state={state}
                      view={displayedView}
                    >
                      <DiagramTargetControls
                        active={
                          active && !launcherOpen && dataMode === 'diagram'
                        }
                        view={displayedView}
                        busy={state.busy}
                        exploration={state.exploration?.request}
                        elements={state.model?.elements ?? []}
                        explorationFocus={explorationFocus}
                        onExplore={(request, focus) => {
                          setExplorationFocus(focus);
                          void run(() => workspace().explore(request));
                        }}
                        disabled={state.busy || state.unapplied}
                        onCreatePart={newPart}
                        onConnectPorts={newConnection}
                      />
                    </ModelPaneHeader>
                  </div>
                  {(dataMode === 'table' || dataMode === 'matrix') &&
                    readySession && (
                      <RequirementsPanel
                        workspace={readySession}
                        state={state}
                        mode={dataMode}
                        onInspect={inspectRequirement}
                      />
                    )}
                  {dataMode === 'document' && readySession && (
                    <DocumentPane
                      workspace={readySession}
                      state={state}
                      rerendering={rerenderingDocument}
                      failure={documentFailure}
                      onReveal={revealDocument}
                      onOpenView={(id) =>
                        void run(async () => {
                          await workspace().openView(id);
                          setDataMode('diagram');
                        })
                      }
                    />
                  )}
                  <div
                    className="model-data-diagram"
                    style={
                      dataMode === 'diagram' ? undefined : { display: 'none' }
                    }
                  >
                    <Diagram
                      initialViewport={cameras.current.get(cameraKey)}
                      onCamera={(viewport) =>
                        cameras.current.set(cameraKey, viewport)
                      }
                      selectedSymbol={selectedCorrespondence?.symbol}
                      busy={state.busy}
                      layoutMode={mode}
                      key={(diagramIdentity ?? 'none') + ':' + state.revision}
                      view={displayedView}
                      exploration={state.exploration?.request}
                      elements={state.model?.elements ?? []}
                      onExplore={(request, focus) => {
                        setExplorationFocus(focus);
                        void run(() => workspace().explore(request));
                      }}
                      presentation={compatiblePresentation}
                      disabled={state.busy || state.unapplied}
                      onSelect={selectSymbol}
                      onMove={(positions) =>
                        state.exploration
                          ? undefined
                          : void run(() => workspace().moveSymbols(positions))
                      }
                    />
                  </div>
                </div>
              }
              inspector={
                <Properties
                  element={element}
                  artifactNode={selectedArtifactNode}
                  relationship={relationshipSelection}
                  requirement={inspectedRequirement}
                  subject={
                    inspectedSubject?.subject ?? selectedCorrespondence?.subject
                  }
                  sourceAvailable={!!inspectionRange}
                  readOnlyDiagram={
                    !!inspectedSubject ||
                    !!state.exploration ||
                    state.view?.artifact?.kind === 'requirement'
                  }
                  usageContext={usageContext}
                  disabled={state.busy || state.unapplied}
                  onRename={(name) => void run(() => reviewRename(name))}
                  onCreateView={newView}
                  onSource={revealSource}
                  onValueSource={(origin) => {
                    const current = workspace().snapshot();
                    const target =
                      displayedView?.modelHash === current.model?.modelHash
                        ? inspectionSource(
                            origin,
                            current.project?.documents ?? [],
                            current.project?.drafts ?? [],
                          )
                        : undefined;
                    if (!target) {
                      setMessage(
                        'Apply or discard the changed source before opening this recorded value.',
                      );
                      return;
                    }
                    setFile(target.file);
                    showSourcePanel();
                    setFocusRange({ ...target, focus: true });
                  }}
                  onCreatePart={newPart}
                  onConnectPorts={newConnection}
                />
              }
              relationships={
                <Relationships
                  view={displayedView}
                  symbol={selectedCorrespondence?.symbol}
                  onSelect={selectSymbol}
                />
              }
              issues={
                <Issues
                  diagnostics={state.diagnostics}
                  diagnosticDocuments={state.diagnosticDocuments}
                  drafts={state.project?.drafts ?? []}
                  onNavigate={navigateIssue}
                  error={dialog ? '' : error}
                />
              }
              issueKey={
                state.diagnostics.length || (!dialog && error)
                  ? JSON.stringify([state.diagnostics, dialog ? '' : error])
                  : ''
              }
            />
          </main>
          <footer>
            <IssuesToggle
              count={state.diagnostics.length + (!dialog && error ? 1 : 0)}
            />
            <span role="status">
              {message}
              {state.layoutNotices.some((notice) => notice.invalidated) &&
                ` ${state.layoutNotices.reduce((total, notice) => total + notice.invalidated, 0)} saved positions were arranged again because their correspondence could not be verified.`}
            </span>
            <span>
              {state.project?.documents.length ?? 0} files · revision{' '}
              {state.revision} · local browser workspace
            </span>
          </footer>
        </div>
      )}
      <WorkbenchDialogs
        fallbackFocus={workspaceSurface}
        kind={active ? dialog : null}
        model={state.model}
        selected={element}
        view={state.view}
        selectedSymbol={selectedCorrespondence?.symbol}
        proposal={proposal}
        documents={state.project?.documents ?? []}
        busy={state.busy}
        error={error}
        onClose={() => {
          setProposal(undefined);
          closeDialog();
        }}
        onNewProject={newProject}
        onReviewView={(command) => void run(() => reviewView(command))}
        onAccept={() => void run(accept)}
      />
    </WorkbenchLayout>
  );
}
