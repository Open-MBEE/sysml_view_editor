import { expect, test } from 'vitest';
import { inspectionSource } from './inspection-source';

const documents = [{ name: 'model.sysml', text: '// λ\r\npart p;' }];
const origin = { file: 'model.sysml', offset: 7, length: 7 };
test('converts exact Unicode and CRLF byte ranges without requesting focus', () => {
  expect(inspectionSource(origin, documents, documents)).toEqual({
    file: 'model.sysml',
    start: 6,
    end: 13,
    focus: false,
  });
});
test('refuses changed drafts, missing files and invalid UTF-8 boundaries', () => {
  expect(
    inspectionSource(origin, documents, [
      { ...documents[0]!, text: 'changed' },
    ]),
  ).toBeUndefined();
  expect(
    inspectionSource({ ...origin, file: 'missing' }, documents, documents),
  ).toBeUndefined();
  for (const [offset, length] of [
    [4, 1],
    [0, 4],
    [-1, 1],
    [7, 100],
    [0.5, 1],
  ]) {
    expect(
      inspectionSource(
        { ...origin, offset: offset!, length: length! },
        documents,
        documents,
      ),
    ).toBeUndefined();
  }
});
