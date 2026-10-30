import { expect, it } from 'vitest';
import {
  indexModelTree,
  modelAncestors,
  modelKindLabel,
  modelTypeLabel,
  visibleModelRows,
} from './model-tree';
import type { ModelElement } from '$lib/workspace/project';

const element = (
  id: string,
  ownerId: string | null,
  kind = 'partUsage',
): ModelElement => ({ id, name: id, ownerId, kind });

it('uses recorded ownership rather than qualified-name prefixes and keeps distinct repeated members', () => {
  const tree = indexModelTree([
    element('package', null, 'package'),
    element('unrelated::definition', 'package', 'actionDef'),
    { ...element('first::reading', 'unrelated::definition'), name: 'reading' },
    { ...element('second::reading', 'package'), name: 'reading' },
  ]);
  expect(tree.roots).toEqual(['package']);
  expect(modelAncestors(tree, 'first::reading')).toEqual([
    'unrelated::definition',
    'package',
  ]);
  expect(visibleModelRows(tree, new Set())).toEqual([
    { id: 'package', depth: 0 },
  ]);
  expect(
    visibleModelRows(tree, new Set(['package', 'unrelated::definition'])),
  ).toEqual([
    { id: 'package', depth: 0 },
    { id: 'unrelated::definition', depth: 1 },
    { id: 'first::reading', depth: 2 },
    { id: 'second::reading', depth: 1 },
  ]);
});

it('keeps view declarations and their rendering members in view navigation without inventing model owners', () => {
  const tree = indexModelTree([
    element('package', null, 'package'),
    element('view', 'package', 'viewUsage'),
    element('rendering', 'view', 'renderingUsage'),
    element('nested', 'rendering'),
    element('part', 'package'),
  ]);
  expect([...tree.nodes.keys()]).toEqual(['package', 'part']);
  expect(tree.unavailable.size).toBe(0);
});

it('retains missing-owner and cyclic declarations with an explicit ownership notice', () => {
  const tree = indexModelTree([
    element('missing', 'absent'),
    element('a', 'b'),
    element('b', 'a'),
    element('child', 'a'),
    element('self', 'self'),
  ]);
  expect(tree.roots).toEqual(['missing', 'a', 'b', 'self']);
  expect([...tree.unavailable]).toEqual(['missing', 'a', 'b', 'self']);
  expect(modelAncestors(tree, 'child')).toEqual(['a']);
  expect(visibleModelRows(tree, new Set(tree.nodes.keys()))).toHaveLength(5);
});

it('shows resolved local and external type labels without inventing bindings', () => {
  const tree = indexModelTree([
    { ...element('type', null, 'itemDef'), name: 'PressureReading' },
    { ...element('reading', null, 'itemUsage'), typeId: 'type' },
    {
      ...element('value', null, 'attributeUsage'),
      typeId: 'ScalarValues::Real',
    },
  ]);
  expect(modelTypeLabel(tree.nodes.get('reading')!.element, tree)).toBe(
    'PressureReading',
  );
  expect(modelTypeLabel(tree.nodes.get('value')!.element, tree)).toBe('Real');
  expect(modelTypeLabel(tree.nodes.get('type')!.element, tree)).toBeUndefined();
  expect(modelKindLabel('actionDef')).toBe('action def');
  expect(modelKindLabel('itemUsage')).toBe('item');
});
