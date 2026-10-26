import type { Diagnostic } from '$lib/workspace/project';
export function Issues({
  diagnostics,
  error,
}: {
  diagnostics: readonly Diagnostic[];
  error: string;
}) {
  if (!error && !diagnostics.length) return null;
  return (
    <section className="issues" aria-label="Issues">
      <h2>Issues</h2>
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
