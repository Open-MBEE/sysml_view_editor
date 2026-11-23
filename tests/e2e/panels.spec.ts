import {
  fillSource,
  test,
  inspectModelElement,
  startExample,
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
  controlReachable,
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
  await inspectModelElement(page, 'Assembly::Station::bay::primary');
  const source = page.getByRole('textbox', {
    name: 'SysML source',
    exact: true,
  });
  const editor = await source.elementHandle();
  const draft = documents[0]!.text + '\n// retain this unfinished draft\npart';
  await fillSource(source, draft);
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
  const dock = page.getByRole('region', {
    name: 'Inspection dock',
    exact: true,
  });
  const right = await regionSize(dock, 'height');
  await page
    .getByRole('separator', { name: 'Resize Inspector', exact: true })
    .focus();
  await page.keyboard.press('ArrowUp');
  await expect.poll(() => regionSize(dock, 'height')).toBeGreaterThan(right);
  const sourceWidth = await regionSize(
    page.getByRole('region', { name: 'Source editor', exact: true }),
    'width',
  );
  await dragSeparator(page, 'Resize Source and Diagram', 'x', 45);
  await expect
    .poll(() =>
      regionSize(
        page.getByRole('region', { name: 'Source editor', exact: true }),
        'width',
      ),
    )
    .toBeLessThan(sourceWidth - 20);
  await dragSeparator(page, 'Resize Source and Diagram', 'x', 800);
  await expect
    .poll(() =>
      regionSize(
        page.getByRole('region', { name: 'Source editor', exact: true }),
        'width',
      ),
    )
    .toBeGreaterThanOrEqual(279);
  await expect(source).toBeVisible();
  expect((await toolbarCenterOffsets(page)).source).toBeLessThan(1);
  await expect(
    page.getByRole('button', { name: 'Show source and model', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Show Issues', exact: true }).click();
  const issues = page.getByRole('region', { name: 'Issues', exact: true });
  await expect(issues).toBeVisible();
  const bottom = await regionSize(dock, 'height');
  await page
    .getByRole('separator', { name: 'Resize Issues', exact: true })
    .focus();
  await page.keyboard.press('ArrowUp');
  await expect.poll(() => regionSize(dock, 'height')).toBeGreaterThan(bottom);
  expect(await diagramCamera(page)).toEqual(camera);
  // Both explicit arrangement changes and divider changes preserve the camera.
  for (const mode of [
    'Show model only',
    'Show source only',
    'Show source and model',
  ])
    await page.getByRole('button', { name: mode, exact: true }).click();
  await expect(source).toHaveSource(draft);
  expect(
    await source.evaluate((node, original) => node === original, editor),
  ).toBe(true);
  await page.getByRole('tab', { name: 'Properties', exact: true }).click();
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
    .getByRole('separator', { name: 'Resize Explorer', exact: true })
    .focus();
  await page.keyboard.press('ArrowRight');
  await expect
    .poll(() => regionSize(explorer, 'width'))
    .toBeGreaterThan(initial);
  const expanded = await regionSize(explorer, 'width');
  await page
    .getByRole('button', { name: 'Collapse Explorer', exact: true })
    .focus();
  await page.keyboard.press('Enter');
  await expect(explorer).not.toBeVisible();
  expect(
    await controlReachable(
      page.getByRole('button', { name: 'Show Explorer', exact: true }),
    ),
  ).toBe(true);
  await expect(
    page.getByRole('button', { name: 'Show Explorer', exact: true }),
  ).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(
    page.getByRole('button', { name: 'Hide Explorer', exact: true }),
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
  expect(
    await controlReachable(
      page.getByRole('button', { name: 'Show Inspector', exact: true }),
    ),
  ).toBe(true);
  await page.keyboard.press('Enter');
  await expect(
    page.getByRole('button', { name: 'Hide Inspector', exact: true }),
  ).toBeFocused();
  await page.getByRole('button', { name: 'Show Issues', exact: true }).click();
  const dock = page.getByRole('region', {
    name: 'Inspection dock',
    exact: true,
  });
  await page
    .getByRole('separator', { name: 'Resize Issues', exact: true })
    .focus();
  await page.keyboard.press('ArrowUp');
  const issues = page.getByRole('region', { name: 'Issues', exact: true });
  const height = await regionSize(dock, 'height');
  await page
    .getByRole('button', { name: 'Collapse Inspector', exact: true })
    .click();
  await expect(
    page.getByRole('button', { name: 'Show Inspector', exact: true }),
  ).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(
    page.getByRole('button', { name: 'Hide Inspector', exact: true }),
  ).toBeFocused();
  await expect.poll(() => regionSize(dock, 'height')).toBeCloseTo(height, 0);
  expect((await downloadProject(page)).bundle).toEqual(before);
  await expect(page.getByRole('banner')).not.toContainText('modified');
  await page.reload();
  await startExample(page);
  await expect
    .poll(() => regionSize(explorer, 'width'))
    .toBeCloseTo(expanded, 0);
  await expect.poll(() => regionSize(dock, 'height')).toBeCloseTo(height, 0);
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
  await fillSource(source, 'package Unfinished { part');
  await page
    .getByRole('button', { name: 'Show source only', exact: true })
    .click();
  await page.getByRole('button', { name: 'Apply source', exact: true }).click();
  const issues = page.getByRole('region', { name: 'Issues', exact: true });
  await expect(issues).toBeVisible();
  await expect(
    page.getByRole('separator', { name: 'Resize Issues', exact: true }),
  ).toBeVisible();
  const dock = page.getByRole('region', {
    name: 'Inspection dock',
    exact: true,
  });
  const height = await regionSize(dock, 'height');
  await dragSeparator(page, 'Resize Issues', 'y', -35);
  await expect
    .poll(() => regionSize(dock, 'height'))
    .toBeGreaterThan(height + 20);
  const failed = (await downloadProject(page)).bundle;
  expect(failed.documents).toEqual(before.documents);
  expect(failed.presentations).toEqual(before.presentations);
  expect(failed.drafts[0]!.text).toBe('package Unfinished { part');
  await expect(source).toHaveSource('package Unfinished { part');
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
  await page.keyboard.press('Escape');
  await dragSeparator(page, 'Resize Source and Diagram', 'x', -20);
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
  await ready(page, { inspection: false });
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
    .getByRole('button', { name: 'Show Inspector', exact: true })
    .click();
  await expect(
    page.getByRole('complementary', { name: 'Properties', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Hide Inspector', exact: true }),
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
