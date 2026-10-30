import {
  test,
  expect,
  openWorkshop,
  importWorkshop,
  waitForStartup,
  diagramNode,
  downloadProject,
} from './support';

test('separates appearance from model edits and follows system changes only when selected', async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await openWorkshop(page);
  const root = page.locator('html');
  await expect(root).toHaveAttribute('data-theme', 'light');
  const source = await page
    .getByRole('textbox', { name: 'SysML source' })
    .inputValue();
  await page.getByRole('button', { name: 'Appearance', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Appearance', exact: true });
  await dialog.getByLabel('Theme', { exact: true }).selectOption('system');
  await expect(root).toHaveAttribute('data-theme', 'dark');
  await page.emulateMedia({ colorScheme: 'light' });
  await expect(root).toHaveAttribute('data-theme', 'light');
  for (const theme of ['light', 'dark']) {
    await dialog.getByLabel('Theme', { exact: true }).selectOption(theme);
    await page.emulateMedia({
      colorScheme: theme === 'light' ? 'dark' : 'light',
    });
    await expect(root).toHaveAttribute('data-theme', theme);
    for (const palette of [
      'neutral',
      'muted',
      'contrast',
      'forest',
      'blueprint',
      'paper',
    ]) {
      await dialog.getByLabel('Diagram palette').selectOption(palette);
      await expect(root).toHaveAttribute('data-palette', palette);
      await expect(root).toHaveCSS('color-scheme', theme);
    }
  }
  await dialog.getByRole('button', { name: 'Done', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'SysML source' })).toHaveValue(
    source,
  );
  await expect(
    page.getByRole('button', { name: 'Undo source', exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByRole('banner').getByText('Workshop', { exact: true }),
  ).toBeVisible();
  const { bundle } = await downloadProject(page);
  expect(bundle).not.toHaveProperty('appearance');
  expect(bundle).not.toHaveProperty('palette');
});

test('retains custom muted colors across palettes and reload, with keyboard dismissal and focus return', async ({
  page,
}) => {
  await openWorkshop(page);
  const definition = diagramNode(page, 'Workshop::Motor');
  const originalFill = await definition.evaluate(
    (element) => getComputedStyle(element).backgroundColor,
  );
  const trigger = page.getByRole('button', { name: 'Appearance', exact: true });
  await trigger.click();
  const dialog = page.getByRole('dialog', { name: 'Appearance', exact: true });
  await dialog.getByText('Element base colors', { exact: true }).click();
  await dialog.getByLabel('Part definitions', { exact: true }).fill('#123456');
  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
  // This is the visible muted fill for #123456 on the light surface, rather
  // than only the preference or custom property that should drive that fill.
  await expect(definition).toHaveCSS('background-color', 'rgb(227, 231, 235)');
  await trigger.click();
  await dialog.getByLabel('Diagram palette').selectOption('forest');
  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
  await expect(definition).not.toHaveCSS(
    'background-color',
    'rgb(227, 231, 235)',
  );
  await expect(trigger).toBeFocused();
  await page.reload();
  await waitForStartup(page);
  await importWorkshop(page);
  await expect(definition).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('data-palette', 'forest');
  await trigger.click();
  await dialog.getByLabel('Diagram palette').selectOption('muted');
  await dialog.getByText('Element base colors', { exact: true }).click();
  await expect(
    dialog.getByLabel('Part definitions', { exact: true }),
  ).toHaveValue('#123456');
  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
  await expect(definition).toHaveCSS('background-color', 'rgb(227, 231, 235)');
  await trigger.click();
  await dialog.getByText('Element base colors', { exact: true }).click();
  await dialog
    .getByRole('button', { name: 'Reset colors', exact: true })
    .click();
  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
  await expect(definition).toHaveCSS('background-color', originalFill);
});

test('opens appearance by keyboard, traps focus in both directions and returns it', async ({
  page,
}) => {
  await openWorkshop(page);
  const trigger = page.getByRole('button', { name: 'Appearance', exact: true });
  await trigger.focus();
  await page.keyboard.press('Enter');
  const dialog = page.getByRole('dialog', { name: 'Appearance', exact: true });
  const first = dialog.getByRole('combobox', { name: 'Theme', exact: true });
  const last = dialog.getByRole('button', { name: 'Close', exact: true });
  await expect(first).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(last).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(first).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
  await expect(trigger).toBeFocused();
});

test('keeps appearance usable when browser preference storage is denied', async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', {
      get() {
        throw new Error('Storage denied');
      },
    });
  });
  await openWorkshop(page);
  await page.getByRole('button', { name: 'Appearance', exact: true }).click();
  await page
    .getByRole('dialog')
    .getByLabel('Theme', { exact: true })
    .selectOption('dark');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.getByRole('alert')).toContainText('browser could not save');
  await page.getByRole('button', { name: 'Done', exact: true }).click();
  await expect(diagramNode(page, 'Workshop::Motor')).toBeVisible();
});
