import { ArrangementSelector } from './ArrangementSelector';
import { PanelControls } from './WorkbenchPanels';

export function WorkspaceToolbar({
  mode,
  onMode,
}: {
  mode: 'code' | 'split' | 'diagram';
  onMode: (mode: 'code' | 'split' | 'diagram') => void;
}) {
  return (
    <div className="workspace-toolbar">
      <span aria-hidden="true" />
      <ArrangementSelector mode={mode} onMode={onMode} />
      <PanelControls />
    </div>
  );
}
