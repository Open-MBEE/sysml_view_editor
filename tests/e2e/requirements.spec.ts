import { readFile } from 'node:fs/promises';
import {
  test,
  expect,
  ready,
  observeEvaluations,
  namedViewButton,
  downloadProject,
} from './support';
import {
  requirementEdgePairs,
  requirementSymbol,
} from './requirements-support';

// This observes the production workers. It establishes the engine projection,
// independently of the separate UI interaction and preservation scenarios.
test('native capacity requirements retain exact typing and satisfaction correspondence', async ({
  page,
}) => {
  const evaluations = await observeEvaluations(page);
  await ready(page);
  const documents = await Promise.all(
    ['model.sysml', 'views.sysml'].map(async (name) => ({
      name,
      text: await readFile(
        new URL(`../../examples/requirements/${name}`, import.meta.url),
        'utf8',
      ),
    })),
  );
  await page.locator('input[type=file]').setInputFiles(
    documents.map((document) => ({
      name: document.name,
      mimeType: 'text/plain',
      buffer: Buffer.from(document.text),
    })),
  );
  const view = 'CapacityViews::requirements';
  await expect(namedViewButton(page, view)).toHaveAttribute(
    'aria-current',
    'page',
  );
  await expect
    .poll(() => evaluations.some((result) => result.view === view))
    .toBe(true);
  const result = evaluations.findLast((entry) => entry.view === view)!;
  expect(result.status).toBe('complete');
  expect(result.renderStatus).toBe('available');
  expect(result.artifact?.kind).toBe('requirement');
  expect(requirementEdgePairs(result, 'typing')).toEqual([
    [
      'CapacityRequirements::usableCapacity',
      'CapacityRequirements::MinimumCapacity',
    ],
  ]);
  expect(requirementEdgePairs(result, 'satisfy')).toEqual([
    ['CapacityRequirements::storage', 'CapacityRequirements::usableCapacity'],
  ]);
  for (const name of [
    'CapacityRequirements::MinimumCapacity',
    'CapacityRequirements::usableCapacity',
    'CapacityRequirements::storage',
  ]) {
    const symbol = requirementSymbol(result, name);
    expect(symbol.subject.origin?.file).toBe('model.sysml');
    expect(symbol.subject.origin?.length).toBeGreaterThan(0);
  }
  const saved = (await downloadProject(page)).bundle;
  expect(saved.documents).toEqual(documents);
  expect(saved.drafts).toEqual(documents);
});
