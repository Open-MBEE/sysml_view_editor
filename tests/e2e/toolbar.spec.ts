import {
  test,
  expect,
  ready,
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
  const original = await source.inputValue();
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
  await source.fill(original + '\n// toolbar history\n');
  await page.getByRole('button', { name: 'Apply source', exact: true }).click();
  await expect(undo).toBeEnabled();
  await undo.focus();
  await expect(page.getByRole('tooltip')).toHaveText('Undo source');
  await page.keyboard.press('Enter');
  await expect(source).toHaveValue(original);
  await expect(redo).toBeEnabled();
  await redo.click();
  await expect(source).toHaveValue(original + '\n// toolbar history\n');
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
