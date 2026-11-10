import type { ReactNode, Ref } from 'react';
import { FilePlus2, FolderOpen, Download, PanelsTopLeft } from 'lucide-react';
import { Button } from '$lib/ui/primitives/button';
import { AppearanceSettings } from '$lib/ui/AppearanceSettings';
import type { WorkspaceState } from '$lib/workspace/createWorkspace';
import { Brand } from '../entry/Brand';
import { EditorTour } from './EditorTour';

export function ProjectHeader({
  state,
  origin,
  active,
  projectsRef,
  recovery,
  onHome,
  onProjects,
  onNew,
  onOpen,
  onDownload,
}: {
  state: Pick<WorkspaceState, 'project' | 'dirty' | 'busy'>;
  origin: string;
  active: boolean;
  projectsRef: Ref<HTMLButtonElement>;
  recovery: ReactNode;
  onHome: () => void;
  onProjects: () => void;
  onNew: () => void;
  onOpen: () => void;
  onDownload: () => void;
}) {
  return (
    <header className="topbar">
      <Brand onHome={onHome} />
      <Button
        ref={projectsRef}
        variant="ghost"
        aria-label="Projects"
        onClick={onProjects}
      >
        <PanelsTopLeft aria-hidden="true" />
        <span className="button-label">Projects</span>
      </Button>
      <div className="project-identity">
        <span className="project-name">
          {state.project?.name ?? 'Workspace'}
          {state.dirty ? ' · modified' : ''}
        </span>
        <small className="project-origin">{origin}</small>
      </div>
      <nav aria-label="Project actions">
        <EditorTour />
        <AppearanceSettings active={active} />
        {recovery}
        <Button
          variant="ghost"
          disabled={state.busy}
          aria-label="New project"
          onClick={onNew}
        >
          <FilePlus2 aria-hidden="true" />
          <span className="button-label">New project</span>
        </Button>
        <Button
          variant="ghost"
          disabled={state.busy}
          aria-label="Open"
          onClick={onOpen}
        >
          <FolderOpen aria-hidden="true" />
          <span className="button-label">Open</span>
        </Button>
        <Button
          variant="default"
          data-tour-download
          disabled={!state.project || state.busy}
          onClick={onDownload}
        >
          <Download aria-hidden="true" />
          Download project
        </Button>
      </nav>
    </header>
  );
}
