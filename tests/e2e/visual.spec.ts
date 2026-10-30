import {
  test,
  expect,
  ready,
  importAssembly,
  showAssemblyDiagram,
} from './support';

for (const theme of ['light', 'dark']) {
  test(`workbench and appearance dialog in ${theme}`, async ({ page }) => {
    await ready(page);
    const trigger = page.getByRole('button', {
      name: 'Appearance',
      exact: true,
    });
    await trigger.click();
    const dialog = page.getByRole('dialog', {
      name: 'Appearance',
      exact: true,
    });
    await dialog.getByLabel('Theme', { exact: true }).selectOption(theme);
    await dialog.getByRole('button', { name: 'Done', exact: true }).click();
    await expect(dialog).not.toBeVisible();
    await expect(page).toHaveScreenshot(`workbench-${theme}.png`);
    await trigger.click();
    await dialog.getByText('Element base colors', { exact: true }).click();
    await expect(dialog).toHaveScreenshot(`appearance-${theme}.png`);
  });
}

for (const theme of ['light', 'dark']) {
  test(`nested assembly in ${theme}`, async ({ page }) => {
    await ready(page);
    await importAssembly(page);
    await showAssemblyDiagram(page);
    await page.getByRole('button', { name: 'Appearance', exact: true }).click();
    const dialog = page.getByRole('dialog', {
      name: 'Appearance',
      exact: true,
    });
    await dialog.getByLabel('Theme', { exact: true }).selectOption(theme);
    await dialog.getByRole('button', { name: 'Done', exact: true }).click();
    await expect(dialog).not.toBeVisible();
    await expect(
      page.getByRole('region', { name: 'Diagram', exact: true }),
    ).toHaveScreenshot(`assembly-${theme}.png`);
  });
}

test('workbench and keyboard-operated appearance at a narrow viewport', async ({
  page,
}) => {
  await page.setViewportSize({ width: 768, height: 900 });
  await ready(page);
  await expect(page).toHaveScreenshot('workbench-narrow.png');
  const trigger = page.getByRole('button', { name: 'Appearance', exact: true });
  await trigger.focus();
  await page.keyboard.press('Enter');
  const dialog = page.getByRole('dialog', { name: 'Appearance', exact: true });
  await expect(dialog).toBeInViewport({ ratio: 1 });
  await expect(
    dialog.getByRole('button', { name: 'Done', exact: true }),
  ).toBeInViewport({ ratio: 1 });
  await expect(dialog).toHaveScreenshot('appearance-narrow.png');
  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
  await expect(trigger).toBeFocused();
});

for (const appearance of [
  { theme: 'light', narrow: false },
  { theme: 'dark', narrow: false },
  { theme: 'light', narrow: true },
  { theme: 'dark', narrow: true },
]) {
  test(`structural authoring dialogs in ${appearance.theme}${appearance.narrow ? ' narrow' : ''}`, async ({
    page,
  }) => {
    if (appearance.narrow)
      await page.setViewportSize({ width: 768, height: 900 });
    await ready(page);
    await importAssembly(page);
    await page.getByRole('button', { name: 'Appearance', exact: true }).click();
    await page
      .getByRole('dialog')
      .getByLabel('Theme', { exact: true })
      .selectOption(appearance.theme);
    await page.getByRole('button', { name: 'Done', exact: true }).click();
    for (const [action, title, file] of [
      ['New part', 'New part', 'part'],
      ['Connect ports', 'Connect ports', 'connection'],
    ]) {
      const trigger = page
        .getByRole('region', { name: 'Diagram', exact: true })
        .getByRole('button', { name: action!, exact: true });
      await trigger.focus();
      await page.keyboard.press('Enter');
      const dialog = page.getByRole('dialog', { name: title!, exact: true });
      await expect(dialog).toBeInViewport({ ratio: 1 });
      await expect(
        dialog.getByRole('button', { name: 'Review source', exact: true }),
      ).toBeInViewport({ ratio: 1 });
      await expect(dialog).toHaveScreenshot(
        `authoring-${file}-${appearance.narrow ? (appearance.theme === 'dark' ? 'narrow-dark' : 'narrow') : appearance.theme}.png`,
      );
      await page.keyboard.press('Escape');
      await expect(dialog).not.toBeVisible();
      await expect(trigger).toBeFocused();
    }
  });
}
