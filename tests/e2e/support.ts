import {
  test as base,
  expect,
  type Locator,
  type Page,
} from '@playwright/test';
import type { ProjectBundle } from '../../src/lib/workspace/persistence';
import { readFile } from 'node:fs/promises';
import { readEvaluatedView } from '../../src/lib/workspace/views/schema';
import type { EvaluatedView } from '../../src/lib/workspace/views';

/** Compare saved geometry by actual per-view semantic occurrence, not n0 IDs. */
export function semanticPositions(
  bundle: ProjectBundle,
  evaluations: readonly EvaluatedView[],
) {
  const positions: Record<string, { x: number; y: number }> = {};
  for (const [view, presentation] of Object.entries(bundle.presentations)) {
    const evaluated = evaluations.findLast(
      (item) => item.view === view && item.modelHash === presentation.modelHash,
    );
    expect(
      evaluated,
      `Missing actual engine evaluation for ${view}`,
    ).toBeDefined();
    for (const [symbol, point] of Object.entries(presentation.positions)) {
      const matches = evaluated!.correspondence.filter(
        (item) => item.symbol === symbol,
      );
      expect(matches).toHaveLength(1);
      const match = matches[0]!;
      const context = match.context.map((origin) => {
        const item = evaluated!.correspondence.find(
          (item) => item.subject.id === origin,
        );
        expect(item?.subject.qualifiedName).toBeTruthy();
        return item!.subject.qualifiedName!;
      });
      positions[JSON.stringify([view, match.subject.qualifiedName, context])] =
        { ...point };
    }
  }
  return positions;
}

export const test = base.extend<{ pageErrors: void }>({
  pageErrors: [
    async ({ page }, use, testInfo) => {
      const errors: string[] = [];
      const onError = (error: Error) =>
        errors.push(error.stack ?? error.message);
      page.on('pageerror', onError);
      await use();
      page.off('pageerror', onError);
      if (errors.length)
        await testInfo.attach('uncaught-page-errors', {
          body: errors.join('\n\n'),
          contentType: 'text/plain',
        });
      expect(errors, 'Uncaught browser errors').toEqual([]);
    },
    { auto: true },
  ],
});
export { expect };

export function diagramNode(page: Page, label: string) {
  return page
    .getByRole('region', { name: 'Diagram', exact: true })
    .getByRole('group')
    .filter({ hasText: label });
}

export async function waitForStartup(page: Page, { split = true } = {}) {
  await expect(
    page.getByRole('group', { name: 'part pump : Pump', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByTitle('CompressorViews::pneumatics', { exact: true }),
  ).toHaveAttribute('aria-current', 'page');
  await expect(
    page.getByRole('button', { name: 'Download project', exact: true }),
  ).toBeEnabled();
  if (split)
    await page.getByRole('button', { name: 'Split', exact: true }).click();
  await page.evaluate(() => document.fonts.ready);
}

export async function ready(page: Page, options: { split?: boolean } = {}) {
  await page.goto('/');
  await waitForStartup(page, options);
}

/** Keep focused history/appearance regressions explicit about their small fixture. */
export async function openWorkshop(page: Page) {
  await ready(page);
  await importWorkshop(page);
}

export async function importWorkshop(page: Page) {
  const documents = await Promise.all(
    ['model.sysml', 'views.sysml'].map(async (name) => ({
      name,
      text: await readFile(
        new URL(`../../examples/workshop/${name}`, import.meta.url),
        'utf8',
      ),
    })),
  );
  await page.locator('input[type=file]').setInputFiles({
    name: 'workshop.sysml-project.json',
    mimeType: 'application/json',
    buffer: Buffer.from(
      JSON.stringify({
        format: 'sysmlv2-view-project',
        version: 1,
        name: 'Workshop',
        documents,
        drafts: documents,
        presentations: {},
      }),
    ),
  });
  await expect(diagramNode(page, 'Workshop::Motor')).toBeVisible();
  await expect(
    page.getByTitle('WorkshopViews::overview', { exact: true }),
  ).toHaveAttribute('aria-current', 'page');
  await expect(
    page.getByRole('button', { name: 'Download project', exact: true }),
  ).toBeEnabled();
}

export async function openView(page: Page, name: string) {
  const button = page.getByRole('button', { name, exact: true });
  await button.click();
  await expect(button).toHaveAttribute('aria-current', 'page');
  await expect(button).toBeEnabled();
}

/** Observe the real worker replies without replacing requests or responses. */
export async function observeEvaluations(page: Page) {
  const evaluations: EvaluatedView[] = [];
  await page.exposeFunction('__recordExampleEvaluation', (value: unknown) => {
    evaluations.push(readEvaluatedView(value));
  });
  await page.addInitScript(() => {
    const host = window as typeof window & {
      __recordExampleEvaluation: (value: unknown) => Promise<void>;
    };
    const NativeWorker = window.Worker;
    window.Worker = class extends NativeWorker {
      constructor(url: string | URL, options?: WorkerOptions) {
        super(url, options);
        this.addEventListener('message', (event: MessageEvent<unknown>) => {
          const reply = event.data as {
            value?: { schemaVersion?: unknown; view?: unknown };
          };
          if (
            reply?.value?.schemaVersion === 1 &&
            typeof reply.value.view === 'string'
          )
            void host.__recordExampleEvaluation(reply.value);
        });
      }
    };
  });
  return evaluations;
}

export function diagramSymbol(page: Page, id: string) {
  return page
    .getByRole('region', { name: 'Diagram', exact: true })
    .locator(`.react-flow__node[data-id=${JSON.stringify(id)}]`);
}

export async function importAssembly(page: Page) {
  const documents = await Promise.all(
    ['model.sysml', 'views.sysml'].map(async (name) => ({
      name,
      text: await readFile(
        new URL(`../../examples/assembly/${name}`, import.meta.url),
        'utf8',
      ),
    })),
  );
  await page.locator('input[type=file]').setInputFiles(
    documents.map((item) => ({
      name: item.name,
      mimeType: 'text/plain',
      buffer: Buffer.from(item.text),
    })),
  );
  await expect(
    page.getByRole('button', { name: 'structure', exact: true }),
  ).toHaveAttribute('aria-current', 'page');
  await expect(
    page.getByRole('group', { name: 'part primary : Device', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Download project', exact: true }),
  ).toBeEnabled();
  return documents;
}

export async function showAssemblyDiagram(page: Page) {
  const station = page.getByRole('group', {
    name: 'part def Assembly::Station',
    exact: true,
  });
  const before = (await station.boundingBox())!.width;
  await page.getByRole('button', { name: 'Diagram', exact: true }).click();
  await expect
    .poll(async () => (await station.boundingBox())!.width)
    .toBeGreaterThan(before + 50);
}

export async function connectionPoints(page: Page) {
  return page
    .getByRole('region', { name: 'Diagram', exact: true })
    .locator('.react-flow__edge-path')
    .evaluateAll((paths) =>
      paths.map((element) => {
        const path = element as SVGPathElement;
        const matrix = path.getScreenCTM()!;
        const start = path.getPointAtLength(0).matrixTransform(matrix);
        const end = path
          .getPointAtLength(path.getTotalLength())
          .matrixTransform(matrix);
        return {
          start: { x: start.x, y: start.y },
          end: { x: end.x, y: end.y },
        };
      }),
    );
}

export async function portAnchor(button: Locator, type: 'source' | 'target') {
  return button.evaluate((element, type) => {
    const handle = element
      .closest('.structure-port')!
      .querySelector(`.react-flow__handle.${type}`)!;
    const rect = handle.getBoundingClientRect();
    // React Flow terminates a connector at the outward edge of the handle.
    return {
      x: handle.classList.contains('react-flow__handle-right')
        ? rect.right
        : rect.left,
      y: rect.y + rect.height / 2,
    };
  }, type);
}

// Read model-space coordinates from the rendered node; screen coordinates also
// include the camera's fit/zoom transform and cannot establish saved geometry.
export async function nodePosition(node: Locator) {
  return node.evaluate((element) => {
    const matrix = new DOMMatrixReadOnly(getComputedStyle(element).transform);
    return { x: matrix.m41, y: matrix.m42 };
  });
}

/** Check displayed model-space geometry, independently of serialized records. */
export async function expectRenderedPositions(
  page: Page,
  bundle: ProjectBundle,
  view: string,
) {
  const presentation = bundle.presentations[view];
  expect(presentation, `Missing saved presentation for ${view}`).toBeDefined();
  for (const [symbol, expected] of Object.entries(presentation!.positions)) {
    const node = diagramSymbol(page, symbol);
    await expect(node).toBeVisible();
    await expect
      .poll(
        async () => {
          return node.evaluate((element, expected) => {
            // CSSOM rounds transforms to browser precision. Compare against
            // browser-normalized expected coordinates, while bundle checks
            // independently require exact saved doubles and semantic identity.
            const probe = document.createElement('div');
            probe.style.cssText =
              'position:fixed;visibility:hidden;pointer-events:none;width:0;height:0';
            probe.style.transform = `translate(${expected.x}px,${expected.y}px)`;
            document.body.append(probe);
            try {
              const actual = new DOMMatrixReadOnly(
                getComputedStyle(element).transform,
              );
              const rendered = new DOMMatrixReadOnly(
                getComputedStyle(probe).transform,
              );
              return Math.max(
                Math.abs(actual.m41 - rendered.m41),
                Math.abs(actual.m42 - rendered.m42),
              );
            } finally {
              probe.remove();
            }
          }, expected);
        },
        { message: `Rendered position of ${view}/${symbol}` },
      )
      .toBeLessThan(0.0001);
  }
}

export async function diagramState(page: Page) {
  return page
    .getByRole('region', { name: 'Diagram', exact: true })
    .locator('.react-flow__node')
    .evaluateAll((nodes) =>
      nodes.map((element) => ({
        symbol: element.getAttribute('data-id'),
        label: element.textContent,
        transform: getComputedStyle(element).transform,
      })),
    );
}

export async function dragNode(page: Page, node: Locator) {
  await node.scrollIntoViewIfNeeded();
  const box = await node.boundingBox();
  expect(box).not.toBeNull();
  await page.mouse.move(box!.x + 30, box!.y + 25);
  await page.mouse.down();
  await page.mouse.move(box!.x + 110, box!.y + 80, { steps: 8 });
  await page.mouse.up();
}

export async function moveNode(page: Page, node: Locator) {
  const before = await nodePosition(node);
  await dragNode(page, node);
  await expect.poll(() => nodePosition(node)).not.toEqual(before);
  return nodePosition(node);
}

export async function downloadProject(page: Page) {
  const pending = page.waitForEvent('download');
  await page
    .getByRole('button', { name: 'Download project', exact: true })
    .click();
  const download = await pending;
  expect(download.suggestedFilename()).toMatch(/\.sysml-project\.json$/);
  const stream = await download.createReadStream();
  expect(stream).not.toBeNull();
  const chunks: Buffer[] = [];
  for await (const chunk of stream!) chunks.push(Buffer.from(chunk));
  const buffer = Buffer.concat(chunks);
  return { buffer, bundle: JSON.parse(buffer.toString()) as ProjectBundle };
}

/** Pane and renderer geometry reads stay here; interactions use accessible names. */
export async function regionSize(region: Locator, axis: 'width' | 'height') {
  const box = await region.boundingBox();
  if (!box) throw new Error('Expected a visible workspace region.');
  return box[axis];
}
export async function dragSeparator(
  page: Page,
  name: string,
  axis: 'x' | 'y',
  delta: number,
) {
  const handle = page.getByRole('separator', { name, exact: true });
  const box = await handle.boundingBox();
  if (!box) throw new Error('Expected a visible panel separator.');
  const x = box.x + box.width / 2,
    y = box.y + box.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(
    x + (axis === 'x' ? delta : 0),
    y + (axis === 'y' ? delta : 0),
    { steps: 8 },
  );
  await page.mouse.up();
}
export async function diagramCamera(page: Page) {
  return page
    .getByRole('region', { name: 'Diagram', exact: true })
    .locator('.react-flow__viewport')
    .evaluate((element) => {
      const matrix = new DOMMatrixReadOnly(getComputedStyle(element).transform);
      return { x: matrix.e, y: matrix.f, zoom: matrix.a };
    });
}
export async function panDiagram(page: Page) {
  const pane = page
    .getByRole('region', { name: 'Diagram', exact: true })
    .locator('.react-flow__pane');
  const box = await pane.boundingBox();
  if (!box) throw new Error('Expected a visible diagram canvas.');
  await page.mouse.move(box.x + 8, box.y + 8);
  await page.mouse.down();
  await page.mouse.move(box.x + 43, box.y + 25, { steps: 5 });
  await page.mouse.up();
}

export async function toolbarCenterOffsets(page: Page) {
  const center = async (locator: Locator) => {
    const box = await locator.boundingBox();
    if (!box) throw new Error('Expected a visible toolbar group or pane.');
    return box.x + box.width / 2;
  };
  return {
    source: Math.abs(
      (await center(
        page.getByRole('group', { name: 'Source actions', exact: true }),
      )) -
        (await center(
          page.getByRole('region', { name: 'Source editor', exact: true }),
        )),
    ),
    modes: Math.abs(
      (await center(
        page.getByRole('group', { name: 'Editor layout', exact: true }),
      )) -
        (await center(
          page.getByRole('region', { name: 'Diagram', exact: true }),
        )),
    ),
  };
}
export async function iconCenterOffset(button: Locator) {
  return button.evaluate((element) => {
    const box = element.getBoundingClientRect();
    const icon = element.querySelector('svg')!.getBoundingClientRect();
    return Math.max(
      Math.abs(icon.x + icon.width / 2 - box.x - box.width / 2),
      Math.abs(icon.y + icon.height / 2 - box.y - box.height / 2),
    );
  });
}
export async function railEdgeOffset(
  page: Page,
  label: string,
  side: 'left' | 'right',
) {
  const main = await page
    .getByRole('main', { name: 'Model workspace', exact: true })
    .boundingBox();
  const button = await page
    .getByRole('button', { name: label, exact: true })
    .boundingBox();
  if (!main || !button)
    throw new Error('Expected a visible workspace and reopen control.');
  return side === 'left'
    ? button.x - main.x
    : main.x + main.width - button.x - button.width;
}
