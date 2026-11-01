import {
  WorkbenchLayout,
  WorkbenchPanels,
  WorkbenchToolbar,
  IssuesToggle,
} from './WorkbenchPanels';
import {
  Undo2,
  Redo2,
  FilePlus2,
  FolderOpen,
  Download,
  Check,
  X,
  CodeXml,
  Columns2,
  Network,
  PanelsTopLeft,
} from 'lucide-react';
import { IconButton } from '$lib/ui/IconButton';
import { Button } from '$lib/ui/primitives/button';
import { AppearanceSettings } from '$lib/ui/AppearanceSettings';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createBrowserSession } from './session';
import { exampleProject, exampleView } from './example';
import type { Workspace, WorkspaceState } from '$lib/workspace/createWorkspace';
import { readProject, type ProjectBundle } from '$lib/workspace/persistence';
import type { EditProposal, SemanticCommand } from '$lib/workspace/editing';
import type { ModelElement, Diagnostic } from '$lib/workspace/project';
import { Explorer } from '../explorer/Explorer';
import { SourceEditor } from '../source/SourceEditor';
import { Diagram } from '../diagrams/Diagram';
import { Properties } from '../properties/Properties';
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
import { Brand } from '../entry/Brand';
import type { EntryRequest } from '../entry/Application';

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
    [error, setError] = useState(''),
    [message, setMessage] = useState('Choose a project to begin.');
  const [symbolSelection, setSymbolSelection] = useState<{
    view: string;
    modelHash: string;
    symbol: string;
  }>();
  const [mode, setMode] = useState<Mode>('diagram'),
    [dialog, setDialog] = useState<
      'project' | 'view' | 'part' | 'connection' | 'proposal' | null
    >(null);
  const [proposal, setProposal] = useState<EditProposal>(),
    [focusRange, setFocusRange] = useState<{
      file: string;
      start: number;
      end: number;
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
    const restored = session.snapshot();
    recovery.acceptRestored({
      project: restored.project!,
      activeFile: entry.activeFile,
      activeView: entry.activeView,
      dirty: restored.dirty || restored.unapplied,
    });
    setSelected('');
    setSymbolSelection(undefined);
    setFile(entry.activeFile ?? entry.project.drafts[0]!.name);
    setFocusRange(undefined);
    setMode('split');
    setMessage('Local recovery restored.');
    setOrigin('Browser recovery');
    setEverOpened(true);
    setLauncherOpen(false);
    await refreshView(session, entry.activeView ?? undefined);
  }
  const element = state.model?.elements.find((item) => item.id === selected);
  const selectedCorrespondence =
    symbolSelection?.view === state.view?.view &&
    symbolSelection?.modelHash === state.view?.modelHash
      ? state.view?.correspondence.find(
          (item) => item.symbol === symbolSelection?.symbol,
        )
      : undefined;
  const usageContext = selectedCorrespondence?.context
    .slice(0, -1)
    .map(
      (origin) =>
        state.view?.correspondence.find((item) => item.subject.id === origin)
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
  async function refreshView(session: Workspace, preferred?: string) {
    const views =
      session
        .snapshot()
        .model?.elements.filter((item) => item.kind === 'viewUsage') ?? [];
    const target = views.find((item) => item.id === preferred) ?? views[0];
    if (target) await session.openView(target.id);
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
    setMode('diagram');
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
    setSelected('');
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
    const normalized =
        projectName.trim().replace(/[^A-Za-z0-9_]/g, '') || 'Model',
      name = /^[A-Za-z_]/.test(normalized) ? normalized : 'Model' + normalized;
    const documents = [
      { name: 'model.sysml', text: `package ${name} {\n\n}\n` },
    ];
    setDialog(null);
    void run(() =>
      open(
        {
          format: 'sysmlv2-view-project',
          version: 1,
          name: projectName.trim() || 'My project',
          documents,
          drafts: documents,
          presentations: {},
        },
        { origin: 'New local project', mode: 'code', unsaved: true },
      ),
    );
  }
  async function importFiles(files: FileList | null) {
    if (!files?.length) return;
    const chosen = Array.from(files);
    if (!replaceAllowed()) return;
    if (chosen.length === 1 && chosen[0]!.name.endsWith('.json')) {
      await open(readProject(await chosen[0]!.text()));
      return;
    }
    const documents = await Promise.all(
      chosen.map(async (item) => ({
        name: item.webkitRelativePath || item.name,
        text: await item.text(),
      })),
    );
    await open({
      format: 'sysmlv2-view-project',
      version: 1,
      name: chosen[0]!.name.replace(/\.sysml$/, ''),
      documents,
      drafts: documents,
      presentations: {},
    });
  }
  function download() {
    const session = workspace(),
      serialized = session.serialize(),
      url = URL.createObjectURL(
        new Blob([serialized], { type: 'application/json' }),
      ),
      link = document.createElement('a');
    link.href = url;
    link.download =
      (session.snapshot().project?.name.replace(/[^A-Za-z0-9_-]/g, '-') ||
        'model') + '.sysml-project.json';
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    session.markSaved(serialized);
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
  }
  function selectSymbol(symbol: string) {
    const correspondence = state.view?.correspondence.find(
      (item) => item.symbol === symbol,
    );
    if (correspondence && state.view)
      setSymbolSelection({
        view: state.view.view,
        modelHash: state.view.modelHash,
        symbol,
      });
    if (correspondence?.subject.qualifiedName) {
      setSelected(correspondence.subject.qualifiedName);
      setTreeSelectionRequest((request) => request + 1);
    }
    const origin = correspondence?.subject.origin;
    setFocusRange(undefined);
    if (origin && state.project) {
      const document = state.project.documents.find(
        (item) => item.name === origin.file,
      );
      if (document) {
        const bytes = new TextEncoder().encode(document.text),
          decoder = new TextDecoder('utf-8', { fatal: true });
        try {
          setFocusRange({
            file: document.name,
            start: decoder.decode(bytes.slice(0, origin.offset)).length,
            end: decoder.decode(bytes.slice(0, origin.offset + origin.length))
              .length,
          });
        } catch {
          setFocusRange(undefined);
        }
      }
    }
  }
  function selectElement(item: ModelElement) {
    setSelected(item.id);
    setSymbolSelection(undefined);
    setFocusRange(undefined);
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
    if (mode === 'diagram') setMode('split');
    setFocusRange(location.target);
  }
  function revealSource() {
    if (focusRange) {
      setFile(focusRange.file);
      setMode('split');
      // Repeat the reveal even when the same file and layout are already open.
      setFocusRange({ ...focusRange });
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
    <WorkbenchLayout mode={mode}>
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
          onExample={() => void run(loadExample)}
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
          <header className="topbar">
            <Brand onHome={onHome} />
            <Button
              ref={launcherTrigger}
              variant="ghost"
              aria-label="Projects"
              onClick={() => {
                setError('');
                setLauncherOpen(true);
              }}
            >
              <PanelsTopLeft aria-hidden="true" />
              <span className="button-label">Projects</span>
            </Button>
            <div className="project-identity">
              <span className="project-name">
                {state.project?.name ?? 'Workspace'}
                {state.dirty ? ' · modified' : ''}
              </span>
              <small className="project-origin">{origin}</small>
            </div>
            <nav aria-label="Project actions">
              <AppearanceSettings active={active && !launcherOpen} />
              <RecoveryButton
                recovery={recovery}
                onRestore={restoreRecovery}
                busy={state.busy}
                active={active && !launcherOpen}
              />
              <Button
                variant="ghost"
                disabled={state.busy}
                aria-label="New project"
                onClick={() => {
                  if (replaceAllowed()) setDialog('project');
                }}
              >
                <FilePlus2 aria-hidden="true" />
                <span className="button-label">New project</span>
              </Button>
              <Button
                variant="ghost"
                disabled={state.busy}
                aria-label="Open"
                onClick={() => picker.current?.click()}
              >
                <FolderOpen aria-hidden="true" />
                <span className="button-label">Open</span>
              </Button>
              <Button
                variant="default"
                disabled={!state.project || state.busy}
                onClick={() => void run(download)}
              >
                <Download aria-hidden="true" />
                Download project
              </Button>
            </nav>
          </header>
          <RecoveryBanner
            recovery={recovery}
            onRestore={restoreRecovery}
            busy={state.busy}
          />
          <WorkbenchToolbar
            history={
              <div
                className="source-history"
                role="group"
                aria-label="Source transaction history"
              >
                <IconButton
                  variant="ghost"
                  disabled={state.busy || state.unapplied || !state.canUndo}
                  onClick={() =>
                    void run(async () => {
                      const session = workspace(),
                        id = session.snapshot().view?.view;
                      session.undo();
                      await refreshView(session, id);
                    })
                  }
                  label="Undo source"
                  size="icon-xs"
                  icon={Undo2}
                />
                <IconButton
                  variant="ghost"
                  disabled={state.busy || state.unapplied || !state.canRedo}
                  onClick={() =>
                    void run(async () => {
                      const session = workspace(),
                        id = session.snapshot().view?.view;
                      session.redo();
                      await refreshView(session, id);
                    })
                  }
                  label="Redo source"
                  size="icon-xs"
                  icon={Redo2}
                />
              </div>
            }
            sourceActions={
              <div
                className="source-actions"
                role="group"
                aria-label="Source actions"
              >
                <span className={state.unapplied ? 'pending' : ''}>
                  {state.busy
                    ? 'Working…'
                    : state.unapplied
                      ? 'Draft not applied'
                      : 'Source applied'}
                </span>
                <Button
                  variant="ghost"
                  size="xs"
                  aria-label="Discard draft"
                  disabled={state.busy || !state.unapplied}
                  onClick={() => void run(() => workspace().discardDrafts())}
                >
                  <X aria-hidden="true" />
                  Discard
                </Button>
                <Button
                  variant="outline"
                  size="xs"
                  disabled={state.busy || !state.unapplied}
                  onClick={() =>
                    void run(async () => {
                      const session = workspace(),
                        id = session.snapshot().view?.view;
                      await session.apply();
                      setMessage('Source applied.');
                      setFocusRange(undefined);
                      await refreshView(session, id);
                    })
                  }
                >
                  <Check aria-hidden="true" />
                  Apply source
                </Button>
              </div>
            }
            modes={
              <div className="modes" role="group" aria-label="Editor layout">
                {(['code', 'split', 'diagram'] as const).map((value) => (
                  <IconButton
                    key={value}
                    label={value.charAt(0).toUpperCase() + value.slice(1)}
                    icon={
                      { code: CodeXml, split: Columns2, diagram: Network }[
                        value
                      ]
                    }
                    aria-pressed={mode === value}
                    onClick={() => setMode(value)}
                  />
                ))}
              </div>
            }
          />
          <main
            className="workbench"
            aria-label="Model workspace"
            tabIndex={-1}
            ref={workspaceSurface}
          >
            <WorkbenchPanels
              explorer={
                <Explorer
                  state={state}
                  file={file}
                  selected={selected}
                  selectionRequest={treeSelectionRequest}
                  onFile={(name) => {
                    setFile(name);
                    if (mode === 'diagram') setMode('split');
                  }}
                  onView={(id) => void run(() => workspace().openView(id))}
                  onSelect={selectElement}
                  onNewView={newView}
                />
              }
              source={
                source ? (
                  <SourceEditor
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
                      if (mode === 'diagram') setMode('split');
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
                <Diagram
                  views={
                    state.model?.elements.filter(
                      (item) => item.kind === 'viewUsage',
                    ) ?? []
                  }
                  busy={state.busy}
                  onOpenView={(id) => void run(() => workspace().openView(id))}
                  layoutMode={mode}
                  key={(state.view?.view ?? 'none') + ':' + state.revision}
                  view={state.view}
                  presentation={compatiblePresentation}
                  disabled={state.busy || state.unapplied}
                  onSelect={selectSymbol}
                  onCreatePart={newPart}
                  onConnectPorts={newConnection}
                  onMove={(positions) =>
                    void run(() => workspace().moveSymbols(positions))
                  }
                />
              }
              inspector={
                <Properties
                  element={element}
                  usageContext={usageContext}
                  disabled={state.busy || state.unapplied}
                  onRename={(name) => void run(() => reviewRename(name))}
                  onCreateView={newView}
                  onSource={revealSource}
                  onCreatePart={newPart}
                  onConnectPorts={newConnection}
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
