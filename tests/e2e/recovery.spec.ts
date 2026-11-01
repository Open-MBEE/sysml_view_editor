import type { Page } from '@playwright/test';
import {
  test,
  expect,
  openWorkshop,
  downloadProject,
  fillSource,
  readSource,
  diagramNode,
  moveNode,
  openView,
  waitForLauncher,
  startExample,
  namedViewButton,
} from './support';

/** Read the real adapter's durable record, never a private application state. */
async function readRecovery(page: Page) {
  return page.evaluate(async () => {
    return new Promise<string | undefined>((resolve, reject) => {
      const request = indexedDB.open('sysml-view-recovery', 1);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const database = request.result;
        const transaction = database.transaction('recovery', 'readonly');
        const read = transaction.objectStore('recovery').get('latest');
        read.onsuccess = () => resolve(read.result as string | undefined);
        read.onerror = () => reject(read.error);
        transaction.oncomplete = () => database.close();
      };
    });
  });
}

/** Controlled persisted-data corruption; restore/discard still use the real UI. */
async function replaceRecovery(page: Page, raw: string) {
  await page.evaluate(async (raw) => {
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.open('sysml-view-recovery', 1);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const database = request.result;
        const transaction = database.transaction('recovery', 'readwrite');
        transaction.objectStore('recovery').put(raw, 'latest');
        transaction.oncomplete = () => {
          database.close();
          resolve();
        };
        transaction.onerror = () => reject(transaction.error);
      };
    });
  }, raw);
}

async function savedDraft(page: Page) {
  await openWorkshop(page);
  await moveNode(page, diagramNode(page, 'Workshop::Motor'));
  await openView(page, 'compressor');
  await moveNode(page, diagramNode(page, 'primary : Motor'));
  const source = page.getByRole('textbox', {
    name: 'SysML source',
    exact: true,
  });
  const draft =
    (await readSource(source)) + '\n// retained 🔧 recovery draft\npart';
  await fillSource(source, draft);
  const expected = (await downloadProject(page)).bundle;
  // Download clears the explicit dirty marker, but unapplied drafts remain recoverable.
  await expect
    .poll(async () => {
      const raw = await readRecovery(page);
      if (!raw) return null;
      return JSON.parse(JSON.parse(raw).project);
    })
    .toEqual(expected);
  return { expected, draft, raw: (await readRecovery(page))! };
}

test('@critical restores exact applied source, invalid drafts and both view layouts from IndexedDB after reload', async ({
  page,
}) => {
  const { expected, draft } = await savedDraft(page);
  page.on('dialog', (dialog) => dialog.accept());
  await page.reload();
  await waitForLauncher(page);
  const recovery = page.getByRole('region', {
    name: 'Saved recovery',
    exact: true,
  });
  await expect(recovery).toBeVisible();
  await recovery
    .getByRole('button', { name: 'Restore recovery', exact: true })
    .click();
  const source = page.getByRole('textbox', {
    name: 'SysML source',
    exact: true,
  });
  await expect(source).toHaveSource(draft);
  await expect(
    namedViewButton(page, 'WorkshopViews::compressor'),
  ).toHaveAttribute('aria-current', 'page');
  expect((await downloadProject(page)).bundle).toEqual(expected);
  await openView(page, 'overview');
  await expect(diagramNode(page, 'Workshop::Motor')).toBeVisible();
  expect((await downloadProject(page)).bundle.presentations).toEqual(
    expected.presentations,
  );
});

test('explicitly discards stored recovery while leaving the launcher empty', async ({
  page,
}) => {
  await savedDraft(page);
  page.on('dialog', (dialog) => dialog.accept());
  await page.reload();
  await waitForLauncher(page);
  await expect(
    page.getByRole('button', { name: 'Download project', exact: true }),
  ).not.toBeVisible();
  const recovery = page.getByRole('region', {
    name: 'Saved recovery',
    exact: true,
  });
  await recovery
    .getByRole('button', { name: 'Discard recovery', exact: true })
    .click();
  await expect(recovery).not.toBeVisible();
  await expect.poll(() => readRecovery(page)).toBeUndefined();
  await waitForLauncher(page);
  await expect(
    page.getByRole('button', { name: 'Resume project', exact: true }),
  ).not.toBeVisible();
  await expect(
    page.getByRole('textbox', { name: 'SysML source', exact: true }),
  ).not.toBeVisible();
});

test('retains malformed recovery until explicit discard and leaves the current project untouched', async ({
  page,
}) => {
  await savedDraft(page);
  const corrupt =
    '{"format":"sysml-view-recovery","version":999,"project":"unreadable"}';
  await replaceRecovery(page, corrupt);
  page.on('dialog', (dialog) => dialog.accept());
  await page.reload();
  await waitForLauncher(page);
  await startExample(page);
  const before = (await downloadProject(page)).bundle;
  const recovery = page.getByRole('region', {
    name: 'Saved recovery',
    exact: true,
  });
  await expect(recovery).toBeVisible();
  await expect(
    recovery.getByRole('button', { name: 'Restore recovery', exact: true }),
  ).toBeDisabled();
  expect(await readRecovery(page)).toBe(corrupt);
  expect((await downloadProject(page)).bundle).toEqual(before);
  await recovery
    .getByRole('button', { name: 'Discard recovery', exact: true })
    .click();
  await expect.poll(() => readRecovery(page)).toBeUndefined();
});

test('reports denied IndexedDB storage, preserves the editable project and retries after storage returns', async ({
  page,
}) => {
  await page.addInitScript(() => {
    const host = window as typeof window & {
      recoveryStorageFailures: number;
      restoreRecoveryStorage: () => void;
    };
    const open = indexedDB.open;
    host.recoveryStorageFailures = 0;
    indexedDB.open = function () {
      host.recoveryStorageFailures++;
      throw new DOMException('Recovery test denied storage', 'SecurityError');
    };
    host.restoreRecoveryStorage = () => {
      indexedDB.open = open;
    };
  });
  await openWorkshop(page);
  const source = page.getByRole('textbox', {
    name: 'SysML source',
    exact: true,
  });
  const original = await readSource(source);
  const draft = original + '\n// work survives denied local storage\n';
  await fillSource(source, draft);
  const expected = (await downloadProject(page)).bundle;
  await page
    .getByRole('button', { name: 'Local recovery', exact: true })
    .click();
  const settings = page.getByRole('dialog', {
    name: 'Local recovery',
    exact: true,
  });
  await expect(
    settings.getByText(/Recovery test denied storage/),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () =>
        (window as typeof window & { recoveryStorageFailures: number })
          .recoveryStorageFailures,
    ),
  ).toBeGreaterThan(0);
  await page.evaluate(() =>
    (
      window as typeof window & { restoreRecoveryStorage: () => void }
    ).restoreRecoveryStorage(),
  );
  await settings
    .getByRole('button', { name: 'Retry recovery', exact: true })
    .click();
  await expect
    .poll(async () => {
      const raw = await readRecovery(page);
      return raw ? JSON.parse(JSON.parse(raw).project) : null;
    })
    .toEqual(expected);
  await page.keyboard.press('Escape');
  await expect(settings).not.toBeVisible();
  await expect(source).toHaveSource(draft);
  expect((await downloadProject(page)).bundle).toEqual(expected);
});

test('a second tab cannot silently overwrite a newer recovery or lose either live draft', async ({
  page,
  context,
}) => {
  const first = await savedDraft(page);
  const other = await context.newPage();
  const errors: string[] = [];
  other.on('pageerror', (error) => errors.push(error.message));
  try {
    await other.goto('/app');
    await waitForLauncher(other);
    await other
      .getByRole('region', { name: 'Saved recovery', exact: true })
      .getByRole('button', { name: 'Restore recovery', exact: true })
      .click();
    const otherSource = other.getByRole('textbox', {
      name: 'SysML source',
      exact: true,
    });
    await expect(otherSource).toHaveSource(first.draft);
    await expect(
      namedViewButton(other, 'WorkshopViews::compressor'),
    ).toHaveAttribute('aria-current', 'page');
    await expect(
      other.getByRole('button', { name: 'Download project', exact: true }),
    ).toBeEnabled();
    await expect(otherSource).toHaveAttribute('aria-readonly', 'false');
    const newer = first.draft + '\n// newer copy from the other tab\n';
    await fillSource(otherSource, newer);
    await expect(otherSource).toHaveSource(newer);
    const otherExpected = (await downloadProject(other)).bundle;
    await expect
      .poll(async () => {
        const raw = await readRecovery(other);
        return raw ? JSON.parse(JSON.parse(raw).project) : null;
      })
      .toEqual(otherExpected);
    await expect
      .poll(async () => {
        const raw = await readRecovery(other);
        return raw ? JSON.parse(raw).activeView : null;
      })
      .toBe('WorkshopViews::compressor');
    const newerRaw = await readRecovery(other);
    const source = page.getByRole('textbox', {
      name: 'SysML source',
      exact: true,
    });
    const older = first.draft + '\n// unsaved first-tab work\n';
    await fillSource(source, older);
    await page
      .getByRole('button', { name: 'Local recovery', exact: true })
      .click();
    const settings = page.getByRole('dialog', {
      name: 'Local recovery',
      exact: true,
    });
    await expect(
      settings.getByText(/Another tab changed local recovery/),
    ).toBeVisible();
    expect(await readRecovery(page)).toBe(newerRaw);
    await settings
      .getByRole('button', { name: 'Retry recovery', exact: true })
      .click();
    // Retry loads the newer pending copy for an explicit decision, never restores it silently.
    await page.keyboard.press('Escape');
    await expect(
      page.getByRole('region', { name: 'Saved recovery', exact: true }),
    ).toBeVisible();
    await expect(source).toHaveSource(older);
    await expect(otherSource).toHaveSource(newer);
    const retained = (await downloadProject(page)).bundle;
    expect(retained.documents).toEqual(first.expected.documents);
    expect(retained.presentations).toEqual(first.expected.presentations);
    expect(retained.drafts[0]!.text).toBe(older);
    expect(await readRecovery(page)).toBe(newerRaw);
  } finally {
    await other.close();
  }
  expect(errors, 'Uncaught errors in the second recovery tab').toEqual([]);
});

test('contains keyboard focus in recovery settings, returns focus and persists the enabled preference', async ({
  page,
}) => {
  await openWorkshop(page);
  const before = (await downloadProject(page)).bundle;
  const trigger = page.getByRole('button', {
    name: 'Local recovery',
    exact: true,
  });
  await trigger.focus();
  await page.keyboard.press('Enter');
  const settings = page.getByRole('dialog', {
    name: 'Local recovery',
    exact: true,
  });
  await expect(settings).toBeVisible();
  const enabled = settings.getByRole('checkbox', {
    name: 'Save recovery locally',
    exact: true,
  });
  await expect(enabled).toBeChecked();
  const done = settings.getByRole('button', { name: 'Done', exact: true });
  await done.focus();
  await page.keyboard.press('Tab');
  await expect
    .poll(() =>
      settings.evaluate((element) => element.contains(document.activeElement)),
    )
    .toBe(true);
  await page.keyboard.press('Shift+Tab');
  await expect(done).toBeFocused();
  await enabled.uncheck();
  await page.keyboard.press('Escape');
  await expect(settings).not.toBeVisible();
  await expect(trigger).toBeFocused();
  expect((await downloadProject(page)).bundle).toEqual(before);
  await page.reload();
  await waitForLauncher(page);
  await trigger.click();
  await expect(enabled).not.toBeChecked();
  await enabled.check();
  await done.click();
  await expect(trigger).toBeFocused();
  await page.reload();
  await waitForLauncher(page);
  await trigger.click();
  await expect(enabled).toBeChecked();
});

test('restored clean source and geometry remain unsaved until a portable download and require replacement confirmation', async ({
  page,
}) => {
  await openWorkshop(page);
  const before = (await downloadProject(page)).bundle;
  await moveNode(page, diagramNode(page, 'Workshop::Motor'));
  await expect
    .poll(async () => {
      const raw = await readRecovery(page);
      if (!raw) return false;
      const project = JSON.parse(JSON.parse(raw).project);
      return (
        project.name === before.name &&
        JSON.stringify(project.presentations) !==
          JSON.stringify(before.presentations)
      );
    })
    .toBe(true);
  const raw = await readRecovery(page);
  expect(raw).toBeDefined();
  const expected = JSON.parse(JSON.parse(raw!).project);
  expect(expected.documents).toEqual(before.documents);
  expect(expected.drafts).toEqual(before.documents);
  page.once('dialog', (dialog) => dialog.accept());
  await page.reload();
  await waitForLauncher(page);
  await page
    .getByRole('region', { name: 'Saved recovery', exact: true })
    .getByRole('button', { name: 'Restore recovery', exact: true })
    .click();
  await expect(
    page.getByRole('button', { name: 'New project', exact: true }),
  ).toBeEnabled();
  await expect(
    page.getByText('Workshop · modified', { exact: true }),
  ).toBeVisible();
  let confirmation = '';
  page.once('dialog', async (dialog) => {
    confirmation = dialog.message();
    await dialog.dismiss();
  });
  await page.getByRole('button', { name: 'New project', exact: true }).click();
  await expect.poll(() => confirmation).not.toBe('');
  await expect(
    page.getByRole('dialog', { name: 'New project', exact: true }),
  ).not.toBeVisible();
  expect((await downloadProject(page)).bundle).toEqual(expected);
  await expect(
    page.getByText('Workshop · modified', { exact: true }),
  ).not.toBeVisible();
  await page.getByRole('button', { name: 'New project', exact: true }).click();
  await expect(
    page.getByRole('dialog', { name: 'New project', exact: true }),
  ).toBeVisible();
});

test('discarding the only unsaved draft removes its stale local recovery without changing applied source', async ({
  page,
}) => {
  await openWorkshop(page);
  const before = (await downloadProject(page)).bundle;
  const source = page.getByRole('textbox', {
    name: 'SysML source',
    exact: true,
  });
  const draft =
    before.documents[0]!.text +
    '\n// explicitly discarded recovery draft\npart';
  await fillSource(source, draft);
  await expect
    .poll(async () => {
      const raw = await readRecovery(page);
      if (!raw) return null;
      return JSON.parse(JSON.parse(raw).project).drafts[0].text;
    })
    .toBe(draft);
  await page
    .getByRole('button', { name: 'Discard draft', exact: true })
    .click();
  await expect(source).toHaveSource(before.documents[0]!.text);
  await expect.poll(() => readRecovery(page)).toBeUndefined();
  expect((await downloadProject(page)).bundle).toEqual(before);
  await page.reload();
  await waitForLauncher(page);
  await expect(
    page.getByRole('region', { name: 'Saved recovery', exact: true }),
  ).not.toBeVisible();
});

test('failed real-engine recovery validation retains the live project, exact stored record and pending choice', async ({
  page,
}) => {
  const saved = await savedDraft(page);
  const envelope = JSON.parse(saved.raw);
  const project = JSON.parse(envelope.project);
  project.documents[0].text = 'package Workshop { part def';
  const invalid = JSON.stringify({
    ...envelope,
    project: JSON.stringify(project),
  });
  await replaceRecovery(page, invalid);
  page.once('dialog', (dialog) => dialog.accept());
  await page.reload();
  await waitForLauncher(page);
  await startExample(page);
  const before = (await downloadProject(page)).bundle;
  const recovery = page.getByRole('region', {
    name: 'Saved recovery',
    exact: true,
  });
  const restore = recovery.getByRole('button', {
    name: 'Restore recovery',
    exact: true,
  });
  await restore.click();
  await expect(recovery.getByRole('alert')).toHaveText(
    'Source has errors; the last applied model is retained.',
  );
  await expect(restore).toBeEnabled();
  await expect(
    recovery.getByRole('button', { name: 'Discard recovery', exact: true }),
  ).toBeEnabled();
  expect(await readRecovery(page)).toBe(invalid);
  expect((await downloadProject(page)).bundle).toEqual(before);
  expect(await readRecovery(page)).toBe(invalid);
});
