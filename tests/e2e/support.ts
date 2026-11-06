import {
  readExplorationResult,
  type ExplorationResult,
} from '../../src/lib/workspace/exploration';
import {
  test as base,
  expect as baseExpect,
  type Locator,
  type Page,
} from '@playwright/test';
import type { ProjectBundle } from '../../src/lib/workspace/persistence';
import { readFile } from 'node:fs/promises';
import { readEvaluatedView } from '../../src/lib/workspace/views/schema';
import type {
  EvaluatedView,
  ViewArtifact,
} from '../../src/lib/workspace/views';
import { originKey } from '../../src/lib/workspace/editing/evidence';

/** Compare saved geometry by actual per-view semantic occurrence, not n0 IDs. */
export function semanticPositions(
  bundle: ProjectBundle,
  evaluations: readonly EvaluatedView[],
) {
  const positions: Record<string, { x: number; y: number }> = {};
  function subjectKey(
    subject: EvaluatedView['correspondence'][number]['subject'],
  ) {
    if (subject.qualifiedName) return subject.qualifiedName;
    const origin = subject.origin;
    expect(
      origin,
      'An unnamed declaration must retain its exact source origin',
    ).toBeDefined();
    expect(
      origin!.nameLength,
      'A named declaration must not lose its qualified name',
    ).toBe(0);
    expect(subject.id).toBe(originKey(origin!));
    const document = bundle.documents.find(
      (item) => item.name === origin!.file,
    );
    expect(
      document,
      'The anonymous declaration belongs to an applied source',
    ).toBeDefined();
    const bytes = new TextEncoder().encode(document!.text);
    expect(origin!.offset).toBeGreaterThanOrEqual(0);
    expect(origin!.length).toBeGreaterThan(0);
    expect(origin!.offset + origin!.length).toBeLessThanOrEqual(bytes.length);
    const text = new TextDecoder('utf-8', { fatal: true }).decode(
      bytes.slice(origin!.offset, origin!.offset + origin!.length),
    );
    return JSON.stringify({ anonymousOrigin: subject.id, text });
  }
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
        expect(
          item,
          'Every occurrence context must retain source correspondence',
        ).toBeDefined();
        return subjectKey(item!.subject);
      });
      positions[JSON.stringify([view, subjectKey(match.subject), context])] = {
        ...point,
      };
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
/** Copy through the real editor clipboard command, including virtualized lines.
 * Reading the whole document focuses it and selects all; tests that assert a
 * reveal/caret use copySourceSelection instead. No private editor DOM state.
 */
export async function copySourceSelection(source: Locator) {
  const page = source.page();
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.evaluate(() => navigator.clipboard.writeText(''));
  await source.press('ControlOrMeta+c');
  return page.evaluate(() => navigator.clipboard.readText());
}
export async function readSource(source: Locator) {
  await source.press('ControlOrMeta+a');
  return copySourceSelection(source);
}
export async function fillSource(source: Locator, text: string) {
  await source.press('ControlOrMeta+a');
  await source.page().keyboard.insertText(text);
}
export const expect = baseExpect.extend({
  async toHaveSource(source: Locator, expected: string | RegExp) {
    let error: unknown;
    try {
      await baseExpect
        .poll(() => readSource(source))
        .toEqual(
          expected instanceof RegExp
            ? baseExpect.stringMatching(expected)
            : expected,
        );
    } catch (caught) {
      error = caught;
    }
    return {
      pass: !error,
      message: () =>
        error
          ? String(error)
          : 'Expected source not to match ' + String(expected),
    };
  },
});

export function diagramNode(page: Page, label: string) {
  return page
    .getByRole('region', { name: 'Diagram', exact: true })
    .getByRole('group')
    .filter({ hasText: label });
}

/** A named-view navigation button, distinct from the diagram's active-view selector. */
export function namedViewButton(page: Page, id: string) {
  return page
    .getByRole('complementary', { name: 'Project navigation', exact: true })
    .getByTitle(id, { exact: true });
}

export async function waitForStartup(page: Page, { split = true } = {}) {
  await expect(
    page.getByRole('group', {
      name: 'part compressor : CompressorInterface',
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    namedViewButton(page, 'CompressorViews::overview'),
  ).toHaveAttribute('aria-current', 'page');
  await expect(
    page.getByRole('button', { name: 'Download project', exact: true }),
  ).toBeEnabled();
  if (split)
    await page.getByRole('button', { name: 'Split', exact: true }).click();
  await page.evaluate(() => document.fonts.ready);
}

/** The app launcher is deliberately empty until an explicit project choice. */
export async function waitForLauncher(page: Page) {
  await expect(
    page.getByRole('heading', { name: 'Open a project', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Load example', exact: true }),
  ).toBeEnabled();
}

/** Explicitly choose the example; waiting for a model never creates one. */
export async function startExample(
  page: Page,
  options: { split?: boolean } = {},
) {
  await waitForLauncher(page);
  await page
    .getByRole('button', { name: 'Load air workshop', exact: true })
    .click();
  await waitForStartup(page, options);
}

/** Most diagram regressions deliberately use the pneumatic fixture after startup. */
export async function ready(page: Page, options: { split?: boolean } = {}) {
  await page.goto('/app');
  await startExample(page, options);
  await namedViewButton(page, 'CompressorViews::pneumatics').click();
  await expect(
    page.getByRole('group', { name: 'part pump : Pump', exact: true }),
  ).toBeVisible();
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
    namedViewButton(page, 'WorkshopViews::overview'),
  ).toHaveAttribute('aria-current', 'page');
  await expect(
    page.getByRole('button', { name: 'Download project', exact: true }),
  ).toBeEnabled();
}

/** The titled row identifies the declaration; its nearest treeitem owns selection. */
export function modelTreeItem(page: Page, id: string) {
  return page
    .getByRole('tree', { name: 'Model', exact: true })
    .getByRole('treeitem')
    .filter({ has: page.getByTitle(id, { exact: true }) })
    .last();
}
export async function selectModelElement(page: Page, id: string) {
  const row = page.getByTitle(id, { exact: true });
  if (!(await row.isVisible()))
    await page
      .getByRole('button', { name: 'Expand all model elements', exact: true })
      .click();
  await row.click();
  await expect(modelTreeItem(page, id)).toHaveAttribute(
    'aria-selected',
    'true',
  );
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

/** Observe actual exploration envelopes; authored view evaluation stays separate. */
export async function observeExplorations(page: Page) {
  const results: ExplorationResult[] = [];
  await page.exposeFunction('__recordExploration', (value: unknown) =>
    results.push(readExplorationResult(value)),
  );
  await page.addInitScript(() => {
    const host = window as typeof window & {
      __recordExploration(value: unknown): Promise<void>;
    };
    const NativeWorker = window.Worker;
    window.Worker = class extends NativeWorker {
      constructor(url: string | URL, options?: WorkerOptions) {
        super(url, options);
        this.addEventListener('message', (event: MessageEvent<unknown>) => {
          const reply = event.data as {
            value?: {
              schemaVersion?: unknown;
              request?: unknown;
              view?: unknown;
            };
          };
          if (
            reply?.value?.schemaVersion === 1 &&
            reply.value.request &&
            reply.value.view === undefined
          )
            void host.__recordExploration(reply.value);
        });
      }
    };
  });
  return results;
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
  // Stay inside a fitted card's header, including small action/state nodes.
  const x = box!.x + Math.min(30, box!.width / 3);
  const y = box!.y + Math.min(25, box!.height / 3);
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + 80, y + 55, { steps: 8 });
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

/** Renderer-only geometry reads stay here; callers select exact native symbols. */
export async function explorationNodeBoxes(
  page: Page,
  symbols: readonly string[],
) {
  return Promise.all(
    symbols.map(async (symbol) => {
      const box = await diagramSymbol(page, symbol).boundingBox();
      if (!box) throw new Error(`Missing exploration symbol ${symbol}`);
      return box;
    }),
  );
}
export async function explorationEdgeLabelBoxes(
  page: Page,
  symbols: readonly string[],
) {
  return Promise.all(
    symbols.map(async (symbol) => {
      const label = page
        .getByRole('region', { name: 'Diagram', exact: true })
        .locator(
          `.react-flow__edge[data-id=${JSON.stringify(symbol)}] .react-flow__edge-text`,
        );
      const box = await label.boundingBox();
      if (!box)
        throw new Error(`Missing exploration relationship label ${symbol}`);
      return box;
    }),
  );
}
export async function explorationScopeFits(page: Page) {
  return page
    .getByRole('group', { name: 'Current exploration scope', exact: true })
    .evaluate((element) => {
      const bounds = element.getBoundingClientRect();
      const strong = element.querySelector('strong')!;
      const text = strong.getBoundingClientRect();
      return (
        strong.scrollWidth <= strong.clientWidth &&
        text.left >= bounds.left - 1 &&
        text.right <= bounds.right + 1
      );
    });
}

/** Check actual SVG routes against declaration cards/headers in screen coordinates. */
export async function overviewRoutingGeometry(
  page: Page,
  unlabelled: readonly string[] = [],
  artifact?: ViewArtifact,
) {
  return page.getByRole('region', { name: 'Diagram', exact: true }).evaluate(
    (region, { unlabelled, topology }) => {
      const cards = [
        ...region.querySelectorAll<HTMLElement>('.react-flow__node'),
      ].map((node) => {
        const element = node.classList.contains('structure-compound')
          ? node.querySelector('.structure-heading')!
          : node;
        return {
          id: node.dataset.id!,
          rect: element.getBoundingClientRect(),
          body: node.getBoundingClientRect(),
          compound: node.classList.contains('structure-compound'),
        };
      });
      const viewport = region
        .querySelector('.react-flow')!
        .getBoundingClientRect();
      const hits: string[] = [],
        labels: DOMRect[] = [];
      let samples = 0;
      for (const edge of region.querySelectorAll<SVGGElement>(
        '.react-flow__edge',
      )) {
        const path = edge.querySelector<SVGPathElement>(
          '.react-flow__edge-path',
        )!;
        // Routed edges emit model-space M/L sections. Check that physical
        // handle attachment never turns a planned straight segment diagonal.
        if (edge.classList.contains('react-flow__edge-routed')) {
          const points = [
            ...(path.getAttribute('d') ?? '').matchAll(
              /[ML] ([-+\d.e]+) ([-+\d.e]+)/g,
            ),
          ].map((match) => ({ x: Number(match[1]), y: Number(match[2]) }));
          for (let index = 1; index < points.length; index++)
            if (
              Math.min(
                Math.abs(points[index]!.x - points[index - 1]!.x),
                Math.abs(points[index]!.y - points[index - 1]!.y),
              ) > 0.1
            )
              hits.push(`${edge.dataset.id} has a non-orthogonal section`);
        }
        const relationship =
          topology?.edges[Number(edge.dataset.id?.split(':')[1])];
        const contains = (owner: string, id: string): boolean => {
          for (
            let current: string | undefined = id;
            current;
            current = topology?.nodes.find(
              (node) => node.id === current,
            )?.parent
          )
            if (current === owner) return true;
          return false;
        };
        const obstacles = cards.map((card) => ({
          id: card.id,
          rect:
            relationship &&
            card.compound &&
            !contains(card.id, relationship.from) &&
            !contains(card.id, relationship.to)
              ? card.body
              : card.rect,
        }));
        const length = path.getTotalLength(),
          matrix = path.getScreenCTM()!;
        for (let distance = 0; distance <= length; distance += 3) {
          const raw = path.getPointAtLength(distance),
            point = new DOMPoint(raw.x, raw.y).matrixTransform(matrix);
          samples++;
          for (const card of obstacles) {
            const r = card.rect;
            if (
              point.x > r.left + 1 &&
              point.x < r.right - 1 &&
              point.y > r.top + 1 &&
              point.y < r.bottom - 1
            ) {
              hits.push(`${edge.dataset.id} crosses ${card.id}`);
              break;
            }
          }
        }
        const label = edge
          .querySelector('.react-flow__edge-textbg')
          ?.getBoundingClientRect();
        if (unlabelled.includes(edge.dataset.id!)) {
          if (label) hits.push(`${edge.dataset.id} unexpected label`);
          continue;
        }
        if (!label) {
          hits.push(`${edge.dataset.id} missing label`);
          continue;
        }
        for (const { id, rect: r } of obstacles)
          if (
            label.left < r.right &&
            label.right > r.left &&
            label.top < r.bottom &&
            label.bottom > r.top
          )
            hits.push(`${edge.dataset.id} label covers ${id}`);
        for (const r of labels)
          if (
            label.left < r.right &&
            label.right > r.left &&
            label.top < r.bottom &&
            label.bottom > r.top
          )
            hits.push(`${edge.dataset.id} labels overlap`);
        if (
          label.left < viewport.left ||
          label.right > viewport.right ||
          label.top < viewport.top ||
          label.bottom > viewport.bottom
        )
          hits.push(`${edge.dataset.id} label outside viewport`);
        labels.push(label);
      }
      return { hits: [...new Set(hits)], labelCount: labels.length, samples };
    },
    {
      unlabelled: [...unlabelled],
      topology: artifact
        ? {
            nodes: artifact.nodes.map((node) => ({
              id: node.id,
              parent: node.parent,
            })),
            edges: artifact.edges.map((edge) => ({
              from: edge.from,
              to: edge.to,
            })),
          }
        : undefined,
    },
  );
}

/** Product-default startup, independent of the retained air-workshop test fixture. */
export async function waitForRoverStartup(page: Page) {
  await expect(
    page.getByRole('combobox', { name: 'Named view', exact: true }),
  ).toHaveValue('RoverViews::architecture');
  await expect(
    page.getByRole('group', { name: 'part battery : Battery', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Download project', exact: true }),
  ).toBeEnabled();
  await page.evaluate(() => document.fonts.ready);
}
