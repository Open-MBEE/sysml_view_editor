import { readFile } from 'node:fs/promises';
import {
  test,
  expect,
  ready,
  observeEvaluations,
  namedViewButton,
  downloadProject,
  copySourceSelection,
  fillSource,
  nodePosition,
  moveNode,
  expectRenderedPositions,
  semanticPositions,
  startExample,
  diagramSymbol,
} from './support';
import {
  requirementEdgePairs,
  requirementSymbol,
  requirementCard,
  requirementEdge,
  requirementViews,
  expectedSatisfactionPairs,
  importRequirementsTraceability,
  waitForRequirements,
  relationshipEndpoint,
} from './requirements-support';

// This observes the production workers. It establishes the engine projection,
// independently of the separate UI interaction and preservation scenarios.
test('native capacity requirements retain exact typing and satisfaction correspondence', async ({
  page,
}) => {
  const evaluations = await observeEvaluations(page);
  await ready(page);
  const documents = await Promise.all(
    ['model.sysml', 'views.sysml'].map(async (name) => ({
      name,
      text: await readFile(
        new URL(`../../examples/requirements/${name}`, import.meta.url),
        'utf8',
      ),
    })),
  );
  await page.locator('input[type=file]').setInputFiles(
    documents.map((document) => ({
      name: document.name,
      mimeType: 'text/plain',
      buffer: Buffer.from(document.text),
    })),
  );
  const view = 'CapacityViews::requirements';
  await expect(namedViewButton(page, view)).toHaveAttribute(
    'aria-current',
    'page',
  );
  await expect
    .poll(() => evaluations.some((result) => result.view === view))
    .toBe(true);
  const result = evaluations.findLast((entry) => entry.view === view)!;
  expect(result.status).toBe('complete');
  expect(result.renderStatus).toBe('available');
  expect(result.artifact?.kind).toBe('requirement');
  expect(requirementEdgePairs(result, 'typing')).toEqual([
    [
      'CapacityRequirements::usableCapacity',
      'CapacityRequirements::MinimumCapacity',
    ],
  ]);
  expect(requirementEdgePairs(result, 'satisfy')).toEqual([
    ['CapacityRequirements::storage', 'CapacityRequirements::usableCapacity'],
  ]);
  for (const name of [
    'CapacityRequirements::MinimumCapacity',
    'CapacityRequirements::usableCapacity',
    'CapacityRequirements::storage',
  ]) {
    const symbol = requirementSymbol(result, name);
    expect(symbol.subject.origin?.file).toBe('model.sysml');
    expect(symbol.subject.origin?.length).toBeGreaterThan(0);
  }
  const definition = page.getByRole('group', {
    name: 'requirement def REQ-1 CapacityRequirements::MinimumCapacity',
    exact: true,
  });
  await expect(definition.getByText('REQ-1', { exact: true })).toBeVisible();
  await expect(definition).toContainText(
    'The storage tank shall have capacity of at least ten units.',
  );
  await expect(
    page.getByRole('button', { name: 'Download project', exact: true }),
  ).toBeEnabled();
  const saved = (await downloadProject(page)).bundle;
  expect(saved.documents).toEqual(documents);
  expect(saved.drafts).toEqual(documents);
});

test('@critical browses exact requirement hierarchy and declared satisfaction without changing source', async ({
  page,
}) => {
  const evaluations = await observeEvaluations(page);
  await ready(page, { split: false });
  const documents = await importRequirementsTraceability(page);
  const result = await waitForRequirements(page, evaluations);
  const before = (await downloadProject(page)).bundle;
  const subjects = new Map(
    result.correspondence.map((item) => [
      item.symbol,
      item.subject.qualifiedName,
    ]),
  );
  const satisfaction = result.artifact!.edges.filter(
    (edge) => edge.kind === 'satisfy',
  );
  expect(
    satisfaction
      .filter((edge) => !edge.negated)
      .map((edge) => [subjects.get(edge.from), subjects.get(edge.to)])
      .sort(),
  ).toEqual([...expectedSatisfactionPairs].sort());
  expect(
    satisfaction
      .filter((edge) => edge.negated)
      .map((edge) => ({
        from: subjects.get(edge.from),
        to: subjects.get(edge.to),
        asserted: edge.asserted,
      })),
  ).toEqual([
    {
      from: 'TraceSystem::spare',
      to: 'TraceRequirements::excludedCapacity',
      asserted: true,
    },
  ]);
  expect(
    satisfaction.some(
      (edge) => subjects.get(edge.to) === 'TraceRequirements::unlinkedCapacity',
    ),
  ).toBe(false);
  expect(requirementEdgePairs(result, 'composition')).toEqual([
    [
      'TraceRequirements::leftSpecification',
      'TraceRequirements::leftSpecification::leftCapacity',
    ],
    [
      'TraceRequirements::rightSpecification',
      'TraceRequirements::rightSpecification::rightCapacity',
    ],
  ]);
  expect(
    result
      .artifact!.edges.filter((edge) => edge.kind === 'composition')
      .every((edge) => edge.ownership === 'direct'),
  ).toBe(true);
  for (const [from, to] of expectedSatisfactionPairs) {
    const card = requirementCard(page, result, to);
    await card.focus();
    await card.press('Enter');
    await expect(card).toBeFocused();
    await expect(card).toHaveCSS('outline-style', 'solid');
    const properties = page.getByRole('complementary', {
      name: 'Properties',
      exact: true,
    });
    await expect(properties.getByText(to, { exact: true })).toBeVisible();
    await expect(
      properties.getByText('TraceRequirements::MinimumCapacity', {
        exact: true,
      }),
    ).toBeVisible();
    await properties
      .getByRole('button', { name: 'Open source', exact: true })
      .click();
    const source = page.getByRole('textbox', {
      name: 'SysML source',
      exact: true,
    });
    await expect(source).toBeFocused();
    expect(await copySourceSelection(source)).toContain(
      to.includes('leftSpecification')
        ? "requirement <'REQ-LEFT-CAP'> leftCapacity"
        : "requirement <'REQ-RIGHT-CAP'> rightCapacity",
    );
    await page.getByRole('button', { name: 'Diagram', exact: true }).click();
    const edge = requirementEdge(page, result, 'satisfy', from, to);
    await edge.focus();
    await edge.press('Enter');
    await expect(edge).toBeFocused();
    await expect(
      properties.getByRole('heading', {
        name: 'Relationship declaration',
        exact: true,
      }),
    ).toBeVisible();
    await expect(relationshipEndpoint(properties, 'Source')).toHaveText(from);
    await expect(relationshipEndpoint(properties, 'Target')).toHaveText(to);
    await expect(properties).toContainText(
      'Model declaration; no execution result is reported.',
    );
    await properties
      .getByRole('button', { name: 'Open source', exact: true })
      .click();
    await expect(source).toBeFocused();
    expect(await copySourceSelection(source)).toBe(
      `satisfy ${to.includes('leftSpecification') ? 'leftSpecification' : 'rightSpecification'}.${to.includes('leftSpecification') ? 'leftCapacity' : 'rightCapacity'} by ${from};`,
    );
    await page.getByRole('button', { name: 'Diagram', exact: true }).click();
  }
  const negative = requirementEdge(
    page,
    result,
    'assert not satisfy',
    'TraceSystem::spare',
    'TraceRequirements::excludedCapacity',
  );
  await negative.focus();
  await negative.press('Enter');
  const properties = page.getByRole('complementary', {
    name: 'Properties',
    exact: true,
  });
  await expect(properties).toContainText('assert not satisfy');
  await expect(relationshipEndpoint(properties, 'Source')).toHaveText(
    'TraceSystem::spare',
  );
  await expect(relationshipEndpoint(properties, 'Target')).toHaveText(
    'TraceRequirements::excludedCapacity',
  );
  await properties
    .getByRole('button', { name: 'Open source', exact: true })
    .click();
  expect(
    await copySourceSelection(
      page.getByRole('textbox', { name: 'SysML source', exact: true }),
    ),
  ).toBe('assert not satisfy excludedCapacity by TraceSystem::spare;');
  await page.getByRole('button', { name: 'Diagram', exact: true }).click();
  const definition = requirementCard(
    page,
    result,
    'TraceRequirements::MinimumCapacity',
  );
  await definition
    .getByRole('button', {
      name: 'Inspect REQ-CAP TraceRequirements::MinimumCapacity',
      exact: true,
    })
    .click();
  await expect(properties).toContainText(
    'are model content, not evidence that a test has passed.',
  );
  await requirementCard(page, result, 'TraceSystem::LeftPlant::tank').click();
  await expect(properties).toContainText(
    'Related context included by this view',
  );
  await expect(
    properties.getByRole('button', { name: 'Open source', exact: true }),
  ).toBeEnabled();
  await expect(
    properties.getByRole('textbox', { name: 'Name', exact: true }),
  ).toHaveCount(0);
  await expect(
    properties.getByRole('button', {
      name: 'New part in selection',
      exact: true,
    }),
  ).toHaveCount(0);
  await expect(
    properties.getByRole('button', {
      name: 'New view of selection',
      exact: true,
    }),
  ).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: 'New part', exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: 'Connect ports', exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: 'Undo source', exact: true }),
  ).toBeDisabled();
  expect((await downloadProject(page)).bundle).toEqual(before);
  expect(before.documents).toEqual(documents);
  expect(before.drafts).toEqual(documents);
});

test('retains independent requirement and overview positions plus invalid drafts through fresh reopen', async ({
  page,
}) => {
  const evaluations = await observeEvaluations(page);
  await ready(page, { split: false });
  const documents = await importRequirementsTraceability(page);
  const result = await waitForRequirements(page, evaluations);
  const requirement = requirementCard(
    page,
    result,
    'TraceRequirements::leftSpecification::leftCapacity',
  );
  const moved = await moveNode(page, requirement);
  await namedViewButton(page, requirementViews.overview).click();
  await expect
    .poll(() =>
      evaluations.some((item) => item.view === requirementViews.overview),
    )
    .toBe(true);
  const overview = evaluations.findLast(
    (item) => item.view === requirementViews.overview,
  )!;
  expect(overview.artifact?.kind).toBe('tree');
  const identity = requirementSymbol(
    overview,
    'TraceRequirements::rightSpecification',
  );
  await moveNode(page, diagramSymbol(page, identity.symbol));
  await namedViewButton(page, requirementViews.requirements).click();
  await expect.poll(() => nodePosition(requirement)).toEqual(moved);
  await page.getByRole('button', { name: 'Split', exact: true }).click();
  await page
    .getByRole('button', { name: 'requirements.sysml', exact: true })
    .click();
  const source = page.getByRole('textbox', {
    name: 'SysML source',
    exact: true,
  });
  const draft =
    documents.find((doc) => doc.name === 'requirements.sysml')!.text +
    '\n// retain unapplied requirements draft\npart';
  await fillSource(source, draft);
  const saved = await downloadProject(page);
  const positions = semanticPositions(saved.bundle, evaluations);
  expect(saved.bundle.documents).toEqual(documents);
  expect(
    saved.bundle.drafts.find((doc) => doc.name === 'requirements.sysml')?.text,
  ).toBe(draft);
  await page.reload();
  await startExample(page);
  await page.locator('input[type=file]').setInputFiles({
    name: 'requirements.sysml-project.json',
    mimeType: 'application/json',
    buffer: saved.buffer,
  });
  await expect(
    namedViewButton(page, requirementViews.requirements),
  ).toHaveAttribute('aria-current', 'page');
  await page.getByRole('button', { name: 'Split', exact: true }).click();
  await page
    .getByRole('button', { name: 'requirements.sysml', exact: true })
    .click();
  await expect(source).toHaveSource(draft);
  await expectRenderedPositions(
    page,
    saved.bundle,
    requirementViews.requirements,
  );
  await namedViewButton(page, requirementViews.overview).click();
  await expectRenderedPositions(page, saved.bundle, requirementViews.overview);
  const reopened = (await downloadProject(page)).bundle;
  expect(reopened).toEqual(saved.bundle);
  expect(semanticPositions(reopened, evaluations)).toEqual(positions);
  await expect(
    page.getByRole('button', { name: 'Undo source', exact: true }),
  ).toBeDisabled();
});

test('retains the accepted requirement graph and draft after real engine failure and recovers on retry', async ({
  page,
}) => {
  const evaluations = await observeEvaluations(page);
  await ready(page, { split: false });
  const documents = await importRequirementsTraceability(page);
  const result = await waitForRequirements(page, evaluations);
  const card = requirementCard(
    page,
    result,
    'TraceRequirements::rightSpecification::rightCapacity',
  );
  await moveNode(page, card);
  const before = (await downloadProject(page)).bundle;
  await page.getByRole('button', { name: 'Split', exact: true }).click();
  await page
    .getByRole('button', { name: 'requirements.sysml', exact: true })
    .click();
  const source = page.getByRole('textbox', {
    name: 'SysML source',
    exact: true,
  });
  const original = documents.find(
    (doc) => doc.name === 'requirements.sysml',
  )!.text;
  const draft = original + '\n// retry this exact requirements edit\n';
  let failures = 0;
  const asset = '**/vendor/opensysml/sysml-wasm.wasm';
  await page.route(asset, async (route) => {
    failures++;
    await route.fulfill({
      status: 503,
      body: 'Controlled unavailable requirement engine',
    });
  });
  await fillSource(source, draft);
  await page.getByRole('button', { name: 'Apply source', exact: true }).click();
  await expect(
    page.getByRole('region', { name: 'Issues', exact: true }),
  ).toContainText('OpenSysML browser assets are unavailable');
  expect(failures).toBeGreaterThan(0);
  await expect(source).toHaveSource(draft);
  await expect(card).toBeVisible();
  const failed = (await downloadProject(page)).bundle;
  expect(failed.documents).toEqual(before.documents);
  expect(failed.presentations).toEqual(before.presentations);
  expect(
    failed.drafts.find((doc) => doc.name === 'requirements.sysml')?.text,
  ).toBe(draft);
  await page.unroute(asset);
  await page.getByRole('button', { name: 'Apply source', exact: true }).click();
  await expect(page.getByText('Source applied', { exact: true })).toBeVisible();
  await expect(card).toBeVisible();
  const recovered = (await downloadProject(page)).bundle;
  expect(
    recovered.documents.find((doc) => doc.name === 'requirements.sysml')?.text,
  ).toBe(draft);
  expect(recovered.drafts).toEqual(recovered.documents);
  expect(semanticPositions(recovered, evaluations)).toEqual(
    semanticPositions(before, evaluations),
  );
  await page.getByRole('button', { name: 'Undo source', exact: true }).click();
  await expect(source).toHaveSource(original);
  expect((await downloadProject(page)).bundle.documents).toEqual(
    before.documents,
  );
  await page.getByRole('button', { name: 'Redo source', exact: true }).click();
  await expect(source).toHaveSource(draft);
});

test('browses the compressor requirements tree without changing its sources or structural layout', async ({
  page,
}) => {
  await ready(page, { split: false });
  const pump = page.getByRole('group', {
    name: 'part pump : Pump',
    exact: true,
  });
  await moveNode(page, pump);
  const before = (await downloadProject(page)).bundle;
  await namedViewButton(page, 'CompressorViews::requirements').click();
  await expect(
    page.getByRole('region', { name: 'Diagram', exact: true }),
  ).toContainText('Overview tree');
  await expect(
    page.getByRole('button', { name: 'Download project', exact: true }),
  ).toBeEnabled();
  await namedViewButton(page, 'CompressorViews::pneumatics').click();
  await expectRenderedPositions(page, before, 'CompressorViews::pneumatics');
  expect((await downloadProject(page)).bundle).toEqual(before);
  expect(before.documents).toHaveLength(9);
});
