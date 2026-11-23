import { test, expect, ready, downloadProject } from './support';

test('a cancelled delayed source reveal cannot steal focus when the source panel is reopened', async ({
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
  const delay = await page.addStyleTag({
    content: '.source-editor { display: none !important; }',
  });
  await page
    .getByRole('complementary', { name: 'Properties', exact: true })
    .getByRole('button', { name: 'Open source', exact: true })
    .click();
  await expect(page.locator('#workspace-source')).not.toHaveAttribute('hidden');
  await page.getByRole('button', { name: 'Hide Source', exact: true }).click();
  await delay.evaluate((element) => element.parentNode?.removeChild(element));
  await page.getByRole('button', { name: 'Show Source', exact: true }).click();
  await expect(
    page.getByRole('textbox', { name: 'SysML source', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Hide Source', exact: true }),
  ).toBeFocused();
  expect((await downloadProject(page)).bundle).toEqual(before);
});
