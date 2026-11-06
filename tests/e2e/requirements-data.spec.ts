import {
  test,
  expect,
  ready,
  downloadProject,
  fillSource,
  copySourceSelection,
  moveNode,
  expectRenderedPositions,
  namedViewButton,
} from './support';
import { importRequirementsTraceability } from './requirements-support';

test('@critical reads requirements and exact declared traceability without changing source, drafts or saved positions', async ({
  page,
}) => {
  await ready(page);
  await importRequirementsTraceability(page);
  await expect(
    page.getByRole('button', { name: 'Download project', exact: true }),
  ).toBeEnabled();
  await moveNode(
    page,
    page.getByRole('group', {
      name: 'requirement def REQ-CAP TraceRequirements::MinimumCapacity',
      exact: true,
    }),
  );
  const before = (await downloadProject(page)).bundle;
  expect(Object.keys(before.presentations)).toEqual([
    'TraceViews::requirements',
  ]);
  await page
    .getByRole('button', { name: 'Requirements table', exact: true })
    .click();
  const table = page.getByRole('region', {
    name: 'Requirements table',
    exact: true,
  });
  await expect(table.getByRole('status')).toHaveText('7 requirements');
  await expect(
    table
      .getByRole('row')
      .filter({ hasText: 'TraceRequirements::MinimumCapacity' })
      .first(),
  ).toContainText('REQ-CAP');
  await expect(table).toContainText(
    'The storage tank shall provide at least ten units',
  );
  await table.getByLabel('Search requirements').fill('REQ-LEFT-CAP');
  await expect(table.getByRole('status')).toHaveText('1 requirements');
  await expect(table).toContainText('TraceSystem::LeftPlant::tank');
  await expect(table).not.toContainText('TraceSystem::RightPlant::tank');
  await table
    .getByRole('button', {
      name: 'TraceRequirements::leftSpecification::leftCapacity',
      exact: true,
    })
    .click();
  const source = page.getByRole('textbox', {
    name: 'SysML source',
    exact: true,
  });
  await expect
    .poll(() => copySourceSelection(source))
    .toContain("requirement <'REQ-LEFT-CAP'> leftCapacity : CapacityRule");
  await table.getByLabel('Search requirements').fill('');
  const csv = page.waitForEvent('download');
  await table.getByRole('button', { name: 'Export CSV', exact: true }).click();
  const stream = await (await csv).createReadStream();
  const chunks = [];
  for await (const c of stream!) chunks.push(Buffer.from(c));
  const content = Buffer.concat(chunks).toString();
  expect(content).toContain('NOT TraceSystem::spare');
  expect(content).toContain('REQ-LEFT-CAP');
  await page
    .getByRole('button', { name: 'Traceability matrix', exact: true })
    .click();
  const matrix = page.getByRole('region', {
    name: 'Traceability matrix',
    exact: true,
  });
  await expect(matrix.getByRole('status')).toHaveText(
    '7 requirements · 3 linked elements',
  );
  const left = matrix.getByRole('row').filter({
    has: page.getByRole('button', {
      name: 'TraceRequirements::leftSpecification::leftCapacity',
      exact: true,
    }),
  });
  await expect(
    left.getByRole('button', { name: 'Declared', exact: true }),
  ).toHaveCount(1);
  const excluded = matrix.getByRole('row').filter({
    has: page.getByRole('button', {
      name: 'TraceRequirements::excludedCapacity',
      exact: true,
    }),
  });
  await expect(excluded).toContainText('Negated declaration');
  const unlinked = matrix.getByRole('row').filter({
    has: page.getByRole('button', {
      name: 'TraceRequirements::unlinkedCapacity',
      exact: true,
    }),
  });
  await expect(unlinked).toBeVisible();
  await expect(
    unlinked.getByRole('button', { name: /Declared|Negated declaration/ }),
  ).toHaveCount(0);
  await namedViewButton(page, 'TraceViews::overview').click();
  await expect(
    page.getByRole('button', { name: 'Diagram view', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true');
  await namedViewButton(page, 'TraceViews::requirements').click();
  await page
    .getByRole('button', { name: 'Traceability matrix', exact: true })
    .click();
  await expect(matrix.getByRole('status')).toHaveText(
    '7 requirements · 3 linked elements',
  );
  await matrix
    .getByLabel('Relationship', { exact: true })
    .selectOption('verification');
  await expect(matrix.getByRole('status')).toHaveText(
    '7 requirements · 0 linked elements',
  );
  expect((await downloadProject(page)).bundle).toEqual(before);
  // Invalid draft remains a draft; the data continues to describe applied source.
  await page
    .getByRole('button', { name: 'requirements.sysml', exact: true })
    .click();
  await fillSource(
    source,
    before.documents.find((d) => d.name === 'requirements.sysml')!.text +
      '\npart broken : Missing;',
  );
  await expect(matrix).toContainText('Unapplied drafts are retained');
  await matrix
    .getByRole('button', {
      name: 'TraceRequirements::excludedCapacity',
      exact: true,
    })
    .click();
  await expect(
    page.getByRole('status').filter({ hasText: 'Apply or discard this file' }),
  ).toBeVisible();
  const saved = (await downloadProject(page)).bundle;
  expect(saved.documents).toEqual(before.documents);
  expect(saved.presentations).toEqual(before.presentations);
  expect(saved.drafts).not.toEqual(before.drafts);
  page.on('dialog', (d) => d.accept());
  await page.locator('input[type=file]').setInputFiles({
    name: 'reopen.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(saved)),
  });
  await expect(
    page.getByRole('button', { name: 'Download project', exact: true }),
  ).toBeEnabled();
  expect((await downloadProject(page)).bundle).toEqual(saved);
  await page.getByRole('button', { name: 'Diagram view', exact: true }).click();
  await expectRenderedPositions(page, saved, 'TraceViews::requirements');
});

test('requirements asset failure is explicit and retries without replacing the project', async ({
  page,
}) => {
  await ready(page);
  const before = (await downloadProject(page)).bundle;
  const asset = '**/vendor/opensysml/sysml-wasm.wasm';
  let failed = 0;
  await page.route(asset, (r) => {
    failed++;
    return r.abort('failed');
  });
  await page
    .getByRole('button', { name: 'Requirements table', exact: true })
    .click();
  const panel = page.getByRole('region', {
    name: 'Requirements table',
    exact: true,
  });
  await expect(panel.getByRole('alert')).toBeVisible();
  expect(failed).toBeGreaterThan(0);
  expect((await downloadProject(page)).bundle).toEqual(before);
  await page.unroute(asset);
  await panel.getByRole('button', { name: 'Retry requirements' }).click();
  await expect(panel.getByRole('table')).toBeVisible();
  expect((await downloadProject(page)).bundle).toEqual(before);
});

test('matrix verification resolves the actual verifier and requirement through a cross-file alias', async ({
  page,
}) => {
  await page.goto('/app');
  const documents = [
    {
      name: 'requirements.sysml',
      text: "package Requirements { requirement <'R-SAFE'> safety; alias Safe for safety; }",
    },
    {
      name: 'system.sysml',
      text: 'package System { private import Requirements::*; part pump { satisfy Safe; } verification def Check; verification proof : Check { objective { verify safety; } } }',
    },
  ];
  await page.locator('input[type=file]').setInputFiles(
    documents.map((d) => ({
      name: d.name,
      mimeType: 'text/plain',
      buffer: Buffer.from(d.text),
    })),
  );
  await expect(
    page.getByRole('button', { name: 'Download project', exact: true }),
  ).toBeEnabled();
  const before = (await downloadProject(page)).bundle;
  await page
    .getByRole('button', { name: 'Traceability matrix', exact: true })
    .click();
  const matrix = page.getByRole('region', {
    name: 'Traceability matrix',
    exact: true,
  });
  await expect(matrix.getByRole('status')).toHaveText(
    '1 requirements · 1 linked elements',
  );
  await expect(
    matrix
      .getByRole('columnheader')
      .getByRole('button', { name: 'System::pump', exact: true }),
  ).toBeVisible();
  await matrix
    .getByRole('combobox', { name: 'Relationship', exact: true })
    .selectOption('verification');
  await expect(
    matrix
      .getByRole('columnheader')
      .getByRole('button', { name: 'System::proof', exact: true }),
  ).toBeVisible();
  await expect(
    matrix
      .getByRole('rowheader')
      .getByRole('button', { name: 'Requirements::safety', exact: true }),
  ).toBeVisible();
  await matrix.getByRole('button', { name: 'Declared', exact: true }).click();
  await expect
    .poll(() =>
      copySourceSelection(
        page.getByRole('textbox', { name: 'SysML source', exact: true }),
      ),
    )
    .toContain('verify safety');
  expect((await downloadProject(page)).bundle).toEqual(before);
});
