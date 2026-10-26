import {
  sameSources,
  sourceDigest,
  validateDocuments,
  type AppliedModel,
  type Diagnostic,
  type ModelSnapshot,
} from './project';
import {
  checkPostconditions,
  readSemanticCommand,
  type EditProposal,
  type SemanticCommand,
  type SemanticEngine,
  type TransformationEngine,
} from './editing';
import { serializeProject, type ProjectBundle } from './persistence';
import { validateEvaluation, type EvaluatedView, type Point } from './views';
import { createHistory } from './history';

export interface WorkspaceState {
  readonly project: ProjectBundle | null;
  readonly model: AppliedModel | null;
  readonly revision: number;
  readonly busy: boolean;
  readonly dirty: boolean;
  readonly unapplied: boolean;
  readonly canUndo: boolean;
  readonly canRedo: boolean;
  readonly diagnostics: readonly Diagnostic[];
  readonly view: EvaluatedView | null;
}
interface Accepted {
  project: ProjectBundle;
  model: AppliedModel;
}
function immutable<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) immutable(child);
    Object.freeze(value);
  }
  return value;
}
export function createWorkspace(dependencies: {
  semantic: SemanticEngine;
  transformations: TransformationEngine;
}) {
  let state: WorkspaceState = immutable({
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
  });
  const listeners = new Set<(value: WorkspaceState) => void>();
  const history = createHistory<Accepted>();
  const proposals = new Map<string, EditProposal>();
  let generation = 0,
    proposalSequence = 0,
    disposed = false,
    controller: AbortController | undefined;
  let saved = '';
  function publish(patch: Partial<WorkspaceState>) {
    const next = { ...state, ...patch };
    state = immutable({
      ...next,
      unapplied:
        !!next.project &&
        !sameSources(next.project.documents, next.project.drafts),
      dirty: !!next.project && serializeProject(next.project) !== saved,
      canUndo: history.canUndo,
      canRedo: history.canRedo,
    });
    for (const listener of listeners) listener(state);
  }
  function alive() {
    if (disposed) throw new Error('Workspace has been disposed.');
  }
  function begin() {
    alive();
    controller?.abort();
    controller = new AbortController();
    const token = ++generation;
    publish({ busy: true });
    return { token, signal: controller.signal };
  }
  function current(token: number) {
    if (disposed || token !== generation)
      throw new Error('Operation is stale; current project was retained.');
  }
  function finish(token: number) {
    if (!disposed && token === generation) publish({ busy: false });
  }
  function accepted(): Accepted {
    if (!state.project || !state.model)
      throw new Error('Open a project first.');
    return { project: state.project, model: state.model };
  }
  function writable() {
    alive();
    if (state.busy || state.unapplied)
      throw new Error(
        'Finish the current operation and apply or discard drafts first.',
      );
    return accepted();
  }
  function validate(model: ModelSnapshot) {
    if (
      !model.modelHash ||
      model.diagnostics.some((item) => item.severity === 'error')
    )
      throw new Error('Source has errors; the last applied model is retained.');
  }
  async function parse(
    documents: ProjectBundle['documents'],
    signal: AbortSignal,
  ) {
    const model = await dependencies.semantic.parse(documents, signal);
    if (model.diagnostics.some((item) => item.severity === 'error')) {
      if (!signal.aborted) publish({ diagnostics: model.diagnostics });
      validate(model);
    }
    validate(model);
    return { ...model, sourceHash: await sourceDigest(documents) };
  }
  function restore(value: Accepted) {
    proposals.clear();
    publish({
      project: value.project,
      model: value.model,
      revision: state.revision + 1,
      view: null,
      diagnostics: value.model.diagnostics,
    });
  }
  function moveSymbols(positions: Readonly<Record<string, Point>>) {
    alive();
    const { project, model } = accepted();
    const view = state.view;
    if (
      state.busy ||
      state.unapplied ||
      view?.status !== 'complete' ||
      !view.artifact
    )
      throw new Error(
        'Choose an available symbol in the current applied view.',
      );
    const moved: Record<string, Point> = {};
    for (const [symbol, position] of Object.entries(positions)) {
      if (!view.artifact.nodes.some((node) => node.id === symbol))
        throw new Error(
          'Choose an available symbol in the current applied view.',
        );
      if (
        !Number.isFinite(position.x) ||
        !Number.isFinite(position.y) ||
        Math.abs(position.x) > 1e7 ||
        Math.abs(position.y) > 1e7
      )
        throw new Error('Invalid position.');
      moved[symbol] = { ...position };
    }
    publish({
      project: {
        ...project,
        presentations: {
          ...project.presentations,
          [view.view]: {
            sourceHash: model.sourceHash,
            modelHash: model.modelHash,
            positions: {
              ...project.presentations[view.view]?.positions,
              ...moved,
            },
          },
        },
      },
    });
  }
  return {
    snapshot: () => state,
    subscribe(listener: (value: WorkspaceState) => void) {
      alive();
      listeners.add(listener);
      listener(state);
      return () => {
        listeners.delete(listener);
      };
    },
    async open(project: ProjectBundle) {
      // Round-trip through the format reader before accepting caller-owned data.
      const candidate = JSON.parse(serializeProject(project)) as ProjectBundle;
      const { token, signal } = begin();
      try {
        const model = await parse(candidate.documents, signal);
        current(token);
        history.clear();
        proposals.clear();
        saved = serializeProject(candidate);
        restore({ project: candidate, model });
      } finally {
        finish(token);
      }
    },
    updateDraft(file: string, text: string) {
      alive();
      const { project } = accepted();
      if (!project.drafts.some((item) => item.name === file))
        throw new Error('Unknown source file.');
      controller?.abort();
      generation++;
      proposals.clear();
      const drafts = validateDocuments(
        project.drafts.map((item) =>
          item.name === file ? { name: file, text } : item,
        ),
      );
      publish({
        project: { ...project, drafts },
        diagnostics: [],
        busy: false,
      });
    },
    discardDrafts() {
      alive();
      if (state.busy) throw new Error('Finish the current operation first.');
      const { project } = accepted();
      proposals.clear();
      publish({
        project: { ...project, drafts: project.documents },
        diagnostics: state.model?.diagnostics ?? [],
      });
    },
    async apply() {
      if (state.busy) throw new Error('Finish the current operation first.');
      const before = accepted();
      const documents = before.project.drafts;
      const { token, signal } = begin();
      try {
        const model = await parse(documents, signal);
        current(token);
        history.record({
          ...before,
          project: { ...before.project, drafts: before.project.documents },
        });
        restore({
          project: {
            ...before.project,
            documents,
            drafts: documents,
            presentations: {},
          },
          model,
        });
      } finally {
        finish(token);
      }
    },
    async prepare(command: SemanticCommand): Promise<EditProposal> {
      const before = writable(),
        baseRevision = state.revision;
      const captured = immutable(structuredClone(readSemanticCommand(command)));
      const { token, signal } = begin();
      try {
        const documents = validateDocuments(
          await dependencies.transformations.propose(
            before.project.documents,
            captured,
            signal,
          ),
        );
        if (
          documents.length !== before.project.documents.length ||
          documents.some(
            (item, i) => item.name !== before.project.documents[i]?.name,
          )
        )
          throw new Error('A semantic command changed project membership.');
        const model = await parse(documents, signal);
        current(token);
        checkPostconditions(before.model, model, captured);
        const proposal = immutable({
          id: String(++proposalSequence),
          baseRevision,
          command: captured,
          documents,
          snapshot: model,
        });
        proposals.set(proposal.id, proposal);
        return proposal;
      } finally {
        finish(token);
      }
    },
    accept(proposal: EditProposal) {
      const before = writable();
      if (
        proposals.get(proposal.id) !== proposal ||
        proposal.baseRevision !== state.revision
      )
        throw new Error(
          'Proposal is stale or was not issued by this workspace.',
        );
      history.record(before);
      // Source changes invalidate revision-bound geometry; do not guess identities.
      restore({
        project: {
          ...before.project,
          documents: proposal.documents,
          drafts: proposal.documents,
          presentations: {},
        },
        model: proposal.snapshot,
      });
    },
    async openView(id: string) {
      alive();
      if (state.busy) throw new Error('Finish the current operation first.');
      const { project, model } = accepted();
      if (
        !model.elements.some(
          (item) => item.id === id && item.kind === 'viewUsage',
        )
      )
        throw new Error('Choose a declared view.');
      const { token, signal } = begin();
      try {
        const result = await dependencies.semantic.evaluate(
          project.documents,
          model.modelHash,
          id,
          signal,
        );
        current(token);
        publish({ view: validateEvaluation(result, model.modelHash, id) });
      } finally {
        finish(token);
      }
    },
    moveSymbol(symbol: string, position: Point) {
      moveSymbols({ [symbol]: position });
    },
    moveSymbols,
    undo() {
      const before = writable(),
        previous = history.undo(before);
      if (previous) restore(previous);
    },
    redo() {
      const before = writable(),
        next = history.redo(before);
      if (next) restore(next);
    },
    serialize() {
      const { project } = accepted();
      return serializeProject(project);
    },
    markSaved(serialized: string) {
      alive();
      if (!state.project || serialized !== serializeProject(state.project))
        throw new Error('Saved content no longer matches this project.');
      saved = serialized;
      publish({});
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      controller?.abort();
      generation++;
      proposals.clear();
      listeners.clear();
    },
  };
}
export type Workspace = ReturnType<typeof createWorkspace>;
