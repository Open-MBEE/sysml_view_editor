import { activeWorkspaceTab, selectExplorationScope } from './support';
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
  openProjectData,
  openNamedView,
} from './support';

test('@critical opens project data as workspace tabs without duplicate view controls and preserves drafts and mounted panes', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const evaluations = await observeEvaluations(page);
  await page.goto('/app');
  await importWorkshop(page);
  await page
    .getByRole('button', { name: 'Show source and model', exact: true })
    .click();
  const header = page.getByRole('group', { name: 'Model header', exact: true });
  await expect(header).toBeVisible();
  await expect(
    page.getByRole('combobox', { name: 'Named view', exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole('group', { name: 'Model representation', exact: true }),
  ).toHaveCount(0);
  await expect(activeWorkspaceTab(page)).toHaveAttribute(
    'title',
    'view:WorkshopViews::overview',
  );
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
    await openProjectData(page, representation);
    await expect(
      header.getByText('Project-wide requirements', { exact: true }),
    ).toBeVisible();
    await expect(header).toContainText('Applied revision · draft pending');
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
  await page
    .getByRole('tablist', { name: 'Workspace documents', exact: true })
    .getByRole('tab', { name: 'overview', exact: true })
    .click();
  await expect(activeWorkspaceTab(page)).toHaveAttribute(
    'title',
    'view:WorkshopViews::overview',
  );
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
      page.getByRole('button', { name: 'Open workspace tab', exact: true }),
    ).toBeDisabled();
  } finally {
    release();
  }
  await expect(
    page.getByRole('button', { name: 'Apply source', exact: true }),
  ).toBeDisabled();
  await expect(header).not.toContainText('draft pending');
  await expect(header).not.toContainText('Updating model…');
  await page.unroute(asset);
});

test('@critical keeps the content picker and contextual actions keyboard reachable at the vertical minimum', async ({
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
  const opener = page.getByRole('button', {
    name: 'Open workspace tab',
    exact: true,
  });
  await opener.focus();
  await expect.poll(() => controlReachable(opener)).toBe(true);
  await opener.press('Enter');
  const picker = page.getByRole('dialog', {
    name: 'Open workspace tab',
    exact: true,
  });
  await expect(picker).toBeVisible();
  const requirements = picker.getByRole('button', {
    name: 'Requirements table',
    exact: true,
  });
  await requirements.focus();
  await expect.poll(() => controlReachable(requirements)).toBe(true);
  await requirements.press('Escape');
  await expect(picker).not.toBeVisible();
  await expect(opener).toBeFocused();
  for (const name of ['Requirements table', 'Traceability matrix'])
    await openProjectData(page, name);
  await openNamedView(page, 'WorkshopViews::overview');
  await activeWorkspaceTab(page).focus();
  await expect
    .poll(() => controlReachable(activeWorkspaceTab(page)))
    .toBe(true);
  expect((await downloadProject(page)).bundle).toEqual(saved);
});

test('closes the content picker across browser route changes while preserving the live project and draft', async ({
  page,
}) => {
  await ready(page);
  const source = page.getByRole('textbox', {
    name: 'SysML source',
    exact: true,
  });
  const draft =
    (await readSource(source)) +
    '\n// retained while leaving the content picker\n';
  await fillSource(source, draft);
  const editor = await source.elementHandle();
  const before = (await downloadProject(page)).bundle;
  await page
    .getByRole('link', { name: 'OpenMBEE View Editor home', exact: true })
    .click();
  await expect(page).toHaveURL(/\/$/);
  await page.goBack();
  await expect(page).toHaveURL(/\/app$/);
  await page
    .getByRole('button', { name: 'Open workspace tab', exact: true })
    .click();
  const picker = page.getByRole('dialog', {
    name: 'Open workspace tab',
    exact: true,
  });
  await expect(picker).toBeVisible();
  await page.goForward();
  await expect(page).toHaveURL(/\/$/);
  await expect(picker).not.toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL(/\/app$/);
  await expect(picker).not.toBeVisible();
  await expect(source).toHaveSource(draft);
  expect(await editor!.evaluate((node) => node.isConnected)).toBe(true);
  expect((await downloadProject(page)).bundle).toEqual(before);
});

test('dismisses the picker without blocking panel controls after a viewport change', async ({
  page,
}) => {
  await ready(page, { split: false, inspection: false });
  const trigger = page.getByRole('button', {
    name: 'Open workspace tab',
    exact: true,
  });
  await trigger.focus();
  await trigger.press('Enter');
  const picker = page.getByRole('dialog', {
    name: 'Open workspace tab',
    exact: true,
  });
  await expect(picker).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(picker).not.toBeVisible();
  await expect(trigger).toBeFocused();
  await page.setViewportSize({ width: 390, height: 900 });
  await page
    .getByRole('button', { name: 'Hide Explorer', exact: true })
    .click();
  await expect(
    page.getByRole('complementary', {
      name: 'Project navigation',
      exact: true,
    }),
  ).not.toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Show Explorer', exact: true }),
  ).toBeVisible();
});

test('shows exploration scope once with an on-demand chooser and one view-type control', async ({
  page,
}) => {
  await page.goto('/app');
  await page.locator('input[type=file]').setInputFiles({
    name: 'scope.sysml',
    mimeType: 'text/plain',
    buffer: Buffer.from('package P { part def System { part child; } }'),
  });
  await expect(
    page
      .getByRole('region', { name: 'Diagram', exact: true })
      .getByRole('group', { name: 'part def System', exact: true }),
  ).toBeVisible();
  const header = page.getByRole('group', { name: 'Model header', exact: true });
  await expect(header.getByText('Scope', { exact: true })).toHaveCount(0);
  await expect(header.getByText('Representation', { exact: true })).toHaveCount(
    0,
  );
  await expect(
    header.getByRole('combobox', { name: 'Exploration scope', exact: true }),
  ).toHaveCount(0);
  await expect(
    header.getByText('Ownership overview', { exact: true }),
  ).toHaveCount(1);
  await expect(
    header.getByText('Applied model · Temporary exploration', { exact: true }),
  ).toHaveCount(0);
  await selectExplorationScope(page, 'P::System');
  await expect(header.getByText('P::System', { exact: true })).toHaveCount(1);
  await expect(
    header.getByRole('group', {
      name: 'Current exploration scope',
      exact: true,
    }),
  ).toHaveText('Part definitionP::System');
  await expect(
    page.getByRole('button', { name: 'Change exploration scope', exact: true }),
  ).toBeFocused();
  const viewType = header.getByRole('combobox', {
    name: 'Exploration representation',
    exact: true,
  });
  await viewType.selectOption('interconnection');
  await expect(viewType).toHaveValue('interconnection');
  await expect(activeWorkspaceTab(page)).toHaveText('System');
  await expect(
    page
      .getByRole('tablist', { name: 'Workspace documents', exact: true })
      .getByRole('tab', { name: 'System', exact: true }),
  ).toHaveCount(1);
});

test('a failed content choice retains the active view and draft, restores picker focus, and permits retry', async ({
  page,
}) => {
  await ready(page, { inspection: false });
  const source = page.getByRole('textbox', {
    name: 'SysML source',
    exact: true,
  });
  const draft =
    (await readSource(source)) + '\n// content choice must retain this draft\n';
  await fillSource(source, draft);
  const before = (await downloadProject(page)).bundle;
  const asset = '**/vendor/opensysml/sysml-wasm.wasm';
  await page.route(asset, (route) =>
    route.fulfill({ status: 503, body: 'Controlled view failure' }),
  );
  const trigger = page.getByRole('button', {
    name: 'Open workspace tab',
    exact: true,
  });
  await trigger.click();
  const picker = page.getByRole('dialog', {
    name: 'Open workspace tab',
    exact: true,
  });
  await picker.getByTitle('CompressorViews::overview', { exact: true }).click();
  await expect(picker).toHaveCount(0);
  await expect(
    page.getByText('OpenSysML browser assets are unavailable.', {
      exact: true,
    }),
  ).toBeVisible();
  await expect(activeWorkspaceTab(page)).toHaveAttribute(
    'title',
    'view:CompressorViews::pneumatics',
  );
  await expect(trigger).toBeFocused();
  await expect(source).toHaveSource(draft);
  expect((await downloadProject(page)).bundle).toEqual(before);
  await page.unroute(asset);
  await openNamedView(page, 'CompressorViews::overview');
  await expect(source).toHaveSource(draft);
  expect((await downloadProject(page)).bundle).toEqual(before);
});
