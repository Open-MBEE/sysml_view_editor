import { readFile } from 'node:fs/promises';
import {
  test,
  expect,
  observeEvaluations,
  diagramSymbol,
  downloadProject,
  copySourceSelection,
  fillSource,
  expectRenderedPositions,
  moveNode,
} from './support';

test('@critical shows authored configuration values in the intended usage context', async ({
  page,
}, testInfo) => {
  const evaluations = await observeEvaluations(page);
  await page.goto('/app');
  const source = await readFile(
    new URL('../fixtures/source-values.sysml', import.meta.url),
  );
  await page.locator('input[type=file]').setInputFiles({
    name: 'values.sysml',
    mimeType: 'text/plain',
    buffer: source,
  });
  const viewName = 'ReadingViews::configurations';
  await expect
    .poll(() => evaluations.some((view) => view.view === viewName))
    .toBe(true);
  const view = evaluations.findLast((view) => view.view === viewName)!;
  await testInfo.attach('source-values-engine', {
    body: JSON.stringify(view, null, 2),
    contentType: 'application/json',
  });
  expect(view.status).toBe('complete');
  expect(view.artifact?.kind).toBe('tree');
  for (const [name, value] of [
    ['Reading::small::capacity', '24'],
    ['Reading::small::evidence', 'records/α-evidence.json'],
    ['Reading::large::capacity', '48'],
    ['Reading::large::evidence', 'records/large-evidence.json'],
  ]) {
    const binding = view.correspondence.filter(
      (entry) =>
        entry.subject.qualifiedName === name &&
        view.artifact!.nodes.some((node) => node.id === entry.symbol),
    );
    expect(binding).toHaveLength(1);
    const node = diagramSymbol(page, binding[0]!.symbol);
    await expect(node).toBeVisible();
    await expect(node).toContainText(value!, { timeout: 1500 });
  }
});

test('@critical inspects exact nested defaults and overrides, explains bindings and reopens preserved work', async ({
  page,
}, testInfo) => {
  const evaluations = await observeEvaluations(page);
  const bytes = await readFile(
    new URL('../fixtures/source-values.sysml', import.meta.url),
  );
  await page.goto('/app');
  await page.locator('input[type=file]').setInputFiles({
    name: 'values.sysml',
    mimeType: 'text/plain',
    buffer: bytes,
  });
  await expect(
    page.getByRole('combobox', { name: 'Named view', exact: true }),
  ).toBeEnabled();
  await page
    .getByRole('combobox', { name: 'Named view', exact: true })
    .selectOption('ReadingViews::nested');
  await expect
    .poll(() =>
      evaluations.some((value) => value.view === 'ReadingViews::nested'),
    )
    .toBe(true);
  await expect(
    page.getByRole('combobox', { name: 'Named view', exact: true }),
  ).toBeEnabled();
  const view = evaluations.findLast(
    (value) => value.view === 'ReadingViews::nested',
  )!;
  expect(view.status).toBe('complete');
  await testInfo.attach('nested-source-values', {
    body: JSON.stringify(view, null, 2),
    contentType: 'application/json',
  });
  const properties = page.getByRole('complementary', {
    name: 'Properties',
    exact: true,
  });
  for (const [owner, expression, provider] of [
    ['Reading::alpha::left', '101', 'Reading::alpha::left::gain'],
    ['Reading::beta::left', '202', 'Reading::beta::left::gain'],
    ['Reading::valueless', '12.50', 'Reading::Sensor::gain'],
  ]) {
    const bindings = view.correspondence.filter(
      (entry) =>
        entry.subject.qualifiedName === owner &&
        view.artifact!.nodes.some((node) => node.id === entry.symbol),
    );
    expect(bindings).toHaveLength(1);
    const binding = bindings[0]!;
    const artifact = view.artifact!.nodes.find(
      (node) => node.id === binding.symbol,
    )!;
    const row = artifact.sourceAttributes!.find((row) => row.name === 'gain')!;
    expect(row.context).toEqual([...binding.context, row.subject.id]);
    expect(row.value.status).toBe('available');
    if (row.value.status !== 'available')
      throw new Error('Expected source value');
    expect(row.value.expression).toBe(expression);
    expect(row.value.provider.qualifiedName).toBe(provider);
    const origin = row.value.expressionOrigin;
    expect(
      new TextDecoder('utf-8', { fatal: true }).decode(
        bytes.subarray(origin.offset, origin.offset + origin.length),
      ),
    ).toBe(expression);
    const node = diagramSymbol(page, binding.symbol);
    await node.focus();
    await node.press('Enter');
    await expect(properties).toContainText(provider!);
    const details = properties.getByRole('region', {
      name: 'Declared source values',
      exact: true,
    });
    await expect(details.locator('pre')).toHaveText(expression!);
    if (owner === 'Reading::valueless') {
      await details
        .getByRole('button', {
          name: 'Open value source for gain',
          exact: true,
        })
        .click();
      const source = page.getByRole('textbox', {
        name: 'SysML source',
        exact: true,
      });
      await expect(source).toBeFocused();
      expect(await copySourceSelection(source)).toContain(
        'attribute gain : Real default = 12.50;',
      );
      await page.getByRole('button', { name: 'Diagram', exact: true }).click();
    }
  }
  const bound = view.correspondence.find(
    (entry) =>
      entry.subject.qualifiedName === 'Reading::bound' &&
      view.artifact!.nodes.some((node) => node.id === entry.symbol),
  )!;
  const node = diagramSymbol(page, bound.symbol);
  await node.focus();
  await node.press('Enter');
  const details = properties.getByRole('region', {
    name: 'Declared source values',
    exact: true,
  });
  await expect(details).toContainText('Value unavailable');
  await expect(details).toContainText('bind bound.gain = replacement;');
  await expect(details.locator('pre')).toHaveCount(0);
  await page.getByRole('button', { name: 'Read at 100%', exact: true }).click();
  await moveNode(page, node);
  const before = (await downloadProject(page)).bundle;
  await page.getByRole('button', { name: 'Split', exact: true }).click();
  const source = page.getByRole('textbox', {
    name: 'SysML source',
    exact: true,
  });
  const draft = bytes.toString() + '\npart unfinished : Missing;';
  await fillSource(source, draft);
  await page.getByRole('button', { name: 'Apply source', exact: true }).click();
  await expect(source).toHaveSource(draft);
  await expect(details).toContainText('Value unavailable');
  await expect(
    details.getByRole('button', {
      name: 'Open attribute source for gain',
      exact: true,
    }),
  ).toBeDisabled();
  const saved = (await downloadProject(page)).bundle;
  expect(saved.documents).toEqual(before.documents);
  expect(saved.presentations).toEqual(before.presentations);
  const fresh = await page.context().browser()!.newContext();
  const reopened = await fresh.newPage();
  await reopened.goto('/app');
  await reopened.locator('input[type=file]').setInputFiles({
    name: 'values.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(saved)),
  });
  await expect(
    reopened.getByRole('button', { name: 'Download project', exact: true }),
  ).toBeEnabled();
  await reopened
    .getByRole('combobox', { name: 'Named view', exact: true })
    .selectOption('ReadingViews::nested');
  await expect(
    reopened.getByRole('combobox', { name: 'Named view', exact: true }),
  ).toBeEnabled();
  expect((await downloadProject(reopened)).bundle).toEqual(saved);
  await expectRenderedPositions(reopened, saved, 'ReadingViews::nested');
  await fresh.close();
});
