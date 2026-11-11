import {
  test,
  expect,
  fillSource,
  downloadProject,
  waitForLauncher,
} from './support';

const failing =
  'package P { part def C; requirement def R { subject c : C; } }';
const passing = 'package P { part def Motor; part m : Motor; }';
const explorationError =
  'Exploration source correspondence is outside the applied project.';

test('accepted recovery exploration errors survive current failures and clear after successful exploration', async ({
  page,
}) => {
  await page.goto('/app');
  await waitForLauncher(page);
  const documents = [{ name: 'model.sysml', text: failing }];
  await page.locator('input[type=file]').setInputFiles({
    name: 'issue14.sysml-project.json',
    mimeType: 'application/json',
    buffer: Buffer.from(
      JSON.stringify({
        format: 'sysmlv2-view-project',
        version: 1,
        name: 'Issue 14',
        documents,
        drafts: documents,
        presentations: {},
      }),
    ),
  });
  const source = page.getByRole('textbox', {
    name: 'SysML source',
    exact: true,
  });
  const alerts = page.getByRole('alert').filter({ hasText: explorationError });
  await expect(alerts.first()).toBeVisible();
  // Persist through the real recovery writer, then replay through the real restore UI.
  const saved = failing + '\n// recover this exact accepted source\n';
  await fillSource(source, saved);
  await page.getByRole('button', { name: 'Apply source', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Apply source', exact: true }),
  ).toBeDisabled();
  await expect(alerts.first()).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(
        async () =>
          new Promise<string | undefined>((resolve, reject) => {
            const request = indexedDB.open('sysml-view-recovery', 1);
            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
              const database = request.result;
              const transaction = database.transaction('recovery', 'readonly');
              const read = transaction.objectStore('recovery').get('latest');
              read.onsuccess = () =>
                resolve(
                  read.result
                    ? JSON.parse(JSON.parse(read.result).project).documents[0]
                        .text
                    : undefined,
                );
              read.onerror = () => reject(read.error);
              transaction.oncomplete = () => database.close();
            };
          }),
      ),
    )
    .toBe(saved);
  page.on('dialog', (dialog) => dialog.accept());
  await page.reload();
  await waitForLauncher(page);
  await page
    .getByRole('region', { name: 'Saved recovery', exact: true })
    .getByRole('button', { name: 'Restore recovery', exact: true })
    .click();
  await expect(source).toHaveSource(saved);
  await expect(alerts.first()).toBeVisible();
  const issues = page.getByRole('region', { name: 'Issues', exact: true });
  await expect(
    issues.getByRole('alert').filter({ hasText: explorationError }),
  ).toBeVisible();
  await expect(
    page.getByRole('region', { name: 'Saved recovery', exact: true }),
  ).not.toBeVisible();
  await expect(issues.getByRole('listitem')).toHaveCount(0);
  expect((await downloadProject(page)).bundle.documents).toEqual([
    { name: 'model.sysml', text: saved },
  ]);

  // A new parse-clean revision with the same construct must still report its current failure.
  const stillFailing = saved + '// another accepted revision\n';
  await fillSource(source, stillFailing);
  await page.getByRole('button', { name: 'Apply source', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Apply source', exact: true }),
  ).toBeDisabled();
  await expect(alerts.first()).toBeVisible();
  await expect(source).toHaveSource(stillFailing);
  await expect(issues.getByRole('listitem')).toHaveCount(0);

  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 });
    for (const theme of ['light', 'dark']) {
      await page
        .getByRole('button', { name: 'Appearance', exact: true })
        .click();
      const appearance = page.getByRole('dialog', {
        name: 'Appearance',
        exact: true,
      });
      await appearance.getByLabel('Theme', { exact: true }).selectOption(theme);
      await appearance
        .getByRole('button', { name: 'Done', exact: true })
        .click();
      await expect(alerts.first()).toBeVisible();
      await page.screenshot({
        path: `sandbox/issue14-implementation/current-error-${width}-${theme}.png`,
      });
    }
  }
  await page.setViewportSize({ width: 1440, height: 900 });

  await fillSource(source, passing);
  await page.getByRole('button', { name: 'Apply source', exact: true }).click();
  // Successful exploration, not a zero diagnostic count, establishes supersession.
  await expect(
    page.getByRole('group', { name: 'part def Motor', exact: true }),
  ).toBeVisible();
  await expect(source).toHaveSource(passing);
  await expect(alerts).toHaveCount(0);
  expect((await downloadProject(page)).bundle.documents).toEqual([
    { name: 'model.sysml', text: passing },
  ]);
});
