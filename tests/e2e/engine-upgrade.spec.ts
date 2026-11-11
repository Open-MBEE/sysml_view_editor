import { readFile } from 'node:fs/promises';
import {
  test,
  expect,
  downloadProject,
  observeEvaluations,
  expectRenderedPositions,
  semanticPositions,
} from './support';
import type { ProjectBundle } from '../../src/lib/workspace/persistence';

test('opens a project positioned with OpenSysML 0.10 without losing sources, identities or saved geometry', async ({
  page,
}) => {
  const fixture = JSON.parse(
    await readFile(
      new URL(
        '../fixtures/opensysml-0.10-positioned.sysml-project.json',
        import.meta.url,
      ),
      'utf8',
    ),
  ) as ProjectBundle;
  const results = await observeEvaluations(page);
  await page.goto('/app');
  await page.locator('input[type=file]').setInputFiles({
    name: 'legacy.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(fixture)),
  });
  const root = page.getByRole('group', {
    name: 'part def P::System',
    exact: true,
  });
  await expect(root).toBeVisible();
  await expect
    .poll(() => results.some((r) => r.view === 'V::structure'))
    .toBe(true);
  const evaluation = results.findLast((r) => r.view === 'V::structure')!;
  expect(evaluation.modelHash).toBe(
    fixture.presentations['V::structure']!.modelHash,
  );
  expect(
    evaluation.correspondence
      .filter((c) => !c.symbol.startsWith('edge:'))
      .map((c) => c.subject.qualifiedName)
      .sort(),
  ).toEqual(['P::System', 'P::System::primary', 'P::System::standby']);
  const saved = (await downloadProject(page)).bundle;
  expect(saved).toEqual(fixture);
  await expectRenderedPositions(page, fixture, 'V::structure');
  expect(semanticPositions(saved, results)).toEqual(
    semanticPositions(fixture, results),
  );
});

test('retains 0.10 declaration-to-position identities across structural, requirements and behavior fixtures', async ({
  page,
}) => {
  const { readdir } = await import('node:fs/promises');
  const { readModelSnapshot } = await import('../../src/lib/workspace/project');
  const { validateEvaluation } = await import('../../src/lib/workspace/views');
  const { readWorkerReply } =
    await import('../../src/lib/engines/workers/schema');
  type Correspondence =
    import('../../src/lib/workspace/views').EvaluatedView['correspondence'];
  // #18 intentionally adds inherited descendants and resolves declared edges
  // to their actual ports. Retain every original identity in the old fixture;
  // assert the reviewed additions separately instead of replacing that fixture.
  const inherited = JSON.parse(
    await readFile(
      new URL(
        '../fixtures/inherited-members-compressor-correspondence.json',
        import.meta.url,
      ),
      'utf8',
    ),
  ) as Record<
    string,
    {
      correspondence: Correspondence;
      edges: Record<string, unknown>[];
    }
  >;
  const fixture = JSON.parse(
    await readFile(
      new URL(
        '../fixtures/opensysml-0.10-correspondence.json',
        import.meta.url,
      ),
      'utf8',
    ),
  ) as {
    samples: Record<
      string,
      {
        documents: ProjectBundle['documents'];
        views: {
          view: string;
          modelHash: string;
          kind: string;
          correspondence: Correspondence;
          edges?: Record<string, unknown>[];
        }[];
      }
    >;
  };
  const worker =
    '/assets/' +
    (await readdir(new URL('../../build/assets/', import.meta.url))).find(
      (n) => n.startsWith('semantic.worker-') && n.endsWith('.js'),
    )!;
  await page.goto('/app');
  async function request(input: unknown) {
    const reply = readWorkerReply(
      await page.evaluate(
        ({ worker, input }) =>
          new Promise((resolve) => {
            const w = new Worker(worker, { type: 'module' });
            const timer = setTimeout(() => {
              w.terminate();
              resolve({ error: 'Compatibility worker timed out.' });
            }, 60000);
            w.onmessage = (e) => {
              clearTimeout(timer);
              w.terminate();
              resolve(e.data);
            };
            w.onerror = (e) => {
              clearTimeout(timer);
              w.terminate();
              resolve({ error: e.message });
            };
            w.postMessage(input);
          }),
        { worker, input },
      ),
    );
    if ('error' in reply) throw new Error(reply.error);
    return reply.value;
  }
  for (const [name, sample] of Object.entries(fixture.samples)) {
    const common = {
      protocolVersion: 1,
      base: '/vendor/opensysml/',
      documents: sample.documents,
    };
    const model = readModelSnapshot(
      await request({ ...common, operation: 'parse' }),
    );
    expect(
      model.diagnostics.filter((d) => d.severity === 'error'),
      name,
    ).toEqual([]);
    for (const view of sample.views) {
      expect(model.modelHash).toBe(view.modelHash);
      const result = validateEvaluation(
        await request({
          ...common,
          operation: 'evaluate',
          modelHash: model.modelHash,
          view: view.view,
        }),
        model.modelHash,
        view.view,
      );
      expect(result.status, view.view).toBe('complete');
      expect(result.artifact?.kind, view.view).toBe(view.kind);
      const current = result.correspondence.filter(
        (c) => !c.symbol.startsWith('edge:'),
      );
      const legacySymbols = new Set(view.correspondence.map((c) => c.symbol));
      expect(
        current.filter((c) => legacySymbols.has(c.symbol)),
        view.view,
      ).toEqual(view.correspondence);
      expect(
        current.filter((c) => !legacySymbols.has(c.symbol)),
        view.view + ' inherited additions',
      ).toEqual(inherited[view.view]?.correspondence ?? []);
      if (view.edges) {
        const pick = (edge: Record<string, unknown>) =>
          Object.fromEntries(
            Object.entries(edge).filter(([key]) =>
              ['from', 'to', 'fromPort', 'toPort', 'kind', 'label'].includes(
                key,
              ),
            ),
          );
        const sort = (items: Record<string, unknown>[]) =>
          items.sort((a, b) =>
            JSON.stringify(a).localeCompare(JSON.stringify(b)),
          );
        expect(
          sort(result.artifact!.edges.map((edge) => pick({ ...edge }))),
          view.view + ' declared endpoints',
        ).toEqual(sort((inherited[view.view]?.edges ?? view.edges).map(pick)));
      }
    }
  }
});
