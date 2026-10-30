import type { Diagnostic } from '$lib/workspace/project';
export function Issues({
  diagnostics,
  error,
}: {
  diagnostics: readonly Diagnostic[];
  error: string;
}) {
  return (
    <section className="issues" aria-label="Issues">
      {!error && !diagnostics.length && (
        <p>No issues in the current applied model.</p>
      )}
      {error && <p role="alert">{error}</p>}
      {diagnostics.map((item, index) => (
        <p key={index}>
          <strong>{item.severity}</strong> {item.file ?? ''}
          {item.line ? ':' + item.line : ''} {item.message}
        </p>
      ))}
    </section>
  );
}
