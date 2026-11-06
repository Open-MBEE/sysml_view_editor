import { it, expect } from 'vitest';
import { validateRequirementsResult } from './index';
const documents = [{ name: 'model.sysml', text: 'requirement r;' }];
const subject = {
  id: 'model.sysml@0:14',
  qualifiedName: 'r',
  origin: {
    file: 'model.sysml',
    offset: 0,
    length: 14,
    nameOffset: 12,
    nameLength: 1,
  },
};
const result = {
  schemaVersion: 1,
  modelHash: 'h',
  status: 'complete',
  diagnostics: [],
  requirements: [
    { subject, kind: 'requirementUsage', shortName: 'R', documentation: [] },
  ],
  relationships: [],
};
it('distinguishes valid empty and unavailable results, rejects stale and outside source', () => {
  expect(validateRequirementsResult(result, 'h', documents)).toEqual(result);
  expect(
    validateRequirementsResult({ ...result, requirements: [] }, 'h', documents)
      .status,
  ).toBe('complete');
  expect(() => validateRequirementsResult(result, 'other', documents)).toThrow(
    'Stale',
  );
  expect(() =>
    validateRequirementsResult(
      { ...result, status: 'indeterminate' },
      'h',
      documents,
    ),
  ).toThrow('Incomplete');
  expect(() => validateRequirementsResult(result, 'h', [])).toThrow('outside');
  expect(() =>
    validateRequirementsResult(
      {
        ...result,
        requirements: [...result.requirements, ...result.requirements],
      },
      'h',
      documents,
    ),
  ).toThrow('Duplicate');
});
