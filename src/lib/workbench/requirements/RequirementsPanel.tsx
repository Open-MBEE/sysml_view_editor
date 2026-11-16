import {
  NativeSelect,
  NativeSelectOption,
} from '$lib/ui/primitives/native-select';
import { useEffect, useState } from 'react';
import type { Workspace, WorkspaceState } from '$lib/workspace/createWorkspace';
import type {
  RequirementsResult,
  RequirementSubject,
} from '$lib/workspace/requirements';
import { Button } from '$lib/ui/primitives/button';
import { Input } from '$lib/ui/primitives/input';

export function RequirementsPanel({
  workspace,
  state,
  mode,
  onInspect,
}: {
  workspace: Workspace;
  state: WorkspaceState;
  mode: 'table' | 'matrix';
  onInspect: (
    subject: RequirementSubject,
    modelHash: string,
    row?: RequirementsResult['requirements'][number],
  ) => void;
}) {
  const [result, setResult] = useState<RequirementsResult>();
  const [error, setError] = useState('');
  const [attempt, retry] = useState(0);
  const [search, setSearch] = useState('');
  const [reverse, setReverse] = useState(false);
  const [kind, setKind] = useState<'satisfaction' | 'verification'>(
    'satisfaction',
  );
  useEffect(() => {
    const controller = new AbortController();
    setResult(undefined);
    setError('');
    workspace
      .requirements(controller.signal)
      .then((value) => {
        if (!controller.signal.aborted) setResult(value);
      })
      .catch((reason) => {
        if (!controller.signal.aborted)
          setError(reason instanceof Error ? reason.message : String(reason));
      });
    return () => controller.abort();
  }, [workspace, state.model, attempt]);
  const current =
    result?.modelHash === state.model?.modelHash ? result : undefined;
  const rows = (current?.requirements ?? [])
    .filter((row) =>
      `${row.shortName} ${row.subject.qualifiedName} ${row.documentation.join(' ')}`
        .toLowerCase()
        .includes(search.toLowerCase()),
    )
    .slice()
    .sort(
      (a, b) =>
        (reverse ? -1 : 1) *
        (a.subject.qualifiedName ?? a.subject.id).localeCompare(
          b.subject.qualifiedName ?? b.subject.id,
        ),
    );
  const links = current?.relationships ?? [];
  const rowIDs = new Set(rows.map((row) => row.subject.id));
  const byTarget = new Map<string, (typeof links)[number][]>();
  const byCell = new Map<string, (typeof links)[number][]>();
  for (const link of links) {
    const targetLinks = byTarget.get(link.target.id) ?? [];
    targetLinks.push(link);
    byTarget.set(link.target.id, targetLinks);
    if (link.kind === kind) {
      const key = JSON.stringify([link.target.id, link.source.id]);
      const cell = byCell.get(key) ?? [];
      cell.push(link);
      byCell.set(key, cell);
    }
  }
  const cellLinks = (target: string, source: string) =>
    byCell.get(JSON.stringify([target, source])) ?? [];
  const relevant = links.filter(
    (link) => link.kind === kind && rowIDs.has(link.target.id),
  );
  const columns = [
    ...new Map(relevant.map((link) => [link.source.id, link.source])).values(),
  ].sort((a, b) =>
    (a.qualifiedName ?? a.id).localeCompare(b.qualifiedName ?? b.id),
  );
  const tooLarge = mode === 'matrix' && rows.length * columns.length > 10000;
  const available =
    current?.status === 'complete' &&
    current.modelHash === state.model?.modelHash &&
    !state.busy;
  function reveal(subject: RequirementSubject) {
    if (available && current)
      onInspect(
        subject,
        current.modelHash,
        current.requirements.find((row) => row.subject.id === subject.id),
      );
  }
  function exportCSV() {
    if (!available || tooLarge) return;
    const data =
      mode === 'table'
        ? [
            [
              'Identifier',
              'Requirement',
              'Kind',
              'Documentation',
              'Declared satisfaction',
              'Declared verification',
            ],
            ...rows.map((row) => [
              row.shortName,
              row.subject.qualifiedName ?? row.subject.id,
              row.kind === 'requirementDef' ? 'Definition' : 'Usage',
              row.documentation.join('\n'),
              ...(['satisfaction', 'verification'] as const).map((k) =>
                (byTarget.get(row.subject.id) ?? [])
                  .filter((l) => l.kind === k)
                  .map(
                    (l) =>
                      `${l.negated ? 'NOT ' : ''}${l.source.qualifiedName ?? l.source.id}`,
                  )
                  .join('; '),
              ),
            ]),
          ]
        : [
            ['Requirement', ...columns.map((c) => c.qualifiedName ?? c.id)],
            ...rows.map((row) => [
              row.subject.qualifiedName ?? row.subject.id,
              ...columns.map((c) =>
                cellLinks(row.subject.id, c.id)
                  .map((l) => (l.negated ? 'Negated declaration' : 'Declared'))
                  .join('; '),
              ),
            ]),
          ];
    const csv = data
      .map((row) =>
        row
          .map((value) => '"' + String(value).replaceAll('"', '""') + '"')
          .join(','),
      )
      .join('\r\n');
    const url = URL.createObjectURL(
      new Blob([csv], { type: 'text/csv;charset=utf-8' }),
    );
    const a = document.createElement('a');
    a.href = url;
    a.download = `requirements-${mode}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return (
    <section
      className="requirements-panel"
      aria-label={
        mode === 'table' ? 'Requirements table' : 'Traceability matrix'
      }
    >
      <div className="requirements-tools">
        <label>
          Search requirements
          <Input value={search} onChange={(e) => setSearch(e.target.value)} />
        </label>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setReverse(!reverse)}
        >
          Sort {reverse ? 'Z–A' : 'A–Z'}
        </Button>
        {mode === 'matrix' && (
          <label>
            Relationship
            <NativeSelect
              aria-label="Relationship"
              value={kind}
              onChange={(e) => setKind(e.target.value as typeof kind)}
            >
              <NativeSelectOption value="satisfaction">
                Satisfaction
              </NativeSelectOption>
              <NativeSelectOption value="verification">
                Verification
              </NativeSelectOption>
            </NativeSelect>
          </label>
        )}
        <Button
          size="sm"
          variant="outline"
          disabled={!available || tooLarge}
          onClick={exportCSV}
        >
          Export CSV
        </Button>
      </div>
      <p>
        Read-only · Applied model
        {state.unapplied ? ' · Unapplied drafts are retained' : ''}. Links are
        declarations, not verification results. Matrix columns show elements
        with declared links.
      </p>
      {error ? (
        <div role="alert">
          {error}{' '}
          <Button onClick={() => retry((n) => n + 1)}>
            Retry requirements
          </Button>
        </div>
      ) : !current ? (
        <p role="status">Loading requirements…</p>
      ) : current.status !== 'complete' ? (
        <div role="alert">
          Requirements unavailable: {current.diagnostics.join(' ')}
        </div>
      ) : (
        <>
          <p role="status">
            {rows.length} requirements
            {mode === 'matrix' ? ` · ${columns.length} linked elements` : ''}
          </p>
          {tooLarge ? (
            <p role="alert">
              This matrix exceeds 10,000 cells. Search requirements to narrow
              the displayed rows and linked columns.
            </p>
          ) : rows.length === 0 ? (
            <p>No requirements match this selection.</p>
          ) : (
            <div
              className="requirements-scroll"
              tabIndex={0}
              role="region"
              aria-label="Scrollable requirements data"
            >
              <table data-mode={mode}>
                <caption className="sr-only">
                  {mode === 'table'
                    ? 'Requirements and declared traceability'
                    : 'Declared requirement traceability matrix'}
                </caption>
                <thead>
                  <tr>
                    <th scope="col">Requirement</th>
                    {mode === 'table' ? (
                      <>
                        <th scope="col">Identifier</th>
                        <th scope="col">Kind</th>
                        <th scope="col">Documentation</th>
                        <th scope="col">Declared satisfaction</th>
                        <th scope="col">Declared verification</th>
                      </>
                    ) : (
                      columns.map((column) => (
                        <th scope="col" key={column.id}>
                          <button
                            disabled={!available}
                            onClick={() => reveal(column)}
                          >
                            {column.qualifiedName ?? column.id}
                          </button>
                        </th>
                      ))
                    )}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.subject.id}>
                      <th scope="row">
                        <button
                          disabled={!available}
                          onClick={() => reveal(row.subject)}
                        >
                          {row.subject.qualifiedName ?? row.subject.id}
                        </button>
                      </th>
                      {mode === 'table' ? (
                        <>
                          <td>{row.shortName || '—'}</td>
                          <td>
                            {row.kind === 'requirementDef'
                              ? 'Definition'
                              : 'Usage'}
                          </td>
                          <td>{row.documentation.join('\n') || '—'}</td>
                          {(['satisfaction', 'verification'] as const).map(
                            (k) => (
                              <td key={k}>
                                {(byTarget.get(row.subject.id) ?? [])
                                  .filter((l) => l.kind === k)
                                  .map((link, i) => (
                                    <div key={link.declaration.id + ':' + i}>
                                      <button
                                        disabled={!available}
                                        onClick={() => reveal(link.declaration)}
                                      >
                                        {link.negated ? 'Negated: ' : ''}
                                        {link.source.qualifiedName ??
                                          link.source.id}
                                      </button>
                                    </div>
                                  ))}
                              </td>
                            ),
                          )}
                        </>
                      ) : (
                        columns.map((column) => (
                          <td key={column.id}>
                            {cellLinks(row.subject.id, column.id).map(
                              (link, i) => (
                                <div key={link.declaration.id + ':' + i}>
                                  <button
                                    disabled={!available}
                                    onClick={() => reveal(link.declaration)}
                                  >
                                    {link.negated
                                      ? 'Negated declaration'
                                      : 'Declared'}
                                  </button>
                                </div>
                              ),
                            )}
                          </td>
                        ))
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </section>
  );
}
