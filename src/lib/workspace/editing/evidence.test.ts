import { describe, it, expect } from 'vitest';
import { sourceDigest } from '../project';
import {
  sourceSplices,
  verifyTransformation,
  transportSpan,
  unchangedHeader,
  verifyCreationEdit,
  type Splice,
} from './evidence';

const before = [{ name: 'a.sysml', text: '// λ 🔧\npackage A { part x; }' }];
const after = [
  { name: 'a.sysml', text: '// λ 🔧\npackage A { part longName; }' },
];
async function result(
  splices: readonly Splice[] = sourceSplices(before, after),
) {
  return {
    documents: after,
    evidence: {
      beforeHash: await sourceDigest(before),
      afterHash: await sourceDigest(after),
      splices,
    },
  };
}
describe('source-bound edit evidence', () => {
  it('permits promoting only the selected owner terminator when inserting a member', async () => {
    const before = [{ name: 'a.sysml', text: 'package P { part a : D; }' }];
    const start = before[0]!.text.indexOf('part a');
    const end = before[0]!.text.indexOf(';') + 1;
    const text = ' { part nested : D; }';
    const after = [
      {
        name: 'a.sysml',
        text:
          before[0]!.text.slice(0, end - 1) + text + before[0]!.text.slice(end),
      },
    ];
    const transformed = await verifyTransformation(before, {
      documents: after,
      evidence: {
        beforeHash: await sourceDigest(before),
        afterHash: await sourceDigest(after),
        owner: { id: 'P::a', unit: 'a.sysml', start, end },
        splices: [{ unit: 'a.sysml', start: end - 1, end, text }],
      },
    });
    expect(() => verifyCreationEdit(before, transformed, 'P::a')).not.toThrow();
    expect(() => verifyCreationEdit(before, transformed, 'P::other')).toThrow(
      'owner',
    );
    expect(() =>
      verifyCreationEdit(
        before,
        {
          ...transformed,
          evidence: {
            ...transformed.evidence,
            splices: [{ unit: 'a.sysml', start, end: start + 4, text: 'item' }],
          },
        },
        'P::a',
      ),
    ).toThrow('unrelated');
  });
  it('normalizes transport object field order before binding the published source digest', async () => {
    const input = await result();
    const verified = await verifyTransformation(before, {
      ...input,
      documents: after.map((doc) => ({ text: doc.text, name: doc.name })),
    });
    expect(await sourceDigest(verified.documents)).toBe(
      verified.evidence.afterHash,
    );
  });
  it('replays UTF-8 edits and rejects different revisions and incomplete source replacements', async () => {
    await expect(
      verifyTransformation(before, await result()),
    ).resolves.toHaveProperty('documents', after);
    const changed = await result();
    await expect(
      verifyTransformation([{ ...before[0]!, text: 'other' }], changed),
    ).rejects.toThrow('revision');
    await expect(
      verifyTransformation(before, await result([])),
    ).rejects.toThrow('reproduce');
  });
  it('rejects unknown units, overlaps, invalid offsets, split code points and malformed transports', async () => {
    const edits = sourceSplices(before, after);
    for (const broken of [
      [{ ...edits[0]!, unit: 'unknown.sysml' }],
      [edits[0]!, edits[0]!],
      [{ ...edits[0]!, end: 999 }],
      [{ ...edits[0]!, start: 4, end: 5 }],
      [{ ...edits[0]!, start: -1 }],
    ])
      await expect(
        verifyTransformation(before, await result(broken)),
      ).rejects.toThrow();
    await expect(
      verifyTransformation(before, { documents: after }),
    ).rejects.toThrow('evidence');
  });
  it('transports enclosing spans but rejects partial overlap and free-form header replacement', () => {
    const origin = {
      file: 'a.sysml',
      offset: 20,
      length: 50,
      nameOffset: 25,
      nameLength: 4,
    };
    expect(
      transportSpan(origin, [{ unit: 'a.sysml', start: 0, end: 0, text: 'λ' }]),
    ).toEqual({ file: 'a.sysml', offset: 22, length: 50 });
    expect(
      transportSpan(origin, [
        { unit: 'a.sysml', start: 40, end: 41, text: 'four' },
      ])?.length,
    ).toBe(53);
    expect(
      transportSpan(origin, [
        { unit: 'a.sysml', start: 10, end: 30, text: '' },
      ]),
    ).toBeUndefined();
    expect(
      unchangedHeader(origin, [
        { unit: 'a.sysml', start: 25, end: 29, text: 'name' },
      ]),
    ).toBe(false);
    expect(
      unchangedHeader(origin, [
        { unit: 'a.sysml', start: 40, end: 41, text: 'four' },
      ]),
    ).toBe(true);
  });
});
