import { readFile } from 'node:fs/promises';
import type { Locator, Page } from '@playwright/test';
import type { EvaluatedView } from '../../src/lib/workspace/views';
import { expect, namedViewButton } from './support';

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
