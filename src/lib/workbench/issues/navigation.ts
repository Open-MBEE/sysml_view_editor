import type { Diagnostic, SourceDocument } from '$lib/workspace/project';
export type SourceTarget = { file: string; start: number; end: number };
export type IssueLocation =
  { target: SourceTarget; label: string; note?: string } | { reason: string };

/** Only navigate within the exact source the engine diagnosed. */
export function issueLocation(
  issue: Diagnostic,
  diagnosed: readonly SourceDocument[],
  drafts: readonly SourceDocument[],
): IssueLocation {
  if (!issue.file) return { reason: 'No source file was reported.' };
  const draft = drafts.find((file) => file.name === issue.file);
  const original = diagnosed.find((file) => file.name === issue.file);
  if (!draft)
    return { reason: 'This source file is not in the current project.' };
  if (!original || original.text !== draft.text)
    return {
      reason:
        'This issue belongs to a different source snapshot. Apply the current draft to refresh it.',
    };
  if (issue.line === undefined)
    return {
      target: { file: draft.name, start: 0, end: 0 },
      label: `Open ${draft.name}`,
      note: 'No line was reported; opens the file without a selection.',
    };
  if (!Number.isSafeInteger(issue.line) || issue.line < 1)
    return { reason: 'The reported source line is unavailable.' };
  const breaks = [...draft.text.matchAll(/\r\n|\r|\n/g)];
  if (issue.line > breaks.length + 1)
    return { reason: 'The reported line is outside this source file.' };
  const previous = breaks[issue.line - 2];
  const start = previous ? previous.index + previous[0].length : 0;
  const end = breaks[issue.line - 1]?.index ?? draft.text.length;
  return {
    target: { file: draft.name, start, end },
    label: `Open ${draft.name} at line ${issue.line}`,
  };
}
