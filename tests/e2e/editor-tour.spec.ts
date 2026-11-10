import { test, expect, ready, downloadProject, fillSource } from './support';

test('editor guide is optional, keyboard accessible and preserves the project', async ({
  page,
}) => {
  await ready(page);
  const original = (await downloadProject(page)).bundle;
  await fillSource(
    page.getByRole('textbox', { name: 'SysML source' }),
    original.drafts[0]!.text + '\npart broken : Missing;',
  );
  await expect(
    page.getByText('Draft not applied', { exact: true }),
  ).toBeVisible();
  const before = (await downloadProject(page)).bundle;
  await expect(page.getByText('Meet the rover.', { exact: false })).toHaveCount(
    0,
  );
  const trigger = page.getByRole('button', { name: 'Guide to the editor' });
  await trigger.focus();
  await trigger.press('Enter');
  const guide = page.getByRole('dialog', { name: 'Editor guide' });
  await expect(guide).toContainText('Find your files and views');
  await expect(guide).toContainText('1 of 5');
  await expect(guide).toHaveAccessibleDescription(
    /1 of 5.*Find your files and views.*Use Explorer/,
  );
  await expect(guide.locator('[aria-live="polite"]')).toHaveAttribute(
    'aria-atomic',
    'true',
  );
  await guide.getByRole('button', { name: 'Next' }).click();
  await expect(guide).toContainText('Choose a layout');
  await guide.getByRole('button', { name: 'Back' }).click();
  await expect(guide).toContainText('Find your files and views');
  await guide.press('Escape');
  await expect(guide).not.toBeVisible();
  await expect(trigger).toBeFocused();
  await trigger.click();
  for (const title of [
    'Choose a layout',
    'Apply source changes',
    'Inspect your model',
    'Save your project',
  ]) {
    await guide.getByRole('button', { name: 'Next' }).click();
    await expect(guide).toContainText(title);
  }
  await guide.getByRole('button', { name: 'Done' }).click();
  await expect(trigger).toBeFocused();
  expect((await downloadProject(page)).bundle).toEqual(before);
});

test('guide stays visible at narrow width when Explorer is collapsed', async ({
  page,
}) => {
  await ready(page);
  await page.setViewportSize({ width: 390, height: 844 });
  const collapse = page.getByRole('button', { name: 'Collapse Explorer' });
  if (await collapse.isVisible()) await collapse.click();
  const trigger = page.getByRole('button', { name: 'Guide to the editor' });
  await trigger.click();
  const guide = page.getByRole('dialog', { name: 'Editor guide' });
  for (let index = 0; index < 5; index++) {
    await expect(guide).toBeVisible();
    await expect
      .poll(async () => {
        const box = await guide.boundingBox();
        return (
          !!box &&
          box.x >= 0 &&
          box.y >= 0 &&
          box.x + box.width <= 390 &&
          box.y + box.height <= 844
        );
      })
      .toBe(true);
    await guide
      .getByRole('button', { name: index === 4 ? 'Done' : 'Next' })
      .click();
  }
  await expect(trigger).toBeFocused();
});

test('guide explains hidden controls without changing the workspace layout', async ({
  page,
}) => {
  await ready(page);
  await page.getByRole('button', { name: 'Code', exact: true }).click();
  await page
    .getByRole('button', { name: 'Collapse Explorer', exact: true })
    .click();
  const trigger = page.getByRole('button', { name: 'Guide to the editor' });
  await trigger.click();
  const guide = page.getByRole('dialog', { name: 'Editor guide' });
  await expect(guide).toContainText(
    'Choose Show Explorer to reopen the panel.',
  );
  for (let index = 0; index < 3; index++) {
    await guide.getByRole('button', { name: 'Next', exact: true }).click();
  }
  await expect(guide).toContainText(
    'Choose Split or Diagram to reveal these controls.',
  );
  await expect(guide).toHaveAccessibleDescription(/4 of 5.*Inspect your model/);
  await expect(
    page.getByRole('button', { name: 'Code', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true');
  await guide.getByRole('button', { name: 'Close', exact: true }).click();
  await expect(trigger).toBeFocused();
  await expect(
    page.getByRole('button', { name: 'Show Explorer', exact: true }),
  ).toBeVisible();
  await trigger.click();
  await expect(guide).toContainText('1 of 5');
});

test('dismissing the guide by choosing a control keeps focus on that control', async ({
  page,
}) => {
  await ready(page);
  await page.getByRole('button', { name: 'Guide to the editor' }).click();
  const code = page.getByRole('button', { name: 'Code', exact: true });
  await code.click();
  await expect(
    page.getByRole('dialog', { name: 'Editor guide' }),
  ).not.toBeVisible();
  await expect(code).toBeFocused();
});
