import type { Locator } from '@playwright/test';
import {
  test,
  expect,
  ready,
  downloadProject,
  connectionPoints,
  portAnchor,
} from './support';

async function directionContrast(label: Locator, card: Locator) {
  const luminance = (color: string) =>
    color
      .match(/[0-9.]+/g)!
      .slice(0, 3)
      .map((value) => Number(value) / 255)
      .map((value) =>
        value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4,
      )
      .reduce(
        (sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index]!,
        0,
      );
  const foreground = luminance(
    await label.evaluate((node) => getComputedStyle(node).color),
  );
  const background = luminance(
    await card.evaluate((node) => getComputedStyle(node).backgroundColor),
  );
  return (
    (Math.max(foreground, background) + 0.05) /
    (Math.min(foreground, background) + 0.05)
  );
}

test('keeps structural labels, keyboard port selection and real endpoints readable through appearance changes', async ({
  page,
}) => {
  await ready(page, { split: false });
  const before = (await downloadProject(page)).bundle;
  const pump = page.getByRole('group', {
    name: 'part pump : Pump',
    exact: true,
  });
  const name = pump.getByText('pump', { exact: true });
  const type = pump.getByText('Pump', { exact: true });
  await expect(name).toBeVisible();
  await expect(type).toBeVisible();
  expect(
    await name.evaluate((node) => Number(getComputedStyle(node).fontWeight)),
  ).toBeGreaterThan(
    await type.evaluate((node) => Number(getComputedStyle(node).fontWeight)),
  );
  await name.click();
  await expect(pump).toHaveCSS('outline-style', 'solid');
  const output = pump.getByRole('button', {
    name: 'out port outlet : AirOutlet',
    exact: true,
  });
  await expect(output.getByText('OUT', { exact: true })).toBeVisible();
  await expect(output.getByText('outlet', { exact: true })).toBeVisible();
  await expect(output.getByText('AirOutlet', { exact: true })).toBeVisible();
  await output.focus();
  await output.press('Enter');
  await expect(
    page.getByRole('complementary', { name: 'Properties', exact: true }),
  ).toContainText('CompressorComponents::Pump::outlet');
  await expect(
    page.getByRole('complementary', { name: 'Properties', exact: true }),
  ).toContainText('CompressorSystem::PneumaticAssembly::pump');
  await expect(output).toBeFocused();
  const tank = page.getByRole('group', {
    name: 'part tank : Tank',
    exact: true,
  });
  const inlet = tank.getByRole('button', {
    name: 'in port inlet : ~AirOutlet',
    exact: true,
  });
  const from = await portAnchor(output, 'source');
  const to = await portAnchor(inlet, 'target');
  await expect
    .poll(async () =>
      (await connectionPoints(page)).some(
        (edge) =>
          Math.abs(edge.start.x - from.x) < 1 &&
          Math.abs(edge.start.y - from.y) < 1 &&
          Math.abs(edge.end.x - to.x) < 1 &&
          Math.abs(edge.end.y - to.y) < 1,
      ),
    )
    .toBe(true);
  for (const theme of ['light', 'dark']) {
    for (const palette of [
      'neutral',
      'muted',
      'contrast',
      'forest',
      'blueprint',
      'paper',
    ]) {
      await page
        .getByRole('button', { name: 'Appearance', exact: true })
        .click();
      const dialog = page.getByRole('dialog', {
        name: 'Appearance',
        exact: true,
      });
      await dialog.getByLabel('Theme', { exact: true }).selectOption(theme);
      await dialog
        .getByLabel('Diagram palette', { exact: true })
        .selectOption(palette);
      await dialog.getByRole('button', { name: 'Done', exact: true }).click();
      await expect(name).toBeVisible();
      const direction = output.getByText('OUT', { exact: true });
      await expect(direction).toBeVisible();
      expect(
        await directionContrast(direction, pump),
        `${theme}/${palette} output direction contrast`,
      ).toBeGreaterThanOrEqual(4.5);
    }
  }
  expect((await downloadProject(page)).bundle).toEqual(before);
});
