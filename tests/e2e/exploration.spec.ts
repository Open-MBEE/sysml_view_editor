import {
  test,
  expect,
  openWorkshop,
  ready,
  downloadProject,
  observeExplorations,
  diagramSymbol,
  fillSource,
  diagramNode,
  moveNode,
  readSource,
  copySourceSelection,
  expectRenderedPositions,
  explorationNodeBoxes,
  explorationEdgeLabelBoxes,
  explorationScopeFits,
} from './support';
import { documents, noViews } from './exploration-support';

test('@critical opens a no-view multi-file model as an overview and distinguishes explicit definitions from typed usages without authoring source', async ({
  page,
}) => {
  const results = await observeExplorations(page);
  await noViews(page);
  await expect.poll(() => results.length).toBe(1);
  expect(results[0]!.request).toEqual({
    scope: { kind: 'project' },
    representation: 'tree',
  });
  expect(results[0]!.selected.map((item) => item.qualifiedName).sort()).toEqual(
    ['P', 'Q'],
  );
  const overview = results[0]!;
  const identity = (name: string) =>
    overview.correspondence.find((item) => item.subject.qualifiedName === name)!
      .symbol;
  const parent = (name: string) =>
    overview.artifact!.nodes.find((item) => item.id === identity(name))!.parent;
  expect(parent('P::System')).toBe(identity('P'));
  expect(parent('P::System::primary')).toBe(identity('P::System'));
  expect(parent('P::System::standby')).toBe(identity('P::System'));
  expect(parent('Q::Motor')).toBe(identity('Q'));
  await expect
    .poll(async () => {
      const [owner, child] = await explorationNodeBoxes(page, [
        identity('P::System'),
        identity('P::System::primary'),
      ]);
      return (
        child!.x > owner!.x &&
        child!.y > owner!.y &&
        child!.x + child!.width < owner!.x + owner!.width &&
        child!.y + child!.height < owner!.y + owner!.height
      );
    })
    .toBe(true);
  await expect
    .poll(async () => {
      const [primary, standby] = await explorationEdgeLabelBoxes(page, [
        'edge:0',
        'edge:1',
      ]);
      return (
        Math.max(primary!.x, standby!.x) >=
          Math.min(primary!.x + primary!.width, standby!.x + standby!.width) ||
        Math.max(primary!.y, standby!.y) >=
          Math.min(primary!.y + primary!.height, standby!.y + standby!.height)
      );
    })
    .toBe(true);
  for (const name of ['primary', 'standby']) {
    // Native 0.12 tree edges are emitted in a different order. Bind the
    // assertion to the exact declaration, rather than a transient edge index.
    const symbol = overview.correspondence.find(
      (item) =>
        item.symbol.startsWith('edge:') &&
        item.subject.qualifiedName === `P::System::${name}`,
    )!.symbol;
    const relation = page.getByRole('group', {
      name: new RegExp(`composition ${name}:`),
    });
    await relation.focus();
    await relation.press('Enter');
    await expect(relation).toBeFocused();
    await expect(
      page.getByRole('button', { name: 'Apply source', exact: true }),
    ).toBeDisabled();
    const inspector = page.getByRole('complementary', {
      name: 'Properties',
      exact: true,
    });
    await expect(
      inspector.getByRole('heading', {
        name: 'Relationship declaration',
        exact: true,
      }),
    ).toBeVisible();
    await expect(inspector).toContainText(`P::System::${name}`);
    await inspector
      .getByRole('button', { name: 'Open source', exact: true })
      .click();
    await expect
      .poll(() =>
        copySourceSelection(
          page.getByRole('textbox', { name: 'SysML source', exact: true }),
        ),
      )
      .toBe(`part ${name} : Q::Motor;`);
    expect(
      overview.correspondence.find((item) => item.symbol === symbol)?.subject
        .qualifiedName,
    ).toBe(`P::System::${name}`);
  }
  const before = (await downloadProject(page)).bundle;
  expect(before.documents).toEqual(documents);
  expect(before.drafts).toEqual(documents);
  expect(before.presentations).toEqual({});
  const scope = page.getByRole('combobox', {
    name: 'Exploration scope',
    exact: true,
  });
  const representation = page.getByRole('combobox', {
    name: 'Exploration representation',
    exact: true,
  });
  await scope.selectOption('P');
  await expect(scope).toBeEnabled();
  await expect(scope).toBeFocused();
  await expect
    .poll(() => results.at(-1)?.request.scope)
    .toEqual({ kind: 'package', subject: 'P' });
  await expect(
    representation.getByRole('option', { name: 'Structure', exact: true }),
  ).toBeDisabled();
  await scope.selectOption('P::System');
  await expect(scope).toBeEnabled();
  await representation.selectOption('interconnection');
  await expect(representation).toBeEnabled();
  await expect(representation).toBeFocused();
  await expect
    .poll(() => results.at(-1)?.artifact?.kind)
    .toBe('interconnection');
  const definition = results.at(-1)!;
  await expect(
    page.getByRole('group', { name: 'Current exploration scope', exact: true }),
  ).toHaveText(/Part definitionP::System/);
  expect(definition.artifact!.nodes.map((node) => node.name).sort()).toEqual([
    'P::System',
    'primary',
    'standby',
  ]);
  await expect
    .poll(async () => {
      const ids = ['P::System', 'P::System::primary', 'P::System::standby'].map(
        (name) =>
          definition.correspondence.find(
            (item) => item.subject.qualifiedName === name,
          )!.symbol,
      );
      const [owner, left, right] = await explorationNodeBoxes(page, ids);
      return (
        Math.abs(left!.y - right!.y) < 1 &&
        right!.x > left!.x + left!.width &&
        owner!.height < owner!.width &&
        Math.abs(left!.height / left!.width - 52 / 208) < 0.01
      );
    })
    .toBe(true);
  const primary = definition.correspondence.find(
    (item) => item.subject.qualifiedName === 'P::System::primary',
  )!;
  const standby = definition.correspondence.find(
    (item) => item.subject.qualifiedName === 'P::System::standby',
  )!;
  expect(primary.context).not.toEqual(standby.context);
  await diagramSymbol(page, primary.symbol).click();
  await page.getByRole('button', { name: 'Open source', exact: true }).click();
  const source = page.getByRole('textbox', {
    name: 'SysML source',
    exact: true,
  });
  await expect
    .poll(() => copySourceSelection(source))
    .toBe('part primary : Q::Motor;');
  await scope.selectOption('P::system');
  await expect(scope).toBeEnabled();
  await representation.selectOption('interconnection');
  await expect(representation).toBeEnabled();
  await expect
    .poll(() => results.at(-1)?.artifact?.nodes.map((node) => node.name))
    .toEqual(['P::system']);
  await expect(
    page.getByRole('group', { name: 'Current exploration scope', exact: true }),
  ).toHaveText(/Part usageP::system/);
  await expect(
    page.getByText(/does not automatically expand its type/),
  ).toBeVisible();
  await page.getByRole('button', { name: 'other.sysml', exact: true }).click();
  await expect(source).toHaveSource(documents[1]!.text);
  await expect(scope).toHaveValue('P::system');
  await expect(representation).toHaveValue('interconnection');
  await expect(
    page.getByRole('button', { name: 'New part', exact: true }),
  ).not.toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Undo source', exact: true }),
  ).toBeDisabled();
  expect((await downloadProject(page)).bundle).toEqual(before);
});

test('exploration preserves invalid drafts and independent named-view geometry and reopens the portable project unchanged', async ({
  page,
}) => {
  await openWorkshop(page);
  await moveNode(page, diagramNode(page, 'Workshop::Motor'));
  const before = (await downloadProject(page)).bundle;
  const source = page.getByRole('textbox', {
    name: 'SysML source',
    exact: true,
  });
  const draft =
    (await readSource(source)) + '\n// preserved while browsing\npart';
  await fillSource(source, draft);
  const expected = await downloadProject(page);
  const named = page.getByRole('combobox', { name: 'Named view', exact: true });
  await named.selectOption('');
  const scope = page.getByRole('combobox', {
    name: 'Exploration scope',
    exact: true,
  });
  await expect(scope).toBeEnabled();
  await scope.selectOption('Workshop');
  await expect(scope).toBeEnabled();
  await expect(source).toHaveSource(draft);
  expect((await downloadProject(page)).bundle).toEqual(expected.bundle);
  await named.selectOption('WorkshopViews::overview');
  await expect(scope).not.toBeVisible();
  await expectRenderedPositions(page, before, 'WorkshopViews::overview');
  expect((await downloadProject(page)).bundle).toEqual(expected.bundle);
  page.once('dialog', (dialog) => dialog.accept());
  await page.reload();
  await page.getByRole('button', { name: 'Load example', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Download project', exact: true }),
  ).toBeEnabled();
  await page.locator('input[type=file]').setInputFiles({
    name: 'reopen.sysml-project.json',
    mimeType: 'application/json',
    buffer: expected.buffer,
  });
  await expect(named).toBeEnabled();
  await expectRenderedPositions(page, before, 'WorkshopViews::overview');
  expect((await downloadProject(page)).bundle).toEqual(expected.bundle);
});

test('an actual exploration engine asset failure preserves the old scope, diagram and sources and permits retry', async ({
  page,
}) => {
  await noViews(page);
  const before = (await downloadProject(page)).bundle;
  const scope = page.getByRole('combobox', {
    name: 'Exploration scope',
    exact: true,
  });
  let failures = 0;
  const asset = '**/vendor/opensysml/sysml-wasm.wasm';
  await page.route(asset, async (route) => {
    failures++;
    await route.fulfill({
      status: 503,
      body: 'Controlled exploration failure',
    });
  });
  await scope.selectOption('P');
  await expect.poll(() => failures).toBeGreaterThan(0);
  await expect(
    page.getByText('OpenSysML browser assets are unavailable.', {
      exact: true,
    }),
  ).toBeVisible();
  await expect(scope).toHaveValue('');
  expect((await downloadProject(page)).bundle).toEqual(before);
  await page.unroute(asset);
  await scope.selectOption('P');
  await expect(scope).toBeEnabled();
  await expect(scope).toHaveValue('P');
  expect((await downloadProject(page)).bundle).toEqual(before);
});

test('shows the entire qualified scope and its definition/usage kind at narrow width', async ({
  page,
}) => {
  await noViews(page);
  await downloadProject(page);
  const prefix = 'Engineering::CompressorControlSubsystem';
  const target = prefix + '::RedundantDriveAssembly';
  const longDocuments = [
    {
      name: 'model.sysml',
      text: 'package Engineering { package CompressorControlSubsystem { part def RedundantDriveAssembly { part primary : Q::Motor; part standby : Q::Motor; } part installedDrive : RedundantDriveAssembly; } }',
    },
    documents[1]!,
  ];
  await page.locator('input[type=file]').setInputFiles(
    longDocuments.map((file) => ({
      name: file.name,
      mimeType: 'text/plain',
      buffer: Buffer.from(file.text),
    })),
  );
  const scope = page.getByRole('combobox', {
    name: 'Exploration scope',
    exact: true,
  });
  await expect(scope).toBeEnabled();
  await page.getByRole('button', { name: 'Diagram', exact: true }).click();
  await page.setViewportSize({ width: 768, height: 900 });
  await page
    .getByRole('button', { name: 'Collapse Explorer', exact: true })
    .click();
  await expect(
    page.getByRole('button', { name: 'Show Explorer', exact: true }),
  ).toBeFocused();
  await scope.selectOption(target);
  await expect(scope).toBeEnabled();
  const caption = page.getByRole('group', {
    name: 'Current exploration scope',
    exact: true,
  });
  await expect(caption).toContainText(target);
  await expect(caption).toContainText('Part definition');
  await expect.poll(() => explorationScopeFits(page)).toBe(true);
  await scope.selectOption(prefix + '::installedDrive');
  await expect(scope).toBeEnabled();
  await expect(caption).toContainText(prefix + '::installedDrive');
  await expect(caption).toContainText('Part usage');
  await expect.poll(() => explorationScopeFits(page)).toBe(true);
});

test('retries an initial exploration asset failure without reopening or changing source', async ({
  page,
}) => {
  await ready(page);
  let requests = 0;
  const asset = '**/vendor/opensysml/sysml-wasm.wasm';
  await page.route(asset, async (route) => {
    requests++;
    if (requests === 2)
      await route.fulfill({
        status: 503,
        body: 'Controlled initial exploration failure',
      });
    else await route.continue();
  });
  await page.locator('input[type=file]').setInputFiles(
    documents.map((file) => ({
      name: file.name,
      mimeType: 'text/plain',
      buffer: Buffer.from(file.text),
    })),
  );
  await expect(
    page.getByText('OpenSysML browser assets are unavailable.', {
      exact: true,
    }),
  ).toBeVisible();
  expect(requests).toBe(2);
  const before = (await downloadProject(page)).bundle;
  expect(before.documents).toEqual(documents);
  await expect(
    page.getByRole('combobox', { name: 'Exploration scope', exact: true }),
  ).not.toBeVisible();
  const retry = page.getByRole('button', {
    name: 'Explore model',
    exact: true,
  });
  await expect(retry).toBeEnabled({ timeout: 3000 });
  await page.unroute(asset);
  await retry.focus();
  await retry.press('Enter');
  await expect(
    page.getByRole('combobox', { name: 'Exploration scope', exact: true }),
  ).toBeEnabled();
  await expect(
    page.getByRole('group', { name: 'part def System', exact: true }),
  ).toBeVisible();
  await expect(retry).not.toBeVisible();
  await expect(
    page.getByRole('combobox', { name: 'Exploration scope', exact: true }),
  ).toBeFocused();
  await expect(
    page.getByRole('button', { name: 'Apply source', exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByRole('button', { name: 'Undo source', exact: true }),
  ).toBeDisabled();
  expect((await downloadProject(page)).bundle).toEqual(before);
});
