import { describe, expect, it, vi } from 'vitest';
import { createWorkspace } from '../createWorkspace';
import {
  validateExploration,
  readExplorationRequest,
  type ExplorationRequest,
  type ExplorationResult,
} from './index';
import type { ProjectBundle } from '../persistence';

const documents = [{ name: 'model.sysml', text: 'package P { part def A; }' }];
const request: ExplorationRequest = {
  scope: { kind: 'project' },
  representation: 'tree',
};
function result(query = request): ExplorationResult {
  const subject = {
    id: 'model.sysml@0:24',
    qualifiedName: 'P',
    origin: {
      file: 'model.sysml',
      offset: 0,
      length: 24,
      nameOffset: 8,
      nameLength: 1,
    },
  };
  return {
    schemaVersion: 1,
    modelHash: 'hash',
    request: query,
    status: 'complete',
    renderStatus: 'available',
    diagnostics: [],
    selected: [subject],
    correspondence: [{ symbol: 'n0', subject, context: [subject.id] }],
    artifact: {
      kind: query.representation,
      nodes: [{ id: 'n0', name: 'P', kind: 'package' }],
      edges: [],
    },
  };
}
function setup() {
  const explore = vi.fn(
    async (
      _documents: unknown,
      _hash: string,
      query: ExplorationRequest,
      _signal?: AbortSignal,
    ) => result(query),
  );
  const workspace = createWorkspace({
    semantic: {
      parse: async () => ({
        modelHash: 'hash',
        diagnostics: [],
        elements: [
          { id: 'P', name: 'P', kind: 'package', ownerId: null },
          { id: 'P::v', name: 'v', kind: 'viewUsage', ownerId: 'P' },
        ],
      }),
      evaluate: async () => ({ ...result(), view: 'P::v' }),
    },
    transformations: {
      propose: async () => {
        throw new Error('Exploration must not transform source');
      },
    },
    exploration: { explore },
  });
  const project: ProjectBundle = {
    format: 'sysmlv2-view-project',
    version: 1,
    name: 'Example',
    documents,
    drafts: documents,
    presentations: {},
  };
  return { workspace, project, explore };
}

describe('read-only exploration', () => {
  it('rejects named-view fields, stale scope/revision, unsupported kinds and unsafe source correspondence', () => {
    expect(() =>
      readExplorationRequest({
        scope: { kind: 'project' },
        representation: 'interconnection',
      }),
    ).toThrow();
    expect(() =>
      validateExploration(
        { ...result(), view: 'invented' },
        'hash',
        request,
        documents,
      ),
    ).toThrow();
    expect(() =>
      validateExploration(result(), 'other', request, documents),
    ).toThrow(/stale/);
    expect(() =>
      validateExploration(
        result(),
        'hash',
        { scope: { kind: 'package', subject: 'P' }, representation: 'tree' },
        documents,
      ),
    ).toThrow(/stale/);
    expect(() =>
      validateExploration(
        { ...result(), artifact: { ...result().artifact!, kind: 'geometry' } },
        'hash',
        request,
        documents,
      ),
    ).toThrow();
    expect(() =>
      validateExploration(result(), 'hash', request, [
        { name: 'model.sysml', text: 'short' },
      ]),
    ).toThrow(/outside/);
    const duplicate = {
      ...result(),
      artifact: {
        ...result().artifact!,
        nodes: [...result().artifact!.nodes, ...result().artifact!.nodes],
      },
    };
    expect(() =>
      validateExploration(duplicate, 'hash', request, documents),
    ).toThrow(/duplicate/);
  });
  it('uses applied sources while preserving invalid drafts, saved geometry, dirty state and history', async () => {
    const { workspace, project: base, explore } = setup();
    const project = {
      ...base,
      presentations: {
        'P::v': {
          sourceHash: 'a'.repeat(64),
          modelHash: 'hash',
          positions: { n0: { x: 11, y: 22 } },
        },
      },
    };
    await workspace.open(project);
    await workspace.openView('P::v');
    workspace.updateDraft('model.sysml', 'invalid draft');
    const before = workspace.serialize();
    const revision = workspace.snapshot().revision;
    await workspace.explore(request);
    expect(explore.mock.calls[0]![0]).toEqual(documents);
    expect(workspace.serialize()).toBe(before);
    expect(workspace.snapshot()).toMatchObject({
      revision,
      unapplied: true,
      canUndo: false,
      view: null,
      exploration: { request },
    });
    expect(() => workspace.moveSymbol('n0', { x: 100, y: 200 })).toThrow();
    await workspace.openView('P::v');
    expect(workspace.snapshot().exploration).toBeNull();
    expect(workspace.serialize()).toBe(before);
  });
  it('retains the previous exploration on engine failure and rejects late results after draft changes', async () => {
    const { workspace, project, explore } = setup();
    await workspace.open(project);
    await workspace.explore(request);
    const previous = workspace.snapshot().exploration;
    explore.mockRejectedValueOnce(new Error('Unavailable asset'));
    await expect(
      workspace.explore({
        scope: { kind: 'package', subject: 'P' },
        representation: 'tree',
      }),
    ).rejects.toThrow('Unavailable asset');
    expect(workspace.snapshot().exploration).toBe(previous);
    let complete!: (value: ExplorationResult) => void;
    explore.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          complete = resolve;
        }),
    );
    const pending = workspace.explore(request);
    workspace.updateDraft('model.sysml', 'new local draft');
    const before = workspace.serialize();
    complete(result());
    await expect(pending).rejects.toThrow(/stale/);
    expect(workspace.snapshot().exploration).toBe(previous);
    expect(workspace.serialize()).toBe(before);
  });
  it('rejects a superseded exploration after opening a replacement project', async () => {
    const { workspace, project, explore } = setup();
    await workspace.open(project);
    let complete!: (value: ExplorationResult) => void;
    explore.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          complete = resolve;
        }),
    );
    const pending = workspace.explore(request);
    await workspace.open({ ...project, name: 'Replacement' });
    complete(result());
    await expect(pending).rejects.toThrow(/stale/);
    expect(workspace.snapshot().project?.name).toBe('Replacement');
    expect(workspace.snapshot().exploration).toBeNull();
  });
});
