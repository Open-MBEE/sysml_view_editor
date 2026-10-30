import { it, expect } from 'vitest';
import { reconcileView } from './reconciliation';
import { transportSpan, originKey, type Splice } from '../editing/evidence';
import type { AppliedModel, SourceLocation } from '../project';
import type { EvaluatedView } from './index';

type Mutable<T> = { -readonly [K in keyof T]: Mutable<T[K]> };

const origins: Record<string, SourceLocation> = {
  P: {
    file: 'model.sysml',
    offset: 0,
    length: 200,
    nameOffset: 9,
    nameLength: 1,
  },
  'P::a': {
    file: 'model.sysml',
    offset: 30,
    length: 20,
    nameOffset: 35,
    nameLength: 1,
  },
  'P::b': {
    file: 'model.sysml',
    offset: 60,
    length: 20,
    nameOffset: 65,
    nameLength: 1,
  },
};
const before: AppliedModel = {
  sourceHash: 'a'.repeat(64),
  modelHash: 'old',
  diagnostics: [],
  elements: [
    { id: 'P', name: 'P', kind: 'partDef', ownerId: null },
    { id: 'P::a', name: 'a', kind: 'partUsage', ownerId: 'P', typeId: 'D' },
    { id: 'P::b', name: 'b', kind: 'partUsage', ownerId: 'P', typeId: 'D' },
  ],
};
function view(
  hash: string,
  ids = ['root', 'a', 'b'],
  edits: readonly Splice[] = [],
  rename = false,
): EvaluatedView {
  const refs = ['P', 'P::a', 'P::b'].map((name, i) => {
    const original = origins[name]!;
    const span = transportSpan(original, edits)!;
    const nameSpan = transportSpan(
      {
        file: original.file,
        offset: original.nameOffset!,
        length: original.nameLength!,
      },
      edits,
    )!;
    const origin = {
      ...span,
      nameOffset: nameSpan.offset,
      nameLength: nameSpan.length,
    };
    return {
      symbol: ids[i]!,
      subject: {
        id: originKey(origin),
        qualifiedName: rename && name === 'P::a' ? 'P::alpha' : name,
        origin,
      },
      context: i
        ? [originKey(transportSpan(origins.P!, edits)!), originKey(origin)]
        : [originKey(origin)],
    };
  });
  return {
    schemaVersion: 1,
    modelHash: hash,
    view: 'V::structure',
    status: 'complete',
    renderStatus: 'available',
    diagnostics: [],
    correspondence: refs,
    artifact: {
      kind: 'interconnection',
      nodes: ids.map((id, i) => ({
        id,
        name: i ? 'same label' : 'P',
        kind: i ? 'part' : 'part def',
        ...(i ? { parent: ids[0]! } : {}),
      })),
      edges: [],
    },
  };
}
const presentation = {
  sourceHash: before.sourceHash,
  modelHash: before.modelHash,
  positions: { root: { x: 0, y: 0 }, a: { x: 10, y: 20 }, b: { x: 80, y: 90 } },
};
it('maps positions by verified declaration/context after renderer IDs change, without joining equal labels', () => {
  const edits = [{ unit: 'model.sysml', start: 35, end: 36, text: 'alpha' }];
  const after = {
    ...before,
    sourceHash: 'b'.repeat(64),
    modelHash: 'fresh',
    elements: before.elements.map((item) =>
      item.id === 'P::a' ? { ...item, id: 'P::alpha', name: 'alpha' } : item,
    ),
  };
  const result = reconcileView({
    oldView: view('old'),
    newView: view('fresh', ['root', 'b', 'a'], edits, true),
    before,
    after,
    presentation,
    edits,
    command: { kind: 'rename', target: 'P::a', name: 'alpha' },
  });
  expect(result.presentation.positions).toEqual({
    root: { x: 0, y: 0 },
    b: { x: 10, y: 20 },
    a: { x: 80, y: 90 },
  });
  expect(result.presentation.sourceHash).toBe(after.sourceHash);
  expect(result.notice.invalidated).toBe(0);
});
it('invalidates ambiguous matches and changed resolved types without assigning another usage its layout', () => {
  const fresh = view('fresh');
  const ambiguous = {
    ...fresh,
    correspondence: [...fresh.correspondence, fresh.correspondence[1]!],
  };
  const after = {
    ...before,
    sourceHash: 'b'.repeat(64),
    modelHash: 'fresh',
    elements: before.elements.map((item) =>
      item.id === 'P::b' ? { ...item, typeId: 'Other' } : item,
    ),
  };
  const result = reconcileView({
    oldView: view('old'),
    newView: ambiguous,
    before,
    after,
    presentation,
    edits: [],
  });
  expect(result.presentation.positions).toEqual({ root: { x: 0, y: 0 } });
  expect(result.notice.invalidated).toBe(2);
});
it('never treats a free-form replacement through a declaration name as verified lineage', () => {
  const edits = [
    { unit: 'model.sysml', start: 35, end: 66, text: 'replacement' },
  ];
  const resized = transportSpan(origins.P!, edits)!;
  const fresh = view('fresh');
  const result = reconcileView({
    oldView: view('old'),
    newView: {
      ...fresh,
      correspondence: fresh.correspondence.map((entry, i) =>
        i
          ? entry
          : {
              ...entry,
              subject: {
                ...entry.subject,
                id: originKey(resized),
                origin: resized,
              },
              context: [originKey(resized)],
            },
      ),
    },
    before,
    after: { ...before, modelHash: 'fresh' },
    presentation,
    edits,
  });
  expect(result.presentation.positions).toEqual({ root: { x: 0, y: 0 } });
});

it.each(['owner', 'file', 'delete', 'replace'] as const)(
  'invalidates a usage after a %s change without lending its coordinates to an added node',
  (change) => {
    const fresh = structuredClone(view('fresh')) as Mutable<EvaluatedView>;
    let elements = before.elements.map((item) => ({ ...item }));
    if (change === 'owner') {
      elements = elements.map((item) =>
        item.id === 'P::a' ? { ...item, ownerId: 'Elsewhere' } : item,
      );
    } else if (change === 'file') {
      const entry = fresh.correspondence[1]!;
      const oldKey = entry.subject.id;
      entry.subject.origin!.file = 'moved.sysml';
      entry.subject.id = originKey(entry.subject.origin!);
      entry.context = entry.context.map((key) =>
        key === oldKey ? entry.subject.id : key,
      );
    } else {
      fresh.correspondence = fresh.correspondence.filter(
        (item) => item.symbol !== 'a',
      );
      fresh.artifact!.nodes = fresh.artifact!.nodes.filter(
        (item) => item.id !== 'a',
      );
      elements = elements.filter((item) => item.id !== 'P::a');
    }
    // A newly inserted declaration has no saved position, even when the renderer
    // reuses the removed node's identifier and its visible label is identical.
    if (change === 'replace') {
      fresh.artifact!.nodes.push({
        id: 'a',
        name: 'same label',
        kind: 'part',
        parent: 'root',
      });
      fresh.correspondence.push({
        symbol: 'a',
        subject: {
          id: 'model.sysml@100:20',
          qualifiedName: 'P::new',
          origin: { file: 'model.sysml', offset: 100, length: 20 },
        },
        context: [originKey(origins.P!), 'model.sysml@100:20'],
      });
      elements.push({
        id: 'P::new',
        name: 'new',
        kind: 'partUsage',
        ownerId: 'P',
        typeId: 'D',
      });
    }
    const result = reconcileView({
      oldView: view('old'),
      newView: fresh,
      before,
      after: { ...before, modelHash: 'fresh', elements },
      presentation,
      edits: [],
    });
    expect(result.presentation.positions).toEqual({
      root: { x: 0, y: 0 },
      b: { x: 80, y: 90 },
    });
    expect(result.notice.invalidated).toBe(1);
  },
);
