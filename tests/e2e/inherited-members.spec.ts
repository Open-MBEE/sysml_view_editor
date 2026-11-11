import { readFile } from 'node:fs/promises';
import type { Page } from '@playwright/test';
import type { EvaluatedView } from '../../src/lib/workspace/views';
import type { ProjectBundle } from '../../src/lib/workspace/persistence';
import {
  test,
  expect,
  observeEvaluations,
  diagramSymbol,
  moveNode,
  nodePosition,
  expectRenderedPositions,
  expectSeparateSiblings,
  semanticPositions,
  copySourceSelection,
  downloadProject,
  openView,
  fillSource,
} from './support';

// Captured with the real old prepared engine (WASM SHA-256
// 9149b23d80b7fd0b6935b374f0e9102c270bc5f7d595b43a8186d01dece7b663).
// Do not regenerate this fixture with the candidate engine.
const legacyBuffer = await readFile(
  new URL(
    '../fixtures/inherited-members-legacy.sysml-project.json',
    import.meta.url,
  ),
);
const legacy = JSON.parse(legacyBuffer.toString()) as ProjectBundle;
const both = 'Views::both';

async function importProject(page: Page, buffer: Buffer) {
  await page.goto('/app');
  // Each caller uses a new context: no live work or recovery may be discarded.
  await expect(
    page.getByRole('region', { name: 'Saved recovery', exact: true }),
  ).toBeHidden();
  await page.locator('input[type=file]').setInputFiles({
    name: 'inherited.sysml-project.json',
    mimeType: 'application/json',
    buffer,
  });
  await expect(
    page.getByRole('combobox', { name: 'Named view', exact: true }),
  ).toHaveValue(both);
  await expect(
    page.getByRole('button', { name: 'Download project', exact: true }),
  ).toBeEnabled();
  await page.getByRole('button', { name: 'Split', exact: true }).click();
}

async function evaluated(evaluations: EvaluatedView[], view = both) {
  await expect
    .poll(() => evaluations.some((item) => item.view === view))
    .toBe(true);
  const result = evaluations.findLast((item) => item.view === view)!;
  expect(result.status).toBe('complete');
  expect(result.renderStatus).toBe('available');
  expect(result.artifact?.kind).toBe('interconnection');
  return result;
}

function occurrence(view: EvaluatedView, owner: string, member: string) {
  const root = view.correspondence.filter(
    (item) => item.subject.qualifiedName === owner,
  );
  expect(root).toHaveLength(1);
  const declaration =
    owner === 'Demo::sat1' && member !== 'c'
      ? `${owner}::${member}`
      : `Demo::Sat::${member}`;
  const matches = view.correspondence.filter(
    (item) =>
      item.subject.qualifiedName === declaration &&
      item.context[0] === root[0]!.subject.id,
  );
  // This is the baseline-red assertion: old pruning has no c occurrence.
  expect(
    matches,
    `${owner}/${member} must retain its exact source and usage`,
  ).toHaveLength(1);
  const match = matches[0]!;
  expect(match.context).toEqual([root[0]!.subject.id, match.subject.id]);
  const nodes = view.artifact!.nodes.filter((node) => node.id === match.symbol);
  expect(nodes).toHaveLength(1);
  expect(nodes[0]!.parent).toBe(root[0]!.symbol);
  expect(nodes[0]!.inherited ?? false).toBe(
    owner === 'Demo::sat2' || (owner === 'Demo::sat1' && member === 'c'),
  );
  expect(nodes[0]!.type).toBe(
    owner === 'Demo::sat1' && member !== 'c' ? 'SmallWheel' : 'Wheel',
  );
  const text =
    owner === 'Demo::sat1' && member !== 'c'
      ? `part :>> ${member} : SmallWheel;`
      : `part ${member} : Wheel;`;
  const offset = legacy.documents[0]!.text.indexOf(text);
  expect(match.subject.id).toBe(`model.sysml@${offset}:${text.length}`);
  expect(match.subject.origin).toMatchObject({
    file: 'model.sysml',
    offset,
    length: text.length,
  });
  return { ...match, text };
}

async function inspect(
  page: Page,
  view: EvaluatedView,
  owner: string,
  member: string,
  sourceAvailable = true,
) {
  const match = occurrence(view, owner, member);
  const node = diagramSymbol(page, match.symbol);
  await expect(node).toBeVisible();
  await node.focus();
  await page.keyboard.press('Enter');
  const properties = page.getByRole('complementary', {
    name: 'Properties',
    exact: true,
  });
  await expect(
    properties.getByText(match.subject.qualifiedName!, { exact: true }),
  ).toBeVisible();
  await expect(properties.getByText(owner, { exact: true })).toBeVisible();
  const reveal = properties.getByRole('button', {
    name: 'Open source',
    exact: true,
  });
  if (!sourceAvailable) {
    await expect(reveal).toBeDisabled();
    return match;
  }
  await reveal.click();
  const source = page.getByRole('textbox', { name: 'SysML source' });
  await expect(source).toBeFocused();
  expect(await copySourceSelection(source)).toContain(match.text);
  return match;
}

test('retains inherited occurrence identity, legacy positions and exact portable drafts @critical', async ({
  page,
  browser,
}) => {
  test.setTimeout(180_000);
  const evaluations = await observeEvaluations(page);
  await importProject(page, legacyBuffer);
  const view = await evaluated(evaluations);
  const sat1c = occurrence(view, 'Demo::sat1', 'c');
  const sat2c = occurrence(view, 'Demo::sat2', 'c');
  expect(sat1c.subject).toEqual(sat2c.subject);
  expect(sat1c.context).not.toEqual(sat2c.context);
  expect(sat1c.symbol).not.toBe(sat2c.symbol);
  for (const [symbol, name, context] of [
    ['n0', 'Demo::sat1', ['model.sysml@134:69']],
    ['n1', 'Demo::sat1::a', ['model.sysml@134:69', 'model.sysml@152:24']],
    ['n2', 'Demo::sat1::b', ['model.sysml@134:69', 'model.sysml@177:24']],
    ['n3', 'Demo::sat2', ['model.sysml@206:16']],
  ] as const) {
    const matches = view.correspondence.filter(
      (item) => item.symbol === symbol,
    );
    expect(matches).toHaveLength(1);
    expect(matches[0]!.subject.qualifiedName).toBe(name);
    expect(matches[0]!.subject.id).toBe(context.at(-1));
    expect(matches[0]!.context).toEqual(context);
  }
  await expectRenderedPositions(page, legacy, both);
  await expectSeparateSiblings(page, view.artifact!);
  const restored = (await downloadProject(page)).bundle;
  expect(restored.documents).toEqual(legacy.documents);
  expect(restored.drafts).toEqual(legacy.drafts);
  expect(restored.presentations[both]).toMatchObject(
    legacy.presentations[both]!,
  );
  for (const owner of ['Demo::sat1', 'Demo::sat2']) {
    for (const member of ['a', 'b', 'c'])
      await inspect(page, view, owner, member);
  }
  const newSymbols = ['Demo::sat1', 'Demo::sat2']
    .flatMap((owner) =>
      ['a', 'b', 'c'].map((member) => occurrence(view, owner, member).symbol),
    )
    .filter((symbol) => !['n1', 'n2'].includes(symbol));
  expect(new Set(newSymbols).size).toBe(4);
  for (const symbol of newSymbols) {
    expect(Number(symbol.slice(1))).toBeGreaterThan(3);
    await expect(diagramSymbol(page, symbol)).toBeVisible();
    // Automatic layout is displayed without writing new saved positions.
    const arranged = await nodePosition(diagramSymbol(page, symbol));
    expect(Number.isFinite(arranged.x)).toBe(true);
    expect(Number.isFinite(arranged.y)).toBe(true);
  }
  const secondBefore = await nodePosition(diagramSymbol(page, sat2c.symbol));
  // Stay within the free sibling gap at the fitted camera scale. Manual
  // overlap prevention is outside this renderer's preservation contract.
  const step = { x: 0, y: 8 };
  const firstMoved = await moveNode(
    page,
    diagramSymbol(page, sat1c.symbol),
    step,
  );
  expect(await nodePosition(diagramSymbol(page, sat2c.symbol))).toEqual(
    secondBefore,
  );
  await moveNode(page, diagramSymbol(page, sat2c.symbol), step);
  expect(await nodePosition(diagramSymbol(page, sat1c.symbol))).toEqual(
    firstMoved,
  );
  const moved = (await downloadProject(page)).bundle;
  await expectRenderedPositions(page, moved, both);
  expect(moved.presentations[both]!.positions[sat1c.symbol]).not.toEqual(
    moved.presentations[both]!.positions[sat2c.symbol],
  );
  await openView(page, 'definition');
  const definition = await evaluated(evaluations, 'Views::definition');
  for (const member of ['a', 'b', 'c'])
    occurrence(definition, 'Demo::Sat', member);
  await moveNode(
    page,
    diagramSymbol(page, occurrence(definition, 'Demo::Sat', 'c').symbol),
  );
  const withDefinition = (await downloadProject(page)).bundle;
  await openView(page, 'both');
  await expectRenderedPositions(page, moved, both);
  const beforeDraft = (await downloadProject(page)).bundle;
  expect(beforeDraft.documents).toEqual(legacy.documents);
  expect(beforeDraft.drafts).toEqual(legacy.drafts);
  expect(beforeDraft.presentations['Views::definition']).toEqual(
    withDefinition.presentations['Views::definition'],
  );
  const expected = semanticPositions(beforeDraft, evaluations);
  const draft =
    legacy.documents[0]!.text +
    '\n// retained invalid inherited-members draft\npart';
  await fillSource(page.getByRole('textbox', { name: 'SysML source' }), draft);
  await page.getByRole('button', { name: 'Apply source', exact: true }).click();
  await expect(
    page.getByRole('region', { name: 'Issues', exact: true }),
  ).toBeVisible();
  const saved = await downloadProject(page);
  expect(saved.bundle.documents).toEqual(legacy.documents);
  expect(saved.bundle.drafts).toEqual([{ name: 'model.sysml', text: draft }]);
  expect(saved.bundle.presentations).toEqual(beforeDraft.presentations);
  expect(semanticPositions(saved.bundle, evaluations)).toEqual(expected);

  const fresh = await browser.newContext({
    baseURL: new URL(page.url()).origin,
    viewport: { width: 1440, height: 900 },
  });
  try {
    const reopenedPage = await fresh.newPage();
    const errors: string[] = [];
    reopenedPage.on('pageerror', (error) => errors.push(error.message));
    const reopenedEvaluations = await observeEvaluations(reopenedPage);
    await importProject(reopenedPage, saved.buffer);
    await expect(
      reopenedPage.getByRole('textbox', { name: 'SysML source' }),
    ).toHaveSource(draft);
    const reopenedView = await evaluated(reopenedEvaluations);
    await expectSeparateSiblings(reopenedPage, reopenedView.artifact!);
    for (const owner of ['Demo::sat1', 'Demo::sat2'])
      occurrence(reopenedView, owner, 'c');
    for (const name of ['definition', 'both']) {
      await openView(reopenedPage, name);
      await evaluated(reopenedEvaluations, `Views::${name}`);
      await expectRenderedPositions(
        reopenedPage,
        saved.bundle,
        `Views::${name}`,
      );
    }
    const reopened = (await downloadProject(reopenedPage)).bundle;
    expect(reopened.documents).toEqual(saved.bundle.documents);
    expect(reopened.drafts).toEqual(saved.bundle.drafts);
    expect(reopened.presentations).toEqual(saved.bundle.presentations);
    expect(semanticPositions(reopened, reopenedEvaluations)).toEqual(expected);
    for (const owner of ['Demo::sat1', 'Demo::sat2'])
      await inspect(reopenedPage, reopenedView, owner, 'c', false);
    expect(errors).toEqual([]);
  } finally {
    await fresh.close();
  }
});
