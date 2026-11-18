import {
  test,
  expect,
  copySourceSelection,
  fillSource,
  readSource,
  downloadProject,
  dragSeparator,
  controlReachable,
  hideExplorer,
} from './support';

import { openRoverReport } from './document-support';

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

test('keeps document source links reachable at the vertical pane minimum', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const { pane, explorer } = await openRoverReport(page);
  await explorer
    .getByRole('button', { name: 'report.sysml', exact: true })
    .click();
  await hideExplorer(page);
  const before = (await downloadProject(page)).bundle;
  await dragSeparator(page, 'Resize Source and Diagram', 'y', 2000);
  const reference = pane.getByRole('link', { name: 'rover', exact: true });
  await reference.focus();
  await expect.poll(() => controlReachable(reference)).toBe(true);
  await reference.press('Enter');
  const source = page.getByRole('textbox', {
    name: 'SysML source',
    exact: true,
  });
  await expect
    .poll(() => copySourceSelection(source))
    .toBe('part rover : InspectionRover;');
  expect((await downloadProject(page)).bundle).toEqual(before);
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

  await page.getByRole('button', { name: 'Undo source', exact: true }).click();
  await expect(
    pane.getByRole('heading', { name: 'Energy', exact: true }),
  ).toBeVisible();
  await expect(source).toHaveSource(text);
  await page.getByRole('button', { name: 'Redo source', exact: true }).click();
  await expect(
    pane.getByRole('heading', { name: 'Power', exact: true }),
  ).toBeVisible();
  await expect(source).toHaveSource(
    text.replace(
      'attribute redefines title = "Energy";',
      'attribute redefines title = "Power";',
    ),
  );

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

// Controlled DOM link fixture tests native activation, independently of engine link generation.
test('preserves native document links for keyboard and pointer activation', async ({
  page,
}) => {
  const { pane, explorer } = await openRoverReport(page);
  const activeFile = explorer.getByRole('button', {
    name: 'system.sysml',
    exact: true,
  });
  await expect(activeFile).toHaveAttribute('aria-current', 'page');
  await pane
    .locator('.sysml-paragraph')
    .first()
    .evaluate((paragraph) => {
      const link = document.createElement('a');
      link.href = '#document-link-target';
      link.textContent = 'Document jump target';
      paragraph.appendChild(link);
      const target = document.createElement('p');
      target.id = 'document-link-target';
      target.textContent = 'Link destination';
      paragraph.parentElement!.appendChild(target);
    });
  const link = pane.getByRole('link', {
    name: 'Document jump target',
    exact: true,
  });
  await link.focus();
  await link.press('Enter');
  await expect(page).toHaveURL(/#document-link-target$/);
  await expect(activeFile).toHaveAttribute('aria-current', 'page');
  await page.evaluate(() => history.replaceState(null, '', location.pathname));
  await link.click();
  await expect(page).toHaveURL(/#document-link-target$/);
  await expect(activeFile).toHaveAttribute('aria-current', 'page');
});

test('refreshes the open document after source acceptance even if the named-view worker fails', async ({
  page,
}) => {
  const { pane, explorer } = await openRoverReport(page);
  await explorer
    .getByRole('button', { name: 'report.sysml', exact: true })
    .click();
  const source = page.getByRole('textbox', {
    name: 'SysML source',
    exact: true,
  });
  const original = await readSource(source);
  await fillSource(
    source,
    original.replace(
      'attribute redefines title = "Energy";',
      'attribute redefines title = "Power";',
    ),
  );
  // Explicit failure injection: parse/document requests still use the real pinned worker.
  await page.evaluate(() => {
    const post = Worker.prototype.postMessage;
    Worker.prototype.postMessage = function (message: unknown) {
      if ((message as { operation?: string }).operation === 'evaluate') {
        queueMicrotask(() =>
          this.dispatchEvent(
            new MessageEvent('message', {
              data: { error: 'Injected named-view failure' },
            }),
          ),
        );
        return;
      }
      post.call(this, message);
    };
  });
  await page.getByRole('button', { name: 'Apply source', exact: true }).click();
  await expect(
    pane.getByRole('heading', { name: 'Power', exact: true }),
  ).toBeVisible();
  await expect(
    page
      .getByRole('alert')
      .filter({ hasText: 'Injected named-view failure' })
      .first(),
  ).toBeVisible();
});

test('shows a document refresh failure and retries without leaving an empty pane', async ({
  page,
}) => {
  const { pane, explorer } = await openRoverReport(page);
  await explorer
    .getByRole('button', { name: 'report.sysml', exact: true })
    .click();
  const source = page.getByRole('textbox', {
    name: 'SysML source',
    exact: true,
  });
  await fillSource(
    source,
    (await readSource(source)) + '\n// refresh the document\n',
  );
  await page.evaluate(() => {
    const post = Worker.prototype.postMessage;
    let fail = true;
    Worker.prototype.postMessage = function (message: unknown) {
      if (
        fail &&
        (message as { operation?: string }).operation === 'document'
      ) {
        fail = false;
        queueMicrotask(() =>
          this.dispatchEvent(
            new MessageEvent('message', {
              data: { error: 'Injected document failure' },
            }),
          ),
        );
        return;
      }
      post.call(this, message);
    };
  });
  await page.getByRole('button', { name: 'Apply source', exact: true }).click();
  await expect(pane.getByRole('alert')).toContainText(
    'Injected document failure',
  );
  await expect(
    pane.getByRole('heading', { name: 'Generated documents', exact: true }),
  ).toHaveCount(0);
  await explorer
    .getByRole('button', { name: 'InspectionReport', exact: true })
    .click();
  await expect(
    pane.getByRole('heading', { name: 'Inspection Rover Report', exact: true }),
  ).toBeVisible();
});

test('preserves the document, draft and pane lifetime across narrow arrangement changes', async ({
  page,
}) => {
  const { pane, explorer } = await openRoverReport(page);
  await explorer
    .getByRole('button', { name: 'report.sysml', exact: true })
    .click();
  const source = page.getByRole('textbox', {
    name: 'SysML source',
    exact: true,
  });
  const draft = (await readSource(source)) + '\n// retained document draft\n';
  await fillSource(source, draft);
  const body = await pane.locator('.document-body').elementHandle();
  const before = (await downloadProject(page)).bundle;
  await page.setViewportSize({ width: 390, height: 900 });
  for (const mode of [
    'Show source only',
    'Show model only',
    'Show source and model',
  ]) {
    await page.getByRole('button', { name: mode, exact: true }).click();
    await expect(
      page.getByRole('button', { name: mode, exact: true }),
    ).toHaveAttribute('aria-pressed', 'true');
    expect(await body!.evaluate((element) => element.isConnected)).toBe(true);
  }
  await expect(
    page.getByRole('button', { name: 'Document', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true');
  await expect(source).toHaveSource(draft);
  expect((await downloadProject(page)).bundle).toEqual(before);
  const embedded = pane.getByRole('group', {
    name: 'Embedded diagram RoverViews::architecture',
    exact: true,
  });
  await embedded.scrollIntoViewIfNeeded();
  const open = embedded.getByRole('button', {
    name: 'Open as named view',
    exact: true,
  });
  await open.focus();
  await expect
    .poll(async () => {
      const button = (await open.boundingBox())!;
      const bounds = (await embedded.boundingBox())!;
      return Math.min(
        button.x - bounds.x,
        bounds.x + bounds.width - button.x - button.width,
      );
    })
    .toBeGreaterThanOrEqual(0);
});
