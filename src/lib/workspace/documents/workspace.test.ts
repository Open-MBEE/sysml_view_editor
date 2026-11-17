import { expect, it, vi } from 'vitest';
import { createWorkspace } from '../createWorkspace';
import type { SemanticEngine, TransformationEngine } from '../editing';
import type { ProjectBundle } from '../persistence';
import type { DocumentEngine } from './index';

const documents = [{ name: 'model.sysml', text: 'part def Report;' }];
const project: ProjectBundle = {
  format: 'sysmlv2-view-project',
  version: 1,
  name: 'Documents',
  documents,
  drafts: documents,
  presentations: {},
};
function rendered(hash = 'model') {
  return {
    schemaVersion: 1,
    modelHash: hash,
    ['document']: 'Report',
    form: 'html',
    status: 'complete',
    content: '<article>Report</article>',
    references: [],
    contents: [],
    diagnostics: [],
  };
}
function setup(render: DocumentEngine['renderDocument']) {
  const semantic: SemanticEngine = {
    parse: vi.fn(async () => ({
      modelHash: 'model',
      elements: [],
      diagnostics: [],
      documents: [
        {
          qualifiedName: 'Report',
          name: 'Report',
          origin: { file: 'model.sysml', offset: 0, length: 16 },
        },
      ],
    })),
    evaluate: vi.fn(async () => {
      throw new Error('Not used');
    }),
  };
  const transformations: TransformationEngine = {
    propose: vi.fn(async () => {
      throw new Error('Not used');
    }),
  };
  return createWorkspace({
    semantic,
    transformations,
    documents: { renderDocument: render },
  });
}
it('rejects a stale document envelope without replacing the current document or project', async () => {
  let stale = false;
  const workspace = setup(async () =>
    rendered(stale ? 'old-revision' : 'model'),
  );
  await workspace.open(project);
  await workspace.openDocument('Report');
  const before = workspace.snapshot();
  stale = true;
  await expect(workspace.openDocument('Report')).rejects.toThrow(/stale/);
  expect(workspace.snapshot().renderedDocument).toEqual(
    before.renderedDocument,
  );
  expect(workspace.snapshot().project).toEqual(before.project);
  expect(workspace.snapshot().busy).toBe(false);
});
it.each(['replacement', 'dispose'] as const)(
  'rejects late document publication after %s',
  async (action) => {
    let complete!: (value: unknown) => void;
    let requestSignal: AbortSignal | undefined;
    const workspace = setup(async (_sources, _hash, _name, _form, signal) => {
      requestSignal = signal;
      return new Promise((resolve) => {
        complete = resolve;
      });
    });
    await workspace.open(project);
    const pending = workspace.openDocument('Report');
    // Register the rejection before superseding the request.
    const rejected = expect(pending).rejects.toThrow();
    if (action === 'replacement')
      await workspace.open({ ...project, name: 'Replacement' });
    else workspace.dispose();
    expect(requestSignal?.aborted).toBe(true);
    complete(rendered());
    await rejected;
    expect(workspace.snapshot().renderedDocument).toBeNull();
    if (action === 'replacement')
      expect(workspace.snapshot().project?.name).toBe('Replacement');
  },
);
