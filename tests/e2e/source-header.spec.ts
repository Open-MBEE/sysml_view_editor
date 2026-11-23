import { openProjectData } from './support';
import { activeWorkspaceTab } from './support';
import {
  test,
  expect,
  openWorkshop,
  importWorkshop,
  dragSeparator,
  sourceHeaderGeometry,
  readSource,
  fillSource,
  downloadProject,
} from './support';

test('@critical keeps source commands local and preserves independent arrangement, representation and file drafts', async ({
  page,
}) => {
  await openWorkshop(page);
  const source = page.getByRole('region', {
    name: 'Source editor',
    exact: true,
  });
  await expect(
    source.getByRole('group', { name: 'Source actions', exact: true }),
  ).toBeVisible();
  const editor = source.getByRole('textbox', {
    name: 'SysML source',
    exact: true,
  });
  const originalEditor = await editor.elementHandle();
  const original = await readSource(editor);
  const draft = original + '\n// keep this file draft through layout changes\n';
  await fillSource(editor, draft);
  await expect(
    source.getByLabel('Unapplied draft in model.sysml', { exact: true }),
  ).toBeVisible();
  await page
    .getByRole('complementary', { name: 'Project navigation', exact: true })
    .getByRole('button', { name: 'views.sysml', exact: true })
    .click();
  await expect(
    source.getByRole('tab', { name: 'views.sysml', exact: true }),
  ).toBeVisible();
  await expect(
    source.getByLabel('Unapplied draft in views.sysml', { exact: true }),
  ).toHaveCount(0);
  await expect(
    source.getByText('Draft not applied', { exact: true }),
  ).toBeVisible();
  const saved = (await downloadProject(page)).bundle;
  const namedView = await activeWorkspaceTab(page).getAttribute('title');
  const arrangement = page.getByRole('group', {
    name: 'Workspace arrangement',
    exact: true,
  });
  for (const representation of ['Requirements table', 'Traceability matrix']) {
    await openProjectData(page, representation);
    await expect(
      arrangement.getByRole('button', {
        name: 'Show source and model',
        exact: true,
      }),
    ).toHaveAttribute('aria-pressed', 'true');
    for (const mode of [
      'Show source only',
      'Show model only',
      'Show source and model',
    ]) {
      const control = arrangement.getByRole('button', {
        name: mode,
        exact: true,
      });
      await control.focus();
      await control.press('Enter');
      await expect(control).toHaveAttribute('aria-pressed', 'true');
      expect(await originalEditor!.evaluate((node) => node.isConnected)).toBe(
        true,
      );
      if (mode === 'Show model only') {
        await expect(
          page.getByRole('button', { name: 'Apply source', exact: true }),
        ).toHaveCount(0);
        await expect(
          page.getByRole('button', { name: 'Undo source', exact: true }),
        ).toHaveCount(0);
      }
    }
    await expect(activeWorkspaceTab(page)).toHaveText(representation);
    expect((await downloadProject(page)).bundle).toEqual(saved);
  }
  await page
    .getByRole('tablist', { name: 'Workspace documents', exact: true })
    .getByTitle(namedView!, { exact: true })
    .click();
  await expect(activeWorkspaceTab(page)).toHaveAttribute('title', namedView!);
  await expect(
    source.getByRole('tab', { name: 'views.sysml', exact: true }),
  ).toBeVisible();
  await page
    .getByRole('complementary', { name: 'Project navigation', exact: true })
    .getByRole('button', { name: 'model.sysml', exact: true })
    .click();
  await expect(editor).toHaveSource(draft);
  await expect(
    source.getByLabel('Unapplied draft in model.sysml', { exact: true }),
  ).toBeVisible();
  expect((await downloadProject(page)).bundle).toEqual(saved);
});

test('@critical keeps source actions and editor space reachable at the narrow divider minimum', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 900 });
  await page.goto('/app');
  await importWorkshop(page);
  await page
    .getByRole('button', { name: 'Show source and model', exact: true })
    .click();
  const editor = page.getByRole('textbox', {
    name: 'SysML source',
    exact: true,
  });
  const originalEditor = await editor.elementHandle();
  const draft = (await readSource(editor)) + '\n// retain this narrow draft\n';
  await fillSource(editor, draft);
  const saved = (await downloadProject(page)).bundle;
  for (const [width, height] of [
    [390, 900],
    [768, 900],
    [390, 600],
  ] as const) {
    await page.setViewportSize({ width, height });
    await dragSeparator(page, 'Resize Source and Diagram', 'y', 2000);
    await expect
      .poll(async () => (await sourceHeaderGeometry(page)).editorHeight)
      .toBeGreaterThanOrEqual(80);
    await expect
      .poll(async () => (await sourceHeaderGeometry(page)).editorHeight)
      .toBeLessThanOrEqual(82);
    await page
      .getByRole('button', { name: 'Show model only', exact: true })
      .click();
    await page
      .getByRole('button', { name: 'Show source and model', exact: true })
      .click();
    await expect
      .poll(async () => (await sourceHeaderGeometry(page)).editorHeight)
      .toBeGreaterThanOrEqual(80);
    await expect
      .poll(async () => (await sourceHeaderGeometry(page)).minInset)
      .toBeGreaterThanOrEqual(0);
    await expect
      .poll(async () => (await sourceHeaderGeometry(page)).reachable)
      .toBe(true);
    await expect(editor).toHaveSource(draft);
    expect(await originalEditor!.evaluate((node) => node.isConnected)).toBe(
      true,
    );
    expect((await downloadProject(page)).bundle).toEqual(saved);
  }
});
