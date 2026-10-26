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

export async function ready(page: Page) {
  await page.goto('/');
  await expect(diagramNode(page, 'Workshop::Motor')).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'overview', exact: true }),
  ).toHaveAttribute('aria-current', 'page');
  await expect(
    page.getByRole('button', { name: 'Download project', exact: true }),
  ).toBeEnabled();
  await page.evaluate(() => document.fonts.ready);
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

export async function moveNode(page: Page, node: Locator) {
  const before = await nodePosition(node);
  await node.scrollIntoViewIfNeeded();
  const box = await node.boundingBox();
  expect(box).not.toBeNull();
  await page.mouse.move(box!.x + 30, box!.y + 25);
  await page.mouse.down();
  await page.mouse.move(box!.x + 110, box!.y + 80, { steps: 8 });
  await page.mouse.up();
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
