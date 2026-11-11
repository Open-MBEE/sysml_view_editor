import { readFile } from 'node:fs/promises';
import {
  test,
  expect,
  fillSource,
  modelTreeItem,
  downloadProject,
} from './support';
import {
  importRequirementsTraceability,
  loadRequirementsTraceability,
} from './requirements-support';

test('@critical tree selection reveals hidden details while retaining the current draft and view', async ({
  page,
}) => {
  await page.goto('/app');
  const buffer = await readFile(
    new URL('../fixtures/source-values.sysml', import.meta.url),
  );
  await page
    .locator('input[type=file]')
    .setInputFiles({ name: 'values.sysml', mimeType: 'text/plain', buffer });
  await expect(
    page.getByRole('button', { name: 'Download project', exact: true }),
  ).toBeEnabled();
  await page.getByRole('button', { name: 'Split', exact: true }).click();
  const draft = buffer.toString() + '\n// retained inspection draft';
  const source = page.getByRole('textbox', {
    name: 'SysML source',
    exact: true,
  });
  await fillSource(source, draft);
  const before = (await downloadProject(page)).bundle;
  await page
    .getByRole('button', { name: 'Collapse Inspector', exact: true })
    .click();
  const reading = modelTreeItem(page, 'Reading');
  await reading.focus();
  await page.keyboard.press('ArrowRight');
  const selected = modelTreeItem(page, 'Reading::small');
  await selected.focus();
  await page.keyboard.press('Enter');
  const properties = page.getByRole('complementary', {
    name: 'Properties',
    exact: true,
  });
  await expect(properties).toBeVisible({ timeout: 1500 });
  await expect(properties).toContainText('Reading::small');
  await expect(selected).toBeFocused();
  await expect(source).toHaveSource(draft);
  await expect(
    page.getByRole('combobox', { name: 'Named view', exact: true }),
  ).toHaveValue('ReadingViews::configurations');
  expect((await downloadProject(page)).bundle).toEqual(before);
});

test('@critical table selection opens details without automatically navigating to source', async ({
  page,
}) => {
  await page.goto('/app');
  await importRequirementsTraceability(page);
  await page.getByRole('button', { name: 'Diagram', exact: true }).click();
  await page
    .getByRole('button', { name: 'Collapse Inspector', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Requirements table', exact: true })
    .click();
  const table = page.getByRole('region', {
    name: 'Requirements table',
    exact: true,
  });
  const row = table.getByRole('button', {
    name: 'TraceRequirements::leftSpecification::leftCapacity',
    exact: true,
  });
  await expect(row).toBeEnabled();
  const before = (await downloadProject(page)).bundle;
  await row.click();
  const properties = page.getByRole('complementary', {
    name: 'Properties',
    exact: true,
  });
  await expect(properties).toBeVisible({ timeout: 1500 });
  await expect(properties).toContainText(
    'TraceRequirements::leftSpecification::leftCapacity',
  );
  await expect(
    page.getByRole('button', { name: 'Diagram', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true');
  await expect(row).toBeFocused();
  await expect(properties).toContainText('REQ-LEFT-CAP');
  await expect(properties).toContainText('Applied requirement declaration');
  await expect(
    properties.getByRole('button', { name: 'Open source', exact: true }),
  ).toBeEnabled();
  expect((await downloadProject(page)).bundle).toEqual(before);
});

for (const theme of ['light', 'dark']) {
  test(`phone inspection keeps focus in a visible tool in ${theme}`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/app');
    const documents = await loadRequirementsTraceability();
    await page.locator('input[type=file]').setInputFiles(
      documents.map((document) => ({
        name: document.name,
        mimeType: 'text/plain',
        buffer: Buffer.from(document.text),
      })),
    );
    await expect(
      page.getByRole('combobox', { name: 'Named view', exact: true }),
    ).toHaveValue('TraceViews::requirements');
    await expect(
      page.getByRole('button', { name: 'Download project', exact: true }),
    ).toBeEnabled();
    await page.getByRole('button', { name: 'Appearance', exact: true }).click();
    const appearance = page.getByRole('dialog', {
      name: 'Appearance',
      exact: true,
    });
    await appearance.getByLabel('Theme', { exact: true }).selectOption(theme);
    await appearance.getByRole('button', { name: 'Done', exact: true }).click();
    await page
      .getByRole('button', { name: 'Requirements table', exact: true })
      .click();
    const before = (await downloadProject(page)).bundle;
    const table = page.getByRole('region', {
      name: 'Requirements table',
      exact: true,
    });
    const row = table.getByRole('button', {
      name: 'TraceRequirements::leftSpecification::leftCapacity',
      exact: true,
    });
    await row.focus();
    await page.keyboard.press('Enter');
    const properties = page.getByRole('complementary', {
      name: 'Properties',
      exact: true,
    });
    await expect(properties).toBeVisible();
    await expect(properties).toContainText('REQ-LEFT-CAP');
    await expect(
      page.getByRole('button', { name: 'Collapse Inspector', exact: true }),
    ).toBeFocused();
    expect((await downloadProject(page)).bundle).toEqual(before);
    await page.screenshot({
      path: testInfo.outputPath(`inspection-phone-${theme}.png`),
    });
    await page
      .getByRole('button', { name: 'Collapse Inspector', exact: true })
      .click();
    await expect(
      page.getByRole('button', { name: 'Show Inspector', exact: true }),
    ).toBeFocused();
  });
}

test('@critical anonymous requirement inspection retains extracted documentation and exact source', async ({
  page,
}) => {
  await page.goto('/app');
  const text =
    'package P { requirement { doc /* The pump shall preserve pressure. */ } }';
  await page.locator('input[type=file]').setInputFiles({
    name: 'anonymous.sysml',
    mimeType: 'text/plain',
    buffer: Buffer.from(text),
  });
  await expect(
    page.getByRole('button', { name: 'Download project', exact: true }),
  ).toBeEnabled();
  await page
    .getByRole('button', { name: 'Requirements table', exact: true })
    .click();
  const table = page.getByRole('region', {
    name: 'Requirements table',
    exact: true,
  });
  await table.getByRole('button', { name: 'P::', exact: true }).click();
  const properties = page.getByRole('complementary', {
    name: 'Properties',
    exact: true,
  });
  await expect(properties).toContainText('The pump shall preserve pressure.');
  await properties
    .getByRole('button', { name: 'Open source', exact: true })
    .click();
  const source = page.getByRole('textbox', {
    name: 'SysML source',
    exact: true,
  });
  await expect(source).toBeFocused();
  await expect(source).toHaveSource(text);
});
