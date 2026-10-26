import { describe, it, expect, vi } from 'vitest';
import { createWorkspace } from './createWorkspace';
import type { SemanticEngine, TransformationEngine } from './editing';
import type { ModelSnapshot } from './project';
import { readProject, type ProjectBundle } from './persistence';

const source =
  'package P { part def A; view v : StandardViewDefinitions::GeneralView { expose A; } }';
function project(): ProjectBundle {
  return {
    format: 'sysmlv2-view-project',
    version: 1,
    name: 'Example',
    documents: [{ name: 'model.sysml', text: source }],
    drafts: [{ name: 'model.sysml', text: source }],
    presentations: {},
  };
}
function model(name = 'A'): ModelSnapshot {
  return {
    modelHash: 'model-' + name,
    elements: [
      { id: 'P', name: 'P', kind: 'package', ownerId: null },
      { id: 'P::' + name, name, kind: 'partDef', ownerId: 'P' },
      { id: 'P::v', name: 'v', kind: 'viewUsage', ownerId: 'P' },
    ],
    diagnostics: [],
  };
}
function setup() {
  const semantic: SemanticEngine = {
    parse: vi.fn<SemanticEngine['parse']>(async (documents) =>
      documents[0]?.text === 'broken'
        ? {
            ...model(),
            diagnostics: [{ severity: 'error', message: 'Invalid source' }],
          }
        : model(documents[0]?.text.includes('part def B') ? 'B' : 'A'),
    ),
    evaluate: vi.fn<SemanticEngine['evaluate']>(
      async (_documents, hash, id) => ({
        schemaVersion: 1,
        modelHash: hash,
        view: id,
        status: 'complete',
        renderStatus: 'available',
        diagnostics: [],
        correspondence: [],
        artifact: {
          kind: 'tree',
          nodes: [{ id: 'symbol', name: 'A', kind: 'partDef' }],
          edges: [],
        },
      }),
    ),
  };
  const transformations: TransformationEngine = {
    propose: vi.fn<TransformationEngine['propose']>(async (documents) =>
      documents.map((item) => ({
        ...item,
        text: item.text.replaceAll('A', 'B'),
      })),
    ),
  };
  return {
    workspace: createWorkspace({ semantic, transformations }),
    semantic,
    transformations,
  };
}
describe('source transactions', () => {
  it('keeps drafts separate until a complete successful apply', async () => {
    const { workspace } = setup();
    await workspace.open(project());
    workspace.updateDraft('model.sysml', source + '\n');
    expect(workspace.snapshot().unapplied).toBe(true);
    expect(workspace.snapshot().project?.documents[0]?.text).toBe(source);
    await workspace.apply();
    expect(workspace.snapshot().unapplied).toBe(false);
    expect(workspace.snapshot().canUndo).toBe(true);
    workspace.undo();
    expect(workspace.snapshot().project?.documents[0]?.text).toBe(source);
    expect(workspace.snapshot().unapplied).toBe(false);
    workspace.redo();
    expect(workspace.snapshot().project?.documents[0]?.text).toBe(
      source + '\n',
    );
  });
  it('retains the model, view and invalid draft when validation fails', async () => {
    const { workspace } = setup();
    await workspace.open(project());
    await workspace.openView('P::v');
    const previous = workspace.snapshot();
    workspace.updateDraft('model.sysml', 'broken');
    await expect(workspace.apply()).rejects.toThrow('errors');
    expect(workspace.snapshot().model).toBe(previous.model);
    expect(workspace.snapshot().view).toBe(previous.view);
    expect(workspace.snapshot().project?.drafts[0]?.text).toBe('broken');
    expect(workspace.snapshot().diagnostics[0]?.message).toBe('Invalid source');
  });
  it('prepares without publishing, accepts once, and restores a transaction through undo', async () => {
    const { workspace } = setup();
    await workspace.open(project());
    const revision = workspace.snapshot().revision;
    const proposal = await workspace.prepare({
      kind: 'rename',
      target: 'P::A',
      name: 'B',
    });
    expect(workspace.snapshot().revision).toBe(revision);
    expect(workspace.snapshot().model?.modelHash).toBe('model-A');
    workspace.accept(proposal);
    expect(workspace.snapshot().model?.modelHash).toBe('model-B');
    expect(() => workspace.accept(proposal)).toThrow('stale');
    workspace.undo();
    expect(workspace.snapshot().model?.modelHash).toBe('model-A');
  });
  it('blocks a proposal after any source draft change, even if the draft returns to the original', async () => {
    const { workspace } = setup();
    await workspace.open(project());
    const proposal = await workspace.prepare({
      kind: 'rename',
      target: 'P::A',
      name: 'B',
    });
    workspace.updateDraft('model.sysml', source + ' ');
    workspace.updateDraft('model.sysml', source);
    expect(() => workspace.accept(proposal)).toThrow('stale');
  });
  it('rejects forged proposals and declaration-changing rename results', async () => {
    const { workspace, semantic } = setup();
    await workspace.open(project());
    const proposal = await workspace.prepare({
      kind: 'rename',
      target: 'P::A',
      name: 'B',
    });
    expect(() => workspace.accept({ ...proposal })).toThrow('not issued');
    vi.mocked(semantic.parse).mockResolvedValueOnce({
      ...model('B'),
      elements: [],
    });
    await expect(
      workspace.prepare({ kind: 'rename', target: 'P::A', name: 'B' }),
    ).rejects.toThrow('count');
    expect(workspace.snapshot().model?.modelHash).toBe('model-A');
  });
  it('rejects commands while a draft exists', async () => {
    const { workspace, transformations } = setup();
    await workspace.open(project());
    workspace.updateDraft('model.sysml', source + ' ');
    await expect(
      workspace.prepare({ kind: 'rename', target: 'P::A', name: 'B' }),
    ).rejects.toThrow('drafts');
    expect(transformations.propose).not.toHaveBeenCalled();
  });
  it('rejects results that arrive after draft editing cancels an operation', async () => {
    const { workspace, semantic } = setup();
    await workspace.open(project());
    let resolve!: (value: ModelSnapshot) => void;
    vi.mocked(semantic.parse).mockImplementationOnce(
      () => new Promise((done) => (resolve = done)),
    );
    workspace.updateDraft('model.sysml', source + ' ');
    const pending = workspace.apply();
    workspace.updateDraft('model.sysml', 'newer draft');
    resolve(model('B'));
    await expect(pending).rejects.toThrow('stale');
    expect(workspace.snapshot().project?.drafts[0]?.text).toBe('newer draft');
    expect(workspace.snapshot().model?.modelHash).toBe('model-A');
  });
  it('cannot publish a response into a disposed workspace', async () => {
    const { workspace, semantic } = setup();
    let resolve!: (value: ModelSnapshot) => void;
    vi.mocked(semantic.parse).mockImplementationOnce(
      () => new Promise((done) => (resolve = done)),
    );
    const pending = workspace.open(project());
    workspace.dispose();
    resolve(model());
    await expect(pending).rejects.toThrow('stale');
    expect(workspace.snapshot().project).toBeNull();
  });
});
describe('views and project persistence', () => {
  it('publishes a group movement once and rejects invalid batches without partial geometry', async () => {
    const { workspace, semantic } = setup();
    await workspace.open(project());
    vi.mocked(semantic.evaluate).mockResolvedValueOnce({
      schemaVersion: 1,
      modelHash: 'model-A',
      view: 'P::v',
      status: 'complete',
      renderStatus: 'available',
      diagnostics: [],
      correspondence: [],
      artifact: {
        kind: 'tree',
        nodes: [
          { id: 'owner', name: 'Owner', kind: 'part def' },
          { id: 'child', name: 'Child', kind: 'part', parent: 'owner' },
        ],
        edges: [],
      },
    });
    await workspace.openView('P::v');
    const subscriber = vi.fn();
    const unsubscribe = workspace.subscribe(subscriber);
    subscriber.mockClear();
    workspace.moveSymbols({
      owner: { x: 90, y: 80 },
      child: { x: 130, y: 160 },
    });
    expect(subscriber).toHaveBeenCalledTimes(1);
    expect(workspace.snapshot().project?.documents[0]?.text).toBe(source);
    expect(workspace.snapshot().canUndo).toBe(false);
    const before = workspace.snapshot();
    expect(() =>
      workspace.moveSymbols({
        owner: { x: 100, y: 100 },
        missing: { x: 0, y: 0 },
      }),
    ).toThrow('symbol');
    expect(workspace.snapshot()).toBe(before);
    expect(() =>
      workspace.moveSymbols({
        owner: { x: 100, y: 100 },
        child: { x: Infinity, y: 0 },
      }),
    ).toThrow('position');
    expect(workspace.snapshot()).toBe(before);
    unsubscribe();
  });
  it('changes presentation without changing sources, then saves and restores it with drafts', async () => {
    const { workspace } = setup();
    await workspace.open(project());
    await workspace.openView('P::v');
    workspace.moveSymbol('symbol', { x: 80, y: 90 });
    expect(workspace.snapshot().project?.documents[0]?.text).toBe(source);
    workspace.updateDraft('model.sysml', 'broken');
    const serialized = workspace.serialize();
    const restored = readProject(serialized);
    expect(restored.presentations['P::v']?.positions.symbol).toEqual({
      x: 80,
      y: 90,
    });
    expect(restored.drafts[0]?.text).toBe('broken');
    const second = setup().workspace;
    await second.open(restored);
    expect(second.snapshot().unapplied).toBe(true);
    expect(second.snapshot().model?.modelHash).toBe('model-A');
    workspace.markSaved(serialized);
    expect(workspace.snapshot().dirty).toBe(false);
  });
  it('refuses stale view responses', async () => {
    const { workspace, semantic } = setup();
    await workspace.open(project());
    vi.mocked(semantic.evaluate).mockResolvedValueOnce({
      schemaVersion: 1,
      modelHash: 'wrong',
      view: 'P::v',
      status: 'complete',
      renderStatus: 'unsupported',
      diagnostics: [],
      correspondence: [],
    });
    await expect(workspace.openView('P::v')).rejects.toThrow('stale');
    expect(workspace.snapshot().view).toBeNull();
  });
  it('does not mark a newer edit as downloaded', async () => {
    const { workspace } = setup();
    await workspace.open(project());
    const old = workspace.serialize();
    workspace.updateDraft('model.sysml', 'changed');
    expect(() => workspace.markSaved(old)).toThrow('no longer matches');
  });
});
