import { readFile } from 'node:fs/promises';
import {
  test,
  expect,
  ready,
  observeEvaluations,
  downloadProject,
} from './support';

test('opens the complete Smart air workshop in its useful pneumatic view and preserves all nine source files', async ({
  page,
}, testInfo) => {
  const evaluations = await observeEvaluations(page);
  await ready(page, { split: false });
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
    (item) => item.view === 'CompressorViews::pneumatics',
  )!;
  expect(view.status).toBe('complete');
  expect(view.artifact?.kind).toBe('interconnection');
  expect(view.artifact!.nodes.map((item) => item.name).sort()).toEqual(
    [
      'CompressorSystem::PneumaticAssembly',
      'pump',
      'tank',
      'regulator',
      'relief',
      'pressureSensor',
    ].sort(),
  );
  expect(view.artifact!.nodes.flatMap((item) => item.ports ?? [])).toHaveLength(
    13,
  );
  expect(view.artifact!.edges.map((item) => item.label).sort()).toEqual(
    [
      'chargingLine',
      'regulatedDelivery',
      'pressureProtection',
      'pressureSample',
    ].sort(),
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
    await expect(source).toHaveValue(
      saved.bundle.documents.find((item) => item.name === file)!.text,
    );
  }
  await expect(
    page.getByTitle('CompressorViews::pneumatics', { exact: true }),
  ).toHaveAttribute('aria-current', 'page');
  expect((await downloadProject(page)).bundle).toEqual(saved.bundle);
  await testInfo.attach('default-pneumatics-engine', {
    body: JSON.stringify(view, null, 2),
    contentType: 'application/json',
  });
});
