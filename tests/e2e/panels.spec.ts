import {
  test,
  waitForStartup,
  expect,
  ready,
  importAssembly,
  openView,
  moveNode,
  downloadProject,
  regionSize,
  dragSeparator,
  diagramCamera,
  panDiagram,
  expectRenderedPositions,
  railEdgeOffset,
  toolbarCenterOffsets,
} from './support';

test('resizes every divider and preserves draft, selection, source DOM, camera and both saved views', async ({
  page,
}) => {
  test.setTimeout(150_000);
  await ready(page);
  const documents = await importAssembly(page);
  for (const view of ['structure', 'devices']) {
    await openView(page, view);
    await moveNode(
      page,
      page.getByRole('group', { name: 'part primary : Device', exact: true }),
    );
  }
  await page
    .getByTitle('Assembly::Station::bay::primary', { exact: true })
    .click();
  const source = page.getByRole('textbox', {
    name: 'SysML source',
    exact: true,
  });
  const editor = await source.elementHandle();
  const draft = documents[0]!.text + '\n// retain this unfinished draft\npart';
  await source.fill(draft);
  const before = (await downloadProject(page)).bundle;
  await panDiagram(page);
  const camera = await diagramCamera(page);
  const explorer = page.getByRole('complementary', {
    name: 'Project navigation',
    exact: true,
  });
  const inspector = page.getByRole('complementary', {
    name: 'Properties',
    exact: true,
  });
  const left = await regionSize(explorer, 'width');
  await dragSeparator(page, 'Resize Explorer', 'x', 70);
  await expect
    .poll(() => regionSize(explorer, 'width'))
    .toBeGreaterThan(left + 40);
  const right = await regionSize(inspector, 'width');
  await page
    .getByRole('separator', { name: 'Resize Inspector', exact: true })
    .focus();
  await page.keyboard.press('ArrowLeft');
  await expect
    .poll(() => regionSize(inspector, 'width'))
    .toBeGreaterThan(right);
  const sourceWidth = await regionSize(source, 'width');
  await dragSeparator(page, 'Resize Source and Diagram', 'x', -45);
  await expect
    .poll(() => regionSize(source, 'width'))
    .toBeLessThan(sourceWidth - 20);
  await dragSeparator(page, 'Resize Source and Diagram', 'x', -800);
  await expect
    .poll(() => regionSize(source, 'width'))
    .toBeGreaterThanOrEqual(159);
  await expect(source).toBeVisible();
  expect((await toolbarCenterOffsets(page)).source).toBeLessThan(1);
  await expect(
    page.getByRole('button', { name: 'Split', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Show Issues', exact: true }).click();
  const issues = page.getByRole('region', { name: 'Issues', exact: true });
  const bottom = await regionSize(issues, 'height');
  await page
    .getByRole('separator', { name: 'Resize Issues', exact: true })
    .focus();
  await page.keyboard.press('ArrowUp');
  await expect.poll(() => regionSize(issues, 'height')).toBeGreaterThan(bottom);
  expect(await diagramCamera(page)).toEqual(camera);
  // Explicit editor modes refit the view; divider changes above preserve the camera.
  for (const mode of ['Diagram', 'Code', 'Split'])
    await page.getByRole('button', { name: mode, exact: true }).click();
  await expect(source).toHaveValue(draft);
  expect(
    await source.evaluate((node, original) => node === original, editor),
  ).toBe(true);
  await expect(inspector).toContainText('Assembly::Station::bay::primary');
  expect((await downloadProject(page)).bundle).toEqual(before);
  await expect(
    page.getByRole('button', { name: 'Undo source', exact: true }),
  ).toBeDisabled();
  await expectRenderedPositions(page, before, 'AssemblyViews::devices');
  // Both named views retain their exact independently saved coordinates.
  await page
    .getByRole('button', { name: 'Discard draft', exact: true })
    .click();
  for (const view of ['structure', 'devices']) {
    await openView(page, view);
    await expectRenderedPositions(page, before, 'AssemblyViews::' + view);
  }
});

test('collapses and restores sizes with keyboard focus, persists UI preferences and resets them', async ({
  page,
}) => {
  await ready(page);
  const before = (await downloadProject(page)).bundle;
  const explorer = page.getByRole('complementary', {
    name: 'Project navigation',
    exact: true,
  });
  const initial = await regionSize(explorer, 'width');
  await page
    .getByRole('button', { name: 'Explorer panel options', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Widen Explorer', exact: true })
    .click();
  await expect
    .poll(() => regionSize(explorer, 'width'))
    .toBeGreaterThan(initial);
  await page.keyboard.press('Escape');
  await expect(
    page.getByRole('button', { name: 'Explorer panel options', exact: true }),
  ).toBeFocused();
  const expanded = await regionSize(explorer, 'width');
  await page
    .getByRole('button', { name: 'Collapse Explorer', exact: true })
    .focus();
  await page.keyboard.press('Enter');
  await expect(explorer).not.toBeVisible();
  expect(await railEdgeOffset(page, 'Show Explorer', 'left')).toBeLessThan(8);
  await expect(
    page.getByRole('button', { name: 'Show Explorer', exact: true }),
  ).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(
    page.getByRole('button', { name: 'Collapse Explorer', exact: true }),
  ).toBeFocused();
  await expect
    .poll(() => regionSize(explorer, 'width'))
    .toBeCloseTo(expanded, 0);
  await page
    .getByRole('button', { name: 'Collapse Inspector', exact: true })
    .click();
  await expect(
    page.getByRole('button', { name: 'Show Inspector', exact: true }),
  ).toBeFocused();
  expect(await railEdgeOffset(page, 'Show Inspector', 'right')).toBeLessThan(8);
  await page.keyboard.press('Enter');
  await expect(
    page.getByRole('button', { name: 'Collapse Inspector', exact: true }),
  ).toBeFocused();
  await page.getByRole('button', { name: 'Show Issues', exact: true }).click();
  await page
    .getByRole('button', { name: 'Issues panel options', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Taller Issues', exact: true })
    .click();
  await page.keyboard.press('Escape');
  const issues = page.getByRole('region', { name: 'Issues', exact: true });
  const height = await regionSize(issues, 'height');
  await page
    .getByRole('button', { name: 'Collapse Issues', exact: true })
    .click();
  await expect(
    page.getByRole('button', { name: 'Show Issues', exact: true }),
  ).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(
    page.getByRole('button', { name: 'Collapse Issues', exact: true }),
  ).toBeFocused();
  await expect.poll(() => regionSize(issues, 'height')).toBeCloseTo(height, 0);
  expect((await downloadProject(page)).bundle).toEqual(before);
  await expect(page.getByRole('banner')).not.toContainText('modified');
  await page.reload();
  await waitForStartup(page);
  await expect
    .poll(() => regionSize(explorer, 'width'))
    .toBeCloseTo(expanded, 0);
  await expect.poll(() => regionSize(issues, 'height')).toBeCloseTo(height, 0);
  await page
    .getByRole('button', { name: 'Workspace layout', exact: true })
    .click();
  const options = page.getByRole('dialog', {
    name: 'Workspace layout options',
    exact: true,
  });
  await options
    .getByRole('button', { name: 'Reset layout', exact: true })
    .click();
  await page.keyboard.press('Escape');
  await expect(
    page.getByRole('button', { name: 'Workspace layout', exact: true }),
  ).toBeFocused();
  await expect
    .poll(() => regionSize(explorer, 'width'))
    .toBeCloseTo(initial, 0);
  await expect(issues).not.toBeVisible();
  expect((await downloadProject(page)).bundle).toEqual(before);
});

test('opens resizable Issues on validation failure and retains the invalid draft and last diagram', async ({
  page,
}) => {
  await ready(page);
  const source = page.getByRole('textbox', {
    name: 'SysML source',
    exact: true,
  });
  const before = (await downloadProject(page)).bundle;
  await source.fill('package Unfinished { part');
  await page.getByRole('button', { name: 'Apply source', exact: true }).click();
  const issues = page.getByRole('region', { name: 'Issues', exact: true });
  await expect(issues).toBeVisible();
  await expect(
    page.getByRole('separator', { name: 'Resize Issues', exact: true }),
  ).toBeVisible();
  const height = await regionSize(issues, 'height');
  await dragSeparator(page, 'Resize Issues', 'y', -35);
  await expect
    .poll(() => regionSize(issues, 'height'))
    .toBeGreaterThan(height + 20);
  const failed = (await downloadProject(page)).bundle;
  expect(failed.documents).toEqual(before.documents);
  expect(failed.presentations).toEqual(before.presentations);
  expect(failed.drafts[0]!.text).toBe('package Unfinished { part');
  await expect(source).toHaveValue('package Unfinished { part');
  await expect(
    page.getByRole('group', { name: 'part pump : Pump', exact: true }),
  ).toBeVisible();
});

test('keeps panels operable when preference storage is denied', async ({
  page,
}) => {
  await page.addInitScript(() => {
    Storage.prototype.getItem = () => {
      throw new Error('blocked storage');
    };
    Storage.prototype.setItem = () => {
      throw new Error('blocked storage');
    };
  });
  await ready(page);
  const before = (await downloadProject(page)).bundle;
  await page
    .getByRole('button', { name: 'Workspace layout', exact: true })
    .click();
  const options = page.getByRole('dialog', {
    name: 'Workspace layout options',
    exact: true,
  });
  await expect(options.getByRole('status')).toContainText('cannot be saved');
  await options
    .getByRole('button', { name: 'More source space', exact: true })
    .click();
  await page.keyboard.press('Escape');
  await page
    .getByRole('button', { name: 'Collapse Explorer', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Show Explorer', exact: true })
    .click();
  expect((await downloadProject(page)).bundle).toEqual(before);
});

test('recovers from corrupt preferences and keeps narrow dark panels reachable without horizontal overflow', async ({
  page,
}) => {
  await page.setViewportSize({ width: 768, height: 900 });
  await page.addInitScript(() =>
    localStorage.setItem('sysml-workbench-layout-v1', '{invalid'),
  );
  await ready(page);
  const before = (await downloadProject(page)).bundle;
  await page.getByRole('button', { name: 'Appearance', exact: true }).click();
  await page
    .getByRole('dialog')
    .getByLabel('Theme', { exact: true })
    .selectOption('dark');
  await page.getByRole('button', { name: 'Done', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Show Inspector', exact: true }),
  ).toBeVisible();
  await page
    .getByRole('button', { name: 'Collapse Explorer', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Show Inspector', exact: true })
    .click();
  await expect(
    page.getByRole('complementary', { name: 'Properties', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Collapse Inspector', exact: true }),
  ).toBeFocused();
  await page
    .getByRole('separator', { name: 'Resize Source and Diagram', exact: true })
    .focus();
  await expect(
    page.getByRole('separator', {
      name: 'Resize Source and Diagram',
      exact: true,
    }),
  ).toHaveAttribute('aria-orientation', 'horizontal');
  await page.keyboard.press('ArrowUp');
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  expect((await downloadProject(page)).bundle).toEqual(before);
});
