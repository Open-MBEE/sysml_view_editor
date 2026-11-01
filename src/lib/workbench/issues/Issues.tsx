import type { Diagnostic, SourceDocument } from '$lib/workspace/project';
import { Button } from '$lib/ui/primitives/button';
import { issueLocation } from './navigation';
export function Issues({
  diagnostics,
  diagnosticDocuments,
  drafts,
  error,
  onNavigate,
}: {
  diagnostics: readonly Diagnostic[];
  diagnosticDocuments: readonly SourceDocument[];
  drafts: readonly SourceDocument[];
  error: string;
  onNavigate: (issue: Diagnostic) => void;
}) {
  return (
    <section className="issues" aria-label="Issues">
      {!error && !diagnostics.length && (
        <p>No issues in the current applied model.</p>
      )}
      {error && <p role="alert">{error}</p>}
      <ul className="issue-list">
        {diagnostics.map((item, index) => {
          const location = issueLocation(item, diagnosticDocuments, drafts);
          return (
            <li key={index}>
              <div className="issue-location">
                <strong>{item.severity}</strong>
                {'target' in location ? (
                  <>
                    <Button
                      variant="link"
                      size="xs"
                      aria-label={location.label}
                      onClick={() => onNavigate(item)}
                    >
                      {item.file}
                      {item.line !== undefined ? ':' + item.line : ''}
                    </Button>
                    {location.note && <span>{location.note}</span>}
                  </>
                ) : (
                  <span>
                    {item.file}
                    {item.line ? ':' + item.line : ''} {location.reason}
                  </span>
                )}
              </div>
              <p>{item.message}</p>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
