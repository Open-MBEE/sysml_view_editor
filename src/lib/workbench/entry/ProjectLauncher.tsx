import { useLayoutEffect, useRef, type ReactNode } from 'react';
import { FilePlus2, FolderOpen, PanelsTopLeft, ArrowRight } from 'lucide-react';
import { Button } from '$lib/ui/primitives/button';
import { AppearanceSettings } from '$lib/ui/AppearanceSettings';
import { Brand } from './Brand';

export function ProjectLauncher({
  onHome,
  onExample,
  onNew,
  onOpen,
  onResume,
  projectName,
  busy,
  error,
  recovery,
  recoveryAction,
}: {
  onHome: () => void;
  onExample: () => void;
  onNew: () => void;
  onOpen: () => void;
  onResume: () => void;
  projectName?: string;
  busy: boolean;
  error: string;
  recovery: ReactNode;
  recoveryAction: ReactNode;
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  useLayoutEffect(() => {
    heading.current?.focus();
  }, []);
  return (
    <div className="entry-page launcher-page">
      <header className="entry-header">
        <Brand onHome={onHome} />
        <nav aria-label="Launcher settings">
          <AppearanceSettings />
          {recoveryAction}
        </nav>
      </header>
      <main className="launcher-content">
        <div className="launcher-heading">
          <div>
            <h1 ref={heading} tabIndex={-1}>
              Open a project
            </h1>
            <p>
              Create a model, open your files, or explore the inspection rover.
            </p>
          </div>
          {projectName && (
            <Button variant="outline" disabled={busy} onClick={onResume}>
              Resume project <ArrowRight aria-hidden="true" />
            </Button>
          )}
        </div>
        {projectName && (
          <p className="launcher-current">
            Current project: <strong>{projectName}</strong>. Returning here
            keeps its drafts, history and diagram in this session.
          </p>
        )}
        {recovery}
        {error && (
          <p role="alert" className="entry-error">
            {error}
          </p>
        )}
        {busy && (
          <p role="status" className="entry-status">
            Opening project…
          </p>
        )}
        <div
          className="launcher-options"
          role="group"
          aria-label="Project starting points"
        >
          <Button
            variant="outline"
            className="launcher-choice"
            aria-label="New project"
            disabled={busy}
            onClick={onNew}
          >
            <FilePlus2 aria-hidden="true" />
            <span>
              <strong>New project</strong>
              <span>Start with an empty SysML model.</span>
            </span>
          </Button>
          <Button
            variant="outline"
            className="launcher-choice"
            aria-label="Open files or project"
            disabled={busy}
            onClick={onOpen}
          >
            <FolderOpen aria-hidden="true" />
            <span>
              <strong>Open files or project</strong>
              <span>Import SysML files or a downloaded project.</span>
            </span>
          </Button>
          <Button
            variant="outline"
            className="launcher-choice"
            aria-label="Load example"
            disabled={busy}
            onClick={onExample}
          >
            <PanelsTopLeft aria-hidden="true" />
            <span>
              <strong>Load example</strong>
              <span>
                Inspection rover: structure, mission, operating states and
                requirements.
              </span>
            </span>
          </Button>
        </div>
        <div className="launcher-storage">
          <h2>Save your work</h2>
          <p>
            Imported files stay unchanged. Download your project to save source,
            drafts and diagram positions. Local recovery keeps a separate copy
            in this browser.
          </p>
        </div>
      </main>
      <footer className="entry-footer">
        <span>OpenMBEE View Editor</span>
        <span className="stage-label">Sandbox</span>
      </footer>
    </div>
  );
}
