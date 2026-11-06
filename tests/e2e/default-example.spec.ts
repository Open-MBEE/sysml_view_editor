import { readFile } from 'node:fs/promises';
import {
  test,
  expect,
  waitForStartup,
  waitForLauncher,
  observeEvaluations,
  downloadProject,
  namedViewButton,
} from './support';

test('explicitly loads the complete Smart air workshop in its workshop overview and preserves all nine source files', async ({
  page,
}, testInfo) => {
  const evaluations = await observeEvaluations(page);
  await page.goto('/app');
  await waitForLauncher(page);
  await page
    .getByRole('button', { name: 'Load air workshop', exact: true })
    .click();
  await expect(
    page.getByRole('combobox', { name: 'Named view', exact: true }),
  ).toHaveValue('CompressorViews::overview', { timeout: 3000 });
  await waitForStartup(page, { split: false });
  await expect(
    page.getByRole('banner').getByText('Smart air workshop', { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Diagram', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true');
  await expect(
    page.getByRole('region', { name: 'Source editor', exact: true }),
  ).not.toBeVisible();
  const view = evaluations.findLast(
    (item) => item.view === 'CompressorViews::overview',
  )!;
  expect(view.status).toBe('complete');
  expect(view.artifact?.kind).toBe('interconnection');
  expect(view.artifact!.nodes.map((item) => item.name).sort()).toEqual(
    [
      'CompressorSystem::WorkshopContext',
      'mains',
      'compressor',
      'tool',
      'serviceConsole',
    ].sort(),
  );
  expect(view.artifact!.nodes.flatMap((item) => item.ports ?? [])).toHaveLength(
    6,
  );
  expect(view.artifact!.edges.map((item) => item.label).sort()).toEqual(
    ['electricalSupply', 'usableAir'].sort(),
  );
  const navigation = page.getByRole('complementary', {
    name: 'Project navigation',
    exact: true,
  });
  for (const name of [
    'overview',
    'structure',
    'installation',
    'pneumatics',
    'definitions',
    'requirements',
    'actions',
    'maintenance',
    'useCases',
    'states',
    'startupSequence',
    'demandSequence',
    'faultSequence',
    'envelopeGeometry',
  ])
    await expect(
      navigation.getByRole('button', { name, exact: true }),
    ).toHaveCount(1);
  const saved = await downloadProject(page);
  expect(saved.bundle.documents).toHaveLength(9);
  for (const source of saved.bundle.documents) {
    const expected = await readFile(
      new URL('../../examples/air-compressor/' + source.name, import.meta.url),
      'utf8',
    );
    expect(source.text).toBe(expected);
  }
  expect(saved.bundle.drafts).toEqual(saved.bundle.documents);
  await page.getByRole('button', { name: 'Split', exact: true }).click();
  const source = page.getByRole('textbox', {
    name: 'SysML source',
    exact: true,
  });
  for (const file of [
    'components.sysml',
    'requirements.sysml',
    'behavior.sysml',
    'system.sysml',
  ]) {
    await navigation.getByRole('button', { name: file, exact: true }).click();
    await expect(source).toHaveSource(
      saved.bundle.documents.find((item) => item.name === file)!.text,
    );
  }
  await expect(
    namedViewButton(page, 'CompressorViews::overview'),
  ).toHaveAttribute('aria-current', 'page');
  expect((await downloadProject(page)).bundle).toEqual(saved.bundle);
  await namedViewButton(page, 'CompressorViews::pneumatics').click();
  await expect(
    page.getByRole('group', { name: 'part pump : Pump', exact: true }),
  ).toBeVisible();
  expect((await downloadProject(page)).bundle.documents).toEqual(
    saved.bundle.documents,
  );
  await testInfo.attach('default-overview-engine', {
    body: JSON.stringify(view, null, 2),
    contentType: 'application/json',
  });
});
