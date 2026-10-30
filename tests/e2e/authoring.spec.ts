import {
  test,
  expect,
  ready,
  importAssembly,
  observeEvaluations,
  openView,
  moveNode,
  downloadProject,
  semanticPositions,
  diagramSymbol,
  expectRenderedPositions,
} from './support';

test('creates a typed part and connects its actual inherited usage ports through reviewed source transactions', async ({
  page,
}, testInfo) => {
  test.setTimeout(180_000);
  const evaluations = await observeEvaluations(page);
  await ready(page);
  const documents = await importAssembly(page);
  for (const view of ['structure', 'devices']) {
    await openView(page, view);
    await moveNode(
      page,
      page.getByRole('group', { name: 'part primary : Device', exact: true }),
    );
  }
  const baseline = (await downloadProject(page)).bundle;
  const originalPositions = semanticPositions(baseline, evaluations);
  await page
    .getByRole('group', { name: 'part Assembly::Station::bay', exact: true })
    .click({ position: { x: 30, y: 30 } });
  await page
    .getByRole('region', { name: 'Diagram', exact: true })
    .getByRole('button', { name: 'New part', exact: true })
    .click();
  let dialog = page.getByRole('dialog');
  await expect(dialog).toHaveAccessibleName('New part');
  await expect(
    dialog.getByRole('textbox', { name: 'Part name' }),
  ).toBeFocused();
  await dialog.getByRole('textbox', { name: 'Part name' }).fill('auxiliary');
  await dialog
    .getByRole('combobox', { name: 'Owner', exact: true })
    .selectOption('Assembly::Station::bay');
  await dialog
    .getByRole('combobox', { name: 'Part definition' })
    .selectOption('Assembly::Device');
  await dialog
    .getByRole('button', { name: 'Review source', exact: true })
    .click();
  await expect(dialog).toHaveAccessibleName('Review source change');
  await expect(dialog).toContainText('part auxiliary : Assembly::Device;');
  await dialog
    .getByRole('button', { name: 'Apply change', exact: true })
    .click();
  await expect(dialog).not.toBeVisible();
  const auxiliary = page.getByRole('group', {
    name: 'part auxiliary : Assembly::Device',
    exact: true,
  });
  await expect(auxiliary).toBeVisible();
  const created = (await downloadProject(page)).bundle;
  expect(semanticPositions(created, evaluations)).toEqual(originalPositions);
  await expect(
    page.getByRole('complementary', { name: 'Properties' }),
  ).toContainText('Assembly::Station::bay::auxiliary');
  expect(created.documents[1]).toEqual(documents[1]);
  expect(created.documents[0]!.text).toContain('action def Inspect;');
  expect(created.documents[0]!.text).toContain(
    '// Outside the supported graphical authoring subset; retain in source.',
  );
  const createdView = evaluations.findLast(
    (item) =>
      item.view === 'AssemblyViews::devices' &&
      item.modelHash ===
        created.presentations['AssemblyViews::devices']!.modelHash,
  )!;
  const node = createdView.artifact!.nodes.find(
    (item) => item.name === 'auxiliary',
  )!;
  expect(
    createdView.correspondence.find((item) => item.symbol === node.id)?.subject
      .qualifiedName,
  ).toBe('Assembly::Station::bay::auxiliary');
  expect(
    createdView.correspondence.find(
      (item) =>
        item.symbol === node.ports!.find((port) => port.name === 'input')!.id,
    )?.subject.qualifiedName,
  ).toBe('Assembly::Device::input');

  // The new usage also gets its own independently saved position in each view.
  for (const view of ['structure', 'devices']) {
    await openView(page, view);
    await moveNode(
      page,
      page.getByRole('group', {
        name: 'part auxiliary : Assembly::Device',
        exact: true,
      }),
    );
  }
  const authoredPositions = semanticPositions(
    (await downloadProject(page)).bundle,
    evaluations,
  );

  await auxiliary
    .getByRole('button', { name: 'out port output : Signal', exact: true })
    .click();
  await page
    .getByRole('complementary', { name: 'Properties' })
    .getByRole('button', { name: 'Connect selected port', exact: true })
    .click();
  dialog = page.getByRole('dialog');
  await expect(dialog).toHaveAccessibleName('Connect ports');
  await dialog.getByRole('textbox', { name: 'Connection name' }).fill('backup');
  await dialog
    .getByRole('combobox', { name: 'From port' })
    .selectOption('Assembly::Station::bay::auxiliary#output');
  await dialog
    .getByRole('combobox', { name: 'To port' })
    .selectOption('Assembly::Station::bay::standby#input');
  await dialog
    .getByRole('button', { name: 'Review source', exact: true })
    .click();
  await expect(dialog).toHaveAccessibleName('Review source change');
  await expect(dialog).toContainText(
    'connection backup connect Assembly::Station::bay::auxiliary.output to Assembly::Station::bay::standby.input;',
  );
  await dialog
    .getByRole('button', { name: 'Apply change', exact: true })
    .click();
  await expect(dialog).not.toBeVisible();
  await expect(
    page.getByRole('main', { name: 'Model workspace', exact: true }),
  ).toBeFocused();
  const connected = (await downloadProject(page)).bundle;
  expect(semanticPositions(connected, evaluations)).toEqual(authoredPositions);
  const evaluated = evaluations.findLast(
    (item) =>
      item.view === 'AssemblyViews::devices' &&
      item.modelHash ===
        connected.presentations['AssemblyViews::devices']!.modelHash,
  )!;
  const edgeIndex = evaluated.correspondence.find(
    (item) => item.subject.qualifiedName === 'Assembly::Station::bay::backup',
  )!.symbol;
  const edge = evaluated.artifact!.edges[Number(edgeIndex.split(':')[1])]!;
  expect(
    evaluated.correspondence.find((item) => item.symbol === edge.from)?.subject
      .qualifiedName,
  ).toBe('Assembly::Station::bay::auxiliary');
  expect(
    evaluated.correspondence.find((item) => item.symbol === edge.to)?.subject
      .qualifiedName,
  ).toBe('Assembly::Station::bay::standby');
  expect(
    evaluated
      .artifact!.nodes.find((item) => item.id === edge.from)!
      .ports!.find((port) => port.id === edge.fromPort)!.name,
  ).toBe('output');
  expect(
    evaluated
      .artifact!.nodes.find((item) => item.id === edge.to)!
      .ports!.find((port) => port.id === edge.toPort)!.name,
  ).toBe('input');
  await testInfo.attach('connected-engine-view', {
    body: JSON.stringify(evaluated, null, 2),
    contentType: 'application/json',
  });

  await page.getByRole('button', { name: 'Undo source', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'SysML source' })).toHaveValue(
    created.documents[0]!.text,
  );
  await page.getByRole('button', { name: 'Undo source', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'SysML source' })).toHaveValue(
    documents[0]!.text,
  );
  expect(
    semanticPositions((await downloadProject(page)).bundle, evaluations),
  ).toEqual(originalPositions);
  for (const text of [
    created.documents[0]!.text,
    connected.documents[0]!.text,
  ]) {
    await page
      .getByRole('button', { name: 'Redo source', exact: true })
      .click();
    await expect(
      page.getByRole('textbox', { name: 'SysML source' }),
    ).toHaveValue(text);
  }
  const saved = await downloadProject(page);
  await page.reload();
  await expect(
    page.getByRole('button', { name: 'overview', exact: true }),
  ).toBeEnabled();
  await page.locator('input[type=file]').setInputFiles({
    name: 'authored.sysml-project.json',
    mimeType: 'application/json',
    buffer: saved.buffer,
  });
  await expect(page.getByRole('textbox', { name: 'SysML source' })).toHaveValue(
    connected.documents[0]!.text,
  );
  for (const view of ['structure', 'devices']) {
    await openView(page, view);
    await expectRenderedPositions(page, saved.bundle, 'AssemblyViews::' + view);
  }
  const reopened = (await downloadProject(page)).bundle;
  expect(reopened.documents).toEqual(connected.documents);
  expect(semanticPositions(reopened, evaluations)).toEqual(authoredPositions);
  const current = evaluations.findLast(
    (item) => item.view === 'AssemblyViews::devices',
  )!;
  await diagramSymbol(
    page,
    current.artifact!.nodes.find((item) => item.name === 'auxiliary')!.id,
  )
    .getByRole('button', { name: 'in port input : Signal', exact: true })
    .click();
  await expect(
    page.getByRole('complementary', { name: 'Properties' }),
  ).toContainText('Assembly::Station::bay::auxiliary');
});

test('contains authoring dialog focus and retains source and positions after duplicate-name and engine failures', async ({
  page,
}) => {
  await ready(page);
  await importAssembly(page);
  await moveNode(
    page,
    page.getByRole('group', { name: 'part primary : Device', exact: true }),
  );
  const before = (await downloadProject(page)).bundle;
  const trigger = page
    .getByRole('region', { name: 'Diagram', exact: true })
    .getByRole('button', { name: 'New part', exact: true });
  await trigger.focus();
  await page.keyboard.press('Enter');
  const dialog = page.getByRole('dialog', { name: 'New part', exact: true });
  const name = dialog.getByRole('textbox', { name: 'Part name' });
  await expect(name).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(
    dialog.getByRole('button', { name: 'Close', exact: true }),
  ).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(name).toBeFocused();
  await dialog
    .getByRole('combobox', { name: 'Owner', exact: true })
    .selectOption('Assembly::Station::bay');
  await name.fill('primary');
  await dialog
    .getByRole('button', { name: 'Review source', exact: true })
    .click();
  await expect(dialog.getByRole('alert')).toContainText('already exists');
  await expect(name).toHaveValue('primary');
  await name.fill('auxiliary');
  let blocked = 0;
  await page.route('**/vendor/sysml-toolkit/sysmlv2_bg.wasm', (route) => {
    blocked++;
    return route.abort();
  });
  await dialog
    .getByRole('button', { name: 'Review source', exact: true })
    .click();
  await expect.poll(() => blocked).toBeGreaterThan(0);
  await expect(dialog.getByRole('alert')).toBeVisible();
  await expect(name).toHaveValue('auxiliary');
  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
  await expect(trigger).toBeFocused();
  const after = (await downloadProject(page)).bundle;
  expect(after).toEqual(before);
  await expect(
    page.getByRole('button', { name: 'Undo source', exact: true }),
  ).toBeDisabled();
  await page.unroute('**/vendor/sysml-toolkit/sysmlv2_bg.wasm');
  await trigger.click();
  await page.getByRole('textbox', { name: 'Part name' }).fill('auxiliary');
  await page
    .getByRole('combobox', { name: 'Owner', exact: true })
    .selectOption('Assembly::Station::bay');
  await page
    .getByRole('button', { name: 'Review source', exact: true })
    .click();
  await expect(page.getByRole('dialog')).toHaveAccessibleName(
    'Review source change',
  );
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  expect((await downloadProject(page)).bundle).toEqual(before);
});

test('cancels an in-flight source proposal and permits a fresh review without changing work', async ({
  page,
}) => {
  await ready(page);
  await importAssembly(page);
  await moveNode(
    page,
    page.getByRole('group', { name: 'part primary : Device', exact: true }),
  );
  const before = (await downloadProject(page)).bundle;
  const trigger = page
    .getByRole('region', { name: 'Diagram', exact: true })
    .getByRole('button', { name: 'New part', exact: true });
  await trigger.click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('textbox', { name: 'Part name' }).fill('auxiliary');
  await dialog
    .getByRole('combobox', { name: 'Owner', exact: true })
    .selectOption('Assembly::Station::bay');
  let release!: () => void;
  let intercepted = false;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route('**/vendor/sysml-toolkit/sysmlv2_bg.wasm', async (route) => {
    intercepted = true;
    await gate;
    await route.continue().catch(() => {});
  });
  await dialog
    .getByRole('button', { name: 'Review source', exact: true })
    .click();
  await expect.poll(() => intercepted).toBe(true);
  await expect(
    dialog.getByRole('button', { name: 'Review source', exact: true }),
  ).toBeDisabled();
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await expect(trigger).toBeFocused();
  release();
  await page.unroute('**/vendor/sysml-toolkit/sysmlv2_bg.wasm');
  expect((await downloadProject(page)).bundle).toEqual(before);
  await expect(
    page.getByRole('button', { name: 'Undo source', exact: true }),
  ).toBeDisabled();
  await trigger.click();
  await dialog.getByRole('textbox', { name: 'Part name' }).fill('auxiliary');
  await dialog
    .getByRole('combobox', { name: 'Owner', exact: true })
    .selectOption('Assembly::Station::bay');
  await dialog
    .getByRole('button', { name: 'Review source', exact: true })
    .click();
  await expect(dialog).toHaveAccessibleName('Review source change');
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(dialog).not.toBeVisible();
  expect((await downloadProject(page)).bundle).toEqual(before);
});

test('adds a nested part to a typed usage by promoting only its semicolon owner', async ({
  page,
}) => {
  await ready(page);
  const documents = await importAssembly(page);
  await page
    .getByRole('group', { name: 'part primary : Device', exact: true })
    .getByText('primary : Device', { exact: true })
    .click();
  await page
    .getByRole('complementary', { name: 'Properties' })
    .getByRole('button', { name: 'New part in selection', exact: true })
    .click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('textbox', { name: 'Part name' }).fill('nested');
  await expect(
    dialog.getByRole('combobox', { name: 'Owner', exact: true }),
  ).toHaveValue('Assembly::Station::bay::primary');
  await dialog
    .getByRole('combobox', { name: 'Part definition' })
    .selectOption('Assembly::Device');
  await dialog
    .getByRole('button', { name: 'Review source', exact: true })
    .click();
  await expect(dialog).toHaveAccessibleName('Review source change');
  await dialog
    .getByRole('button', { name: 'Apply change', exact: true })
    .click();
  await expect(dialog).not.toBeVisible();
  await expect(
    page.getByRole('group', {
      name: 'part nested : Assembly::Device',
      exact: true,
    }),
  ).toBeVisible();
  const after = (await downloadProject(page)).bundle;
  expect(after.documents[1]).toEqual(documents[1]);
  expect(after.documents[0]!.text).toContain('part primary : Device {');
  expect(after.documents[0]!.text).toContain('part nested : Assembly::Device;');
  expect(after.documents[0]!.text).toContain(
    'connection handoff connect primary.output to standby.input;',
  );
  await expect(
    page.getByRole('complementary', { name: 'Properties' }),
  ).toContainText('Assembly::Station::bay::primary::nested');
  await page.getByRole('button', { name: 'Undo source', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'SysML source' })).toHaveValue(
    documents[0]!.text,
  );
});
