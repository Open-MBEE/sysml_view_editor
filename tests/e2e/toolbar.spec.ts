import {
  readSource,
  fillSource,
  test,
  expect,
  ready,
  waitForLauncher,
  openWorkshop,
  downloadProject,
  diagramCamera,
  panDiagram,
  diagramNode,
  nodePosition,
  dragNode,
  toolbarCenterOffsets,
  iconCenterOffset,
  dragSeparator,
} from './support';

test('icon actions retain accessible names, tooltips and exact source undo/redo', async ({
  page,
}) => {
  await openWorkshop(page);
  const source = page.getByRole('textbox', {
    name: 'SysML source',
    exact: true,
  });
  const original = await readSource(source);
  const undo = page.getByRole('button', { name: 'Undo source', exact: true });
  const redo = page.getByRole('button', { name: 'Redo source', exact: true });
  await expect(undo).toBeDisabled();
  await expect(redo).toBeDisabled();
  await source.focus();
  await page.getByRole('button', { name: 'Split', exact: true }).focus();
  await expect(page.getByRole('tooltip')).toHaveText('Split');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('tooltip')).not.toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Split', exact: true }),
  ).toBeFocused();
  await fillSource(source, original + '\n// toolbar history\n');
  await page.getByRole('button', { name: 'Apply source', exact: true }).click();
  await expect(undo).toBeEnabled();
  await undo.focus();
  await expect(page.getByRole('tooltip')).toHaveText('Undo source');
  await page.keyboard.press('Enter');
  await expect(source).toHaveSource(original);
  await expect(redo).toBeEnabled();
  await redo.click();
  await expect(source).toHaveSource(original + '\n// toolbar history\n');
  await expect(
    page.getByRole('button', { name: 'Download project', exact: true }),
  ).toBeEnabled();
});

test('diagram icons zoom, fit and lock without adding source or layout history', async ({
  page,
}) => {
  await openWorkshop(page);
  const before = (await downloadProject(page)).bundle;
  const controls = page.getByRole('group', {
    name: 'Diagram controls',
    exact: true,
  });
  const camera = await diagramCamera(page);
  await controls.getByRole('button', { name: 'Zoom in', exact: true }).click();
  await expect
    .poll(async () => (await diagramCamera(page)).zoom)
    .toBeGreaterThan(camera.zoom);
  await controls.getByRole('button', { name: 'Zoom out', exact: true }).click();
  await expect
    .poll(async () => (await diagramCamera(page)).zoom)
    .toBeCloseTo(camera.zoom, 4);
  await panDiagram(page);
  const panned = await diagramCamera(page);
  await controls.getByRole('button', { name: 'Fit view', exact: true }).click();
  await expect.poll(() => diagramCamera(page)).not.toEqual(panned);
  const node = diagramNode(page, 'Workshop::Motor');
  const point = await nodePosition(node);
  await controls
    .getByRole('button', { name: 'Lock diagram', exact: true })
    .click();
  await expect(
    controls.getByRole('button', { name: 'Unlock diagram', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true');
  await dragNode(page, node);
  expect(await nodePosition(node)).toEqual(point);
  await controls
    .getByRole('button', { name: 'Unlock diagram', exact: true })
    .click();
  expect((await downloadProject(page)).bundle).toEqual(before);
  await expect(
    page.getByRole('button', { name: 'Undo source', exact: true }),
  ).toBeDisabled();
});

test('centres source commands and mode icons over their panes while resizing', async ({
  page,
}) => {
  await page.setViewportSize({ width: 2048, height: 900 });
  await ready(page, { split: false });
  const modeGap = async () => {
    const mode = await page
      .getByRole('button', { name: 'Diagram', exact: true })
      .boundingBox();
    const options = await page
      .getByRole('button', { name: 'Workspace layout', exact: true })
      .boundingBox();
    return options!.x - mode!.x - mode!.width;
  };
  await expect.poll(modeGap).toBeGreaterThanOrEqual(8);
  await page.getByRole('button', { name: 'Split', exact: true }).click();
  const aligned = async () =>
    Math.max(...Object.values(await toolbarCenterOffsets(page)));
  await expect.poll(aligned).toBeLessThan(1);
  for (const name of [
    'Undo source',
    'Redo source',
    'Code',
    'Split',
    'Diagram',
    'Collapse Explorer',
    'Collapse Inspector',
    'Workspace layout',
  ])
    expect(
      await iconCenterOffset(page.getByRole('button', { name, exact: true })),
    ).toBeLessThan(0.5);
  await dragSeparator(page, 'Resize Explorer', 'x', 60);
  await expect.poll(aligned).toBeLessThan(1);
  await dragSeparator(page, 'Resize Source and Diagram', 'x', 80);
  await expect.poll(aligned).toBeLessThan(1);
  await page.setViewportSize({ width: 768, height: 900 });
  await expect.poll(aligned).toBeLessThan(1);
  await page.setViewportSize({ width: 1024, height: 900 });
  await page.getByRole('button', { name: 'Diagram', exact: true }).click();
  await dragSeparator(page, 'Resize Explorer', 'x', 200);
  await expect
    .poll(async () => {
      const modes = await page
        .getByRole('group', { name: 'Editor layout', exact: true })
        .boundingBox();
      const actions = await page
        .getByRole('group', { name: 'Source actions', exact: true })
        .boundingBox();
      return modes!.y - actions!.y - actions!.height;
    })
    .toBeGreaterThanOrEqual(0);
  await expect.poll(modeGap).toBeGreaterThanOrEqual(8);
});

test('keeps wrapped mobile project actions inside the header and above source controls', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 900 });
  await page.goto('/app');
  await waitForLauncher(page);
  await page.getByRole('button', { name: 'Load example', exact: true }).click();
  await expect(
    page.getByRole('combobox', { name: 'Named view', exact: true }),
  ).toHaveValue('CompressorViews::pneumatics');
  await expect(
    page.getByRole('group', { name: 'part pump : Pump', exact: true }),
  ).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  const header = page.getByRole('banner');
  const actions = header.getByRole('navigation', {
    name: 'Project actions',
    exact: true,
  });
  for (const width of [390, 600, 601]) {
    await page.setViewportSize({ width, height: 900 });
    await expect
      .poll(
        async () => {
          const [container, content] = await Promise.all([
            header.boundingBox(),
            actions.boundingBox(),
          ]);
          return (
            container!.y + container!.height - content!.y - content!.height
          );
        },
        { timeout: 5000 },
      )
      .toBeGreaterThanOrEqual(0);
    await expect
      .poll(
        async () => {
          const [container, history, source, modes] = await Promise.all([
            header.boundingBox(),
            page
              .getByRole('group', {
                name: 'Source transaction history',
                exact: true,
              })
              .boundingBox(),
            page
              .getByRole('group', { name: 'Source actions', exact: true })
              .boundingBox(),
            page
              .getByRole('group', { name: 'Editor layout', exact: true })
              .boundingBox(),
          ]);
          return (
            Math.min(history!.y, source!.y, modes!.y) -
            container!.y -
            container!.height
          );
        },
        { timeout: 5000 },
      )
      .toBeGreaterThanOrEqual(0);
  }
  await page.setViewportSize({ width: 390, height: 900 });
  const before = (await downloadProject(page)).bundle;
  const appearance = actions.getByRole('button', {
    name: 'Appearance',
    exact: true,
  });
  await appearance.focus();
  await appearance.press('Enter');
  const dialog = page.getByRole('dialog', { name: 'Appearance', exact: true });
  await expect(
    dialog.getByRole('combobox', { name: 'Theme', exact: true }),
  ).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
  await expect(appearance).toBeFocused();
  await header.getByRole('button', { name: 'Projects', exact: true }).click();
  await page
    .getByRole('button', { name: 'Resume project', exact: true })
    .click();
  await expect(
    header.getByRole('button', { name: 'Projects', exact: true }),
  ).toBeFocused();
  expect((await downloadProject(page)).bundle).toEqual(before);
});
