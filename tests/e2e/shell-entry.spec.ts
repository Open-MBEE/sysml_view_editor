import { readFile } from 'node:fs/promises';
import type { Page } from '@playwright/test';
import {
  test,
  expect,
  waitForLauncher,
  waitForStartup,
  openWorkshop,
  downloadProject,
  fillSource,
  readSource,
  copySourceSelection,
  diagramNode,
  openView,
  moveNode,
  panDiagram,
  diagramCamera,
  selectModelElement,
  expectRenderedPositions,
  namedViewButton,
} from './support';

async function chooseFiles(page: Page) {
  const choice = page.waitForEvent('filechooser');
  await page
    .getByRole('button', { name: 'Open files or project', exact: true })
    .click();
  return choice;
}

async function workshopFiles() {
  return Promise.all(
    ['model.sysml', 'views.sysml'].map(async (name) => ({
      name,
      mimeType: 'text/plain',
      buffer: await readFile(
        new URL('../../examples/workshop/' + name, import.meta.url),
      ),
    })),
  );
}

test('opens the OpenMBEE landing and empty launcher without loading an example or model engine', async ({
  page,
}) => {
  const engineRequests: string[] = [];
  page.on('request', (request) => {
    if (/\/vendor\/(opensysml|sysml-toolkit)\//.test(request.url()))
      engineRequests.push(request.url());
  });
  await page.goto('/');
  await expect(page).toHaveTitle(/OpenMBEE View Editor/);
  await expect(
    page.getByRole('heading', {
      name: 'OpenMBEE View Editor',
      exact: true,
      level: 1,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole('link', { name: 'Source', exact: true }),
  ).toHaveAttribute('href', 'https://github.com/Open-MBEE/sysml_view_editor');
  await page.getByRole('link', { name: 'Open app', exact: true }).click();
  await expect(page).toHaveURL(/\/app$/);
  await waitForLauncher(page);
  await expect(
    page.getByRole('heading', { name: 'Open a project', exact: true }),
  ).toBeFocused();
  await expect(
    page.getByRole('button', { name: 'Resume project', exact: true }),
  ).not.toBeVisible();
  await expect(
    page.getByRole('main', { name: 'Model workspace', exact: true }),
  ).not.toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Download project', exact: true }),
  ).not.toBeVisible();
  await expect(
    page.getByRole('button', { name: 'New project', exact: true }),
  ).toBeEnabled();
  await expect(
    page.getByRole('button', { name: 'Open files or project', exact: true }),
  ).toBeEnabled();
  await page
    .getByText('Folder and repository workflows', { exact: true })
    .click();
  await expect(
    page.getByText(
      'Direct folder saving and Flexo project/branch checkout are planned. Use source files or a project bundle to work locally today.',
      { exact: true },
    ),
  ).toBeVisible();
  expect(engineRequests).toEqual([]);
});

test('landing and direct example links open the real model once and reload returns to the empty launcher', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'Try an example', exact: true }).click();
  await waitForStartup(page, { split: false });
  await expect(page).toHaveURL(/\/app$/);
  const bundle = (await downloadProject(page)).bundle;
  expect(bundle.name).toBe('Smart air workshop');
  expect(bundle.documents).toHaveLength(9);
  expect(bundle.drafts).toEqual(bundle.documents);
  await page.reload();
  await waitForLauncher(page);
  await expect(
    page.getByRole('button', { name: 'Resume project', exact: true }),
  ).not.toBeVisible();
  await expect(
    page.getByRole('main', { name: 'Model workspace', exact: true }),
  ).not.toBeVisible();
  // A directly opened example URL uses the same real vendor assets and consumes
  // its one-shot instruction, including when the incoming route has a slash.
  await page.goto('/app/?example=1');
  await waitForStartup(page, { split: false });
  await expect(page).toHaveURL(/\/app$/);
  expect((await downloadProject(page)).bundle.documents).toEqual(
    bundle.documents,
  );
  await page.reload();
  await waitForLauncher(page);
  await expect(
    page.getByRole('button', { name: 'Resume project', exact: true }),
  ).not.toBeVisible();
});

test('creates a new source project from the launcher and returns dialog focus on cancellation', async ({
  page,
}) => {
  await page.goto('/app');
  await waitForLauncher(page);
  const create = page.getByRole('button', { name: 'New project', exact: true });
  await create.focus();
  await create.press('Enter');
  const dialog = page.getByRole('dialog', { name: 'New project', exact: true });
  const name = dialog.getByRole('textbox', {
    name: 'Project name',
    exact: true,
  });
  await expect(name).toBeFocused();
  const close = dialog.getByRole('button', { name: 'Close', exact: true });
  await close.focus();
  await page.keyboard.press('Tab');
  await expect(name).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(close).toBeFocused();
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await expect(create).toBeFocused();
  await expect(
    page.getByRole('button', { name: 'Resume project', exact: true }),
  ).not.toBeVisible();
  await create.click();
  await name.fill('Bench');
  await dialog
    .getByRole('button', { name: 'Create project', exact: true })
    .click();
  await expect(dialog).not.toBeVisible();
  const source = page.getByRole('textbox', {
    name: 'SysML source',
    exact: true,
  });
  await expect(source).toHaveSource('package Bench {\n\n}\n');
  await expect(
    page.getByRole('banner').getByText('Bench · modified', { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Code', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true');
  let replacement = '';
  page.once('dialog', async (confirmation) => {
    replacement = confirmation.message();
    await confirmation.dismiss();
  });
  await create.click();
  await expect
    .poll(() => replacement)
    .toBe(
      'Replace this project and discard changes that have not been downloaded?',
    );
  await expect(dialog).not.toBeVisible();
  await expect(source).toHaveSource('package Bench {\n\n}\n');
  await expect(
    page.getByRole('banner').getByText('Bench · modified', { exact: true }),
  ).toBeVisible();
  const bundle = (await downloadProject(page)).bundle;
  await expect(
    page.getByRole('banner').getByText('Bench', { exact: true }),
  ).toBeVisible();
  await expect(page.getByRole('banner')).not.toContainText('modified');
  expect(bundle.name).toBe('Bench');
  expect(bundle.documents).toEqual([
    { name: 'model.sysml', text: 'package Bench {\n\n}\n' },
  ]);
  expect(bundle.drafts).toEqual(bundle.documents);
  expect(bundle.presentations).toEqual({});
});

test('imports source files through the launcher file chooser without an implicit startup model', async ({
  page,
}) => {
  await page.goto('/app');
  await waitForLauncher(page);
  const files = await workshopFiles();
  const chooser = await chooseFiles(page);
  await chooser.setFiles(files);
  await expect(diagramNode(page, 'Workshop::Motor')).toBeVisible();
  await page.getByRole('button', { name: 'Split', exact: true }).click();
  const source = page.getByRole('textbox', {
    name: 'SysML source',
    exact: true,
  });
  await expect(source).toHaveSource(files[0]!.buffer.toString('utf8'));
  const bundle = (await downloadProject(page)).bundle;
  expect(bundle.documents).toEqual(
    files.map((file) => ({
      name: file.name,
      text: file.buffer.toString('utf8'),
    })),
  );
  expect(bundle.drafts).toEqual(bundle.documents);
  await expect(
    page.getByRole('heading', { name: 'Open a project', exact: true }),
  ).not.toBeVisible();
});

test('launcher and browser navigation retain exact drafts, source DOM, camera, both layouts and accepted source history', async ({
  page,
}) => {
  test.setTimeout(150_000);
  await openWorkshop(page);
  const source = page.getByRole('textbox', {
    name: 'SysML source',
    exact: true,
  });
  const original = await readSource(source);
  const applied = original + '\n// accepted before launcher navigation\n';
  await fillSource(source, applied);
  await page.getByRole('button', { name: 'Apply source', exact: true }).click();
  await expect(page.getByText('Source applied', { exact: true })).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Undo source', exact: true }),
  ).toBeEnabled();
  await moveNode(page, diagramNode(page, 'Workshop::Motor'));
  await openView(page, 'compressor');
  await moveNode(page, diagramNode(page, 'primary : Motor'));
  await selectModelElement(page, 'Workshop::Compressor::primary');
  const before = (await downloadProject(page)).bundle;
  const draft = applied + '\n// retained unfinished launcher draft\npart';
  await fillSource(source, draft);
  const editor = await source.elementHandle();
  await source.press('ControlOrMeta+Home');
  await source.press('Shift+End');
  const selectedSource = await copySourceSelection(source);
  expect(selectedSource).toBe('package Workshop {');
  await panDiagram(page);
  const camera = await diagramCamera(page);
  await expect(page.getByRole('banner')).toContainText('modified');

  await page
    .getByRole('link', { name: 'OpenMBEE View Editor home', exact: true })
    .click();
  await expect(page).toHaveURL(/\/$/);
  await expect(source).not.toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL(/\/app$/);
  await expect(source).toBeVisible();
  await page.goForward();
  await expect(page).toHaveURL(/\/$/);
  await expect(source).not.toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL(/\/app$/);
  await expect(source).toBeVisible();
  await page.getByRole('button', { name: 'Projects', exact: true }).click();
  await waitForLauncher(page);
  await expect(source).not.toBeVisible();
  await page
    .getByRole('button', { name: 'Resume project', exact: true })
    .click();
  await expect(
    page.getByRole('button', { name: 'Projects', exact: true }),
  ).toBeFocused();
  await expect.poll(() => copySourceSelection(source)).toBe(selectedSource);
  expect(
    await source.evaluate((node, previous) => node === previous, editor),
  ).toBe(true);
  await expect(source).toHaveSource(draft);
  await expect(page.getByRole('banner')).toContainText('modified');
  await expect(
    namedViewButton(page, 'WorkshopViews::compressor'),
  ).toHaveAttribute('aria-current', 'page');
  await expect(
    page.getByRole('complementary', { name: 'Properties', exact: true }),
  ).toContainText('Workshop::Compressor::primary');
  expect(await diagramCamera(page)).toEqual(camera);
  const retained = (await downloadProject(page)).bundle;
  expect(retained).toEqual({
    ...before,
    drafts: before.drafts.map((file) =>
      file.name === 'model.sysml' ? { ...file, text: draft } : file,
    ),
  });
  await page
    .getByRole('button', { name: 'Discard draft', exact: true })
    .click();
  for (const view of ['overview', 'compressor']) {
    await openView(page, view);
    await expectRenderedPositions(page, before, 'WorkshopViews::' + view);
  }
  await page.getByRole('button', { name: 'Undo source', exact: true }).click();
  await expect(source).toHaveSource(original);
  await page.getByRole('button', { name: 'Redo source', exact: true }).click();
  await expect(source).toHaveSource(applied);
});

test('cancelled replacement and failed real-engine import keep the current model, invalid draft and saved geometry', async ({
  page,
}) => {
  await openWorkshop(page);
  await moveNode(page, diagramNode(page, 'Workshop::Motor'));
  const before = (await downloadProject(page)).bundle;
  const source = page.getByRole('textbox', {
    name: 'SysML source',
    exact: true,
  });
  const draft = before.documents[0]!.text + '\n// keep current work\npart';
  await fillSource(source, draft);
  await page.getByRole('button', { name: 'Projects', exact: true }).click();
  await waitForLauncher(page);
  let cancelled = '';
  page.once('dialog', async (dialog) => {
    cancelled = dialog.message();
    await dialog.dismiss();
  });
  await page.getByRole('button', { name: 'Load example', exact: true }).click();
  await expect
    .poll(() => cancelled)
    .toBe(
      'Replace this project and discard changes that have not been downloaded?',
    );
  await waitForLauncher(page);
  page.once('dialog', (dialog) => dialog.accept());
  const chooser = await chooseFiles(page);
  await chooser.setFiles({
    name: 'broken.sysml',
    mimeType: 'text/plain',
    buffer: Buffer.from('package Broken { part def'),
  });
  await expect(page.getByRole('alert')).toHaveText(
    'Source has errors; the last applied model is retained.',
  );
  await expect(
    page.getByRole('button', { name: 'Resume project', exact: true }),
  ).toBeEnabled();
  await page
    .getByRole('button', { name: 'Resume project', exact: true })
    .click();
  await expect(source).toHaveSource(draft);
  await expect(diagramNode(page, 'Workshop::Motor')).toBeVisible();
  await expect(page.getByRole('banner')).toContainText('modified');
  expect((await downloadProject(page)).bundle).toEqual({
    ...before,
    drafts: before.drafts.map((file) =>
      file.name === 'model.sysml' ? { ...file, text: draft } : file,
    ),
  });
});

test('rejects an unsupported project bundle in the empty launcher and permits a valid retry', async ({
  page,
}) => {
  await page.goto('/app');
  await waitForLauncher(page);
  const chooser = await chooseFiles(page);
  await chooser.setFiles({
    name: 'future.sysml-project.json',
    mimeType: 'application/json',
    buffer: Buffer.from('{"format":"sysmlv2-view-project","version":99}'),
  });
  await expect(page.getByRole('alert')).toContainText(
    'Select a supported version 1 project',
  );
  await waitForLauncher(page);
  await expect(
    page.getByRole('button', { name: 'Resume project', exact: true }),
  ).not.toBeVisible();
  const retry = await chooseFiles(page);
  const files = await workshopFiles();
  await retry.setFiles(files);
  await expect(diagramNode(page, 'Workshop::Motor')).toBeVisible();
  const bundle = (await downloadProject(page)).bundle;
  expect(bundle.documents).toEqual(
    files.map((file) => ({
      name: file.name,
      text: file.buffer.toString('utf8'),
    })),
  );
  expect(bundle.drafts).toEqual(bundle.documents);
});

test('the diagram view selector keeps source-file choice, pending draft and both saved view layouts independent', async ({
  page,
}) => {
  await openWorkshop(page);
  await moveNode(page, diagramNode(page, 'Workshop::Motor'));
  await openView(page, 'compressor');
  await moveNode(page, diagramNode(page, 'primary : Motor'));
  const before = (await downloadProject(page)).bundle;
  await page.getByRole('button', { name: 'views.sysml', exact: true }).click();
  const source = page.getByRole('textbox', {
    name: 'SysML source',
    exact: true,
  });
  const draft =
    before.documents.find((file) => file.name === 'views.sysml')!.text +
    '\n// independent source draft\npart';
  await fillSource(source, draft);
  const diagram = page.getByRole('region', { name: 'Diagram', exact: true });
  const selector = diagram.getByRole('combobox', {
    name: 'Named view',
    exact: true,
  });
  await expect(selector).toHaveValue('WorkshopViews::compressor');
  for (const [view, representation] of [
    ['overview', 'Overview tree'],
    ['compressor', 'Structure'],
  ] as const) {
    await selector.selectOption('WorkshopViews::' + view);
    await expect(
      namedViewButton(page, 'WorkshopViews::' + view),
    ).toHaveAttribute('aria-current', 'page');
    await expect(
      diagram.getByText(representation, { exact: true }),
    ).toBeVisible();
    await expect(
      diagram.getByText('Applied revision · draft pending', { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'views.sysml', exact: true }),
    ).toHaveAttribute('aria-current', 'page');
    await expect(source).toHaveSource(draft);
    await expectRenderedPositions(page, before, 'WorkshopViews::' + view);
  }
  expect((await downloadProject(page)).bundle).toEqual({
    ...before,
    drafts: before.drafts.map((file) =>
      file.name === 'views.sysml' ? { ...file, text: draft } : file,
    ),
  });
});

test('hidden workbench save shortcuts do not download or mark work saved, while visible save still exports exact work', async ({
  page,
}) => {
  await openWorkshop(page);
  const source = page.getByRole('textbox', {
    name: 'SysML source',
    exact: true,
  });
  const original = await readSource(source);
  const applied =
    original + '\n// accepted history before hidden save shortcuts\n';
  await fillSource(source, applied);
  await page.getByRole('button', { name: 'Apply source', exact: true }).click();
  await expect(page.getByText('Source applied', { exact: true })).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Undo source', exact: true }),
  ).toBeEnabled();
  const before = (await downloadProject(page)).bundle;
  const draft = applied + '\n// retain the dirty hidden draft\npart';
  await fillSource(source, draft);
  await expect(page.getByRole('banner')).toContainText('modified');
  const downloads: string[] = [];
  page.on('download', (download) =>
    downloads.push(download.suggestedFilename()),
  );

  await page.getByRole('button', { name: 'Projects', exact: true }).click();
  await waitForLauncher(page);
  await page.keyboard.press('ControlOrMeta+s');
  await page
    .getByRole('link', { name: 'OpenMBEE View Editor home', exact: true })
    .click();
  await expect(page).toHaveURL(/\/$/);
  await page.keyboard.press('ControlOrMeta+s');
  await page.getByRole('link', { name: 'Open app', exact: true }).click();
  await waitForLauncher(page);
  await page
    .getByRole('button', { name: 'Resume project', exact: true })
    .click();
  await expect(source).toHaveSource(draft);
  // Marking a hidden project saved would remove this real dirty-state outcome,
  // even if the browser's download event had not yet reached the test process.
  await expect(page.getByRole('banner')).toContainText('modified');
  expect(downloads).toEqual([]);

  const exported = page.waitForEvent('download');
  await page.keyboard.press('ControlOrMeta+s');
  const download = await exported;
  expect(download.suggestedFilename()).toBe('Workshop.sysml-project.json');
  const path = await download.path();
  expect(path).not.toBeNull();
  const project = JSON.parse(await readFile(path!, 'utf8'));
  expect(project).toEqual({
    ...before,
    drafts: before.drafts.map((file) =>
      file.name === 'model.sysml' ? { ...file, text: draft } : file,
    ),
  });
  expect(downloads).toEqual(['Workshop.sysml-project.json']);
  await expect(page.getByRole('banner')).not.toContainText('modified');
  await expect(source).toHaveSource(draft);
  await page
    .getByRole('button', { name: 'Discard draft', exact: true })
    .click();
  await expect(
    page.getByRole('button', { name: 'Undo source', exact: true }),
  ).toBeEnabled();
  await page.getByRole('button', { name: 'Undo source', exact: true }).click();
  await expect(source).toHaveSource(original);
  await page.getByRole('button', { name: 'Redo source', exact: true }).click();
  await expect(source).toHaveSource(applied);
});

test('a newer example opening supersedes a held real engine request without publishing its cancellation error', async ({
  page,
}) => {
  await page.goto('/app');
  await waitForLauncher(page);
  let release!: () => void;
  let held = false;
  let requests = 0;
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  const asset = '**/vendor/opensysml/sysml-wasm.wasm';
  await page.route(asset, async (route) => {
    requests++;
    if (!held) {
      held = true;
      await pending;
    }
    await route.continue();
  });
  try {
    await page
      .getByRole('button', { name: 'Load example', exact: true })
      .click();
    await expect.poll(() => held).toBe(true);
    await expect(
      page.getByText('Opening project…', { exact: true }),
    ).toBeVisible();
    await page
      .getByRole('link', { name: 'OpenMBEE View Editor home', exact: true })
      .click();
    await page
      .getByRole('link', { name: 'Try an example', exact: true })
      .click();
    await expect.poll(() => requests).toBeGreaterThan(1);
    release();
    await waitForStartup(page, { split: false });
    await expect(
      page.getByRole('button', { name: /^(Show|Hide) Issues$/ }),
    ).toHaveText('Issues (0)');
    await expect(
      page.getByText('Engine operation cancelled.', { exact: true }),
    ).not.toBeVisible();
    await expect(page.getByRole('alert')).not.toBeVisible();
    const bundle = (await downloadProject(page)).bundle;
    expect(bundle.name).toBe('Smart air workshop');
    expect(bundle.documents).toHaveLength(9);
    for (const document of bundle.documents) {
      expect(document.text).toBe(
        await readFile(
          new URL(
            '../../examples/air-compressor/' + document.name,
            import.meta.url,
          ),
          'utf8',
        ),
      );
    }
    expect(bundle.drafts).toEqual(bundle.documents);
  } finally {
    release();
    await page.unroute(asset);
  }
});
