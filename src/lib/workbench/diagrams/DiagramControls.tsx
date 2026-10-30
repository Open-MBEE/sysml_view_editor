import { Panel, useReactFlow, useStore } from '@xyflow/react';
import {
  ZoomIn,
  ZoomOut,
  Scan,
  LockKeyhole,
  LockKeyholeOpen,
} from 'lucide-react';
import { IconButton } from '$lib/ui/IconButton';

export function DiagramControls({
  locked,
  onLock,
  padding,
}: {
  locked: boolean;
  onLock: (locked: boolean) => void;
  padding: number;
}) {
  const { zoomIn, zoomOut, fitView } = useReactFlow();
  const zoom = useStore((state) => state.transform[2]);
  const minZoom = useStore((state) => state.minZoom);
  const maxZoom = useStore((state) => state.maxZoom);
  return (
    <Panel
      position="bottom-left"
      className="diagram-controls"
      role="group"
      aria-label="Diagram controls"
    >
      <IconButton
        size="icon-xs"
        label="Zoom in"
        icon={ZoomIn}
        disabled={zoom >= maxZoom}
        onClick={() => void zoomIn()}
      />
      <IconButton
        size="icon-xs"
        label="Zoom out"
        icon={ZoomOut}
        disabled={zoom <= minZoom}
        onClick={() => void zoomOut()}
      />
      <IconButton
        size="icon-xs"
        label="Fit view"
        icon={Scan}
        onClick={() => void fitView({ padding, maxZoom: 1 })}
      />
      <IconButton
        size="icon-xs"
        label={locked ? 'Unlock diagram' : 'Lock diagram'}
        icon={locked ? LockKeyhole : LockKeyholeOpen}
        aria-pressed={locked}
        onClick={() => onLock(!locked)}
      />
    </Panel>
  );
}
