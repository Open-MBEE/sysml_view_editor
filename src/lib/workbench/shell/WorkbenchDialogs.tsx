import {
  NativeSelect,
  NativeSelectOption,
} from '$lib/ui/primitives/native-select';
import { Input } from '$lib/ui/primitives/input';
import { Button } from '$lib/ui/primitives/button';
import { useState, type RefObject } from 'react';
import { Dialog } from '$lib/ui/Dialog';
import type {
  ModelSnapshot,
  ModelElement,
  SourceDocument,
} from '$lib/workspace/project';
import type { EditProposal, SemanticCommand } from '$lib/workspace/editing';
import type { EvaluatedView } from '$lib/workspace/views';
import { NewPartForm, NewConnectionForm } from './StructuralAuthoring';
export function WorkbenchDialogs({
  kind,
  fallbackFocus,
  model,
  selected,
  view,
  selectedSymbol,
  proposal,
  documents,
  busy,
  error,
  onClose,
  onNewProject,
  onReviewView,
  onAccept,
}: {
  kind: 'project' | 'view' | 'part' | 'connection' | 'proposal' | null;
  fallbackFocus?: RefObject<HTMLElement | null>;
  model: ModelSnapshot | null;
  selected?: ModelElement;
  view: EvaluatedView | null;
  selectedSymbol?: string;
  proposal?: EditProposal;
  documents: readonly SourceDocument[];
  busy: boolean;
  error: string;
  onClose: () => void;
  onNewProject: (name: string) => void;
  onReviewView: (command: SemanticCommand) => void;
  onAccept: () => void;
}) {
  return (
    <Dialog
      fallbackFocus={fallbackFocus}
      open={kind !== null}
      title={
        kind === 'project'
          ? 'New project'
          : kind === 'view'
            ? 'New view'
            : kind === 'part'
              ? 'New part'
              : kind === 'connection'
                ? 'Connect ports'
                : 'Review source change'
      }
      onClose={onClose}
    >
      {kind === 'project' && (
        <NewProjectForm onClose={onClose} onCreate={onNewProject} />
      )}
      {kind === 'view' && model && (
        <NewViewForm
          model={model}
          selected={selected}
          busy={busy}
          onClose={onClose}
          onReview={onReviewView}
        />
      )}
      {kind === 'part' && model && (
        <NewPartForm
          model={model}
          selected={selected}
          view={view}
          busy={busy}
          onClose={onClose}
          onReview={onReviewView}
        />
      )}
      {kind === 'connection' && model && (
        <NewConnectionForm
          model={model}
          selected={selected}
          selectedSymbol={selectedSymbol}
          view={view}
          busy={busy}
          onClose={onClose}
          onReview={onReviewView}
        />
      )}
      {kind === 'proposal' && proposal && (
        <>
          <p>
            Review the exact source changes. All project sources have been
            validated.
          </p>
          {!!proposal.layoutNotices.length && (
            <section aria-label="Layout preservation">
              <h3>Diagram positions</h3>
              <ul>
                {proposal.layoutNotices.map((notice) => (
                  <li key={notice.view}>
                    {notice.view}: {notice.retained} retained
                    {notice.invalidated
                      ? `, ${notice.invalidated} will be arranged again. ${notice.reason ?? ''}`
                      : ''}
                  </li>
                ))}
              </ul>
            </section>
          )}
          {proposal.documents
            .filter(
              (document) =>
                document.text !==
                documents.find((item) => item.name === document.name)?.text,
            )
            .map((document) => (
              <section key={document.name}>
                <h3>{document.name}</h3>
                <div className="source-review">
                  <section>
                    <h4>Before</h4>
                    <pre>
                      {
                        documents.find((item) => item.name === document.name)
                          ?.text
                      }
                    </pre>
                  </section>
                  <section>
                    <h4>After</h4>
                    <pre>{document.text}</pre>
                  </section>
                </div>
              </section>
            ))}
          <div className="dialog-actions">
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button variant="default" onClick={onAccept} autoFocus>
              Apply change
            </Button>
          </div>
        </>
      )}
      {error && (
        <p className="dialog-error" role="alert">
          {error}
        </p>
      )}
    </Dialog>
  );
}
function NewProjectForm({
  onClose,
  onCreate,
}: {
  onClose: () => void;
  onCreate: (name: string) => void;
}) {
  const [name, setName] = useState('My project');
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        onCreate(name);
      }}
    >
      <p>Start with one SysML source file.</p>
      <label htmlFor="project-name">Project name</label>
      <Input
        id="project-name"
        value={name}
        onChange={(event) => setName(event.target.value)}
        maxLength={120}
        required
      />
      <div className="dialog-actions">
        <Button variant="ghost" type="button" onClick={onClose}>
          Cancel
        </Button>
        <Button variant="default">Create project</Button>
      </div>
    </form>
  );
}
function initialView(model: ModelSnapshot, selected?: ModelElement) {
  const subject =
    selected ?? model.elements.find((item) => item.kind === 'package');
  let owner = subject;
  const seen = new Set<string>();
  while (owner && owner.kind !== 'package' && !seen.has(owner.id)) {
    seen.add(owner.id);
    const ownerId = owner.ownerId;
    owner = model.elements.find((item) => item.id === ownerId);
  }
  owner =
    owner?.kind === 'package'
      ? owner
      : model.elements.find((item) => item.kind === 'package');
  const base = (subject?.name ?? 'Model') + 'View';
  let name = base,
    suffix = 2;
  while (model.elements.some((item) => item.id === owner?.id + '::' + name))
    name = base + suffix++;
  return { name, owner: owner?.id ?? '', subject: subject?.id ?? '' };
}
function NewViewForm({
  model,
  selected,
  busy,
  onClose,
  onReview,
}: {
  model: ModelSnapshot;
  selected?: ModelElement;
  busy: boolean;
  onClose: () => void;
  onReview: (command: SemanticCommand) => void;
}) {
  const [seed] = useState(() => initialView(model, selected));
  const [name, setName] = useState(seed.name),
    [owner, setOwner] = useState(seed.owner),
    [subject, setSubject] = useState(seed.subject),
    [family, setFamily] = useState<'GeneralView' | 'InterconnectionView'>(
      'GeneralView',
    );
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        onReview({ kind: 'createView', owner, subject, name, family });
      }}
    >
      <p>Create a named view of existing model content.</p>
      <label htmlFor="view-name">View name</label>
      <Input
        id="view-name"
        value={name}
        onChange={(event) => setName(event.target.value)}
        required
      />
      <label htmlFor="view-subject">Show</label>
      <NativeSelect
        id="view-subject"
        value={subject}
        onChange={(event) => setSubject(event.target.value)}
      >
        {model.elements
          .filter((item) => !['viewDef', 'viewUsage'].includes(item.kind))
          .map((item) => (
            <NativeSelectOption key={item.id} value={item.id}>
              {item.id}
            </NativeSelectOption>
          ))}
      </NativeSelect>
      <label htmlFor="view-family">Representation</label>
      <NativeSelect
        id="view-family"
        value={family}
        onChange={(event) => setFamily(event.target.value as typeof family)}
      >
        <NativeSelectOption value="GeneralView">
          Overview tree
        </NativeSelectOption>
        <NativeSelectOption value="InterconnectionView">
          Structure
        </NativeSelectOption>
      </NativeSelect>
      <details>
        <summary>Advanced</summary>
        <label htmlFor="view-owner">Source package</label>
        <NativeSelect
          id="view-owner"
          value={owner}
          onChange={(event) => setOwner(event.target.value)}
        >
          {model.elements
            .filter((item) => item.kind === 'package')
            .map((item) => (
              <NativeSelectOption key={item.id} value={item.id}>
                {item.id}
              </NativeSelectOption>
            ))}
        </NativeSelect>
      </details>
      <div className="dialog-actions">
        <Button variant="ghost" type="button" onClick={onClose}>
          Cancel
        </Button>
        <Button variant="default" disabled={busy || !owner || !subject}>
          Review source
        </Button>
      </div>
    </form>
  );
}
