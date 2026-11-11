import { test, expect, copySourceSelection } from './support';

/** Open the bundled rover and its generated report through the real pinned engine. */
async function openRoverReport(page: import('@playwright/test').Page) {
  await page.goto('/app');
  await page.getByRole('button', { name: 'Load example', exact: true }).click();
  await expect(
    page.getByRole('combobox', { name: 'Named view', exact: true }),
  ).toHaveValue('RoverViews::architecture');
  const explorer = page.getByRole('complementary', {
    name: 'Project navigation',
    exact: true,
  });
  const documents = explorer.getByRole('region', {
    name: 'Documents',
    exact: true,
  });
  const report = documents.getByRole('button', {
    name: 'InspectionReport',
    exact: true,
  });
  await expect(report).toHaveAttribute(
    'title',
    'RoverReport::InspectionReport',
  );
  await expect(report).toContainText('report.sysml');
  await report.click();
  await expect(report).toHaveAttribute('aria-current', 'page');
  const pane = page.getByRole('region', { name: 'Document', exact: true });
  await expect(
    pane.getByRole('heading', { name: 'Inspection Rover Report', exact: true }),
  ).toBeVisible();
  return { explorer, pane };
}

test('@critical renders the rover report from the engine, reveals clicked declarations in source and mounts the architecture view natively', async ({
  page,
}) => {
  const { pane } = await openRoverReport(page);
  await expect(
    page.getByRole('button', { name: 'Document', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true');
  // Engine HTML keeps its semantic classes and model facts.
  const body = pane.locator('.document-body');
  await expect(body.locator('article.sysml-document')).toHaveAttribute(
    'data-document',
    'RoverReport::InspectionReport',
  );
  await expect(
    body.getByRole('heading', { name: 'Energy', exact: true }),
  ).toBeVisible();
  const batteryRow = body.locator(
    'tr.sysml-row[data-element="RoverSystem::InspectionRover::energy::battery"]',
  );
  await expect(batteryRow.getByRole('cell').nth(0)).toHaveText('battery');
  await expect(batteryRow.getByRole('cell').nth(1)).toHaveText(
    'RoverComponents::Battery',
  );
  await expect(
    body
      .locator('tr.sysml-row[data-element="RoverRequirements::speed"]')
      .getByRole('cell')
      .nth(1),
  ).toHaveText('Limit the left drive nominal indoor speed to 1.5 m/s.');
  await expect(body.locator('script, style, img, iframe')).toHaveCount(0);
  await expect(body.locator('pre.mermaid, pre.dot')).toHaveCount(0);
  await expect(body).not.toContainText('digraph');

  // A Diagram block that embeds a declared view mounts the native renderer.
  const embedded = pane.getByRole('group', {
    name: 'Embedded diagram RoverViews::architecture',
    exact: true,
  });
  await expect(embedded).toHaveAttribute('data-state', 'rendered');
  await expect(
    embedded.getByRole('group', {
      name: 'part battery : Battery',
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    embedded.getByRole('button', { name: 'Open as named view', exact: true }),
  ).toBeEnabled();
  await expect(
    embedded.getByRole('combobox', { name: 'Named view', exact: true }),
  ).toHaveCount(0);
  await embedded.scrollIntoViewIfNeeded();
  await page.screenshot({
    path: test.info().outputPath('rover-document.png'),
    fullPage: false,
  });

  // The inline reference reveals the referenced declaration in the source editor.
  await body.getByRole('link', { name: 'rover', exact: true }).click();
  const source = page.getByRole('textbox', {
    name: 'SysML source',
    exact: true,
  });
  await expect(
    page
      .getByRole('complementary', { name: 'Project navigation', exact: true })
      .getByRole('button', { name: 'system.sysml', exact: true }),
  ).toHaveAttribute('aria-current', 'page');
  await expect
    .poll(() => copySourceSelection(source))
    .toBe('part rover : InspectionRover;');

  // A table row reveals its element; a heading reveals the section declaration in the report.
  await batteryRow.click();
  await expect
    .poll(() => copySourceSelection(source))
    .toBe('part battery : Battery;');
  await body.getByRole('heading', { name: 'Mobility', exact: true }).click();
  await expect(
    page
      .getByRole('complementary', { name: 'Project navigation', exact: true })
      .getByRole('button', { name: 'report.sysml', exact: true }),
  ).toHaveAttribute('aria-current', 'page');
  await expect
    .poll(() => copySourceSelection(source))
    .toMatch(/^part mobility : Section \{[\s\S]*\}$/);

  // Opening the embedded view as a named view returns to the diagram surface.
  await embedded
    .getByRole('button', { name: 'Open as named view', exact: true })
    .click();
  await expect(
    page.getByRole('button', { name: 'Diagram view', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true');
  await expect(
    page.getByRole('combobox', { name: 'Named view', exact: true }),
  ).toHaveValue('RoverViews::architecture');
});

test('re-renders the open document from the applied revision and reports typed planning failures in Issues', async ({
  page,
}) => {
  const { pane } = await openRoverReport(page);
  const source = page.getByRole('textbox', {
    name: 'SysML source',
    exact: true,
  });
  await page
    .getByRole('complementary', { name: 'Project navigation', exact: true })
    .getByRole('button', { name: 'report.sysml', exact: true })
    .click();
  await source.press('ControlOrMeta+a');
  const text = await copySourceSelection(source);
  await source.press('ControlOrMeta+a');
  await page.keyboard.insertText(
    text.replace(
      'attribute redefines title = "Energy";',
      'attribute redefines title = "Power";',
    ),
  );
  await page.getByRole('button', { name: 'Apply source', exact: true }).click();
  await expect(
    pane.getByRole('heading', { name: 'Power', exact: true }),
  ).toBeVisible();
  await expect(pane.getByRole('heading', { name: 'Energy' })).toHaveCount(0);

  // A missing query makes the revision invalid: the pane keeps the last document and Issues locate the block.
  await source.press('ControlOrMeta+a');
  await page.keyboard.insertText(
    text.replace(/calc rows : Subparts \{\s*in root = rover\.energy;\s*\}/, ''),
  );
  await page.getByRole('button', { name: 'Apply source', exact: true }).click();
  const issues = page.getByRole('region', { name: 'Issues', exact: true });
  await expect(issues).toContainText('references no query');
  await expect(
    issues.getByRole('button', { name: /Open report\.sysml at line \d+/ }),
  ).toBeVisible();
  await expect(
    pane.getByRole('heading', { name: 'Power', exact: true }),
  ).toBeVisible();
});
