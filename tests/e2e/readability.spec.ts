import {
  importRequirementsTraceability,
  requirementCard,
} from './requirements-support';
import {
  test,
  expect,
  observeEvaluations,
  diagramCamera,
  downloadProject,
  fillSource,
  regionSize,
  readingCenterOffset,
} from './support';

const source = `package ReadingSpace { part def Assembly {
${Array.from({ length: 20 }, (_, index) => `part device${index} { attribute rating = ${index}; }`).join('\n')}
} }
package ReadingViews { view assembly : StandardViewDefinitions::InterconnectionView { expose ReadingSpace::Assembly; } }`;
for (const width of [1600, 800])
  test(`@critical large assembly opens at a readable scale at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 1000 });
    const evaluations = await observeEvaluations(page);
    await page.goto('/app');
    await page.locator('input[type=file]').setInputFiles({
      name: 'reading.sysml',
      mimeType: 'text/plain',
      buffer: Buffer.from(source),
    });
    await expect
      .poll(() =>
        evaluations.some((value) => value.view === 'ReadingViews::assembly'),
      )
      .toBe(true);
    await expect(
      page.getByRole('combobox', { name: 'Named view', exact: true }),
    ).toBeEnabled();
    await expect
      .poll(async () => (await diagramCamera(page)).zoom, { timeout: 1500 })
      .toBeGreaterThanOrEqual(0.75);
    const before = (await downloadProject(page)).bundle;
    await page.getByRole('button', { name: 'Fit view', exact: true }).click();
    await expect
      .poll(async () => (await diagramCamera(page)).zoom)
      .toBeLessThan(0.6);
    await page
      .getByRole('button', { name: 'Read at 100%', exact: true })
      .click();
    await expect.poll(async () => (await diagramCamera(page)).zoom).toBe(1);
    expect((await downloadProject(page)).bundle).toEqual(before);
  });

test('@critical readable camera follows Inspector selection from an embedded Inspect button', async ({
  page,
}) => {
  const evaluations = await observeEvaluations(page);
  await page.goto('/app');
  await importRequirementsTraceability(page);
  const first = page.getByRole('group', {
    name: 'requirement def REQ-CAP TraceRequirements::MinimumCapacity',
    exact: true,
  });
  await first.focus();
  await first.press('Enter');
  await page.getByRole('button', { name: 'Fit view', exact: true }).click();
  const selected = requirementCard(
    page,
    evaluations.findLast((view) => view.view === 'TraceViews::requirements')!,
    'TraceRequirements::rightSpecification::rightCapacity',
  );
  await selected
    .getByRole('button', {
      name: 'Inspect REQ-RIGHT-CAP TraceRequirements::rightSpecification::rightCapacity',
      exact: true,
    })
    .click();
  await expect(
    page.getByRole('complementary', { name: 'Properties', exact: true }),
  ).toContainText('REQ-RIGHT-CAP');
  await page.getByRole('button', { name: 'Read at 100%', exact: true }).click();
  await expect.poll(async () => (await diagramCamera(page)).zoom).toBe(1);
  await expect.poll(() => readingCenterOffset(selected)).toBeLessThan(1);
  const canvas = await page
    .getByRole('region', { name: 'Diagram', exact: true })
    .boundingBox();
  await expect
    .poll(async () => {
      const box = await selected.boundingBox();
      return (
        !!box &&
        !!canvas &&
        box.x >= canvas.x &&
        box.x + box.width <= canvas.x + canvas.width &&
        box.y >= canvas.y &&
        box.y + box.height <= canvas.y + canvas.height
      );
    })
    .toBe(true);
});

test('@critical responsive panes preserve explicit preferences, camera and the unfinished draft', async ({
  page,
}) => {
  await page.goto('/app');
  await page.locator('input[type=file]').setInputFiles({
    name: 'reading.sysml',
    mimeType: 'text/plain',
    buffer: Buffer.from(source),
  });
  await expect(
    page.getByRole('combobox', { name: 'Named view', exact: true }),
  ).toBeEnabled();
  await page.getByRole('button', { name: 'Split', exact: true }).click();
  const editor = page.getByRole('textbox', {
    name: 'SysML source',
    exact: true,
  });
  const draft = source + '\n// keep this draft through responsive inspection';
  await fillSource(editor, draft);
  await page
    .getByRole('button', { name: 'Collapse Inspector', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Collapse Explorer', exact: true })
    .click();
  const preferences = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('sysml-workbench-layout-v1')!),
  );
  const saved = (await downloadProject(page)).bundle;
  const camera = await diagramCamera(page);
  for (const width of [800, 390, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    await expect(editor).toHaveSource(draft);
    await expect.poll(() => diagramCamera(page)).toEqual(camera);
    await expect(
      page.getByRole('button', { name: 'Show Explorer', exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Show Inspector', exact: true }),
    ).toBeVisible();
    expect(
      await page.evaluate(() =>
        JSON.parse(localStorage.getItem('sysml-workbench-layout-v1')!),
      ),
    ).toEqual(preferences);
    const primary = await page
      .getByRole('region', { name: 'Diagram', exact: true })
      .boundingBox();
    expect(primary!.width).toBeGreaterThan(width * (width <= 900 ? 0.8 : 0.4));
  }
  await page
    .getByRole('button', { name: 'Show Inspector', exact: true })
    .focus();
  await page.keyboard.press('Enter');
  await expect(
    page.getByRole('button', { name: 'Collapse Inspector', exact: true }),
  ).toBeFocused();
  await expect
    .poll(() =>
      regionSize(
        page.getByRole('complementary', { name: 'Properties', exact: true }),
        'width',
      ),
    )
    .toBeGreaterThanOrEqual(189);
  expect(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem('sysml-workbench-layout-v1')!)
          .inspector,
    ),
  ).toBe(preferences.inspector);
  expect((await downloadProject(page)).bundle).toEqual(saved);
});
