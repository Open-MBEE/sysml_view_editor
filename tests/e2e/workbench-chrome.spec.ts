import {
  test,
  expect,
  importWorkshop,
  fillSource,
  readSource,
  downloadProject,
  diagramCamera,
  dragSeparator,
  controlReachable,
} from './support';
import type { Locator } from '@playwright/test';

async function fits(control: Locator, pane: Locator) {
  const [button, region] = await Promise.all([
    control.boundingBox(),
    pane.boundingBox(),
  ]);
  return (
    !!button &&
    !!region &&
    button.x >= region.x &&
    button.x + button.width <= region.x + region.width + 1
  );
}

test('@critical keeps primary controls reachable across widths, narrow panes and transitions without changing drafts or camera', async ({
  page,
}) => {
  await page.goto('/app');
  await importWorkshop(page);
  await page
    .getByRole('button', { name: 'Show source and model', exact: true })
    .click();
  const source = page.getByRole('textbox', {
    name: 'SysML source',
    exact: true,
  });
  const draft = (await readSource(source)) + '\npart';
  await fillSource(source, draft);
  const editor = await source.elementHandle();
  const saved = (await downloadProject(page)).bundle;
  const camera = await diagramCamera(page);
  const header = page.getByRole('group', { name: 'Model header', exact: true });
  const sourcePane = page.getByRole('region', {
    name: 'Source editor',
    exact: true,
  });
  // Begin from a known closed tool before viewport changes can auto-collapse it.
  const closeInspection = page.getByRole('button', {
    name: 'Collapse Inspector',
    exact: true,
  });
  if (await closeInspection.isVisible()) await closeInspection.click();
  for (const width of [1440, 1200, 1000, 900, 768, 600, 390, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    if (width === 390) {
      const show = page.getByRole('button', {
        name: 'Show Inspector',
        exact: true,
      });
      await expect(show).toBeVisible();
      await show.click();
      await expect(
        page.getByRole('complementary', { name: 'Properties', exact: true }),
      ).toBeVisible();
    }
    for (const name of ['Apply source', 'Discard draft']) {
      const button = page.getByRole('button', { name, exact: true });
      await button.focus();
      await expect.poll(() => controlReachable(button)).toBe(true);
      expect(await fits(button, sourcePane), `${name} fits at ${width}`).toBe(
        true,
      );
    }
    for (const name of [
      'Diagram view',
      'Requirements table',
      'Traceability matrix',
    ]) {
      const button = header.getByRole('button', { name, exact: true });
      await button.focus();
      await expect.poll(() => controlReachable(button)).toBe(true);
      expect(await fits(button, header), `${name} fits at ${width}`).toBe(true);
    }
    expect(await diagramCamera(page)).toEqual(camera);
    expect(await editor!.evaluate((element) => element.isConnected)).toBe(true);
    await expect(source).toHaveSource(draft);
  }
  for (const delta of [-2000, 2000]) {
    await dragSeparator(page, 'Resize Source and Diagram', 'x', delta);
    for (const name of [
      'Apply source',
      'Discard draft',
      'Traceability matrix',
    ]) {
      const button = page.getByRole('button', { name, exact: true });
      await button.focus();
      await expect.poll(() => controlReachable(button)).toBe(true);
      expect(
        await fits(
          button,
          name === 'Traceability matrix' ? header : sourcePane,
        ),
      ).toBe(true);
    }
  }
  expect((await downloadProject(page)).bundle).toEqual(saved);
  expect(await diagramCamera(page)).toEqual(camera);
});

test('keeps canvas controls keyboard reachable at the vertical minimum', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/app');
  await importWorkshop(page);
  await page
    .getByRole('button', { name: 'Show source and model', exact: true })
    .click();
  const saved = (await downloadProject(page)).bundle;
  await dragSeparator(page, 'Resize Source and Diagram', 'y', -2000);
  for (const name of ['Zoom in', 'Zoom out', 'Fit view', 'Read at 100%']) {
    const button = page.getByRole('button', { name, exact: true });
    await button.focus();
    await expect.poll(() => controlReachable(button)).toBe(true);
    await expect(button).toBeFocused();
  }
  expect((await downloadProject(page)).bundle).toEqual(saved);
});

test('@critical distinguishes persistent selection from keyboard focus in forced colors', async ({
  page,
}, testInfo) => {
  await page.emulateMedia({ forcedColors: 'active', reducedMotion: 'reduce' });
  await page.goto('/app');
  await importWorkshop(page);
  const group = page.getByRole('group', {
    name: 'Model representation',
    exact: true,
  });
  const selected = group.getByRole('button', {
    name: 'Diagram view',
    exact: true,
  });
  const focused = group.getByRole('button', {
    name: 'Requirements table',
    exact: true,
  });
  await focused.focus();
  await expect(focused).toBeFocused();
  await expect(selected).toHaveAttribute('aria-pressed', 'true');
  await expect(focused).toHaveAttribute('aria-pressed', 'false');
  const border = (button: Locator) =>
    button.evaluate((element) =>
      parseFloat(getComputedStyle(element).borderBottomWidth),
    );
  expect(await border(selected)).toBeGreaterThan(await border(focused));
  expect(
    await focused.evaluate((element) =>
      parseFloat(getComputedStyle(element).outlineWidth),
    ),
  ).toBeGreaterThan(0);
  expect(
    await focused.evaluate(
      (element) => getComputedStyle(element).transitionDuration,
    ),
  ).toBe('0s');
  await page.screenshot({
    path: testInfo.outputPath('forced-colors-selection-focus.png'),
  });
});
