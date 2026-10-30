import {
  test,
  waitForStartup,
  expect,
  ready,
  importAssembly,
  showAssemblyDiagram,
  openView,
  downloadProject,
  moveNode,
  nodePosition,
  connectionPoints,
  portAnchor,
} from './support';

test('renders nested ownership, reference notation and real port endpoints', async ({
  page,
}) => {
  await ready(page);
  await importAssembly(page);
  await showAssemblyDiagram(page);
  const station = page.getByRole('group', {
    name: 'part def Assembly::Station',
    exact: true,
  });
  const bay = page.getByRole('group', { name: 'part bay', exact: true });
  const primary = page.getByRole('group', {
    name: 'part primary : Device',
    exact: true,
  });
  const standby = page.getByRole('group', {
    name: 'part standby : Device',
    exact: true,
  });
  const monitor = page.getByRole('group', {
    name: 'ref part monitor : Device',
    exact: true,
  });
  await expect(monitor).toHaveCSS('border-top-style', 'dashed');
  for (const [owner, child] of [
    [station, bay],
    [bay, primary],
    [bay, standby],
    [station, monitor],
  ]) {
    const parentBox = await owner!.boundingBox();
    const box = await child!.boundingBox();
    expect(box!.x).toBeGreaterThan(parentBox!.x);
    expect(box!.y).toBeGreaterThan(parentBox!.y);
    expect(box!.x + box!.width).toBeLessThan(parentBox!.x + parentBox!.width);
    expect(box!.y + box!.height).toBeLessThan(parentBox!.y + parentBox!.height);
  }
  const output = primary.getByRole('button', {
    name: 'out port output : Signal',
    exact: true,
  });
  const input = standby.getByRole('button', {
    name: 'in port input : Signal',
    exact: true,
  });
  await expect(
    primary.getByRole('button', {
      name: 'inout port service : Signal',
      exact: true,
    }),
  ).toBeVisible();
  await expect.poll(async () => (await connectionPoints(page)).length).toBe(1);
  const [connection] = await connectionPoints(page);
  const from = await portAnchor(output, 'source');
  const to = await portAnchor(input, 'target');
  expect(connection!.start.x).toBeCloseTo(from.x, 0);
  expect(connection!.start.y).toBeCloseTo(from.y, 0);
  expect(connection!.end.x).toBeCloseTo(to.x, 0);
  expect(connection!.end.y).toBeCloseTo(to.y, 0);
});

test('selects inherited ports by keyboard and distinguishes their usage contexts', async ({
  page,
}) => {
  await ready(page);
  await importAssembly(page);
  const properties = page.getByRole('complementary', { name: 'Properties' });
  for (const usage of ['primary', 'standby']) {
    const node = page.getByRole('group', {
      name: `part ${usage} : Device`,
      exact: true,
    });
    const port = node.getByRole('button', {
      name: 'out port output : Signal',
      exact: true,
    });
    await port.focus();
    await page.keyboard.press('Enter');
    await expect(
      properties.getByText('Assembly::Device::output', { exact: true }),
    ).toBeVisible();
    await expect(
      properties.getByText(
        `Assembly::Station › Assembly::Station::bay › Assembly::Station::bay::${usage}`,
        { exact: true },
      ),
    ).toBeVisible();
    await properties
      .getByRole('button', { name: 'Open source', exact: true })
      .click();
    const source = page.getByRole('textbox', { name: 'SysML source' });
    await expect(source).toBeFocused();
    expect(
      await source.evaluate((element: HTMLTextAreaElement) =>
        element.value.slice(element.selectionStart, element.selectionEnd),
      ),
    ).toContain('port output : Signal');
  }
});

test('moves an assembly with its descendants and reopens absolute positions without source edits', async ({
  page,
}) => {
  await ready(page);
  const documents = await importAssembly(page);
  await showAssemblyDiagram(page);
  const station = page.getByRole('group', {
    name: 'part def Assembly::Station',
    exact: true,
  });
  const primary = page.getByRole('group', {
    name: 'part primary : Device',
    exact: true,
  });
  const stationBefore = await nodePosition(station);
  const childBefore = await nodePosition(primary);
  const stationAfter = await moveNode(page, station);
  let childAfter = await nodePosition(primary);
  expect(childAfter.x - childBefore.x).toBeCloseTo(
    stationAfter.x - stationBefore.x,
    1,
  );
  expect(childAfter.y - childBefore.y).toBeCloseTo(
    stationAfter.y - stationBefore.y,
    1,
  );
  childAfter = await moveNode(page, primary);
  const { buffer, bundle } = await downloadProject(page);
  expect(bundle.documents).toEqual(documents);
  expect(bundle.drafts).toEqual(documents);
  await expect(
    page.getByRole('button', { name: 'Undo source', exact: true }),
  ).toBeDisabled();
  await openView(page, 'devices');
  await expect(primary).toBeVisible();
  await expect(
    page.getByRole('region', { name: 'Diagram', exact: true }),
  ).toContainText('not shown');
  await openView(page, 'structure');
  await expect.poll(() => nodePosition(primary)).toEqual(childAfter);
  await page.reload();
  await waitForStartup(page);
  await page.locator('input[type=file]').setInputFiles({
    name: 'assembly.sysml-project.json',
    mimeType: 'application/json',
    buffer,
  });
  await expect(station).toBeVisible();
  await expect.poll(() => nodePosition(station)).toEqual(stationAfter);
  await expect.poll(() => nodePosition(primary)).toEqual(childAfter);
  const reopened = (await downloadProject(page)).bundle;
  expect(reopened.documents).toEqual(documents);
  expect(reopened.presentations).toEqual(bundle.presentations);
});
