import { noViews, assemblyExploration } from './exploration-support';
import {
  test,
  expect,
  ready,
  importAssembly,
  showAssemblyDiagram,
  modelTreeItem,
  openWorkshop,
  downloadProject,
  fillSource,
  copySourceSelection,
  observeEvaluations,
  overviewRoutingGeometry,
} from './support';
import {
  importRequirementsTraceability,
  waitForRequirements,
  centerRequirementCard,
  zoomRequirementForReading,
  requirementCard,
} from './requirements-support';

for (const theme of ['light', 'dark']) {
  test(`workbench and appearance dialog in ${theme}`, async ({ page }) => {
    await ready(page, { split: false });
    const trigger = page.getByRole('button', {
      name: 'Appearance',
      exact: true,
    });
    await trigger.click();
    const dialog = page.getByRole('dialog', {
      name: 'Appearance',
      exact: true,
    });
    await dialog.getByLabel('Theme', { exact: true }).selectOption(theme);
    await dialog.getByRole('button', { name: 'Done', exact: true }).click();
    await expect(dialog).not.toBeVisible();
    await expect(page).toHaveScreenshot(`workbench-${theme}.png`);
    await trigger.click();
    await dialog.getByText('Element base colors', { exact: true }).click();
    await expect(dialog).toHaveScreenshot(`appearance-${theme}.png`);
  });
}

for (const theme of ['light', 'dark']) {
  test(`nested assembly in ${theme}`, async ({ page }) => {
    await ready(page);
    await importAssembly(page);
    await showAssemblyDiagram(page);
    await page.getByRole('button', { name: 'Appearance', exact: true }).click();
    const dialog = page.getByRole('dialog', {
      name: 'Appearance',
      exact: true,
    });
    await dialog.getByLabel('Theme', { exact: true }).selectOption(theme);
    await dialog.getByRole('button', { name: 'Done', exact: true }).click();
    await expect(dialog).not.toBeVisible();
    await expect(
      page.getByRole('region', { name: 'Diagram', exact: true }),
    ).toHaveScreenshot(`assembly-${theme}.png`);
  });
}

test('workbench and keyboard-operated appearance at a narrow viewport', async ({
  page,
}) => {
  await page.setViewportSize({ width: 768, height: 900 });
  await ready(page, { split: false });
  await expect(page).toHaveScreenshot('workbench-narrow.png');
  const trigger = page.getByRole('button', { name: 'Appearance', exact: true });
  await trigger.focus();
  await page.keyboard.press('Enter');
  const dialog = page.getByRole('dialog', { name: 'Appearance', exact: true });
  await expect(dialog).toBeInViewport({ ratio: 1 });
  await expect(
    dialog.getByRole('button', { name: 'Done', exact: true }),
  ).toBeInViewport({ ratio: 1 });
  await expect(dialog).toHaveScreenshot('appearance-narrow.png');
  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
  await expect(trigger).toBeFocused();
});

for (const appearance of [
  { theme: 'light', narrow: false },
  { theme: 'dark', narrow: false },
  { theme: 'light', narrow: true },
  { theme: 'dark', narrow: true },
]) {
  test(`structural authoring dialogs in ${appearance.theme}${appearance.narrow ? ' narrow' : ''}`, async ({
    page,
  }) => {
    if (appearance.narrow)
      await page.setViewportSize({ width: 768, height: 900 });
    await ready(page);
    await importAssembly(page);
    await page.getByRole('button', { name: 'Appearance', exact: true }).click();
    await page
      .getByRole('dialog')
      .getByLabel('Theme', { exact: true })
      .selectOption(appearance.theme);
    await page.getByRole('button', { name: 'Done', exact: true }).click();
    for (const [action, title, file] of [
      ['New part', 'New part', 'part'],
      ['Connect ports', 'Connect ports', 'connection'],
    ]) {
      const trigger = page
        .getByRole('region', { name: 'Diagram', exact: true })
        .getByRole('button', { name: action!, exact: true });
      await trigger.focus();
      await page.keyboard.press('Enter');
      const dialog = page.getByRole('dialog', { name: title!, exact: true });
      await expect(dialog).toBeInViewport({ ratio: 1 });
      await expect(
        dialog.getByRole('button', { name: 'Review source', exact: true }),
      ).toBeInViewport({ ratio: 1 });
      await expect(dialog).toHaveScreenshot(
        `authoring-${file}-${appearance.narrow ? (appearance.theme === 'dark' ? 'narrow-dark' : 'narrow') : appearance.theme}.png`,
      );
      await page.keyboard.press('Escape');
      await expect(dialog).not.toBeVisible();
      await expect(trigger).toBeFocused();
    }
  });
}

for (const theme of ['light', 'dark']) {
  for (const narrow of [false, true]) {
    test(`resized workspace panels in ${theme}${narrow ? ' narrow' : ''}`, async ({
      page,
    }) => {
      if (narrow) await page.setViewportSize({ width: 768, height: 900 });
      await ready(page);
      await page
        .getByRole('button', { name: 'Appearance', exact: true })
        .click();
      await page
        .getByRole('dialog')
        .getByLabel('Theme', { exact: true })
        .selectOption(theme);
      await page.getByRole('button', { name: 'Done', exact: true }).click();
      if (narrow) {
        await page
          .getByRole('button', { name: 'Collapse Explorer', exact: true })
          .click();
        await page
          .getByRole('button', { name: 'Show Inspector', exact: true })
          .click();
      } else {
        await page
          .getByRole('button', { name: 'Explorer panel options', exact: true })
          .click();
        await page
          .getByRole('button', { name: 'Widen Explorer', exact: true })
          .click();
        await page.keyboard.press('Escape');
      }
      await page
        .getByRole('button', { name: 'Show Issues', exact: true })
        .click();
      const handle = page.getByRole('separator', {
        name: 'Resize Issues',
        exact: true,
      });
      await expect(
        page.getByRole('button', { name: 'Collapse Issues', exact: true }),
      ).toBeFocused();
      await handle.focus();
      await expect(handle).toBeFocused();
      await page.keyboard.press('ArrowUp');
      await expect(
        page.getByRole('region', { name: 'Issues', exact: true }),
      ).toBeVisible();
      await expect(page).toHaveScreenshot(
        `panels-${theme}${narrow ? '-narrow' : ''}.png`,
      );
    });
  }
}

for (const theme of ['light', 'dark']) {
  for (const narrow of [false, true]) {
    test(`model ownership tree in ${theme}${narrow ? ' narrow' : ''}`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: narrow ? 768 : 1440, height: 1100 });
      await ready(page, { split: false });
      await page
        .getByRole('button', { name: 'Appearance', exact: true })
        .click();
      await page
        .getByRole('dialog')
        .getByLabel('Theme', { exact: true })
        .selectOption(theme);
      await page.getByRole('button', { name: 'Done', exact: true }).click();
      await page
        .getByRole('button', { name: 'Explorer panel options', exact: true })
        .click();
      for (let i = 0; i < 4; i++)
        await page
          .getByRole('button', { name: 'Widen Explorer', exact: true })
          .click();
      await page.keyboard.press('Escape');
      await expect(
        page.getByRole('button', {
          name: 'Explorer panel options',
          exact: true,
        }),
      ).toBeFocused();
      const behavior = modelTreeItem(page, 'CompressorBehavior');
      await behavior.focus();
      await page.keyboard.press('ArrowRight');
      for (const name of ['SensePressure', 'ControlMotor', 'PumpAir']) {
        await modelTreeItem(page, 'CompressorBehavior::' + name).focus();
        await page.keyboard.press('ArrowRight');
      }
      await behavior.focus();
      await page
        .getByTitle('CompressorBehavior', { exact: true })
        .scrollIntoViewIfNeeded();
      await expect(
        page.getByTitle('CompressorBehavior', { exact: true }),
      ).toBeInViewport({ ratio: 1 });
      await page
        .getByRole('button', { name: 'Download project', exact: true })
        .hover();
      await expect(
        page.getByRole('complementary', {
          name: 'Project navigation',
          exact: true,
        }),
      ).toHaveScreenshot(`model-tree-${theme}${narrow ? '-narrow' : ''}.png`);
    });
  }
}

for (const theme of ['light', 'dark']) {
  for (const narrow of [false, true]) {
    test(`source editor and search in ${theme}${narrow ? ' narrow' : ''}`, async ({
      page,
    }) => {
      if (narrow) await page.setViewportSize({ width: 768, height: 900 });
      await ready(page);
      await page
        .getByRole('button', { name: 'Appearance', exact: true })
        .click();
      await page
        .getByRole('dialog')
        .getByLabel('Theme', { exact: true })
        .selectOption(theme);
      await page.getByRole('button', { name: 'Done', exact: true }).click();
      const sourcePane = page.getByRole('region', {
        name: 'Source editor',
        exact: true,
      });
      const axis = narrow ? 'height' : 'width';
      const available =
        (await sourcePane.boundingBox())![axis] +
        (await page
          .getByRole('region', { name: 'Diagram', exact: true })
          .boundingBox())![axis];
      await page.getByRole('button', { name: 'Code', exact: true }).click();
      await expect
        .poll(async () => (await sourcePane.boundingBox())![axis])
        .toBeGreaterThanOrEqual(available - 1);
      const source = page.getByRole('textbox', {
        name: 'SysML source',
        exact: true,
      });
      const keyword = source.getByText('package', { exact: true });
      await expect(keyword).toHaveCSS(
        'color',
        theme === 'light' ? 'rgb(109, 58, 198)' : 'rgb(196, 164, 255)',
      );
      await source.press('ControlOrMeta+f');
      const editor = page.getByRole('region', {
        name: 'Source editor',
        exact: true,
      });
      await editor
        .getByRole('textbox', { name: 'Find', exact: true })
        .fill('Compressor');
      await expect(
        editor.getByRole('textbox', { name: 'Replace', exact: true }),
      ).toBeInViewport({ ratio: 1 });
      await expect(page).toHaveScreenshot(
        `source-editor-${theme}${narrow ? '-narrow' : ''}.png`,
      );
    });
  }
}

for (const theme of ['light', 'dark']) {
  for (const narrow of [false, true]) {
    test(`navigable source diagnostics in ${theme}${narrow ? ' narrow' : ''}`, async ({
      page,
    }) => {
      if (narrow) await page.setViewportSize({ width: 768, height: 900 });
      await openWorkshop(page);
      await page
        .getByRole('button', { name: 'Appearance', exact: true })
        .click();
      await page
        .getByRole('dialog')
        .getByLabel('Theme', { exact: true })
        .selectOption(theme);
      await page.getByRole('button', { name: 'Done', exact: true }).click();
      const original = (await downloadProject(page)).bundle.documents[0]!.text;
      await fillSource(
        page.getByRole('textbox', { name: 'SysML source', exact: true }),
        original.replace('part def Motor;', 'part def Motor :> Missing;'),
      );
      await page
        .getByRole('button', { name: 'Apply source', exact: true })
        .click();
      const link = page
        .getByRole('region', { name: 'Issues', exact: true })
        .getByRole('button', { name: /Open model.sysml at line/ })
        .first();
      await expect(link).toBeVisible();
      await expect(
        page.getByRole('button', { name: 'Apply source', exact: true }),
      ).toBeEnabled();
      await expect(
        page.getByRole('textbox', { name: 'SysML source', exact: true }),
      ).toHaveAttribute('aria-readonly', 'false');
      await link.focus();
      await expect(link).toBeFocused();
      await expect(page).toHaveScreenshot(
        `diagnostics-${theme}${narrow ? '-narrow' : ''}.png`,
      );
    });
  }
}

for (const theme of ['light', 'dark']) {
  for (const narrow of [false, true]) {
    test(`local recovery dialog in ${theme}${narrow ? ' narrow' : ''}`, async ({
      page,
    }) => {
      if (narrow) await page.setViewportSize({ width: 768, height: 900 });
      await ready(page, { split: false });
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
      const trigger = page.getByRole('button', {
        name: 'Local recovery',
        exact: true,
      });
      await trigger.focus();
      await trigger.press('Enter');
      const dialog = page.getByRole('dialog', {
        name: 'Local recovery',
        exact: true,
      });
      await expect(
        dialog.getByText(
          'Local recovery is ready. Unsaved source drafts and diagram positions are saved after edits.',
          { exact: true },
        ),
      ).toBeVisible();
      await expect(dialog).toBeInViewport({ ratio: 1 });
      await expect(
        dialog.getByRole('checkbox', {
          name: 'Save recovery locally',
          exact: true,
        }),
      ).toBeChecked();
      await expect(dialog).toHaveScreenshot(
        `local-recovery-${theme}${narrow ? '-narrow' : ''}.png`,
      );
      await page.keyboard.press('Escape');
      await expect(dialog).not.toBeVisible();
      await expect(trigger).toBeFocused();
    });

    test(`engine symbol information in ${theme}${narrow ? ' narrow' : ''}`, async ({
      page,
    }) => {
      if (narrow) await page.setViewportSize({ width: 768, height: 900 });
      await openWorkshop(page);
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
      await page.getByRole('button', { name: 'Code', exact: true }).click();
      const source = page.getByRole('textbox', {
        name: 'SysML source',
        exact: true,
      });
      const original = (await downloadProject(page)).bundle.documents[0]!.text;
      await fillSource(
        source,
        original.replace(
          'part def Motor;',
          'part def Motor { doc /* Shared compressor drive.\n\nThis definition powers the primary and standby usages while keeping each usage distinct. */ }',
        ),
      );
      await source.press('ControlOrMeta+Home');
      await source.press('ControlOrMeta+f');
      const find = page
        .getByRole('region', { name: 'Source editor', exact: true })
        .getByRole('textbox', { name: 'Find', exact: true });
      await find.fill('');
      await find.pressSequentially('Motor');
      await find.press('Enter');
      await find.press('Escape');
      await expect.poll(() => copySourceSelection(source)).toBe('Motor');
      await source.press('ArrowRight');
      await source.press('ArrowLeft');
      await page.mouse.move(0, 0);
      await source.press('F1');
      const information = page.getByRole('tooltip', {
        name: 'Symbol information',
        exact: true,
      });
      await expect(information).toContainText('Workshop::Motor');
      await expect(information).toContainText('Shared compressor drive.');
      await expect(information).toContainText('keeping each usage distinct.');
      await expect(source).toHaveAttribute(
        'aria-describedby',
        'source-help source-symbol-info',
      );
      await expect(information).toBeInViewport({ ratio: 1 });
      await expect(page).toHaveScreenshot(
        `symbol-information-${theme}${narrow ? '-narrow' : ''}.png`,
      );
      await source.press('Escape');
      await expect(information).not.toBeVisible();
      await expect(source).toBeFocused();
    });
  }
}

for (const theme of ['light', 'dark']) {
  for (const width of [1440, 768, 390]) {
    test(`OpenMBEE entry surfaces in ${theme} at ${width}`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/');
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
      await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
      await page.evaluate(() => document.fonts.ready);
      await page.mouse.move(0, 0);
      await expect(
        page.getByRole('heading', {
          name: 'OpenMBEE View Editor',
          exact: true,
          level: 1,
        }),
      ).toBeVisible();
      await expect(
        page.getByRole('link', { name: 'Open app', exact: true }),
      ).toBeInViewport({ ratio: 1 });
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth),
      ).toBeLessThanOrEqual(width);
      await expect(page).toHaveScreenshot(`landing-${theme}-${width}.png`, {
        fullPage: true,
      });
      await page.getByRole('link', { name: 'Open app', exact: true }).click();
      await expect(
        page.getByRole('heading', { name: 'Open a project', exact: true }),
      ).toBeFocused();
      await expect(
        page.getByRole('button', { name: 'Load example', exact: true }),
      ).toBeEnabled();
      await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
      await page.mouse.move(0, 0);
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth),
      ).toBeLessThanOrEqual(width);
      await expect(page).toHaveScreenshot(`launcher-${theme}-${width}.png`, {
        fullPage: true,
      });
    });
  }
}

for (const theme of ['light', 'dark']) {
  for (const narrow of [false, true]) {
    test(`selected structural nodes in ${theme}${narrow ? ' narrow' : ''}`, async ({
      page,
    }) => {
      if (narrow) await page.setViewportSize({ width: 768, height: 900 });
      await ready(page, { split: false });
      await page
        .getByRole('button', { name: 'Appearance', exact: true })
        .click();
      const dialog = page.getByRole('dialog', {
        name: 'Appearance',
        exact: true,
      });
      await dialog.getByLabel('Theme', { exact: true }).selectOption(theme);
      await dialog.getByRole('button', { name: 'Done', exact: true }).click();
      const tank = page.getByRole('group', {
        name: 'part tank : Tank',
        exact: true,
      });
      await tank.getByText('tank', { exact: true }).click();
      await expect(tank).toHaveClass(/selected/);
      await page.mouse.move(0, 0);
      await expect(
        page.getByRole('region', { name: 'Diagram', exact: true }),
      ).toHaveScreenshot(
        `selected-structure-${theme}${narrow ? '-narrow' : ''}.png`,
      );
    });
  }
}

for (const theme of ['light', 'dark']) {
  for (const width of [390, 600]) {
    test(`mobile project header in ${theme} at ${width}`, async ({ page }) => {
      await ready(page, { split: false });
      await page.setViewportSize({ width, height: 900 });
      await page
        .getByRole('button', { name: 'Appearance', exact: true })
        .click();
      const dialog = page.getByRole('dialog', {
        name: 'Appearance',
        exact: true,
      });
      await dialog.getByLabel('Theme', { exact: true }).selectOption(theme);
      await dialog.getByRole('button', { name: 'Done', exact: true }).click();
      await expect(dialog).not.toBeVisible();
      await page.mouse.move(0, 0);
      await expect(page.getByRole('banner')).toHaveScreenshot(
        `mobile-header-${theme}-${width}.png`,
      );
    });
  }
}

for (const theme of ['light', 'dark']) {
  for (const width of [1440, 768]) {
    test(`requirement hierarchy and declared satisfaction in ${theme} at ${width}`, async ({
      page,
    }) => {
      const evaluations = await observeEvaluations(page);
      await ready(page, { split: false });
      await importRequirementsTraceability(page);
      const result = await waitForRequirements(page, evaluations);
      await expect(
        page.getByRole('region', { name: 'Issues', exact: true }),
      ).not.toBeVisible();
      await page.setViewportSize({ width, height: 900 });
      await page
        .getByRole('button', { name: 'Appearance', exact: true })
        .click();
      const dialog = page.getByRole('dialog', {
        name: 'Appearance',
        exact: true,
      });
      await dialog.getByLabel('Theme', { exact: true }).selectOption(theme);
      await dialog.getByRole('button', { name: 'Done', exact: true }).click();
      await expect(dialog).not.toBeVisible();
      await requirementCard(page, result, 'TraceRequirements::MinimumCapacity')
        .getByRole('button', {
          name: 'Inspect REQ-CAP TraceRequirements::MinimumCapacity',
          exact: true,
        })
        .click();
      await expect(
        page.getByRole('complementary', { name: 'Properties', exact: true }),
      ).toContainText(
        'are model content, not evidence that a test has passed.',
      );
      await expect(
        page.getByRole('button', { name: 'Download project', exact: true }),
      ).toBeEnabled();
      await page.evaluate(() => document.fonts.ready);
      await page.mouse.move(0, 0);
      if (width === 1440)
        await expect(page).toHaveScreenshot(
          `requirements-overview-${theme}.png`,
        );
      if (width === 768)
        await page
          .getByRole('button', { name: 'Collapse Explorer', exact: true })
          .click();
      const selectedRequirement = requirementCard(
        page,
        result,
        'TraceRequirements::MinimumCapacity',
      );
      await zoomRequirementForReading(page, selectedRequirement);
      await selectedRequirement.focus();
      await selectedRequirement.press('Enter');
      await expect(selectedRequirement).toBeFocused();
      await centerRequirementCard(page, selectedRequirement);
      await page.mouse.move(0, 0);
      await expect(page).toHaveScreenshot(`requirements-${theme}-${width}.png`);
    });
  }
}

for (const theme of ['light', 'dark']) {
  for (const width of [1440, 768]) {
    test(`read-only model exploration in ${theme} at ${width}`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 900 });
      await noViews(page);
      await page.getByRole('button', { name: 'Diagram', exact: true }).click();
      const before = (await downloadProject(page)).bundle;
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
      await expect(appearance).not.toBeVisible();
      await expect(
        page.getByRole('button', { name: 'Appearance', exact: true }),
      ).toBeFocused();
      if (width === 768) {
        await page
          .getByRole('button', { name: 'Collapse Explorer', exact: true })
          .click();
        await expect(
          page.getByRole('button', { name: 'Show Explorer', exact: true }),
        ).toBeFocused();
      }
      const scope = page.getByRole('combobox', {
        name: 'Exploration scope',
        exact: true,
      });
      const representation = page.getByRole('combobox', {
        name: 'Exploration representation',
        exact: true,
      });
      await scope.focus();
      await expect(scope).toBeFocused();
      await page.keyboard.press('Tab');
      await expect(representation).toBeFocused();
      await page.evaluate(() => document.fonts.ready);
      await page.mouse.move(0, 0);
      await expect(page).toHaveScreenshot(
        `exploration-overview-${theme}-${width}.png`,
      );
      await scope.selectOption('P::System');
      await expect(scope).toBeEnabled();
      await representation.selectOption('interconnection');
      await expect(
        page.getByRole('group', {
          name: 'part primary : Q::Motor',
          exact: true,
        }),
      ).toBeVisible();
      await expect(representation).toBeEnabled();
      await scope.focus();
      await expect(scope).toBeFocused();
      await page.keyboard.press('Tab');
      await expect(representation).toBeFocused();
      await page.mouse.move(0, 0);
      await expect(page).toHaveScreenshot(
        `exploration-structure-${theme}-${width}.png`,
      );
      expect((await downloadProject(page)).bundle).toEqual(before);
    });
  }
}

for (const theme of ['light', 'dark'])
  for (const width of [1440, 768]) {
    test(`assembly exploration routing in ${theme} at ${width}`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 900 });
      await assemblyExploration(page);
      await page.getByRole('button', { name: 'Diagram', exact: true }).click();
      await page
        .getByRole('button', { name: 'Appearance', exact: true })
        .click();
      const dialog = page.getByRole('dialog', {
        name: 'Appearance',
        exact: true,
      });
      await dialog.getByLabel('Theme', { exact: true }).selectOption(theme);
      await dialog.getByRole('button', { name: 'Done', exact: true }).click();
      await expect(
        page.getByRole('button', { name: 'Appearance', exact: true }),
      ).toBeFocused();
      if (width === 768) {
        await page
          .getByRole('button', { name: 'Collapse Explorer', exact: true })
          .click();
        await expect(
          page.getByRole('button', { name: 'Show Explorer', exact: true }),
        ).toBeFocused();
      }
      await page.getByRole('button', { name: 'Fit view', exact: true }).click();
      await expect
        .poll(async () => {
          const g = await overviewRoutingGeometry(page);
          return { hits: g.hits, count: g.labelCount };
        })
        .toEqual({ hits: [], count: 6 });
      await page.evaluate(() => document.fonts.ready);
      await page.mouse.move(0, 0);
      await expect(page).toHaveScreenshot(
        `assembly-exploration-overview-${theme}-${width}.png`,
      );
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
      await page.getByRole('button', { name: 'Fit view', exact: true }).click();
      await page.mouse.move(0, 0);
      await expect(page).toHaveScreenshot(
        `assembly-exploration-structure-${theme}-${width}.png`,
      );
    });
  }
