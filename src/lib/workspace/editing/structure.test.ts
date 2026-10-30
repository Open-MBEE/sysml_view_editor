import { it, expect } from 'vitest';
import {
  compatiblePorts,
  structuralPorts,
  validateConnection,
  validateCreation,
  type PortEndpoint,
} from './structure';
import type { ModelSnapshot } from '../project';
import type { EvaluatedView } from '../views';

const output: PortEndpoint = {
  usage: 'P::a',
  port: 'output',
  symbol: 'n0.0',
  type: 'P::Signal',
  direction: 'out',
};
const input: PortEndpoint = {
  usage: 'P::b',
  port: 'input',
  symbol: 'n1.0',
  type: 'P::Signal',
  direction: 'in',
};
const model: ModelSnapshot = {
  modelHash: 'model',
  diagnostics: [],
  elements: [
    { id: 'P', name: 'P', kind: 'partDef', ownerId: null },
    { id: 'D', name: 'D', kind: 'partDef', ownerId: null },
    { id: 'P::a', name: 'a', kind: 'partUsage', ownerId: 'P', typeId: 'D' },
    { id: 'P::b', name: 'b', kind: 'partUsage', ownerId: 'P', typeId: 'D' },
    {
      id: 'D::output',
      name: 'output',
      kind: 'portUsage',
      ownerId: 'D',
      typeId: 'P::Signal',
    },
    {
      id: 'D::input',
      name: 'input',
      kind: 'portUsage',
      ownerId: 'D',
      typeId: 'P::Signal',
    },
  ],
};
const view: EvaluatedView = {
  schemaVersion: 1,
  modelHash: 'model',
  view: 'V::structure',
  status: 'complete',
  renderStatus: 'available',
  diagnostics: [],
  artifact: {
    kind: 'interconnection',
    nodes: [
      {
        id: 'n0',
        name: 'a',
        kind: 'part',
        ports: [
          { id: 'n0.0', name: 'output', type: 'Signal', direction: 'out' },
        ],
      },
      {
        id: 'n1',
        name: 'b',
        kind: 'part',
        ports: [{ id: 'n1.0', name: 'input', type: 'Signal', direction: 'in' }],
      },
    ],
    edges: [],
  },
  correspondence: [
    {
      symbol: 'n0',
      subject: { id: 'a', qualifiedName: 'P::a' },
      context: ['a'],
    },
    {
      symbol: 'n0.0',
      subject: { id: 'out', qualifiedName: 'D::output' },
      context: ['a', 'out'],
    },
    {
      symbol: 'n1',
      subject: { id: 'b', qualifiedName: 'P::b' },
      context: ['b'],
    },
    {
      symbol: 'n1.0',
      subject: { id: 'in', qualifiedName: 'D::input' },
      context: ['b', 'in'],
    },
  ],
};
it('checks resolved type, explicit direction and usage identity independently of Toolkit acceptance', () => {
  expect(compatiblePorts(output, input)).toBe(true);
  expect(compatiblePorts(output, { ...input, direction: 'out' })).toBe(false);
  expect(compatiblePorts(output, { ...input, type: 'Different::Signal' })).toBe(
    false,
  );
  expect(
    compatiblePorts(
      { ...output, direction: 'inout' },
      { ...input, direction: 'inout' },
    ),
  ).toBe(true);
  expect(
    compatiblePorts(
      { ...output, direction: 'inout' },
      { ...output, direction: 'inout' },
    ),
  ).toBe(false);
});
it('resolves repeated declarations through their owning usage context and rejects ambiguous mappings', () => {
  expect(structuralPorts(model, view)).toEqual([output, input]);
  expect(structuralPorts(model, { ...view, modelHash: 'stale' })).toEqual([]);
  expect(
    structuralPorts(model, {
      ...view,
      correspondence: [...view.correspondence, view.correspondence[1]!],
    }),
  ).toEqual([input]);
});
it('requires an explicit common owner and distinct, compatible resolved endpoints', () => {
  const command = {
    kind: 'connectPorts' as const,
    view: view.view,
    owner: 'P',
    name: 'link',
    from: { usage: 'P::a', port: 'output' },
    to: { usage: 'P::b', port: 'input' },
  };
  expect(() => validateConnection(model, view, command)).not.toThrow();
  expect(() =>
    validateConnection(model, view, { ...command, to: command.from }),
  ).toThrow('directed');
  expect(() =>
    validateConnection(model, view, { ...command, owner: 'Other' }),
  ).toThrow('owner');
  expect(() =>
    validateCreation(model, {
      kind: 'createPart',
      owner: 'P',
      type: 'Unknown',
      name: 'x',
    }),
  ).toThrow('definition');
});
