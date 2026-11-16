import {
  test,
  expect,
  openWorkshop,
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
  await expect(source.getByTitle('views.sysml', { exact: true })).toBeVisible();
  await expect(
    source.getByLabel('Unapplied draft in views.sysml', { exact: true }),
  ).toHaveCount(0);
  await expect(
    source.getByText('Draft not applied', { exact: true }),
  ).toBeVisible();
  const saved = (await downloadProject(page)).bundle;
  const namedView = await page
    .getByRole('combobox', { name: 'Named view', exact: true })
    .inputValue();
  const arrangement = page.getByRole('group', {
    name: 'Workspace arrangement',
    exact: true,
  });
  for (const representation of ['Requirements table', 'Traceability matrix']) {
    await page
      .getByRole('button', { name: representation, exact: true })
      .click();
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
    await expect(
      page.getByRole('button', { name: representation, exact: true }),
    ).toHaveAttribute('aria-pressed', 'true');
    expect((await downloadProject(page)).bundle).toEqual(saved);
  }
  await page.getByRole('button', { name: 'Diagram view', exact: true }).click();
  await expect(
    page.getByRole('combobox', { name: 'Named view', exact: true }),
  ).toHaveValue(namedView);
  await expect(source.getByTitle('views.sysml', { exact: true })).toBeVisible();
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
