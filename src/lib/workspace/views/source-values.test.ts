import { expect, test } from 'vitest';
import { validateEvaluation } from './index';

// Controlled transport fixtures verify publication rules, not SysML semantics.
const text = 'part p { attribute x = "λ"; }';
const documents = [{ name: 'model.sysml', text }];
function origin(fragment: string) {
  return {
    file: 'model.sysml',
    offset: new TextEncoder().encode(text.slice(0, text.indexOf(fragment)))
      .length,
    length: new TextEncoder().encode(fragment).length,
  };
}
function subject(fragment: string) {
  const location = origin(fragment);
  return {
    id: `${location.file}@${location.offset}:${location.length}`,
    origin: location,
  };
}
function response() {
  const owner = subject(text),
    member = subject('attribute x = "λ";');
  const row = {
    subject: member,
    name: 'x',
    context: [owner.id, member.id],
    declaration: 'attribute x = "λ";',
    value: {
      status: 'available',
      expression: '"λ"',
      expressionOrigin: origin('"λ"'),
      provider: structuredClone(member),
      isDefault: false,
      isInitial: false,
      provenance: 'own',
    },
  };
  return {
    schemaVersion: 1,
    modelHash: 'hash',
    view: 'v',
    status: 'complete',
    renderStatus: 'available',
    diagnostics: [],
    correspondence: [
      { symbol: 'owner', subject: owner, context: [owner.id] },
      { symbol: 'attribute', subject: member, context: [owner.id, member.id] },
    ],
    artifact: {
      kind: 'tree',
      nodes: [
        { id: 'owner', name: 'p', kind: 'part', sourceAttributes: [row] },
        {
          id: 'attribute',
          name: 'x',
          kind: 'attribute',
          sourceAttribute: structuredClone(row),
        },
      ],
      edges: [],
    },
  };
}
test('publishes exact UTF-8 expressions with node and compartment contexts', () => {
  const value = response();
  expect(validateEvaluation(value, 'hash', 'v', documents)).toEqual(value);
  expect(() => validateEvaluation(value, 'hash', 'v')).toThrow(
    'applied project',
  );
});
for (const fault of [
  'expression',
  'provider',
  'context',
  'declaration',
  'identity',
  'duplicate',
  'utf8',
  'provenance',
  'correspondence',
])
  test(`rejects forged source-value ${fault}`, () => {
    const value = response();
    const row = value.artifact.nodes[1]!.sourceAttribute!;
    if (fault === 'expression') row.value.expression = '"other"';
    if (fault === 'provider') row.value.expressionOrigin.offset = 0;
    if (fault === 'context') row.context[0] = 'another usage';
    if (fault === 'declaration') row.declaration = 'attribute x = 3;';
    if (fault === 'identity') row.subject.id = 'invented';
    if (fault === 'duplicate')
      value.artifact.nodes[0]!.sourceAttributes!.push(
        value.artifact.nodes[0]!.sourceAttributes![0]!,
      );
    if (fault === 'utf8') row.value.expressionOrigin.length -= 2;
    if (fault === 'provenance') row.value.provenance = 'redefined';
    if (fault === 'correspondence')
      value.correspondence.push(structuredClone(value.correspondence[1]!));
    expect(() => validateEvaluation(value, 'hash', 'v', documents)).toThrow();
  });
test('preserves explicit unsupported and absent states without inventing a value', () => {
  const value = response();
  const raw = JSON.parse(JSON.stringify(value));
  raw.artifact.nodes[1].sourceAttribute.value = {
    status: 'unsupported',
    reason: 'binding precedence unsupported',
  };
  raw.artifact.nodes[0].sourceAttributes[0].value = { status: 'absent' };
  expect(validateEvaluation(raw, 'hash', 'v', documents)).toEqual(raw);
});
