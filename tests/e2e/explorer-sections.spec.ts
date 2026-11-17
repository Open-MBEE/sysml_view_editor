import {
  test,
  expect,
  ready,
  fillSource,
  readSource,
  downloadProject,
  diagramCamera,
  modelTreeItem,
  namedViewButton,
} from './support';

test('@critical preserves independent Explorer sections and navigation across activity rail toggles', async ({
  page,
}) => {
  await ready(page);
  const nav = page.getByRole('complementary', {
    name: 'Project navigation',
    exact: true,
  });
  const rail = page.getByRole('navigation', {
    name: 'Workspace activities',
    exact: true,
  });
  await expect(rail.getByRole('button')).toHaveCount(1);
  const files = nav.getByRole('button', { name: 'Files', exact: true });
  const views = nav.getByRole('button', { name: 'Views', exact: true });
  const model = nav.getByRole('button', { name: 'Model', exact: true });
  const source = page.getByRole('textbox', {
    name: 'SysML source',
    exact: true,
  });
  const draft = (await readSource(source)) + '\npart';
  await fillSource(source, draft);
  const saved = (await downloadProject(page)).bundle;
  const camera = await diagramCamera(page);
  const branch = modelTreeItem(page, 'CompressorBehavior');
  await branch.focus();
  await branch.press('ArrowRight');
  await expect(branch).toHaveAttribute('aria-expanded', 'true');
  await files.click();
  await views.click();
  await model.click();
  for (const toggle of [files, views, model])
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  const hide = rail.getByRole('button', { name: 'Hide Explorer', exact: true });
  await hide.focus();
  await hide.press('Enter');
  const show = rail.getByRole('button', { name: 'Show Explorer', exact: true });
  await expect(show).toBeFocused();
  await expect(nav).toHaveCount(0);
  await show.press('Enter');
  await expect(nav).toBeVisible();
  for (const toggle of [files, views, model])
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await model.click();
  await expect(branch).toHaveAttribute('aria-expanded', 'true');
  await files.click();
  await views.click();
  await expect(
    namedViewButton(page, 'CompressorViews::pneumatics'),
  ).toHaveAttribute('aria-current', 'page');
  await expect(source).toHaveSource(draft);
  expect((await downloadProject(page)).bundle).toEqual(saved);
  expect(await diagramCamera(page)).toEqual(camera);
});

test('reopens the Model section to reveal diagram selection without taking focus', async ({
  page,
}) => {
  await ready(page, { split: false });
  const nav = page.getByRole('complementary', {
    name: 'Project navigation',
    exact: true,
  });
  const model = nav.getByRole('button', { name: 'Model', exact: true });
  await model.click();
  await expect(model).toHaveAttribute('aria-expanded', 'false');
  const pump = page.getByRole('group', {
    name: 'part pump : Pump',
    exact: true,
  });
  await pump.getByText('pump : Pump', { exact: true }).click();
  await expect(model).toHaveAttribute('aria-expanded', 'true');
  await expect(
    modelTreeItem(page, 'CompressorSystem::PneumaticAssembly::pump'),
  ).toHaveAttribute('aria-selected', 'true');
  await expect(
    modelTreeItem(page, 'CompressorSystem::PneumaticAssembly'),
  ).toHaveAttribute('aria-expanded', 'true');
  await expect(pump).toBeFocused();
});

test('keeps New view separate from the collapsed Views toggle and keeps phone focus visible', async ({
  page,
}) => {
  await ready(page, { split: false });
  await page.setViewportSize({ width: 390, height: 900 });
  const rail = page.getByRole('navigation', {
    name: 'Workspace activities',
    exact: true,
  });
  const show = rail.getByRole('button', { name: 'Show Explorer', exact: true });
  if (await show.isVisible()) await show.click();
  const nav = page.getByRole('complementary', {
    name: 'Project navigation',
    exact: true,
  });
  const views = nav.getByRole('button', { name: 'Views', exact: true });
  await views.click();
  const before = (await downloadProject(page)).bundle;
  await nav.getByRole('button', { name: 'New view', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'New view', exact: true });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(views).toHaveAttribute('aria-expanded', 'false');
  await expect(
    nav.getByRole('button', { name: 'New view', exact: true }),
  ).toBeFocused();
  await rail
    .getByRole('button', { name: 'Hide Explorer', exact: true })
    .click();
  await expect(show).toBeFocused();
  await show.press('Enter');
  await expect(
    page.getByRole('button', { name: 'Collapse Explorer', exact: true }),
  ).toBeFocused();
  await expect(views).toHaveAttribute('aria-expanded', 'false');
  expect((await downloadProject(page)).bundle).toEqual(before);
});
