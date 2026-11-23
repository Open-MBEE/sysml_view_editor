import {
  test,
  expect,
  ready,
  readSource,
  fillSource,
  downloadProject,
  diagramCamera,
  importWorkshop,
  copySourceSelection,
  sourceScroll,
  controlReachable,
} from './support';

test('@critical model-first panels preserve the editor, draft, camera and project through focus and maximise', async ({
  page,
}) => {
  await ready(page, { split: false, inspection: false });
  await expect(
    page.getByRole('complementary', { name: 'Properties', exact: true }),
  ).toBeHidden();
  await page.getByRole('button', { name: 'Show Source', exact: true }).click();
  const source = page.getByRole('textbox', {
    name: 'SysML source',
    exact: true,
  });
  await expect(source).toBeVisible();
  const draft = (await readSource(source)) + '\n// retained panel draft';
  await fillSource(source, draft);
  const editor = await source.elementHandle();
  const bundle = (await downloadProject(page)).bundle;
  const camera = await diagramCamera(page);
  await page
    .getByRole('button', { name: 'Inspect selection', exact: true })
    .click();
  await expect(
    page.getByRole('complementary', { name: 'Properties', exact: true }),
  ).toBeVisible();
  for (const name of [
    'Focus model',
    'Restore workspace',
    'Maximize Source',
    'Restore Source',
    'Maximize Explorer',
    'Restore Explorer',
    'Hide Source',
    'Show Source',
  ]) {
    await page.getByRole('button', { name, exact: true }).click();
    expect(await editor!.evaluate((node) => node.isConnected)).toBe(true);
    if (name === 'Maximize Explorer') {
      await expect
        .poll(async () => {
          const navigation = await page
            .getByRole('complementary', {
              name: 'Project navigation',
              exact: true,
            })
            .boundingBox();
          const workspace = await page
            .getByRole('main', { name: 'Model workspace', exact: true })
            .boundingBox();
          return workspace!.width - navigation!.width;
        })
        .toBeLessThan(4);
    }
    if (
      await page
        .getByRole('region', { name: 'Diagram', exact: true })
        .isVisible()
    ) {
      expect(await diagramCamera(page)).toEqual(camera);
    }
  }
  await expect(source).toHaveSource(draft);
  expect((await downloadProject(page)).bundle).toEqual(bundle);
  await source.press('Control+z');
  await expect(source).not.toHaveSource(draft);
});

test('selection does not force inspection and explicit inspection can be closed with focus return', async ({
  page,
}) => {
  await ready(page, { split: false, inspection: false });
  await page
    .getByRole('group', { name: 'part pump : Pump', exact: true })
    .getByText('pump', { exact: true })
    .click();
  await expect(
    page.getByRole('complementary', { name: 'Properties', exact: true }),
  ).toBeHidden();
  await page
    .getByRole('button', { name: 'Inspect selection', exact: true })
    .click();
  await expect(
    page.getByRole('complementary', { name: 'Properties', exact: true }),
  ).toContainText('pump');
  const propertiesTab = page.getByRole('tab', {
    name: 'Properties',
    exact: true,
  });
  await propertiesTab.focus();
  await propertiesTab.press('ArrowRight');
  await expect(
    page.getByRole('tab', { name: 'Relationships', exact: true }),
  ).toBeFocused();
  await expect(
    page.getByRole('region', {
      name: 'Relationships in current view',
      exact: true,
    }),
  ).toContainText('pump');
  await page.setViewportSize({ width: 390, height: 900 });
  for (const name of ['Maximize Inspector', 'Collapse Inspector']) {
    const control = page.getByRole('button', { name, exact: true });
    await expect
      .poll(() => controlReachable(control), { timeout: 5000 })
      .toBe(true);
  }
  await page
    .getByRole('button', { name: 'Collapse Inspector', exact: true })
    .click();
  await expect(
    page.getByRole('button', { name: 'Show Inspector', exact: true }),
  ).toBeFocused();
});

for (const theme of ['light', 'dark']) {
  test(`keeps model-first panels usable at desktop and narrow widths in ${theme}`, async ({
    page,
  }, info) => {
    await ready(page, { split: false, inspection: false });
    await page.getByRole('button', { name: 'Appearance', exact: true }).click();
    const dialog = page.getByRole('dialog', {
      name: 'Appearance',
      exact: true,
    });
    await dialog.getByLabel('Theme', { exact: true }).selectOption(theme);
    await dialog.getByRole('button', { name: 'Close', exact: true }).click();
    await page
      .getByRole('button', { name: 'Show Source', exact: true })
      .click();
    await page
      .getByRole('group', { name: 'part pump : Pump', exact: true })
      .getByText('pump', { exact: true })
      .click();
    await page
      .getByRole('button', { name: 'Inspect selection', exact: true })
      .click();
    for (const width of [1440, 768, 390, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await expect(
        page.getByRole('textbox', { name: 'SysML source', exact: true }),
      ).toBeVisible();
      const apply = page.getByRole('button', {
        name: 'Apply source',
        exact: true,
      });
      await expect(apply).toBeVisible();
      expect(
        await apply.evaluate((node) => {
          const b = node.getBoundingClientRect();
          return (
            b.width > 0 &&
            b.x >= 0 &&
            b.right <= window.innerWidth &&
            b.y >= 0 &&
            b.bottom <= window.innerHeight
          );
        }),
      ).toBe(true);
      await page.screenshot({ path: info.outputPath(`${theme}-${width}.png`) });
    }
  });
}

test('source tabs retain each draft and undo history without changing applied sources', async ({
  page,
}) => {
  await ready(page, { inspection: false });
  const source = page.getByRole('textbox', {
    name: 'SysML source',
    exact: true,
  });
  const bundle = (await downloadProject(page)).bundle;
  const original = await readSource(source);
  const first = original + '\n// first file draft';
  await fillSource(source, first);
  await source.press('Shift+Home');
  const selection = await copySourceSelection(source);
  const scroll = await sourceScroll(source);
  expect(scroll).toBeGreaterThan(0);
  await page
    .getByRole('button', { name: 'components.sysml', exact: true })
    .click();
  const components = await readSource(source);
  const second = components + '\n// second file draft';
  await fillSource(source, second);
  const tabs = page.getByRole('tablist', { name: 'Source files', exact: true });
  await tabs.getByRole('tab', { name: 'system.sysml', exact: true }).click();
  // Observe restored scroll before clipboard verification focuses the editor.
  await expect.poll(() => sourceScroll(source)).toBeCloseTo(scroll, 0);
  expect(await copySourceSelection(source)).toBe(selection);
  await expect(source).toHaveSource(first);
  await source.press('Control+z');
  await expect(source).toHaveSource(original);
  await tabs
    .getByRole('tab', { name: 'components.sysml', exact: true })
    .click();
  await expect(source).toHaveSource(second);
  await tabs
    .getByRole('button', { name: 'Close components.sysml tab', exact: true })
    .click();
  await expect(
    tabs.getByRole('tab', { name: 'system.sysml', exact: true }),
  ).toHaveAttribute('aria-selected', 'true');
  await page
    .getByRole('button', { name: 'components.sysml', exact: true })
    .click();
  await expect(source).toHaveSource(second);
  await source.press('Control+z');
  await expect(source).toHaveSource(components);
  expect((await downloadProject(page)).bundle).toEqual(bundle);
});

test('workspace tabs and model history restore the camera and preserve project data', async ({
  page,
}) => {
  await page.goto('/app');
  await importWorkshop(page);
  const before = (await downloadProject(page)).bundle;
  await page.getByRole('button', { name: 'Read at 100%', exact: true }).click();
  await expect(page.getByLabel('Current zoom', { exact: true })).toHaveText(
    '100%',
  );
  const camera = await diagramCamera(page);
  await page.getByRole('button', { name: 'compressor', exact: true }).click();
  const tabs = page.getByRole('tablist', {
    name: 'Workspace documents',
    exact: true,
  });
  await expect(
    tabs.getByRole('tab', { name: 'compressor', exact: true }),
  ).toHaveAttribute('aria-selected', 'true');
  await tabs.getByRole('tab', { name: 'overview', exact: true }).click();
  await expect.poll(() => diagramCamera(page)).toEqual(camera);
  await page
    .getByRole('button', { name: 'Project overview', exact: true })
    .click();
  await expect(
    tabs.getByRole('tab', { name: 'Project overview', exact: true }),
  ).toHaveAttribute('aria-selected', 'true');
  await page
    .getByRole('button', { name: 'Back in model', exact: true })
    .click();
  await expect(
    tabs.getByRole('tab', { name: 'overview', exact: true }),
  ).toHaveAttribute('aria-selected', 'true');
  await expect.poll(() => diagramCamera(page)).toEqual(camera);
  await page
    .getByRole('button', { name: 'Forward in model', exact: true })
    .click();
  await expect(
    tabs.getByRole('tab', { name: 'Project overview', exact: true }),
  ).toHaveAttribute('aria-selected', 'true');
  await tabs
    .getByRole('button', { name: 'Close Project overview tab', exact: true })
    .click();
  await expect(
    tabs.getByRole('tab', { name: 'Project overview', exact: true }),
  ).toHaveCount(0);
  expect((await downloadProject(page)).bundle).toEqual(before);
});

test('explicit source reveal leaves a maximised inspection panel', async ({
  page,
}) => {
  await ready(page, { split: false, inspection: false });
  await page
    .getByRole('group', { name: 'part pump : Pump', exact: true })
    .getByText('pump', { exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Inspect selection', exact: true })
    .click();
  const before = (await downloadProject(page)).bundle;
  await page
    .getByRole('button', { name: 'Maximize Inspector', exact: true })
    .click();
  const source = page.getByRole('textbox', {
    name: 'SysML source',
    exact: true,
  });
  await expect(source).toBeHidden();
  await page
    .getByRole('complementary', { name: 'Properties', exact: true })
    .getByRole('button', { name: 'Open source', exact: true })
    .click();
  await expect(source).toBeVisible();
  await expect(source).toBeFocused();
  expect(await copySourceSelection(source)).toContain('pump');
  expect((await downloadProject(page)).bundle).toEqual(before);
});

test('project replacement does not replay old panel reveal requests or editor history', async ({
  page,
}) => {
  await ready(page, { split: false, inspection: false });
  await downloadProject(page);
  const source = page.getByRole('textbox', {
    name: 'SysML source',
    exact: true,
  });
  await page
    .getByRole('button', { name: 'components.sysml', exact: true })
    .click();
  await expect(source).toBeVisible();
  await page.getByRole('button', { name: 'Hide Source', exact: true }).click();
  await expect(source).toBeHidden();
  await importWorkshop(page);
  await expect(source).toBeHidden({ timeout: 5000 });
  const replacement = (await downloadProject(page)).bundle;
  await page.getByRole('button', { name: 'Show Source', exact: true }).click();
  await expect(source).toHaveSource(replacement.drafts[0]!.text);
  await source.press('Control+z');
  await expect(source).toHaveSource(replacement.drafts[0]!.text);
  expect((await downloadProject(page)).bundle).toEqual(replacement);
});
