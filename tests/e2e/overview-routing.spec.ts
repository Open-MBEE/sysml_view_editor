import {
  test,
  expect,
  observeExplorations,
  downloadProject,
  overviewRoutingGeometry,
  copySourceSelection,
} from './support';
import { assemblyExploration } from './exploration-support';
import nativeArtifact from '../fixtures/exploration-assembly-artifact.json' with { type: 'json' };

test('routes the real assembly overview clear of cards and labels while preserving declarations and structural connections', async ({
  page,
}) => {
  const results = await observeExplorations(page);
  const documents = await assemblyExploration(page);
  await expect.poll(() => results.length).toBe(1);
  expect(results[0]!.artifact).toEqual(nativeArtifact);
  await page.getByRole('button', { name: 'Diagram', exact: true }).click();
  const before = (await downloadProject(page)).bundle;
  expect(before.documents).toEqual(documents);
  await page.getByRole('button', { name: 'Fit view', exact: true }).click();
  await expect
    .poll(async () => {
      const geometry = await overviewRoutingGeometry(page);
      return { hits: geometry.hits, count: geometry.labelCount };
    })
    .toEqual({ hits: [], count: 6 });
  const expected: Record<string, string> = {
    input: 'in port input : Signal;',
    output: 'out port output : Signal;',
    service: 'inout port service : Signal;',
    monitor: 'ref part monitor : Device;',
    primary: 'part primary : Device;',
    standby: 'part standby : Device;',
  };
  for (const edge of results[0]!.artifact!.edges) {
    const relation = page.getByRole('group', {
      name: new RegExp(`^${edge.kind} ${edge.label}:`),
    });
    await relation.focus();
    await relation.press('Enter');
    await expect(relation).toBeFocused();
    await expect(
      page.getByRole('button', { name: 'Apply source', exact: true }),
    ).toBeDisabled();
    await page
      .getByRole('complementary', { name: 'Properties', exact: true })
      .getByRole('button', { name: 'Open source', exact: true })
      .click();
    await expect
      .poll(() =>
        copySourceSelection(
          page.getByRole('textbox', { name: 'SysML source', exact: true }),
        ),
      )
      .toBe(expected[edge.label!]);
  }
  expect((await downloadProject(page)).bundle).toEqual(before);
  const scope = page.getByRole('combobox', {
    name: 'Exploration scope',
    exact: true,
  });
  await scope.selectOption('Assembly::Station');
  await expect(scope).toBeEnabled();
  const representation = page.getByRole('combobox', {
    name: 'Exploration representation',
    exact: true,
  });
  await representation.selectOption('interconnection');
  await expect(representation).toBeEnabled();
  await expect(
    page.getByRole('group', { name: 'part primary : Device', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('group', { name: /connection handoff:/ }),
  ).toBeVisible();
  expect((await downloadProject(page)).bundle).toEqual(before);
});
