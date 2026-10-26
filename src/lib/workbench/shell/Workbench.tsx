import { Button } from '$lib/ui/primitives/button';
import { AppearanceSettings } from '$lib/ui/AppearanceSettings';
import { useEffect, useRef, useState } from 'react';
import { createBrowserWorkspace } from './session';
import { exampleProject } from './example';
import type { Workspace, WorkspaceState } from '$lib/workspace/createWorkspace';
import { readProject, type ProjectBundle } from '$lib/workspace/persistence';
import type { EditProposal, SemanticCommand } from '$lib/workspace/editing';
import type { ModelElement } from '$lib/workspace/project';
import { Explorer } from '../explorer/Explorer';
import { SourceEditor } from '../source/SourceEditor';
import { Diagram } from '../diagrams/Diagram';
import { Properties } from '../properties/Properties';
import { Issues } from '../issues/Issues';
import { WorkbenchDialogs } from './WorkbenchDialogs';

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
  view: null,
};
type Mode = 'split' | 'code' | 'diagram';
export function Workbench() {
  const ref = useRef<Workspace | null>(null),
    picker = useRef<HTMLInputElement>(null);
  const [state, setState] = useState(initial),
    [file, setFile] = useState('model.sysml'),
    [selected, setSelected] = useState(''),
    [error, setError] = useState(''),
    [message, setMessage] = useState('Opening example project…');
  const [symbolSelection, setSymbolSelection] = useState<{
    view: string;
    modelHash: string;
    symbol: string;
  }>();
  const [mode, setMode] = useState<Mode>('split'),
    [dialog, setDialog] = useState<'project' | 'view' | 'proposal' | null>(
      null,
    );
  const [proposal, setProposal] = useState<EditProposal>(),
    [focusRange, setFocusRange] = useState<{
      file: string;
      start: number;
      end: number;
    }>();
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
    const session = createBrowserWorkspace();
    ref.current = session;
    const unsubscribe = session.subscribe(setState);
    let closed = false;
    void session
      .open(exampleProject)
      .then(() => refreshView(session))
      .then(() => {
        if (!closed) setMessage('Project opened locally.');
      })
      .catch((reason) => {
        if (!closed) setError(String(reason));
      });
    return () => {
      closed = true;
      unsubscribe();
      session.dispose();
      if (ref.current === session) ref.current = null;
    };
  }, []);
  async function run(action: () => unknown | Promise<unknown>) {
    setError('');
    try {
      await action();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    }
  }
  async function open(project: ProjectBundle) {
    const session = workspace();
    await session.open(project);
    setSelected('');
    setSymbolSelection(undefined);
    setFile(project.drafts[0]!.name);
    setFocusRange(undefined);
    setMessage('Project opened locally.');
    await refreshView(session);
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
      open({
        format: 'sysmlv2-view-project',
        version: 1,
        name: projectName.trim() || 'My project',
        documents,
        drafts: documents,
        presentations: {},
      }),
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
      if (
        (event.ctrlKey || event.metaKey) &&
        event.key.toLowerCase() === 's' &&
        ref.current?.snapshot().project
      ) {
        event.preventDefault();
        download();
      }
    }
    window.addEventListener('beforeunload', unload);
    window.addEventListener('keydown', keyboard);
    return () => {
      window.removeEventListener('beforeunload', unload);
      window.removeEventListener('keydown', keyboard);
    };
  }, [state.dirty]);
  function newView() {
    setDialog('view');
  }
  async function reviewRename(name: string) {
    if (!element) return;
    setProposal(
      await workspace().prepare({
        kind: 'rename',
        target: element.id,
        name: name.trim(),
      }),
    );
    setDialog('proposal');
  }
  async function reviewView(command: SemanticCommand) {
    setProposal(await workspace().prepare(command));
    setDialog('proposal');
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
    if (command.kind === 'rename') {
      const split = command.target.lastIndexOf('::');
      setSelected(
        (split >= 0 ? command.target.slice(0, split + 2) : '') + command.name,
      );
    }
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
    if (correspondence?.subject.qualifiedName)
      setSelected(correspondence.subject.qualifiedName);
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
    setDialog(null);
    setError('');
  }
  return (
    <>
      <input
        className="sr-only"
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
      <div className="app">
        <header className="topbar">
          <div className="brand">
            SysML <span>View Editor</span>
          </div>
          <span className="project-name">
            {state.project?.name ?? 'Workspace'}
            {state.dirty ? ' · modified' : ''}
          </span>
          <nav aria-label="Project actions">
            <AppearanceSettings />
            <Button
              variant="ghost"
              disabled={state.busy || !state.project}
              onClick={() => {
                if (replaceAllowed()) setDialog('project');
              }}
            >
              New project
            </Button>
            <Button
              variant="ghost"
              disabled={state.busy || !state.project}
              onClick={() => picker.current?.click()}
            >
              Open
            </Button>
            <Button
              variant="default"
              disabled={!state.project || state.busy}
              onClick={() => void run(download)}
            >
              Download project
            </Button>
          </nav>
        </header>
        <div className="actionbar">
          <div>
            <Button
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
            >
              Undo source
            </Button>
            <Button
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
            >
              Redo source
            </Button>
          </div>
          <div className="source-actions">
            <span className={state.unapplied ? 'pending' : ''}>
              {state.busy
                ? 'Working…'
                : state.unapplied
                  ? 'Draft not applied'
                  : 'Source applied'}
            </span>
            <Button
              variant="ghost"
              disabled={state.busy || !state.unapplied}
              onClick={() => void run(() => workspace().discardDrafts())}
            >
              Discard draft
            </Button>
            <Button
              variant="outline"
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
              Apply source
            </Button>
          </div>
          <div className="modes" aria-label="Editor layout">
            {(['code', 'split', 'diagram'] as const).map((value) => (
              <Button
                variant="ghost"
                key={value}
                aria-pressed={mode === value}
                onClick={() => setMode(value)}
              >
                {value.charAt(0).toUpperCase() + value.slice(1)}
              </Button>
            ))}
          </div>
        </div>
        <main className="workbench">
          <Explorer
            state={state}
            file={file}
            selected={selected}
            onFile={(name) => {
              setFile(name);
              if (mode === 'diagram') setMode('split');
            }}
            onView={(id) => void run(() => workspace().openView(id))}
            onSelect={selectElement}
            onNewView={newView}
          />
          <div
            className={
              'editors ' +
              (mode === 'code'
                ? 'code-only'
                : mode === 'diagram'
                  ? 'diagram-only'
                  : '')
            }
          >
            {mode !== 'diagram' && source && (
              <SourceEditor
                file={source}
                disabled={state.busy}
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
            )}
            <div className="diagram-slot" hidden={mode === 'code'}>
              <Diagram
                key={(state.view?.view ?? 'none') + ':' + state.revision}
                view={state.view}
                presentation={compatiblePresentation}
                disabled={state.busy || state.unapplied}
                onSelect={selectSymbol}
                onMove={(positions) =>
                  void run(() => workspace().moveSymbols(positions))
                }
              />
            </div>
          </div>
          <Properties
            element={element}
            usageContext={usageContext}
            disabled={state.busy || state.unapplied}
            onRename={(name) => void run(() => reviewRename(name))}
            onCreateView={newView}
            onSource={revealSource}
          />
        </main>
        <Issues diagnostics={state.diagnostics} error={dialog ? '' : error} />
        <footer>
          <span role="status">{message}</span>
          <span>
            {state.project?.documents.length ?? 0} files · revision{' '}
            {state.revision} · local browser workspace
          </span>
        </footer>
      </div>
      <WorkbenchDialogs
        kind={dialog}
        model={state.model}
        selected={element}
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
    </>
  );
}
