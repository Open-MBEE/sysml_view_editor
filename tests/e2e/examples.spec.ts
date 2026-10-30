import {
  test,
  waitForStartup,
  expect,
  ready,
  observeEvaluations,
  downloadProject,
  diagramSymbol,
  connectionPoints,
} from './support';
import { loadCatalog, loadExample } from '../../examples/catalog';
import { writeFile } from 'node:fs/promises';

const catalog = await loadCatalog();
for (const entry of catalog.examples) {
  test(`example library: ${entry.id}`, async ({ page }, testInfo) => {
    const observed = await observeEvaluations(page);
    await ready(page);
    observed.length = 0;
    const documents = await loadExample(entry);
    await page.locator('input[type=file]').setInputFiles(
      documents.map((item) => ({
        name: item.name,
        mimeType: 'text/plain',
        buffer: Buffer.from(item.text),
      })),
    );
    const source = page.getByRole('textbox', { name: 'SysML source' });
    await expect(source).toHaveValue(documents[0]!.text);
    const diagram = page.getByRole('region', { name: 'Diagram', exact: true });
    for (const view of entry.views) {
      const button = page.getByTitle(view.id, { exact: true });
      await button.click();
      await expect(button).toHaveAttribute('aria-current', 'page');
      await expect(button).toBeEnabled();
      await expect
        .poll(() => observed.filter((result) => result.view === view.id).length)
        .toBeGreaterThan(0);
      const result = observed.findLast((result) => result.view === view.id)!;
      expect(result.status).toBe('complete');
      expect(result.renderStatus).toBe('available');
      expect(result.artifact?.kind).toBe(view.engineKind);
      expect(result.artifact?.nodes.map((node) => node.name).sort()).toEqual(
        [...view.nodeNames].sort(),
      );
      expect(result.artifact?.edges.map((edge) => edge.kind).sort()).toEqual(
        [...view.edgeKinds].sort(),
      );
      for (const notice of view.notices) {
        expect(result.artifact?.notices).toContain(notice);
        await expect(diagram).toContainText(notice);
      }
      await expect(
        page.getByRole('region', { name: 'Issues' }),
      ).not.toBeVisible();
      if (view.app === 'unavailable') {
        await expect(
          diagram.getByRole('heading', {
            name: 'Rendering unavailable',
            exact: true,
          }),
        ).toBeVisible();
      } else if (view.nodeNames.length === 0) {
        await expect(diagram).toContainText(
          'This view exposes no renderable elements.',
        );
      } else {
        for (const node of result.artifact!.nodes)
          await expect(diagramSymbol(page, node.id)).toBeVisible();
        await expect
          .poll(async () => (await connectionPoints(page)).length)
          .toBe(result.artifact!.edges.length);
      }
      if (entry.id === 'parts' && view.engineKind === 'interconnection') {
        for (const owner of ['left', 'right']) {
          const identity = `PartExample::Machine::${owner}::motor`;
          const symbol = result.correspondence.find(
            (item) => item.subject.qualifiedName === identity,
          )!.symbol;
          await diagramSymbol(page, symbol).click();
          await expect(
            page
              .getByRole('complementary', { name: 'Properties' })
              .getByText(identity, { exact: true }),
          ).toBeVisible();
        }
      }
      await page.evaluate(() => document.fonts.ready);
      const name = view.id.replaceAll('::', '-');
      const capture = testInfo.outputPath(name + '-current.png');
      const artifact = testInfo.outputPath(name + '-engine.json');
      await diagram.screenshot({ path: capture, animations: 'disabled' });
      await writeFile(artifact, JSON.stringify(result, null, 2));
      await testInfo.attach(name + '-current', {
        path: capture,
        contentType: 'image/png',
      });
      await testInfo.attach(name + '-engine', {
        path: artifact,
        contentType: 'application/json',
      });
    }
    const { buffer, bundle } = await downloadProject(page);
    expect(bundle.documents).toEqual(documents);
    expect(bundle.drafts).toEqual(documents);
    await page.reload();
    await waitForStartup(page);
    await page.locator('input[type=file]').setInputFiles({
      name: entry.id + '.sysml-project.json',
      mimeType: 'application/json',
      buffer,
    });
    await expect(source).toHaveValue(documents[0]!.text);
    await expect(
      page.getByTitle(entry.views[0]!.id, { exact: true }),
    ).toHaveAttribute('aria-current', 'page');
    const reopened = (await downloadProject(page)).bundle;
    expect(reopened.documents).toEqual(documents);
    expect(reopened.drafts).toEqual(documents);
  });
}
