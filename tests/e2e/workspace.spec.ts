import {
  test,
  expect,
  openWorkshop,
  waitForStartup,
  openView,
  diagramNode,
  diagramState,
  nodePosition,
  moveNode,
  downloadProject,
} from './support';
test('loads real source-defined views and keeps the view stable when changing files', async ({
  page,
}) => {
  await openWorkshop(page);
  await page.getByRole('button', { name: 'views.sysml', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'SysML source' })).toHaveValue(
    /package WorkshopViews/,
  );
  const diagram = page.getByRole('region', { name: 'Diagram', exact: true });
  await expect(diagram.getByText('overview', { exact: true })).toBeVisible();
  await openView(page, 'compressor');
  await expect(diagram.getByText('compressor', { exact: true })).toBeVisible();
  await expect(diagramNode(page, 'primary : Motor')).toBeVisible();
});
test('retains an invalid draft and the last valid diagram', async ({
  page,
}) => {
  await openWorkshop(page);
  const before = await diagramState(page);
  const applied = (await downloadProject(page)).bundle.documents;
  await page
    .getByRole('textbox', { name: 'SysML source' })
    .fill('package Broken { part def');
  await page.getByRole('button', { name: 'Apply source', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Issues' })).toBeVisible();
  await expect(
    page.getByText('Draft not applied', { exact: true }),
  ).toBeVisible();
  expect(await diagramState(page)).toEqual(before);
  await expect(page.getByRole('textbox', { name: 'SysML source' })).toHaveValue(
    'package Broken { part def',
  );
  const saved = (await downloadProject(page)).bundle;
  expect(saved.documents).toEqual(applied);
  expect(saved.drafts[0]?.text).toBe('package Broken { part def');
  await page
    .getByRole('button', { name: 'Discard draft', exact: true })
    .click();
  await expect(page.getByRole('textbox', { name: 'SysML source' })).toHaveValue(
    /package Workshop/,
  );
});
test('uses Toolkit rename, updates both references, and supports exact undo/redo', async ({
  page,
}) => {
  await openWorkshop(page);
  const source = page.getByRole('textbox', { name: 'SysML source' });
  const original = await source.inputValue();
  const renamed = original.replaceAll('Motor', 'Drive');
  await page.getByTitle('Workshop::Motor', { exact: true }).click();
  await page.getByRole('textbox', { name: 'Name', exact: true }).fill('Drive');
  await page
    .getByRole('button', { name: 'Review rename', exact: true })
    .click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByRole('dialog')).toContainText('part def Drive');
  await page.getByRole('button', { name: 'Apply change', exact: true }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await expect(source).toHaveValue(renamed);
  await expect(diagramNode(page, 'primary : Drive')).toBeVisible();
  await expect(diagramNode(page, 'standby : Drive')).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Undo source', exact: true }),
  ).toBeEnabled();
  await page.getByRole('button', { name: 'Undo source', exact: true }).click();
  await expect(source).toHaveValue(original);
  await expect(diagramNode(page, 'primary : Motor')).toBeVisible();
  await expect(diagramNode(page, 'standby : Motor')).toBeVisible();
  await page.getByRole('button', { name: 'Redo source', exact: true }).click();
  await expect(source).toHaveValue(renamed);
  await expect(diagramNode(page, 'primary : Drive')).toBeVisible();
  await expect(diagramNode(page, 'standby : Drive')).toBeVisible();
});
test('creates a native view declaration through a reviewed transaction', async ({
  page,
}) => {
  await openWorkshop(page);
  await page.getByTitle('Workshop::Compressor', { exact: true }).click();
  await page
    .getByRole('button', { name: 'New view of selection', exact: true })
    .click();
  await page
    .getByRole('textbox', { name: 'View name', exact: true })
    .fill('CompressorDetail');
  await page
    .getByRole('button', { name: 'Review source', exact: true })
    .click();
  await expect(page.getByRole('dialog')).toContainText('view CompressorDetail');
  await page.getByRole('button', { name: 'Apply change', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'CompressorDetail', exact: true }),
  ).toBeVisible();
  await expect(
    page
      .getByRole('region', { name: 'Diagram', exact: true })
      .getByText('CompressorDetail', { exact: true }),
  ).toBeVisible();
});
test('downloads and reopens a project with the draft and diagram positions intact', async ({
  page,
}) => {
  await openWorkshop(page);
  const source = page.getByRole('textbox', { name: 'SysML source' });
  const original = await source.inputValue();
  const node = diagramNode(page, 'Workshop::Motor');
  const symbol = await node.getAttribute('data-id');
  expect(symbol).not.toBeNull();
  const moved = await moveNode(page, node);
  await expect(source).toHaveValue(original);
  await expect(
    page.getByRole('button', { name: 'Undo source', exact: true }),
  ).toBeDisabled();

  // Switching views must restore this view's position, without borrowing it
  // for an unrelated symbol that happens to use the same renderer-local ID.
  await openView(page, 'compressor');
  const otherNode = diagramNode(page, 'primary : Motor');
  await expect(otherNode).toBeVisible();
  const otherSymbol = await otherNode.getAttribute('data-id');
  expect(otherSymbol).not.toBeNull();
  const otherMoved = await moveNode(page, otherNode);
  expect(otherMoved).not.toEqual(moved);
  const other = await downloadProject(page);
  expect(Object.keys(other.bundle.presentations)).toEqual([
    'WorkshopViews::overview',
    'WorkshopViews::compressor',
  ]);
  expect(
    other.bundle.presentations['WorkshopViews::compressor']?.positions[
      otherSymbol!
    ],
  ).toEqual(otherMoved);
  await openView(page, 'overview');
  await expect.poll(() => nodePosition(node)).toEqual(moved);
  await page
    .getByRole('textbox', { name: 'SysML source' })
    .fill('package Unfinished {');
  const { buffer, bundle } = await downloadProject(page);
  expect(bundle.drafts[0]?.text).toBe('package Unfinished {');
  expect(bundle.documents[0]?.text).toBe(original);
  expect(
    bundle.presentations['WorkshopViews::overview']?.positions[symbol!],
  ).toEqual(moved);

  // Reopen into a fresh page so the old renderer cannot supply the position.
  await page.reload();
  await waitForStartup(page);
  await page.locator('input[type=file]').setInputFiles({
    name: 'saved.sysml-project.json',
    mimeType: 'application/json',
    buffer,
  });
  // The draft is retained while the diagram evaluates applied source.
  await expect(page.getByRole('textbox', { name: 'SysML source' })).toHaveValue(
    'package Unfinished {',
  );
  await expect.poll(() => nodePosition(node)).toEqual(moved);
  await page
    .getByRole('button', { name: 'Discard draft', exact: true })
    .click();
  await openView(page, 'overview');
  await expect.poll(() => nodePosition(node)).toEqual(moved);
  await expect(source).toHaveValue(original);
  await openView(page, 'compressor');
  await expect.poll(() => nodePosition(otherNode)).toEqual(otherMoved);
  await openView(page, 'overview');
  await expect.poll(() => nodePosition(node)).toEqual(moved);
  const reopened = await downloadProject(page);
  expect(reopened.bundle.documents).toEqual(bundle.documents);
  expect(reopened.bundle.drafts).toEqual(bundle.documents);
  expect(reopened.bundle.presentations).toEqual(bundle.presentations);
});

test('cancels a reviewed rename without changing source, references or history', async ({
  page,
}) => {
  await openWorkshop(page);
  const before = (await downloadProject(page)).bundle;
  await page.getByTitle('Workshop::Motor', { exact: true }).click();
  await page.getByRole('textbox', { name: 'Name', exact: true }).fill('Drive');
  await page
    .getByRole('button', { name: 'Review rename', exact: true })
    .click();
  const dialog = page.getByRole('dialog', { name: 'Review source change' });
  await expect(dialog).toContainText('part def Drive');
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await expect(page.getByRole('textbox', { name: 'SysML source' })).toHaveValue(
    before.documents[0]!.text,
  );
  await expect(diagramNode(page, 'primary : Motor')).toBeVisible();
  await expect(diagramNode(page, 'standby : Motor')).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Undo source', exact: true }),
  ).toBeDisabled();
  expect((await downloadProject(page)).bundle).toEqual(before);
});

test('distinguishes repeated usages when selecting a diagram symbol', async ({
  page,
}) => {
  await openWorkshop(page);
  const properties = page.getByRole('complementary', { name: 'Properties' });
  for (const usage of ['primary', 'standby']) {
    await diagramNode(page, `${usage} : Motor`).click();
    await expect(
      properties.getByRole('heading', { name: usage, exact: true }),
    ).toBeVisible();
    await expect(
      properties.getByText(`Workshop::Compressor::${usage}`, { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByTitle(`Workshop::Compressor::${usage}`, { exact: true }),
    ).toHaveAttribute('aria-pressed', 'true');
    await properties
      .getByRole('button', { name: 'Open source', exact: true })
      .click();
    const source = page.getByRole('textbox', { name: 'SysML source' });
    await expect(source).toBeFocused();
    await expect
      .poll(() =>
        source.evaluate((element: HTMLTextAreaElement) =>
          element.value.slice(element.selectionStart, element.selectionEnd),
        ),
      )
      .toContain(`part ${usage} : Motor`);
  }
});

test('retains source, draft and diagram after engine asset failure, then recovers', async ({
  page,
}) => {
  await openWorkshop(page);
  const source = page.getByRole('textbox', { name: 'SysML source' });
  const original = await source.inputValue();
  const draft = original + '\n// retained across engine failure\n';
  const node = diagramNode(page, 'Workshop::Motor');
  const before = await nodePosition(node);
  let failedRequests = 0;
  const assets = '**/vendor/opensysml/sysml-wasm.wasm';
  await page.route(assets, async (route) => {
    failedRequests++;
    await route.fulfill({
      status: 503,
      body: 'Engine unavailable for this test',
    });
  });
  await source.fill(draft);
  await page.getByRole('button', { name: 'Apply source', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Issues' })).toContainText(
    'OpenSysML browser assets are unavailable',
  );
  expect(failedRequests).toBeGreaterThan(0);
  await expect(source).toHaveValue(draft);
  await expect(node).toBeVisible();
  expect(await nodePosition(node)).toEqual(before);
  const saved = (await downloadProject(page)).bundle;
  expect(saved.documents[0]?.text).toBe(original);
  expect(saved.drafts[0]?.text).toBe(draft);
  await page.unroute(assets);
  await page.getByRole('button', { name: 'Apply source', exact: true }).click();
  await expect(page.getByText('Source applied', { exact: true })).toBeVisible();
  await expect(node).toBeVisible();
  const recovered = (await downloadProject(page)).bundle;
  expect(recovered.documents[0]?.text).toBe(draft);
  expect(recovered.drafts).toEqual(recovered.documents);
});
