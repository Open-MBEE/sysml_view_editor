import { expect, it } from 'vitest';
import { issueLocation } from './navigation';
const documents = [{ name: 'model.sysml', text: '// 🛠\r\npart café;\r\n' }];
it('selects only the reported whole line, retaining raw UTF-16/CRLF coordinates', () => {
  expect(
    issueLocation(
      { severity: 'error', message: 'bad', file: 'model.sysml', line: 2 },
      documents,
      documents,
    ),
  ).toEqual({
    target: {
      file: 'model.sysml',
      start: '// 🛠\r\n'.length,
      end: '// 🛠\r\npart café;'.length,
    },
    label: 'Open model.sysml at line 2',
  });
});
it('opens a known file without inventing a line or selecting unrelated text', () => {
  expect(
    issueLocation(
      { severity: 'error', message: 'bad', file: 'model.sysml' },
      documents,
      documents,
    ),
  ).toMatchObject({
    target: { file: 'model.sysml', start: 0, end: 0 },
    note: expect.stringContaining('No line'),
  });
});
it('refuses missing, stale and out-of-range locations', () => {
  const diagnostic = {
    severity: 'error',
    message: 'bad',
    file: 'model.sysml',
    line: 2,
  };
  expect(
    issueLocation(diagnostic, documents, [
      { ...documents[0]!, text: '// changed\r\npart other;\r\n' },
    ]),
  ).toHaveProperty(
    'reason',
    expect.stringContaining('different source snapshot'),
  );
  expect(issueLocation(diagnostic, [], documents)).toHaveProperty('reason');
  expect(issueLocation(diagnostic, documents, [])).toHaveProperty('reason');
  expect(
    issueLocation({ ...diagnostic, file: undefined }, documents, documents),
  ).toHaveProperty('reason');
  expect(
    issueLocation({ ...diagnostic, line: 99 }, documents, documents),
  ).toHaveProperty('reason', expect.stringContaining('outside'));
});
it('supports empty trailing lines and CR-only files without clamping invalid lines', () => {
  expect(
    issueLocation(
      { severity: 'error', message: 'bad', file: 'model.sysml', line: 3 },
      documents,
      documents,
    ),
  ).toMatchObject({
    target: {
      start: documents[0]!.text.length,
      end: documents[0]!.text.length,
    },
  });
  const cr = [{ name: 'model.sysml', text: 'first\rsecond' }];
  expect(
    issueLocation(
      { severity: 'error', message: 'bad', file: 'model.sysml', line: 2 },
      cr,
      cr,
    ),
  ).toMatchObject({ target: { start: 6, end: 12 } });
});
