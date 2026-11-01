import {
  test,
  expect,
  openWorkshop,
  fillSource,
  copySourceSelection,
  downloadProject,
  openView,
  moveNode,
  diagramNode,
  diagramCamera,
  observeEvaluations,
  semanticPositions,
  selectModelElement,
  panDiagram,
  startExample,
} from './support';

test('opens a real diagnostic in the correct file by pointer and keyboard while retaining drafts and saved views', async ({
  page,
}) => {
  const evaluations = await observeEvaluations(page);
  await openWorkshop(page);
  for (const view of ['overview', 'compressor']) {
    await openView(page, view);
    await moveNode(
      page,
      diagramNode(
        page,
        view === 'overview' ? 'Workshop::Motor' : 'primary : Motor',
      ),
    );
  }
  const source = page.getByRole('textbox', {
    name: 'SysML source',
    exact: true,
  });
  const before = (await downloadProject(page)).bundle;
  const original = before.documents.find(
    (file) => file.name === 'model.sysml',
  )!.text;
  const draft = original.replace(
    'part def Motor;',
    'part def Motor :> Missing;',
  );
  expect(draft).not.toBe(original);
  await fillSource(source, draft);
  await page.getByRole('button', { name: 'Apply source', exact: true }).click();
  const issues = page.getByRole('region', { name: 'Issues', exact: true });
  await expect(issues).toContainText('Missing');
  const link = issues
    .getByRole('button', { name: /Open model.sysml at line/ })
    .first();
  await expect(link).toBeVisible();
  const failed = (await downloadProject(page)).bundle;
  expect(failed.documents).toEqual(before.documents);
  expect(failed.presentations).toEqual(before.presentations);
  await page.getByRole('button', { name: 'views.sysml', exact: true }).click();
  await panDiagram(page);
  const camera = await diagramCamera(page);
  await link.click();
  await expect(source).toBeFocused();
  expect(await copySourceSelection(source)).toContain(
    'part def Motor :> Missing;',
  );
  expect(await diagramCamera(page)).toEqual(camera);
  await page.getByRole('button', { name: 'views.sysml', exact: true }).click();
  await link.focus();
  await page.keyboard.press('Enter');
  await expect(source).toBeFocused();
  expect(await copySourceSelection(source)).toContain(
    'part def Motor :> Missing;',
  );
  expect((await downloadProject(page)).bundle).toEqual(failed);
  await fillSource(source, original + '\n// diagnostic corrected\n');
  await expect(
    issues.getByRole('button', { name: /Open model.sysml/ }),
  ).toHaveCount(0);
  await page.getByRole('button', { name: 'Apply source', exact: true }).click();
  await expect(page.getByText('Source applied', { exact: true })).toBeVisible();
  const saved = await downloadProject(page);
  expect(saved.bundle.documents[0]!.text).toBe(
    original + '\n// diagnostic corrected\n',
  );
  expect(semanticPositions(saved.bundle, evaluations)).toEqual(
    semanticPositions(before, evaluations),
  );
  await page.getByRole('button', { name: 'Undo source', exact: true }).click();
  await expect(source).toHaveSource(original);
  await page.getByRole('button', { name: 'Redo source', exact: true }).click();
  await expect(source).toHaveSource(saved.bundle.documents[0]!.text);
  await page.reload();
  await startExample(page);
  await page.locator('input[type=file]').setInputFiles({
    name: 'diagnostics.sysml-project.json',
    mimeType: 'application/json',
    buffer: saved.buffer,
  });
  await expect(source).toHaveSource(saved.bundle.documents[0]!.text);
  expect((await downloadProject(page)).bundle).toEqual(saved.bundle);
});

/** Controlled normalized responses cover location policy; the first test uses real diagnostics. */
async function controlledDiagnostics(page: import('@playwright/test').Page) {
  await page.addInitScript(() => {
    const host = window as typeof window & { diagnosticFault?: string };
    const NativeWorker = window.Worker;
    window.Worker = class extends NativeWorker {
      constructor(url: string | URL, options?: WorkerOptions) {
        super(url, options);
        this.addEventListener('message', (event: MessageEvent) => {
          if (
            !host.diagnosticFault ||
            !Array.isArray(event.data?.value?.elements)
          )
            return;
          const mode = host.diagnosticFault;
          const diagnostic = {
            severity: 'error',
            message: 'Controlled location: ' + mode,
            ...(mode === 'missing-file'
              ? {}
              : {
                  file:
                    mode === 'unknown-file' ? 'outside.sysml' : 'model.sysml',
                }),
            ...(mode === 'file-only'
              ? {}
              : { line: mode === 'outside-line' ? 999 : 3 }),
          };
          Object.defineProperty(event, 'data', {
            value: {
              value: { ...event.data.value, diagnostics: [diagnostic] },
            },
          });
        });
      }
    };
  });
}

test('explains missing, unknown and out-of-range locations without changing source or applied geometry', async ({
  page,
}) => {
  await controlledDiagnostics(page);
  await openWorkshop(page);
  const before = (await downloadProject(page)).bundle;
  const source = page.getByRole('textbox', {
    name: 'SysML source',
    exact: true,
  });
  for (const [mode, reason] of [
    ['missing-file', 'No source file'],
    ['unknown-file', 'not in the current project'],
    ['outside-line', 'outside this source file'],
  ]) {
    await page.evaluate((mode) => {
      (window as typeof window & { diagnosticFault?: string }).diagnosticFault =
        mode;
    }, mode!);
    const draft = before.documents[0]!.text + '\n// ' + mode;
    await fillSource(source, draft);
    await page
      .getByRole('button', { name: 'Apply source', exact: true })
      .click();
    const issues = page.getByRole('region', { name: 'Issues', exact: true });
    await expect(issues).toContainText(reason!);
    await expect(
      issues.getByRole('button', { name: /Open .*sysml/ }),
    ).toHaveCount(0);
    await expect(source).toHaveSource(draft);
    const saved = (await downloadProject(page)).bundle;
    expect(saved.documents).toEqual(before.documents);
    expect(saved.presentations).toEqual(before.presentations);
  }
});

test('opens a file-only issue without selecting unrelated text', async ({
  page,
}) => {
  await controlledDiagnostics(page);
  await openWorkshop(page);
  const before = (await downloadProject(page)).bundle;
  await page.evaluate(() => {
    (window as typeof window & { diagnosticFault?: string }).diagnosticFault =
      'file-only';
  });
  const source = page.getByRole('textbox', {
    name: 'SysML source',
    exact: true,
  });
  const draft = before.documents[0]!.text + '\n// file-only';
  await fillSource(source, draft);
  await page.getByRole('button', { name: 'Apply source', exact: true }).click();
  const issues = page.getByRole('region', { name: 'Issues', exact: true });
  await expect(issues).toContainText('No line was reported');
  await page.getByRole('button', { name: 'views.sysml', exact: true }).click();
  await issues
    .getByRole('button', { name: 'Open model.sysml', exact: true })
    .click();
  await expect(source).toBeFocused();
  await page.keyboard.insertText('// beginning\n');
  await expect(source).toHaveSource('// beginning\n' + draft);
  expect((await downloadProject(page)).bundle.documents).toEqual(
    before.documents,
  );
});

test('refuses navigation into a rejected semantic candidate that differs from the live draft', async ({
  page,
}) => {
  await controlledDiagnostics(page);
  await openWorkshop(page);
  const before = (await downloadProject(page)).bundle;
  await page.evaluate(() => {
    (window as typeof window & { diagnosticFault?: string }).diagnosticFault =
      'candidate';
  });
  await selectModelElement(page, 'Workshop::Motor');
  await page.getByRole('textbox', { name: 'Name', exact: true }).fill('Drive');
  await page
    .getByRole('button', { name: 'Review rename', exact: true })
    .click();
  const issues = page.getByRole('region', { name: 'Issues', exact: true });
  await expect(issues).toContainText('different source snapshot');
  await expect(
    issues.getByRole('button', { name: /Open .*sysml/ }),
  ).toHaveCount(0);
  await expect(
    page.getByRole('textbox', { name: 'SysML source', exact: true }),
  ).toHaveSource(before.documents[0]!.text);
  expect((await downloadProject(page)).bundle).toEqual(before);
});
