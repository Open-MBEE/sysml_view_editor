import { readFile } from 'node:fs/promises';
import {
  test,
  expect,
  waitForRoverStartup,
  observeEvaluations,
  downloadProject,
  namedViewButton,
  diagramSymbol,
  moveNode,
  expectRenderedPositions,
  copySourceSelection,
  overviewRoutingGeometry,
} from './support';

async function rover(page: import('@playwright/test').Page) {
  await page.goto('/app');
  await page.getByRole('button', { name: 'Load example', exact: true }).click();
  await waitForRoverStartup(page);
}

test('@critical opens the inspection rover with inherited declared values and exact connections, preserving all six files across its guided tour', async ({
  page,
}) => {
  const results = await observeEvaluations(page);
  await rover(page);
  const architecture = results.findLast(
    (v) => v.view === 'RoverViews::architecture',
  )!;
  expect(architecture.status).toBe('complete');
  expect(architecture.artifact!.nodes.map((n) => n.name)).toEqual([
    'RoverSystem::InspectionRover',
    'energy',
    'battery',
    'distribution',
    'mobility',
    'leftDrive',
    'rightDrive',
    'autonomy',
    'controller',
    'lidar',
    'inspection',
    'camera',
    'radio',
  ]);
  expect(architecture.artifact!.edges.map((e) => e.label).sort()).toEqual(
    [
      'batterySupply',
      'obstacleScan',
      'leftPower',
      'rightPower',
      'computePower',
      'cameraPower',
      'leftCommand',
      'rightCommand',
      'inspectionImages',
      'missionTelemetry',
    ].sort(),
  );
  const battery = architecture.artifact!.nodes.find(
    (n) => n.name === 'battery',
  )!;
  expect(battery.attributeDeclarations).toEqual([
    'attribute capacityWh : Real default = 480.0;',
    'attribute reservePercent : Real default = 20.0;',
  ]);
  await expect(
    diagramSymbol(page, battery.id).getByText(
      'capacityWh : Real default = 480.0',
      {
        exact: true,
      },
    ),
  ).toBeVisible();
  expect(
    battery.sourceAttributes?.find((row) => row.name === 'capacityWh')?.value,
  ).toMatchObject({
    status: 'available',
    expression: '480.0',
    isDefault: true,
  });
  await page.getByRole('button', { name: 'Fit view', exact: true }).click();
  await expect
    .poll(
      async () =>
        (await overviewRoutingGeometry(page, [], architecture.artifact)).hits,
      {
        timeout: 3000,
      },
    )
    .toEqual([]);
  await expect
    .poll(
      async () =>
        (await overviewRoutingGeometry(page, [], architecture.artifact))
          .labelCount,
    )
    .toBe(10);
  const saved = await downloadProject(page);
  expect(saved.bundle.documents).toHaveLength(6);
  for (const file of saved.bundle.documents)
    expect(file.text).toBe(
      await readFile(
        new URL(
          '../../examples/inspection-rover/' + file.name,
          import.meta.url,
        ),
        'utf8',
      ),
    );
  expect(saved.bundle.drafts).toEqual(saved.bundle.documents);
  for (const [view, kind] of [
    ['mission', 'action'],
    ['lifecycle', 'state'],
    ['requirements', 'requirement'],
    ['definitions', 'definition'],
  ]) {
    await namedViewButton(page, 'RoverViews::' + view).click();
    await expect(namedViewButton(page, 'RoverViews::' + view)).toHaveAttribute(
      'aria-current',
      'page',
    );
    await expect
      .poll(
        () =>
          results.findLast((v) => v.view === 'RoverViews::' + view)?.artifact
            ?.kind,
      )
      .toBe(kind);
    await expect(
      page.getByRole('heading', { name: 'Rendering unavailable', exact: true }),
    ).not.toBeVisible();
    const first = results.findLast((v) => v.view === 'RoverViews::' + view)!
      .artifact!.nodes[0]!;
    if (first.sourceAttributes?.length) {
      await expect(
        diagramSymbol(page, first.id).getByTitle(
          first.name + (first.type ? ' : ' + first.type : ''),
          { exact: true },
        ),
      ).toBeVisible();
    } else
      await expect(diagramSymbol(page, first.id)).toContainText(first.name);
  }
  const requirements = results.findLast(
    (v) => v.view === 'RoverViews::requirements',
  )!;
  expect(
    requirements.artifact!.edges.filter((e) => e.kind === 'satisfy'),
  ).toHaveLength(4);
  expect((await downloadProject(page)).bundle).toEqual(saved.bundle);
});

for (const [view, target, declaration] of [
  ['mission', 'patrol', 'action patrol;'],
  ['lifecycle', 'safeStop', 'state safeStop;'],
]) {
  test(`preserves ${view} source selection and independently arranged geometry after portable reopen`, async ({
    page,
  }) => {
    const results = await observeEvaluations(page);
    await rover(page);
    await namedViewButton(page, 'RoverViews::' + view).click();
    await expect
      .poll(
        () => results.findLast((v) => v.view === 'RoverViews::' + view)?.status,
      )
      .toBe('complete');
    const result = results.findLast((v) => v.view === 'RoverViews::' + view)!;
    const node = result.artifact!.nodes.find((n) => n.name === target)!;
    const unlabelled = result.artifact!.edges.flatMap((edge, index) =>
      edge.label ? [] : [`edge:${index}`],
    );
    const symbol = diagramSymbol(page, node.id);
    await expect(symbol).toBeVisible();
    await expect
      .poll(
        async () => (await overviewRoutingGeometry(page, unlabelled)).hits,
        {
          timeout: 3000,
        },
      )
      .toEqual([]);
    await expect
      .poll(
        async () =>
          (await overviewRoutingGeometry(page, unlabelled)).labelCount,
      )
      .toBe(result.artifact!.edges.filter((edge) => edge.label).length);
    await symbol.focus();
    await symbol.press('Enter');
    await page
      .getByRole('complementary', { name: 'Properties', exact: true })
      .getByRole('button', { name: 'Open source', exact: true })
      .click();
    const source = page.getByRole('textbox', {
      name: 'SysML source',
      exact: true,
    });
    await expect.poll(() => copySourceSelection(source)).toBe(declaration);
    await expect(
      page.getByRole('button', { name: 'Apply source', exact: true }),
    ).toBeDisabled();
    const before = (await downloadProject(page)).bundle;
    const edgeName =
      view === 'mission'
        ? 'succession : RoverBehavior::InspectRoute.patrol to RoverBehavior::InspectRoute.detectObstacle'
        : 'transition pathClear: RoverBehavior::OperatingMode.safeStop to RoverBehavior::OperatingMode.patrolling';
    const edge = page.getByRole('group', { name: edgeName, exact: true });
    await edge.focus();
    await edge.press('Enter');
    await expect(edge).toBeFocused();
    await page
      .getByRole('complementary', { name: 'Properties', exact: true })
      .getByRole('button', { name: 'Open source', exact: true })
      .click();
    await expect
      .poll(() => copySourceSelection(source))
      .toBe(
        view === 'mission'
          ? 'succession first patrol then detectObstacle;'
          : 'transition pathClear first safeStop then patrolling;',
      );
    expect((await downloadProject(page)).bundle).toEqual(before);
    await page.getByRole('button', { name: 'Diagram', exact: true }).click();
    await moveNode(page, symbol);
    const saved = await downloadProject(page);
    expect(saved.bundle.presentations['RoverViews::' + view]).toBeDefined();
    await page.reload();
    await page
      .getByRole('button', { name: 'Load example', exact: true })
      .click();
    await waitForRoverStartup(page);
    await page.locator('input[type=file]').setInputFiles({
      name: 'rover.sysml-project.json',
      mimeType: 'application/json',
      buffer: saved.buffer,
    });
    await namedViewButton(page, 'RoverViews::' + view).click();
    await expectRenderedPositions(page, saved.bundle, 'RoverViews::' + view);
    expect((await downloadProject(page)).bundle).toEqual(saved.bundle);
  });
}

test('keeps structural routes with a moved rover assembly and retains exact source, endpoints and positions after reopen', async ({
  page,
}) => {
  const results = await observeEvaluations(page);
  await rover(page);
  const architecture = results.findLast(
    (result) => result.view === 'RoverViews::architecture',
  )!;
  const before = (await downloadProject(page)).bundle;
  await moveNode(
    page,
    diagramSymbol(page, architecture.artifact!.nodes[0]!.id),
  );
  await expect
    .poll(
      async () =>
        (await overviewRoutingGeometry(page, [], architecture.artifact)).hits,
    )
    .toEqual([]);
  const saved = await downloadProject(page);
  expect(saved.bundle.documents).toEqual(before.documents);
  expect(saved.bundle.drafts).toEqual(before.drafts);
  expect(saved.bundle.presentations['RoverViews::architecture']).toBeDefined();
  await page.reload();
  await page.getByRole('button', { name: 'Load example', exact: true }).click();
  await waitForRoverStartup(page);
  await page.locator('input[type=file]').setInputFiles({
    name: 'rover.sysml-project.json',
    mimeType: 'application/json',
    buffer: saved.buffer,
  });
  await expectRenderedPositions(page, saved.bundle, 'RoverViews::architecture');
  await expect
    .poll(
      async () =>
        (await overviewRoutingGeometry(page, [], architecture.artifact)).hits,
    )
    .toEqual([]);
  expect((await downloadProject(page)).bundle).toEqual(saved.bundle);
});
