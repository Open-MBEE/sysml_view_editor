import {
  ready,
  dragSeparator,
  controlReachable,
  test,
  expect,
  importWorkshop,
  fillSource,
  readSource,
  downloadProject,
  observeEvaluations,
  namedViewButton,
} from './support';

test('@critical keeps one Model header and preserves independent representation, arrangement and drafts', async ({
  page,
}) => {
  const evaluations = await observeEvaluations(page);
  await page.goto('/app');
  await importWorkshop(page);
  await page
    .getByRole('button', { name: 'Show source and model', exact: true })
    .click();
  const header = page.getByRole('group', { name: 'Model header', exact: true });
  await expect(header).toBeVisible();
  await expect(
    header.getByText('Representation', { exact: true }),
  ).toBeVisible();
  await expect(
    header.getByRole('combobox', { name: 'Named view', exact: true }),
  ).toHaveValue('WorkshopViews::overview');
  await expect(
    page.getByRole('combobox', { name: 'Named view', exact: true }),
  ).toHaveCount(1);
  const source = page.getByRole('textbox', {
    name: 'SysML source',
    exact: true,
  });
  const editor = await source.elementHandle();
  const canvas = await page
    .getByRole('region', { name: 'Diagram', exact: true })
    .getByRole('application')
    .elementHandle();
  const draft =
    (await readSource(source)) +
    '\n// unfinished draft remains independent\npart';
  await fillSource(source, draft);
  const saved = (await downloadProject(page)).bundle;
  const evaluationCount = evaluations.length;
  for (const representation of ['Requirements table', 'Traceability matrix']) {
    const button = header.getByRole('button', {
      name: representation,
      exact: true,
    });
    await button.focus();
    await button.press('Enter');
    await expect(button).toBeFocused();
    await expect(button).toHaveAttribute('aria-pressed', 'true');
    await expect(
      header.getByText('Project-wide requirements', { exact: true }),
    ).toBeVisible();
    await expect(header).toContainText('Applied revision · draft pending');
    await expect(
      page.getByRole('combobox', { name: 'Named view', exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByRole('button', { name: 'Fit view', exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByRole('button', { name: 'Show source and model', exact: true }),
    ).toHaveAttribute('aria-pressed', 'true');
    expect(await canvas!.evaluate((node) => node.isConnected)).toBe(true);
    expect(await editor!.evaluate((node) => node.isConnected)).toBe(true);
    expect((await downloadProject(page)).bundle).toEqual(saved);
    expect(evaluations).toHaveLength(evaluationCount);
  }
  await namedViewButton(page, 'WorkshopViews::overview').click();
  await expect(
    header.getByRole('button', { name: 'Diagram view', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true');
  await expect(
    header.getByRole('combobox', { name: 'Named view', exact: true }),
  ).toHaveValue('WorkshopViews::overview');
  await expect(source).toHaveSource(draft);
  expect((await downloadProject(page)).bundle).toEqual(saved);
});

test('reports current model work and unavailable rendering without duplicating diagram target controls', async ({
  page,
}) => {
  await ready(page);
  const header = page.getByRole('group', { name: 'Model header', exact: true });
  await namedViewButton(page, 'CompressorViews::startupSequence').click();
  await expect(header).toContainText('Rendering unavailable');
  await expect(
    page.getByRole('region', { name: 'Diagram', exact: true }),
  ).toContainText('Rendering unavailable');
  await namedViewButton(page, 'CompressorViews::pneumatics').click();
  await expect(
    header.getByRole('button', { name: 'New part', exact: true }),
  ).toHaveCount(1);
  await expect(
    header.getByRole('button', { name: 'Connect ports', exact: true }),
  ).toHaveCount(1);
  const source = page.getByRole('textbox', {
    name: 'SysML source',
    exact: true,
  });
  await fillSource(
    source,
    (await readSource(source)) +
      '\n// apply valid draft while retaining the displayed model\n',
  );
  let requested = false;
  let release!: () => void;
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  const asset = '**/vendor/opensysml/sysml-wasm.wasm';
  await page.route(asset, async (route) => {
    requested = true;
    await pending;
    await route.continue();
  });
  try {
    await page
      .getByRole('button', { name: 'Apply source', exact: true })
      .click();
    await expect.poll(() => requested).toBe(true);
    await expect(header).toContainText(
      'Updating model… · showing applied revision',
    );
    await expect(
      header.getByRole('button', { name: 'Requirements table', exact: true }),
    ).toBeDisabled();
  } finally {
    release();
  }
  await expect(
    page.getByRole('button', { name: 'Apply source', exact: true }),
  ).toBeDisabled();
  await expect(header).toContainText('Applied model');
  await expect(header).not.toContainText('Updating model…');
  await page.unroute(asset);
});

test('@critical keeps Model representation and target controls keyboard reachable at the vertical minimum', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 900 });
  await page.goto('/app');
  await importWorkshop(page);
  await page
    .getByRole('button', { name: 'Show source and model', exact: true })
    .click();
  const saved = (await downloadProject(page)).bundle;
  await dragSeparator(page, 'Resize Source and Diagram', 'y', -2000);
  const header = page.getByRole('group', { name: 'Model header', exact: true });
  for (const name of [
    'Requirements table',
    'Traceability matrix',
    'Diagram view',
  ]) {
    const button = header.getByRole('button', { name, exact: true });
    await button.focus();
    await expect.poll(() => controlReachable(button)).toBe(true);
    await button.press('Enter');
    await expect(button).toBeFocused();
  }
  const target = header.getByRole('combobox', {
    name: 'Named view',
    exact: true,
  });
  await target.focus();
  await expect.poll(() => controlReachable(target)).toBe(true);
  expect((await downloadProject(page)).bundle).toEqual(saved);
});
