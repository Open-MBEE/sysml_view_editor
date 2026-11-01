import type { Page, Locator } from '@playwright/test';
import {
  test,
  expect,
  openWorkshop,
  downloadProject,
  copySourceSelection,
  fillSource,
  diagramNode,
} from './support';

/** Use the actual editor's find command, including virtualized source. */
async function selectWord(page: Page, source: Locator, word: string) {
  await source.press('ControlOrMeta+Home');
  await source.press('ControlOrMeta+f');
  const find = page
    .getByRole('region', { name: 'Source editor', exact: true })
    .getByRole('textbox', { name: 'Find', exact: true });
  await find.fill('');
  // CodeMirror commits search on keyup/change, rather than the input event from fill().
  await find.pressSequentially(word);
  await find.press('Enter');
  await find.press('Escape');
  await expect(source).toBeFocused();
  await expect.poll(() => copySourceSelection(source)).toBe(word);
}

/** CRLF and an astral character before the definition exercise raw UTF-16 ranges. */
async function languageProject(page: Page) {
  await openWorkshop(page);
  const original = (await downloadProject(page)).bundle;
  const documents = original.documents.map((file) => ({
    ...file,
    text: (file.name === 'model.sysml'
      ? file.text.replace(
          'part def Motor;',
          '/* 🔧 café */ part def Motor { doc /* Shared drive. */ }',
        )
      : file.text.replace('expose Workshop::*;', 'expose Workshop::Motor;')
    ).replaceAll('\n', '\r\n'),
  }));
  await page.locator('input[type=file]').setInputFiles({
    name: 'language.sysml-project.json',
    mimeType: 'application/json',
    buffer: Buffer.from(
      JSON.stringify({
        ...original,
        documents,
        drafts: documents,
        presentations: {},
      }),
    ),
  });
  await expect(diagramNode(page, 'Workshop::Motor')).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Download project', exact: true }),
  ).toBeEnabled();
  return (await downloadProject(page)).bundle;
}

test('uses real Toolkit symbol information and project-only cross-file definition without changing the project', async ({
  page,
}) => {
  const before = await languageProject(page);
  await page.getByRole('button', { name: 'views.sysml', exact: true }).click();
  const source = page.getByRole('textbox', {
    name: 'SysML source',
    exact: true,
  });
  await selectWord(page, source, 'Motor');
  await source.press('ArrowRight');
  await source.press('ArrowLeft');
  await source.press('F1');
  const information = page.getByRole('tooltip', {
    name: 'Symbol information',
    exact: true,
  });
  await expect(information).toContainText('Workshop::Motor');
  await expect(information).toContainText('Shared drive.');
  await source.press('Escape');
  await expect(information).not.toBeVisible();
  await source.press('F12');
  await expect.poll(() => copySourceSelection(source)).toBe('Motor');
  // The target declaration is in model.sysml after an astral character and CRLF.
  // Copying the actual selected range detects byte/code-point offset mistakes.
  await expect(source).toHaveSource(
    before.documents
      .find((file) => file.name === 'model.sysml')!
      .text.replaceAll('\r\n', '\n'),
  );
  expect((await downloadProject(page)).bundle).toEqual(before);
});

test('completes a real Toolkit project symbol as a draft, then applies through the real semantic engines', async ({
  page,
}) => {
  const before = await languageProject(page);
  const views = before.documents.find(
    (file) => file.name === 'views.sysml',
  )!.text;
  await page.getByRole('button', { name: 'views.sysml', exact: true }).click();
  const source = page.getByRole('textbox', {
    name: 'SysML source',
    exact: true,
  });
  const incomplete = views.replace('Workshop::Motor', 'Workshop::Co');
  await fillSource(source, incomplete);
  await selectWord(page, source, 'Co');
  await source.press('ArrowRight');
  await source.press('Control+Space');
  const choices = page.getByRole('listbox');
  await expect(choices).toBeVisible();
  await choices
    .getByRole('option', { name: /^Compressor\s*Workshop::Compressor$/ })
    .click();
  const edited = views.replace(
    'expose Workshop::Motor;',
    'expose Workshop::Compressor;',
  );
  await expect(source).toHaveSource(edited.replaceAll('\r\n', '\n'));
  const completed = (await downloadProject(page)).bundle;
  expect(completed.documents).toEqual(before.documents);
  expect(completed.presentations).toEqual(before.presentations);
  expect(completed.drafts).toEqual(
    before.drafts.map((file) =>
      file.name === 'views.sysml' ? { ...file, text: edited } : file,
    ),
  );
  await page.getByRole('button', { name: 'Apply source', exact: true }).click();
  await expect(page.getByText('Source applied', { exact: true })).toBeVisible();
  await expect(diagramNode(page, 'Workshop::Compressor')).toBeVisible();
  const applied = (await downloadProject(page)).bundle;
  expect(applied.documents).toEqual(
    before.documents.map((file) =>
      file.name === 'views.sysml' ? { ...file, text: edited } : file,
    ),
  );
  expect(applied.drafts).toEqual(applied.documents);
  await page.getByRole('button', { name: 'Undo source', exact: true }).click();
  await expect(source).toHaveSource(views.replaceAll('\r\n', '\n'));
  await page.getByRole('button', { name: 'Redo source', exact: true }).click();
  await expect(source).toHaveSource(edited.replaceAll('\r\n', '\n'));
});

test('cancels a pending real Toolkit completion when its source snapshot changes', async ({
  page,
}) => {
  const before = await languageProject(page);
  const views = before.documents.find(
    (file) => file.name === 'views.sysml',
  )!.text;
  await page.getByRole('button', { name: 'views.sysml', exact: true }).click();
  const source = page.getByRole('textbox', {
    name: 'SysML source',
    exact: true,
  });
  const draft = views.replace('Workshop::Motor', 'Workshop::Co');
  await fillSource(source, draft);
  await selectWord(page, source, 'Co');
  await source.press('ArrowRight');
  let release!: () => void;
  let held = false;
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  const asset = '**/vendor/sysml-toolkit/sysmlv2_bg.wasm';
  await page.route(asset, async (route) => {
    if (!held) {
      held = true;
      await pending;
    }
    await route.continue();
  });
  try {
    await source.press('Control+Space');
    await expect.poll(() => held).toBe(true);
    await source.press('ControlOrMeta+End');
    await page.keyboard.insertText('// changed during query\n');
  } finally {
    release();
  }
  const retained = draft + '// changed during query\r\n';
  await expect(source).toHaveSource(retained.replaceAll('\r\n', '\n'));
  await expect(page.getByRole('listbox')).not.toBeVisible();
  // A new real response establishes readiness after cancellation, without a sleep.
  await selectWord(page, source, 'Co');
  await source.press('ArrowRight');
  await source.press('Control+Space');
  await expect(
    page
      .getByRole('listbox')
      .getByRole('option', { name: /^Compressor\s*Workshop::Compressor$/ }),
  ).toBeVisible();
  await source.press('Escape');
  await expect(source).toHaveSource(retained.replaceAll('\r\n', '\n'));
  const saved = (await downloadProject(page)).bundle;
  expect(saved.documents).toEqual(before.documents);
  expect(saved.presentations).toEqual(before.presentations);
  expect(saved.drafts.find((file) => file.name === 'views.sysml')!.text).toBe(
    retained,
  );
  await page.unroute(asset);
});

test('retains exact drafts and applied geometry after a Toolkit library asset failure, then recovers on retry', async ({
  page,
}) => {
  const before = await languageProject(page);
  const views = before.documents.find(
    (file) => file.name === 'views.sysml',
  )!.text;
  const source = page.getByRole('textbox', {
    name: 'SysML source',
    exact: true,
  });
  await page.getByRole('button', { name: 'views.sysml', exact: true }).click();
  const draft = views + '// unsaved while assistance is unavailable\r\n';
  await fillSource(source, draft);
  await selectWord(page, source, 'Motor');
  await source.press('ArrowRight');
  await source.press('ArrowLeft');
  const asset = '**/vendor/sysml-toolkit/stdlib/sysml-library.prepared.gz';
  let failures = 0;
  await page.route(asset, async (route) => {
    failures++;
    await route.fulfill({
      status: 503,
      body: 'Controlled unavailable library asset',
    });
  });
  await source.press('F1');
  await expect.poll(() => failures).toBeGreaterThan(0);
  await expect(
    page.getByText('Toolkit library asset is unavailable.', { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('tooltip', { name: 'Symbol information', exact: true }),
  ).not.toBeVisible();
  const failed = (await downloadProject(page)).bundle;
  expect(failed.documents).toEqual(before.documents);
  expect(failed.presentations).toEqual(before.presentations);
  expect(failed.drafts).toEqual(
    before.drafts.map((file) =>
      file.name === 'views.sysml' ? { ...file, text: draft } : file,
    ),
  );
  await page.unroute(asset);
  await selectWord(page, source, 'Motor');
  await source.press('ArrowRight');
  await source.press('ArrowLeft');
  await source.press('F1');
  await expect(
    page.getByRole('tooltip', { name: 'Symbol information', exact: true }),
  ).toContainText('Shared drive.');
  await source.press('Escape');
  await expect(source).toHaveSource(draft.replaceAll('\r\n', '\n'));
  expect((await downloadProject(page)).bundle).toEqual(failed);
});
