import { readFile } from 'node:fs/promises';
import type { Locator, Page } from '@playwright/test';
import type { EvaluatedView } from '../../src/lib/workspace/views';
import {
  expect,
  namedViewButton,
  diagramState,
  readingCenterOffset,
} from './support';

export const requirementViews = {
  requirements: 'TraceViews::requirements',
  overview: 'TraceViews::overview',
} as const;

export const expectedSatisfactionPairs = [
  [
    'TraceSystem::LeftPlant::tank',
    'TraceRequirements::leftSpecification::leftCapacity',
  ],
  [
    'TraceSystem::RightPlant::tank',
    'TraceRequirements::rightSpecification::rightCapacity',
  ],
] as const;

export async function loadRequirementsTraceability() {
  return Promise.all(
    ['system.sysml', 'requirements.sysml', 'views.sysml'].map(async (name) => ({
      name,
      text: await readFile(
        new URL(
          `../../examples/requirements-traceability/${name}`,
          import.meta.url,
        ),
        'utf8',
      ),
    })),
  );
}

export async function importRequirementsTraceability(page: Page) {
  const documents = await loadRequirementsTraceability();
  await page.locator('input[type=file]').setInputFiles(
    documents.map((document) => ({
      name: document.name,
      mimeType: 'text/plain',
      buffer: Buffer.from(document.text),
    })),
  );
  await expect(
    namedViewButton(page, requirementViews.requirements),
  ).toBeVisible();
  return documents;
}

/** Resolve actual worker correspondence, never join repeated display labels. */
export function requirementSymbol(
  result: EvaluatedView,
  qualifiedName: string,
) {
  const nodes = new Set(result.artifact?.nodes.map((node) => node.id));
  const matches = result.correspondence.filter(
    (item) =>
      nodes.has(item.symbol) && item.subject.qualifiedName === qualifiedName,
  );
  expect(matches, `Unique occurrence of ${qualifiedName}`).toHaveLength(1);
  return matches[0]!;
}

export function requirementEdgePairs(result: EvaluatedView, kind: string) {
  const subjects = new Map(
    result.correspondence.map((item) => [
      item.symbol,
      item.subject.qualifiedName,
    ]),
  );
  return (result.artifact?.edges ?? [])
    .filter((edge) => edge.kind === kind)
    .map((edge) => {
      const from = subjects.get(edge.from);
      const to = subjects.get(edge.to);
      expect(
        from,
        'Relationship source has semantic correspondence',
      ).toBeTruthy();
      expect(
        to,
        'Relationship target has semantic correspondence',
      ).toBeTruthy();
      return [from!, to!];
    })
    .sort((left, right) =>
      JSON.stringify(left).localeCompare(JSON.stringify(right)),
    );
}

export function requirementCard(
  page: Page,
  result: EvaluatedView,
  qualifiedName: string,
) {
  const identity = requirementSymbol(result, qualifiedName);
  const node = result.artifact!.nodes.find(
    (item) => item.id === identity.symbol,
  )!;
  const name = `${node.kind} ${node.shortName ? node.shortName + ' ' : ''}${node.name}${node.type ? ' : ' + node.type : ''}${node.exposure === 'contextual' ? ', related context' : ''}`;
  return page.getByRole('group', { name, exact: true });
}

export function requirementEdge(
  page: Page,
  result: EvaluatedView,
  label: string,
  from: string,
  to: string,
) {
  const nodeLabel = (qualifiedName: string) => {
    const identity = requirementSymbol(result, qualifiedName);
    const node = result.artifact!.nodes.find(
      (item) => item.id === identity.symbol,
    )!;
    return `${node.kind} ${node.shortName ? node.shortName + ' ' : ''}${node.name}${node.type ? ' : ' + node.type : ''}${node.exposure === 'contextual' ? ', related context' : ''}`;
  };
  return page.getByRole('group', {
    name: `${label}: ${nodeLabel(from)} to ${nodeLabel(to)}`,
    exact: true,
  });
}

export async function waitForRequirements(
  page: Page,
  evaluations: readonly EvaluatedView[],
) {
  await expect
    .poll(() =>
      evaluations.some((item) => item.view === requirementViews.requirements),
    )
    .toBe(true);
  const result = evaluations.findLast(
    (item) => item.view === requirementViews.requirements,
  )!;
  expect(result.status).toBe('complete');
  expect(result.renderStatus).toBe('available');
  expect(result.artifact?.kind).toBe('requirement');
  await expect(
    requirementCard(page, result, 'TraceRequirements::MinimumCapacity'),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Download project', exact: true }),
  ).toBeEnabled();
  return result;
}

/** Bind values to the accessible endpoint group, not text anywhere in Inspector. */
export function relationshipEndpoint(
  properties: Locator,
  label: 'Source' | 'Target',
) {
  return properties
    .getByRole('group', { name: `${label} endpoint`, exact: true })
    .getByRole('definition');
}

/** Renderer geometry stays in helpers; Fit must expose every requirement node. */
export async function expectRequirementsFit(page: Page) {
  const canvas = page
    .getByRole('region', { name: 'Diagram', exact: true })
    .locator('.react-flow');
  await expect
    .poll(
      () =>
        canvas.evaluate((element) => {
          const bounds = element.getBoundingClientRect();
          const nodes = [...element.querySelectorAll('.react-flow__node')];
          if (!nodes.length) return -1;
          return Math.min(
            ...nodes.map((node) => {
              const box = node.getBoundingClientRect();
              return Math.min(
                box.left - bounds.left,
                bounds.right - box.right,
                box.top - bounds.top,
                bounds.bottom - box.bottom,
              );
            }),
          );
        }),
      {
        message: 'Requirements Fit keeps every node inside the visible canvas',
      },
    )
    .toBeGreaterThanOrEqual(0);
}

/** Center the focused card with a real canvas pan, retaining model-space geometry. */
export async function centerRequirementCard(page: Page, card: Locator) {
  await settledRequirementViewport(page);
  const canvas = page
    .getByRole('region', { name: 'Diagram', exact: true })
    .locator('.react-flow');
  const bounds = (await canvas.boundingBox())!;
  const box = (await card.boundingBox())!;
  const before = await diagramState(page);
  const delta = {
    x: bounds.x + bounds.width / 2 - box.x - box.width / 2,
    y: bounds.y + bounds.height / 2 - box.y - box.height / 2,
  };
  const start = await canvas.evaluate((element, delta) => {
    const bounds = element.getBoundingClientRect();
    const candidates = [
      {
        x: delta.x >= 0 ? bounds.x + 50 : bounds.right - 50,
        y: delta.y >= 0 ? bounds.y + 50 : bounds.bottom - 50,
      },
      {
        x: delta.x >= 0 ? bounds.x + 8 : bounds.right - 8,
        y: delta.y >= 0 ? bounds.y + 8 : bounds.bottom - 8,
      },
      { x: bounds.x + 8, y: bounds.y + 8 },
      { x: bounds.right - 8, y: bounds.y + 8 },
      { x: bounds.x + 8, y: bounds.bottom - 8 },
      { x: bounds.right - 8, y: bounds.bottom - 8 },
      { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 },
    ];
    return candidates.find((point) =>
      element.ownerDocument
        .elementFromPoint(point.x, point.y)
        ?.classList.contains('react-flow__pane'),
    );
  }, delta);
  if (!start)
    throw new Error('No unobstructed canvas point for requirement panning.');
  await page.mouse.move(start.x, start.y);
  await page.mouse.down({ button: 'middle' });
  await page.mouse.move(start.x + delta.x, start.y + delta.y, { steps: 8 });
  await page.mouse.up({ button: 'middle' });
  await settledRequirementViewport(page);
  await expect
    .poll(
      async () => {
        const current = (await card.boundingBox())!;
        const viewport = (await canvas.boundingBox())!;
        return Math.min(
          current.x - viewport.x,
          current.y - viewport.y,
          viewport.x + viewport.width - current.x - current.width,
          viewport.y + viewport.height - current.y - current.height,
        );
      },
      {
        message:
          'Focused requirement card stays fully readable inside the canvas',
      },
    )
    .toBeGreaterThanOrEqual(0);
  await expect.poll(() => readingCenterOffset(card)).toBeLessThan(1);
  await expect.poll(() => diagramState(page)).toEqual(before);
}

/** Wait for rendered viewport geometry to stop changing across consecutive frames. */
async function settledRequirementViewport(page: Page) {
  return page
    .getByRole('region', { name: 'Diagram', exact: true })
    .locator('.react-flow')
    .evaluate(async (canvas) => {
      const viewport = canvas.querySelector('.react-flow__viewport');
      if (!viewport) throw new Error('Requirement viewport is unavailable.');
      let previous = '',
        stableFrames = 0;
      const deadline = performance.now() + 5000;
      while (performance.now() < deadline) {
        await new Promise<void>((resolve) =>
          requestAnimationFrame(() => resolve()),
        );
        const bounds = canvas.getBoundingClientRect();
        const transform = getComputedStyle(viewport).transform;
        const sample = JSON.stringify([
          bounds.x,
          bounds.y,
          bounds.width,
          bounds.height,
          transform,
        ]);
        stableFrames = sample === previous ? stableFrames + 1 : 0;
        if (bounds.width > 0 && bounds.height > 0 && stableFrames >= 3)
          return transform;
        previous = sample;
      }
      throw new Error('Requirement viewport geometry did not settle.');
    });
}

/**
 * Normalize through the visible maximum-zoom endpoint, then five real zoom-out
 * actions. React Flow documents each zoom-out as 1/1.2 of the previous scale.
 * This does not depend on whether initial fit finished before a panel resize.
 */
export async function zoomRequirementForReading(page: Page, card: Locator) {
  const zoomIn = page.getByRole('button', { name: 'Zoom in', exact: true });
  const zoomOut = page.getByRole('button', { name: 'Zoom out', exact: true });
  await settledRequirementViewport(page);
  for (let attempt = 0; attempt < 24 && (await zoomIn.isEnabled()); attempt++) {
    const before = (await card.boundingBox())!.width;
    await zoomIn.click();
    await settledRequirementViewport(page);
    const after = (await card.boundingBox())!.width;
    expect(
      after,
      'Each zoom-in action increases the rendered card scale',
    ).toBeGreaterThan(before);
    if (await zoomIn.isEnabled()) expect(after).toBeCloseTo(before * 1.2, 2);
  }
  await expect(
    zoomIn,
    'Reach the visible maximum zoom before normalizing',
  ).toBeDisabled();
  const maximumWidth = (await card.boundingBox())!.width;
  for (let step = 0; step < 5; step++) {
    const before = (await card.boundingBox())!.width;
    await zoomOut.click();
    await expect
      .poll(async () => (await card.boundingBox())!.width, {
        message: 'Zoom-out reaches the documented complete 1/1.2 scale step',
      })
      .toBeCloseTo(before / 1.2, 2);
    await settledRequirementViewport(page);
  }
  const width = (await card.boundingBox())!.width;
  expect(
    width,
    'Focused card has the same zoom regardless of initial fit',
  ).toBeCloseTo(maximumWidth / 1.2 ** 5, 2);
  expect(
    width,
    'Focused requirement text remains readable',
  ).toBeGreaterThanOrEqual(240);
  return width;
}
