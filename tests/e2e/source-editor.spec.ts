import {
  test,
  expect,
  openWorkshop,
  readSource,
  fillSource,
  copySourceSelection,
  downloadProject,
  waitForStartup,
  diagramState,
  diagramNode,
} from './support';

test('edits, indents, closes brackets and undoes drafts independently of applied source history', async ({
  page,
}) => {
  await openWorkshop(page);
  const source = page.getByRole('textbox', {
    name: 'SysML source',
    exact: true,
  });
  const before = (await downloadProject(page)).bundle;
  await fillSource(source, 'package Draft ');
  await source.press('{');
  await source.press('Enter');
  await page.keyboard.insertText('part motor;');
  await expect(source).toHaveSource('package Draft {\n    part motor;\n}');
  await expect(
    page.getByRole('button', { name: 'Undo source', exact: true }),
  ).toBeDisabled();
  const saved = (await downloadProject(page)).bundle;
  expect(saved.documents).toEqual(before.documents);
  expect(saved.drafts[0]!.text).toBe('package Draft {\n    part motor;\n}');
  await source.press('ControlOrMeta+End');
  await page.evaluate(() => navigator.clipboard.writeText(' // pasted edit'));
  await source.press('ControlOrMeta+v');
  await expect(source).toHaveSource(saved.drafts[0]!.text + ' // pasted edit');
  await source.press('ControlOrMeta+z');
  await expect(source).toHaveSource(saved.drafts[0]!.text);
  await source.press(
    process.platform === 'darwin' ? 'Meta+Shift+Z' : 'Control+y',
  );
  await expect(source).toHaveSource(saved.drafts[0]!.text + ' // pasted edit');
  await page
    .getByRole('button', { name: 'Discard draft', exact: true })
    .click();
  await expect(source).toHaveSource(before.documents[0]!.text);
  // A discarded draft must not be recoverable through CodeMirror's local undo.
  await source.press('ControlOrMeta+z');
  await expect(source).toHaveSource(before.documents[0]!.text);
  await source.press('Tab');
  await expect(source).not.toBeFocused();
  expect((await downloadProject(page)).bundle).toEqual(before);
});

test('finds and replaces source through keyboard controls, then applies with the real engines', async ({
  page,
}) => {
  await openWorkshop(page);
  const source = page.getByRole('textbox', {
    name: 'SysML source',
    exact: true,
  });
  const original = await readSource(source);
  await source.press('ArrowLeft');
  await source.press('ControlOrMeta+f');
  const editor = page.getByRole('region', {
    name: 'Source editor',
    exact: true,
  });
  const find = editor.getByRole('textbox', { name: 'Find', exact: true });
  await expect(find).toBeFocused();
  await find.fill('Motor');
  await editor
    .getByRole('textbox', { name: 'Replace', exact: true })
    .fill('Drive');
  await editor
    .getByRole('button', { name: 'replace all', exact: true })
    .click();
  await find.focus();
  await page.keyboard.press('Escape');
  await expect(find).not.toBeVisible();
  await expect(source).toBeFocused();
  await expect(source).toHaveSource(original.replaceAll('Motor', 'Drive'));
  await page.getByRole('button', { name: 'Apply source', exact: true }).click();
  await expect(page.getByText('Source applied', { exact: true })).toBeVisible();
  await expect(diagramNode(page, 'primary : Drive')).toBeVisible();
  const applied = (await downloadProject(page)).bundle;
  expect(applied.documents[0]!.text).toBe(
    original.replaceAll('Motor', 'Drive'),
  );
  await page.getByRole('button', { name: 'Undo source', exact: true }).click();
  await expect(source).toHaveSource(original);
  await page.getByRole('button', { name: 'Redo source', exact: true }).click();
  await expect(source).toHaveSource(applied.documents[0]!.text);
});

test('retains a virtualized long draft across file switches, local undo and fresh reopen', async ({
  page,
}) => {
  await openWorkshop(page);
  const source = page.getByRole('textbox', {
    name: 'SysML source',
    exact: true,
  });
  const original = await readSource(source);
  const draft =
    original +
    '\n' +
    Array.from({ length: 1500 }, (_, i) => `// retained line ${i} 🛠`).join(
      '\n',
    ) +
    '\n';
  await fillSource(source, draft);
  await expect(source).toHaveSource(draft);
  await source.press('ControlOrMeta+End');
  await page.evaluate(() => navigator.clipboard.writeText('// at the end'));
  await source.press('ControlOrMeta+v');
  await source.press('ControlOrMeta+z');
  await expect(source).toHaveSource(draft);
  await page.getByRole('button', { name: 'views.sysml', exact: true }).click();
  const views = await readSource(source);
  await source.press('ControlOrMeta+z');
  await expect(source).toHaveSource(views);
  await page.getByRole('button', { name: 'model.sysml', exact: true }).click();
  await expect(source).toHaveSource(draft);
  const saved = await downloadProject(page);
  expect(saved.bundle.documents[0]!.text).toBe(original);
  expect(saved.bundle.drafts[0]!.text).toBe(draft);
  await page.reload();
  await waitForStartup(page);
  await page.locator('input[type=file]').setInputFiles({
    name: 'draft.sysml-project.json',
    mimeType: 'application/json',
    buffer: saved.buffer,
  });
  await expect(source).toHaveSource(draft);
  expect((await downloadProject(page)).bundle).toEqual(saved.bundle);
});

test('preserves CRLF and Unicode through source reveal, typing and save without applying a draft', async ({
  page,
}) => {
  await openWorkshop(page);
  const before = (await downloadProject(page)).bundle;
  const documents = before.documents.map((file) => ({
    ...file,
    text: '// 🛠 café\r\n' + file.text.replaceAll('\n', '\r\n'),
  }));
  await page.locator('input[type=file]').setInputFiles({
    name: 'crlf.sysml-project.json',
    mimeType: 'application/json',
    buffer: Buffer.from(
      JSON.stringify({ ...before, documents, drafts: documents }),
    ),
  });
  const source = page.getByRole('textbox', {
    name: 'SysML source',
    exact: true,
  });
  await expect(source).toContainText('café');
  await expect(
    page.getByRole('button', { name: 'Download project', exact: true }),
  ).toBeEnabled();
  const diagram = await diagramState(page);
  await diagramNode(page, 'primary : Motor').click();
  await page.getByRole('button', { name: 'Open source', exact: true }).click();
  await expect(source).toBeFocused();
  expect(await copySourceSelection(source)).toContain('part primary : Motor');
  await source.press('ControlOrMeta+End');
  await page.keyboard.insertText('// extra 🛠\n// next');
  const saved = (await downloadProject(page)).bundle;
  expect(saved.documents).toEqual(documents);
  expect(saved.drafts[0]!.text).toBe(
    documents[0]!.text + '// extra 🛠\r\n// next',
  );
  expect(await diagramState(page)).toEqual(diagram);
  await source.press('ControlOrMeta+z');
  expect((await downloadProject(page)).bundle.drafts).toEqual(documents);
});

test('blocks typing and draft undo while a real-engine application is pending', async ({
  page,
}) => {
  await openWorkshop(page);
  const source = page.getByRole('textbox', {
    name: 'SysML source',
    exact: true,
  });
  const original = await readSource(source);
  const draft = original + '\n// retain while applying\n';
  await fillSource(source, draft);
  let release!: () => void,
    requests = 0;
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  const asset = '**/vendor/opensysml/sysml-wasm.wasm';
  await page.route(asset, async (route) => {
    requests++;
    await pending;
    await route.continue();
  });
  try {
    await page
      .getByRole('button', { name: 'Apply source', exact: true })
      .click();
    await expect.poll(() => requests).toBeGreaterThan(0);
    await expect(source).toHaveAttribute('aria-readonly', 'true');
    await source.press('ControlOrMeta+z');
    await source.press('x');
    await expect(source).toHaveSource(draft);
  } finally {
    release();
  }
  await expect(page.getByText('Source applied', { exact: true })).toBeVisible();
  await expect(source).toHaveAttribute('aria-readonly', 'false');
  expect((await downloadProject(page)).bundle.documents[0]!.text).toBe(draft);
  await page.unroute(asset);
});

for (const width of [1440, 768]) {
  test(`fills the source area after Split to Code at ${width}px and restores the split`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await openWorkshop(page);
    const source = page.getByRole('region', {
      name: 'Source editor',
      exact: true,
    });
    const diagram = page.getByRole('region', { name: 'Diagram', exact: true });
    const axis = width < 900 ? 'height' : 'width';
    const before = (await source.boundingBox())![axis];
    const available = before + (await diagram.boundingBox())![axis];
    await page.getByRole('button', { name: 'Code', exact: true }).click();
    await expect
      .poll(async () => (await source.boundingBox())![axis])
      .toBeGreaterThanOrEqual(available - 1);
    await expect(diagram).not.toBeVisible();
    await page.getByRole('button', { name: 'Split', exact: true }).click();
    await expect
      .poll(async () => Math.abs((await source.boundingBox())![axis] - before))
      .toBeLessThan(1);
    await expect(diagram).toBeVisible();
  });
}
