import { readFile } from 'node:fs/promises';
import type { Page } from '@playwright/test';
import type { EvaluatedView } from '../../src/lib/workspace/views';
import { expect, namedViewButton } from './support';

export const requirementViews = {
  requirements: 'TraceViews::requirements',
  overview: 'TraceViews::overview',
} as const;

export const expectedSatisfactionPairs = [
  [
    'TraceSystem::LeftPlant::tank',
    'TraceRequirements::leftSpecification::capacity',
  ],
  [
    'TraceSystem::RightPlant::tank',
    'TraceRequirements::rightSpecification::capacity',
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
