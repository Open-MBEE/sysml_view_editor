import {
  test,
  expect,
  waitForRoverStartup,
  observeExplorations,
  downloadProject,
  activeWorkspaceTab,
} from './support';

test('rover project overview accepts exact correspondence and preserves all project sources', async ({
  page,
}, testInfo) => {
  const results = await observeExplorations(page);
  await page.goto('/app');
  await page.getByRole('button', { name: 'Load example', exact: true }).click();
  await waitForRoverStartup(page);
  const before = (await downloadProject(page)).bundle;
  await page
    .getByRole('button', { name: 'Project overview', exact: true })
    .click();
  await expect.poll(() => results.length).toBeGreaterThan(0);
  await testInfo.attach('exploration-response', {
    body: JSON.stringify(results.at(-1), null, 2),
    contentType: 'application/json',
  });
  await expect(activeWorkspaceTab(page)).toHaveText('Project overview');
  await expect(
    page.getByRole('group', {
      name: 'Current exploration scope',
      exact: true,
    }),
  ).toContainText('Project overview');
  const overview = results.at(-1)!;
  expect(overview.status).toBe('complete');
  expect(overview.selected.map((item) => item.qualifiedName).sort()).toEqual([
    'RoverBehavior',
    'RoverComponents',
    'RoverReport',
    'RoverRequirements',
    'RoverSystem',
    'RoverTypes',
    'RoverViews',
  ]);
  expect(overview.artifact?.nodes).toHaveLength(194);
  expect(overview.artifact?.edges).toHaveLength(134);
  expect(overview.diagnostics).toContain(
    'Exploration omitted 8 relationships without exact source locations.',
  );
  await expect(
    page.getByRole('status').filter({ hasText: overview.diagnostics[0] }),
  ).toBeVisible();
  for (const item of overview.correspondence) {
    expect(item.subject.origin).toBeDefined();
  }
  expect((await downloadProject(page)).bundle).toEqual(before);
});
