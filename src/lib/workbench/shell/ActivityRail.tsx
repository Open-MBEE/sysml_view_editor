import type { Ref } from 'react';
import { Folder } from 'lucide-react';
import { IconButton } from '$lib/ui/IconButton';

export function ActivityRail({
  expanded,
  onToggle,
  buttonRef,
}: {
  expanded: boolean;
  onToggle: () => void;
  buttonRef: Ref<HTMLButtonElement>;
}) {
  return (
    <nav className="activity-rail" aria-label="Workspace activities">
      <IconButton
        size="icon"
        ref={buttonRef}
        label={`${expanded ? 'Hide' : 'Show'} Explorer`}
        hint={`Explorer · ${expanded ? 'hide' : 'show'} sidebar`}
        icon={Folder}
        aria-expanded={expanded}
        aria-controls="workspace-explorer"
        aria-pressed={expanded}
        onClick={onToggle}
      />
    </nav>
  );
}
