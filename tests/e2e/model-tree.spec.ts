import {
  test,
  expect,
  ready,
  modelTreeItem,
  downloadProject,
  diagramCamera,
} from './support';

test('nests actual action parameters by owner and retains an invalid draft, source file, applied view and geometry while browsing', async ({
  page,
}) => {
  await ready(page);
  const source = page.getByRole('textbox', {
    name: 'SysML source',
    exact: true,
  });
  await source.fill('package Unfinished { part');
  await page.getByRole('button', { name: 'Apply source', exact: true }).click();
  await expect(
    page.getByRole('region', { name: 'Issues', exact: true }),
  ).toBeVisible();
  const before = (await downloadProject(page)).bundle;
  const camera = await diagramCamera(page);
  const tree = page.getByRole('tree', { name: 'Model', exact: true });
  const behavior = modelTreeItem(page, 'CompressorBehavior');
  await behavior.focus();
  await page.keyboard.press('ArrowRight');
  const sense = modelTreeItem(page, 'CompressorBehavior::SensePressure');
  await sense.focus();
  await page.keyboard.press('ArrowRight');
  const control = modelTreeItem(page, 'CompressorBehavior::ControlMotor');
  await control.focus();
  await page.keyboard.press('ArrowRight');
  const first = modelTreeItem(
    page,
    'CompressorBehavior::SensePressure::reading',
  );
  const second = modelTreeItem(
    page,
    'CompressorBehavior::ControlMotor::reading',
  );
  for (const [branch, reading, identity] of [
    [sense, first, 'CompressorBehavior::SensePressure::reading'],
    [control, second, 'CompressorBehavior::ControlMotor::reading'],
  ] as const) {
    await expect(
      branch.getByRole('group').getByRole('treeitem', {
        name: 'reading, item, PressureReading',
        exact: true,
      }),
    ).toHaveCount(1);
    await expect(reading).toHaveAttribute('aria-level', '3');
    await expect(
      reading.getByText('PressureReading', { exact: true }),
    ).toBeVisible();
    await reading.focus();
    await page.keyboard.press('Enter');
    await expect(reading).toHaveAttribute('aria-selected', 'true');
    const inspector = page.getByRole('complementary', {
      name: 'Properties',
      exact: true,
    });
    await expect(inspector.getByText(identity, { exact: true })).toBeVisible();
    await expect(
      inspector.getByText('CompressorTypes::PressureReading', { exact: true }),
    ).toBeVisible();
  }
  await behavior.focus();
  await page.keyboard.press('ArrowLeft');
  await expect(behavior).toHaveAttribute('aria-expanded', 'false');
  await expect(
    tree.getByRole('treeitem', {
      name: 'reading, item, PressureReading',
      exact: true,
    }),
  ).toHaveCount(0);
  await expect(
    page.getByRole('complementary', { name: 'Properties', exact: true }),
  ).toContainText('CompressorBehavior::ControlMotor::reading');
  await expect(source).toHaveValue('package Unfinished { part');
  await expect(
    page
      .getByRole('region', { name: 'Source editor', exact: true })
      .getByText('system.sysml', { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByTitle('CompressorViews::pneumatics', { exact: true }),
  ).toHaveAttribute('aria-current', 'page');
  expect((await downloadProject(page)).bundle).toEqual(before);
  expect(await diagramCamera(page)).toEqual(camera);
});

test('provides one keyboard tab stop, visible-row navigation, type-ahead and explicit selection', async ({
  page,
}) => {
  await ready(page, { split: false });
  const before = (await downloadProject(page)).bundle;
  const tree = page.getByRole('tree', { name: 'Model', exact: true });
  const system = modelTreeItem(page, 'CompressorSystem');
  const behavior = modelTreeItem(page, 'CompressorBehavior');
  await system.focus();
  await page.keyboard.press('ArrowDown');
  await expect(modelTreeItem(page, 'CompressorComponents')).toBeFocused();
  await expect(tree.getByRole('treeitem', { selected: true })).toHaveCount(0);
  await page.keyboard.press('End');
  await expect(modelTreeItem(page, 'CompressorGeometry')).toBeFocused();
  await page.keyboard.press('Home');
  await expect(system).toBeFocused();
  await page.keyboard.type('CompressorBehavior');
  await expect(behavior).toBeFocused();
  await page.keyboard.press('Space');
  await expect(behavior).toHaveAttribute('aria-selected', 'true');
  await page.keyboard.press('ArrowRight');
  await expect(behavior).toBeFocused();
  await page.keyboard.press('ArrowRight');
  const sense = modelTreeItem(page, 'CompressorBehavior::SensePressure');
  await expect(sense).toBeFocused();
  await expect(behavior).toHaveAttribute('aria-selected', 'true');
  await page.keyboard.press('ArrowDown');
  await expect(
    modelTreeItem(page, 'CompressorBehavior::SenseTemperature'),
  ).toBeFocused();
  await page.keyboard.press('ArrowUp');
  await expect(sense).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(sense).toHaveAttribute('aria-selected', 'true');
  await page.keyboard.press('Tab');
  await expect(
    page.getByRole('separator', { name: 'Resize Explorer', exact: true }),
  ).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(sense).toBeFocused();
  await page.keyboard.press('ArrowLeft');
  await expect(behavior).toBeFocused();
  await page.keyboard.press('ArrowLeft');
  await expect(behavior).toHaveAttribute('aria-expanded', 'false');
  await page
    .getByRole('button', { name: 'Expand all model elements', exact: true })
    .click();
  await expect(
    modelTreeItem(page, 'CompressorBehavior::SensePressure::reading'),
  ).toBeVisible();
  await page
    .getByRole('button', { name: 'Collapse all model elements', exact: true })
    .click();
  await page.keyboard.press('Tab');
  await expect(behavior).toBeFocused();
  expect((await downloadProject(page)).bundle).toEqual(before);
});

test('reveals the selected usage from the diagram, including repeated selection, without taking diagram focus', async ({
  page,
}) => {
  await ready(page, { split: false });
  const before = (await downloadProject(page)).bundle;
  const pump = page.getByRole('group', {
    name: 'part pump : Pump',
    exact: true,
  });
  const item = modelTreeItem(page, 'CompressorSystem::PneumaticAssembly::pump');
  const owner = modelTreeItem(page, 'CompressorSystem::PneumaticAssembly');
  for (let attempt = 0; attempt < 2; attempt++) {
    await pump.getByText('pump : Pump', { exact: true }).click();
    await expect(item).toHaveAttribute('aria-selected', 'true');
    await expect(owner).toHaveAttribute('aria-expanded', 'true');
    await expect(pump).toBeFocused();
    await expect(
      page
        .getByRole('complementary', { name: 'Properties', exact: true })
        .getByText('CompressorSystem::PneumaticAssembly::pump', {
          exact: true,
        }),
    ).toBeVisible();
    await owner.focus();
    await page.keyboard.press('ArrowLeft');
    await expect(owner).toHaveAttribute('aria-expanded', 'false');
  }
  expect((await downloadProject(page)).bundle).toEqual(before);
});
