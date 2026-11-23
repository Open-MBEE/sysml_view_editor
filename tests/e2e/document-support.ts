import { activeWorkspaceTab } from './support';
import type { Page } from '@playwright/test';
import { expect } from './support';

/** Open the bundled rover and its generated report through the real pinned engine. */
export async function openRoverReport(page: Page) {
  await page.goto('/app');
  await page.getByRole('button', { name: 'Load example', exact: true }).click();
  await expect(activeWorkspaceTab(page)).toHaveAttribute(
    'title',
    'view:' + 'RoverViews::architecture',
  );
  const show = page.getByRole('button', { name: 'Show Explorer', exact: true });
  if (await show.isVisible()) await show.click();
  const explorer = page.getByRole('complementary', {
    name: 'Project navigation',
    exact: true,
  });
  const documents = explorer.getByRole('region', {
    name: 'Documents',
    exact: true,
  });
  const report = documents.getByRole('button', {
    name: 'InspectionReport',
    exact: true,
  });
  await expect(report).toHaveAttribute(
    'title',
    'RoverReport::InspectionReport',
  );
  await expect(report).toContainText('report.sysml');
  await report.click();
  await expect(report).toHaveAttribute('aria-current', 'page');
  const pane = page.getByRole('region', { name: 'Document', exact: true });
  await expect(
    pane.getByRole('heading', { name: 'Inspection Rover Report', exact: true }),
  ).toBeVisible();
  return { explorer, pane };
}
