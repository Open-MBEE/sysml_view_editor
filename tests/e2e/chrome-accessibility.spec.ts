import { readFile, writeFile } from 'node:fs/promises';
import { test, expect, importWorkshop } from './support';

test.use({
  launchOptions: {
    args: ['--force-renderer-accessibility', '--ozone-platform=x11'],
  },
});

test('@critical exposes navigation disclosures and independent representation states to assistive technology', async ({
  page,
}, testInfo) => {
  await page.goto('/app');
  await importWorkshop(page);
  const speechLog = process.env.WORKBENCH_ORCA_LOG;
  async function heard(text: string) {
    if (!speechLog) return;
    await expect
      .poll(async () =>
        (await readFile(speechLog, 'utf8')).includes(`SPEECH OUTPUT: '${text}`),
      )
      .toBe(true);
  }
  const rail = page.getByRole('group', {
    name: 'Workspace panels',
    exact: true,
  });
  const hide = rail.getByRole('button', { name: 'Hide Explorer', exact: true });
  if (await hide.isVisible()) {
    await hide.focus();
    await hide.press('Enter');
  }
  const show = rail.getByRole('button', { name: 'Show Explorer', exact: true });
  await show.focus();
  await expect(show).toBeFocused();
  await heard('Show Explorer');
  await show.press('Enter');
  const nav = page.getByRole('complementary', {
    name: 'Project navigation',
    exact: true,
  });
  await expect(nav).toBeVisible();
  const model = nav.getByRole('button', { name: 'Model', exact: true });
  await model.focus();
  await heard('Model');
  await model.press('Enter');
  await expect(model).toHaveAttribute('aria-expanded', 'false');
  await expect(nav.getByRole('tree')).toHaveCount(0);
  const collapsed = await nav.ariaSnapshot();
  expect(collapsed).toContain('button "Model"');
  expect(collapsed).not.toContain('tree "Model"');
  await model.press('Enter');
  await expect(model).toHaveAttribute('aria-expanded', 'true');
  await expect(
    nav.getByRole('tree', { name: 'Model', exact: true }),
  ).toBeVisible();
  const table = page.getByRole('button', {
    name: 'Requirements table',
    exact: true,
  });
  await table.focus();
  await heard('Requirements table');
  await table.press('Enter');
  await expect(table).toHaveAttribute('aria-pressed', 'true');
  await expect(
    page.getByRole('group', { name: 'Model header', exact: true }),
  ).toContainText('Project-wide requirements');
  const header = await page
    .getByRole('group', { name: 'Model header', exact: true })
    .ariaSnapshot();
  expect(header).toContain('button "Requirements table" [pressed]');
  expect(header).not.toContain('Named view');
  await page
    .getByRole('button', { name: 'Show source only', exact: true })
    .focus();
  await page.keyboard.press('Enter');
  await expect(
    page.getByRole('group', { name: 'Model header', exact: true }),
  ).toHaveCount(0);
  const source = page.getByRole('textbox', {
    name: 'SysML source',
    exact: true,
  });
  await source.focus();
  await expect(source).toBeFocused();
  await heard('SysML source');
  await writeFile(
    testInfo.outputPath('chrome-accessibility.txt'),
    `Collapsed navigation:\n${collapsed}\n\nTable header:\n${header}\n\nSource-only:\n${await page.getByRole('main', { name: 'Model workspace', exact: true }).ariaSnapshot()}\n`,
  );
});
