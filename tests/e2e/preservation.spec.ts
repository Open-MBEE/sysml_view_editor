import {
  test,
  waitForStartup,
  expect,
  ready,
  observeEvaluations,
  importAssembly,
  openView,
  moveNode,
  downloadProject,
  semanticPositions,
  expectRenderedPositions,
} from './support';

for (const rename of [
  { target: 'Assembly::Device', oldName: 'Device', name: 'ControllerDriver' },
  {
    target: 'Assembly::Station::bay::primary',
    oldName: 'primary',
    name: 'activeDevice',
  },
]) {
  test(`preserves both views through reviewed rename of ${rename.oldName}`, async ({
    page,
  }) => {
    test.setTimeout(150_000);
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
    const before = (await downloadProject(page)).bundle;
    const expected = Object.fromEntries(
      Object.entries(semanticPositions(before, evaluations)).map(
        ([key, point]) => [
          key.replaceAll(
            rename.target,
            rename.target.slice(0, rename.target.lastIndexOf('::') + 2) +
              rename.name,
          ),
          point,
        ],
      ),
    );
    await page.getByTitle(rename.target, { exact: true }).click();
    await page
      .getByRole('textbox', { name: 'Name', exact: true })
      .fill(rename.name);
    await page
      .getByRole('button', { name: 'Review rename', exact: true })
      .click();
    const dialog = page.getByRole('dialog');
    await expect(
      dialog.getByRole('region', { name: 'Layout preservation' }),
    ).toContainText('AssemblyViews::structure: 5 retained');
    await expect(
      dialog.getByRole('region', { name: 'Layout preservation' }),
    ).toContainText('AssemblyViews::devices: 3 retained');
    await page
      .getByRole('button', { name: 'Apply change', exact: true })
      .click();
    await expect(dialog).not.toBeVisible();
    const accepted = (await downloadProject(page)).bundle;
    expect(semanticPositions(accepted, evaluations)).toEqual(expected);
    for (const view of ['structure', 'devices']) {
      await openView(page, view);
      await expectRenderedPositions(page, accepted, 'AssemblyViews::' + view);
    }
    expect(accepted.documents).toEqual(
      documents.map((doc) => ({
        ...doc,
        text: doc.text.replaceAll(rename.oldName, rename.name),
      })),
    );
    await page
      .getByRole('button', { name: 'Undo source', exact: true })
      .click();
    await expect(
      page.getByRole('textbox', { name: 'SysML source' }),
    ).toHaveValue(documents[0]!.text);
    expect(
      semanticPositions((await downloadProject(page)).bundle, evaluations),
    ).toEqual(semanticPositions(before, evaluations));
    await page
      .getByRole('button', { name: 'Redo source', exact: true })
      .click();
    await expect(
      page.getByRole('textbox', { name: 'SysML source' }),
    ).toHaveValue(accepted.documents[0]!.text);
    expect(
      semanticPositions((await downloadProject(page)).bundle, evaluations),
    ).toEqual(expected);
    const saved = await downloadProject(page);
    await page.reload();
    await waitForStartup(page);
    await page.locator('input[type=file]').setInputFiles({
      name: 'retained.sysml-project.json',
      mimeType: 'application/json',
      buffer: saved.buffer,
    });
    await expect(
      page.getByRole('textbox', { name: 'SysML source' }),
    ).toHaveValue(accepted.documents[0]!.text);
    for (const view of ['structure', 'devices']) {
      await openView(page, view);
      await expectRenderedPositions(
        page,
        saved.bundle,
        'AssemblyViews::' + view,
      );
    }
    const reopened = (await downloadProject(page)).bundle;
    expect(reopened.documents).toEqual(accepted.documents);
    expect(semanticPositions(reopened, evaluations)).toEqual(expected);
    const usage = rename.oldName === 'primary' ? rename.name : 'primary';
    const type = rename.oldName === 'Device' ? rename.name : 'Device';
    const port = page
      .getByRole('group', { name: `part ${usage} : ${type}`, exact: true })
      .getByRole('button', { name: 'out port output : Signal', exact: true });
    await port.focus();
    await page.keyboard.press('Enter');
    const properties = page.getByRole('complementary', { name: 'Properties' });
    await expect(
      properties.getByText(`Assembly::${type}::output`, { exact: true }),
    ).toBeVisible();
    await expect(properties).toContainText(`Assembly::Station::bay::${usage}`);
  });
}

test('retains both views through a Unicode source insertion and an unrelated-file edit', async ({
  page,
}) => {
  test.setTimeout(150_000);
  const evaluations = await observeEvaluations(page);
  await ready(page);
  const documents = await importAssembly(page);
  const sources = [
    ...documents,
    { name: 'notes.sysml', text: 'package Notes { part def Marker; }\n' },
  ];
  await page.locator('input[type=file]').setInputFiles(
    sources.map((doc) => ({
      name: doc.name,
      mimeType: 'text/plain',
      buffer: Buffer.from(doc.text),
    })),
  );
  await expect(page.getByRole('textbox', { name: 'SysML source' })).toHaveValue(
    documents[0]!.text,
  );
  for (const view of ['structure', 'devices']) {
    await openView(page, view);
    await moveNode(
      page,
      page.getByRole('group', { name: 'part primary : Device', exact: true }),
    );
  }
  const before = (await downloadProject(page)).bundle;
  const expected = semanticPositions(before, evaluations);
  let prior = before;
  for (const [file, text] of [
    ['model.sysml', '// λ 🔧 unchanged declarations\n' + documents[0]!.text],
    ['notes.sysml', 'package Notes { part def MarkerChanged; }\n'],
  ]) {
    await page.getByRole('button', { name: file!, exact: true }).click();
    await page.getByRole('textbox', { name: 'SysML source' }).fill(text!);
    await page
      .getByRole('button', { name: 'Apply source', exact: true })
      .click();
    await expect(
      page.getByRole('button', { name: 'Download project', exact: true }),
    ).toBeEnabled();
    await expect(
      page.getByText('Source applied', { exact: true }),
    ).toBeVisible();
    const applied = (await downloadProject(page)).bundle;
    expect(semanticPositions(applied, evaluations)).toEqual(expected);
    await page
      .getByRole('button', { name: 'Undo source', exact: true })
      .click();
    await expect(
      page.getByRole('textbox', { name: 'SysML source' }),
    ).toHaveValue(prior.documents.find((item) => item.name === file)!.text);
    expect(
      semanticPositions((await downloadProject(page)).bundle, evaluations),
    ).toEqual(expected);
    await page
      .getByRole('button', { name: 'Redo source', exact: true })
      .click();
    await expect(
      page.getByRole('textbox', { name: 'SysML source' }),
    ).toHaveValue(text!);
    expect(
      semanticPositions((await downloadProject(page)).bundle, evaluations),
    ).toEqual(expected);
    prior = applied;
  }
  await page
    .getByRole('textbox', { name: 'SysML source' })
    .fill('package Unfinished { part');
  await page.getByRole('button', { name: 'Apply source', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Issues' })).toBeVisible();
  const rejected = (await downloadProject(page)).bundle;
  expect(rejected.documents).toEqual(prior.documents);
  expect(
    rejected.drafts.find((item) => item.name === 'notes.sysml')!.text,
  ).toBe('package Unfinished { part');
  expect(semanticPositions(rejected, evaluations)).toEqual(expected);
  await expectRenderedPositions(page, rejected, 'AssemblyViews::devices');
  await page
    .getByRole('button', { name: 'Discard draft', exact: true })
    .click();
  const saved = await downloadProject(page);
  await page.reload();
  await waitForStartup(page);
  await page.locator('input[type=file]').setInputFiles({
    name: 'edited.sysml-project.json',
    mimeType: 'application/json',
    buffer: saved.buffer,
  });
  await expect(page.getByRole('textbox', { name: 'SysML source' })).toHaveValue(
    '// λ 🔧 unchanged declarations\n' + documents[0]!.text,
  );
  for (const view of ['structure', 'devices']) {
    await openView(page, view);
    await expectRenderedPositions(page, saved.bundle, 'AssemblyViews::' + view);
  }
  expect(
    semanticPositions((await downloadProject(page)).bundle, evaluations),
  ).toEqual(expected);
});

test('invalidates reordered usage mappings instead of lending another usage its saved position', async ({
  page,
}) => {
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
  const before = (await downloadProject(page)).bundle;
  const retained = Object.fromEntries(
    Object.entries(semanticPositions(before, evaluations)).filter(
      ([key]) =>
        ![
          'Assembly::Station::bay::primary',
          'Assembly::Station::bay::standby',
        ].includes((JSON.parse(key) as string[])[1]!),
    ),
  );
  const reordered = documents[0]!.text.replace(
    'part primary : Device;\n            part standby : Device;',
    'part standby : Device;\n            part primary : Device;',
  );
  await page.getByRole('textbox', { name: 'SysML source' }).fill(reordered);
  await page.getByRole('button', { name: 'Apply source', exact: true }).click();
  await expect(page.getByRole('status')).toContainText(
    '4 saved positions were arranged again',
  );
  const after = (await downloadProject(page)).bundle;
  expect(after.documents[0]!.text).toBe(reordered);
  expect(semanticPositions(after, evaluations)).toEqual(retained);
  await page.getByRole('button', { name: 'Undo source', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'SysML source' })).toHaveValue(
    documents[0]!.text,
  );
  expect(
    semanticPositions((await downloadProject(page)).bundle, evaluations),
  ).toEqual(semanticPositions(before, evaluations));
});
