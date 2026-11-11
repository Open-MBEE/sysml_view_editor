import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ExternalLink } from 'lucide-react';
import { Button } from '$lib/ui/primitives/button';
import { Diagram } from '../diagrams/Diagram';
import type { Workspace, WorkspaceState } from '$lib/workspace/createWorkspace';
import type { DocumentClick } from '$lib/workspace/documents';
import type { EvaluatedView } from '$lib/workspace/views';
import { contentPath, sanitizeDocumentHtml } from './document-html';

interface DiagramMount {
  readonly key: string;
  readonly view: string;
  readonly caption: string;
  readonly notice: string;
  readonly node: HTMLElement;
}

/** Read-only rendering of the engine's HTML with native diagrams mounted in place of Mermaid fences. */
export function DocumentPane({
  workspace,
  state,
  onReveal,
  onOpenView,
}: {
  workspace: Workspace;
  state: WorkspaceState;
  onReveal: (click: DocumentClick) => void;
  onOpenView: (id: string) => void;
}) {
  const rendered = state.renderedDocument;
  const container = useRef<HTMLDivElement>(null);
  const [mounts, setMounts] = useState<DiagramMount[]>([]);
  useLayoutEffect(() => {
    const host = container.current;
    if (!host) return;
    if (!rendered || rendered.status !== 'complete') {
      host.replaceChildren();
      setMounts([]);
      return;
    }
    host.replaceChildren(sanitizeDocumentHtml(rendered.content));
    // Native heading/row semantics stay; only href-less reference anchors need a role.
    for (const element of host.querySelectorAll<HTMLElement>(
      '[data-element], h1, h2, h3, h4, h5, h6, .sysml-paragraph',
    )) {
      element.tabIndex = 0;
      const qualifiedName = element.getAttribute('data-element');
      if (qualifiedName) {
        element.title = `Reveal ${qualifiedName} in source`;
        if (
          element instanceof HTMLAnchorElement &&
          !element.hasAttribute('href')
        )
          element.setAttribute('role', 'link');
      } else element.title = 'Reveal this block in source';
    }
    const next: DiagramMount[] = [];
    host
      .querySelectorAll<HTMLElement>('figure.sysml-diagram')
      .forEach((figure, index) => {
        const notice =
          figure.querySelector('.sysml-diagram-notice')?.textContent?.trim() ??
          '';
        const caption = figure.querySelector('figcaption');
        const node = document.createElement('div');
        node.className = 'sysml-diagram-mount';
        figure.replaceChildren(node, ...(caption ? [caption] : []));
        next.push({
          key: `${rendered.modelHash}:${index}`,
          view: figure.getAttribute('data-view') ?? '',
          caption: caption?.textContent ?? '',
          notice,
          node,
        });
      });
    setMounts(next);
  }, [rendered]);
  function activate(target: EventTarget | null) {
    const host = container.current;
    if (!host || !(target instanceof Element)) return;
    const reference = target.closest('[data-element]');
    if (reference && host.contains(reference)) {
      onReveal({
        kind: 'element',
        qualifiedName: reference.getAttribute('data-element')!,
      });
      return;
    }
    const path = contentPath(target, host);
    if (path) onReveal({ kind: 'content', path });
  }
  if (!rendered)
    return (
      <section className="document-pane" aria-label="Document">
        <div className="empty">
          <h2>Generated documents</h2>
          <p>
            Choose a document definition in the Explorer. The engine plans,
            evaluates and renders it from the applied model.
          </p>
        </div>
      </section>
    );
  return (
    <section className="document-pane" aria-label="Document">
      <header className="pane-heading document-heading">
        <div>
          <span className="document-kind">Generated document</span>
          <strong title={rendered.document}>
            {rendered.title || rendered.document}
          </strong>
        </div>
        <span className="diagram-revision">
          {state.unapplied
            ? 'Applied revision · draft pending'
            : 'Read-only · applied model'}
        </span>
      </header>
      {rendered.status !== 'complete' && (
        <div className="empty" role="alert">
          <h2>Document could not be rendered</h2>
          {rendered.diagnostics.map((item, index) => (
            <p key={index}>
              {item.message}
              {item.file
                ? ` (${item.file}${item.line ? ':' + item.line : ''})`
                : ''}
            </p>
          ))}
          <p>Open Issues to navigate to the reported declaration.</p>
        </div>
      )}
      <div
        className="document-body"
        ref={container}
        hidden={rendered.status !== 'complete'}
        onClick={(event) => activate(event.target)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            const target = event.target as HTMLElement;
            if (target.closest('.sysml-diagram-mount')) return;
            event.preventDefault();
            activate(target);
          }
        }}
      />
      {mounts.map((mount) =>
        createPortal(
          <EmbeddedView
            key={mount.key}
            mount={mount}
            workspace={workspace}
            state={state}
            onOpenView={onOpenView}
          />,
          mount.node,
          mount.key,
        ),
      )}
    </section>
  );
}

/** One Diagram block: the editor's native renderer for the declared view, or the engine's notice. */
function EmbeddedView({
  mount,
  workspace,
  state,
  onOpenView,
}: {
  mount: DiagramMount;
  workspace: Workspace;
  state: WorkspaceState;
  onOpenView: (id: string) => void;
}) {
  const [view, setView] = useState<EvaluatedView>();
  const [error, setError] = useState('');
  const declared = state.model?.elements.some(
    (item) => item.id === mount.view && item.kind === 'viewUsage',
  );
  useEffect(() => {
    if (!declared) return;
    const controller = new AbortController();
    setView(undefined);
    setError('');
    workspace
      .previewView(mount.view, controller.signal)
      .then((value) => {
        if (!controller.signal.aborted) setView(value);
      })
      .catch((reason) => {
        if (!controller.signal.aborted)
          setError(reason instanceof Error ? reason.message : String(reason));
      });
    return () => controller.abort();
  }, [workspace, state.model, mount.view, declared]);
  const notice =
    mount.notice ||
    (mount.view
      ? `${mount.view} is not a declared view of the applied model.`
      : 'This diagram block does not embed a declared view.');
  const drawable =
    view?.status === 'complete' && view.renderStatus === 'available';
  return (
    <div
      className="document-diagram"
      role="group"
      aria-label={`Embedded diagram ${mount.view || mount.caption}`.trim()}
      data-view={mount.view}
      data-state={
        !declared
          ? 'undeclared'
          : error
            ? 'failed'
            : !view
              ? 'loading'
              : drawable
                ? 'rendered'
                : 'unavailable'
      }
    >
      <div className="document-diagram-actions">
        <span>{mount.view || 'Diagram'}</span>
        {declared && (
          <Button
            variant="ghost"
            size="xs"
            onClick={() => onOpenView(mount.view)}
            disabled={state.busy}
          >
            <ExternalLink aria-hidden="true" />
            Open as named view
          </Button>
        )}
      </div>
      {!declared ? (
        <p className="document-diagram-notice">{notice}</p>
      ) : error ? (
        <p className="document-diagram-notice" role="alert">
          {error}
        </p>
      ) : !view ? (
        <p className="document-diagram-notice" role="status">
          Evaluating {mount.view}…
        </p>
      ) : drawable ? (
        <div className="document-diagram-canvas">
          <Diagram
            embedded
            view={view}
            views={[]}
            busy={false}
            disabled
            layoutMode="diagram"
            onOpenView={onOpenView}
            onSelect={() => undefined}
            onMove={() => undefined}
            onCreatePart={() => undefined}
            onConnectPorts={() => undefined}
          />
        </div>
      ) : (
        <p className="document-diagram-notice">
          {view.diagnostics.join(' ') || notice}
        </p>
      )}
    </div>
  );
}
