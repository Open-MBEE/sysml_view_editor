import { readFile } from 'node:fs/promises';
import {
  test,
  expect,
  ready,
  observeEvaluations,
  namedViewButton,
  downloadProject,
  fillSource,
} from './support';

test('distinguishes exposed membership from native GeneralView expansion while preserving source drafts', async ({
  page,
}) => {
  const evaluations = await observeEvaluations(page);
  await ready(page);
  const text = await readFile(
    new URL('../fixtures/general-view-filter-scope.sysml', import.meta.url),
    'utf8',
  );
  await page.locator('input[type=file]').setInputFiles({
    name: 'scope.sysml',
    mimeType: 'text/plain',
    buffer: Buffer.from(text),
  });
  await expect(namedViewButton(page, 'ScopeViews::definitions')).toBeVisible();
  await expect
    .poll(() => evaluations.some((e) => e.view === 'ScopeViews::definitions'))
    .toBe(true);
  const source = page.getByRole('textbox', {
    name: 'SysML source',
    exact: true,
  });
  const draft = text + '\n// Unapplied draft must survive browsing.\n';
  await fillSource(source, draft);
  const expectedMembers = [
    'ScopeDemo::Sat',
    'ScopeDemo::Sat::a',
    'ScopeDemo::Sat::b',
    'ScopeDemo::Sat::c',
  ];
  for (const [name, kind, selected] of [
    ['definitions', 'definition', ['ScopeDemo::Sat']],
    ['tree', 'tree', ['ScopeDemo::Sat']],
    ['definitionsAndUsages', 'definition', ['ScopeDemo::Sat']],
    ['explicitMembers', 'definition', expectedMembers],
  ] as const) {
    const view = 'ScopeViews::' + name;
    await namedViewButton(page, view).click();
    await expect(namedViewButton(page, view)).toHaveAttribute(
      'aria-current',
      'page',
    );
    await expect
      .poll(() => evaluations.some((e) => e.view === view))
      .toBe(true);
    const result = evaluations.findLast((e) => e.view === view)!;
    expect(result.status).toBe('complete');
    expect(result.artifact?.kind).toBe(kind);
    expect(result.selected!.map((s) => s.qualifiedName).sort()).toEqual(
      [...selected].sort(),
    );
    const nodes = new Set(result.artifact!.nodes.map((n) => n.id));
    const subjects = result.correspondence.filter((c) => nodes.has(c.symbol));
    expect(subjects.map((c) => c.subject.qualifiedName).sort()).toEqual(
      [
        ...(name === 'tree' || name === 'explicitMembers'
          ? expectedMembers
          : ['ScopeDemo::Sat']),
      ].sort(),
    );
    for (const { subject } of subjects) {
      expect(subject.origin?.file).toBe('scope.sysml');
      const origin = subject.origin!;
      const declaration = Buffer.from(text)
        .subarray(origin.offset, origin.offset + origin.length)
        .toString();
      const localName = subject.qualifiedName!.split('::').at(-1)!;
      expect(declaration).toContain(
        localName === 'Sat' ? 'part def Sat' : `part ${localName} : Wheel;`,
      );
    }
  }
  expect((await downloadProject(page)).bundle.documents).toEqual([
    { name: 'scope.sysml', text },
  ]);
  expect((await downloadProject(page)).bundle.drafts).toEqual([
    { name: 'scope.sysml', text: draft },
  ]);
  await expect(
    page.getByRole('button', { name: 'Apply source', exact: true }),
  ).toBeEnabled();
});
