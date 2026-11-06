import { useDiagramFit } from './useDiagramFit';
import { Panel, useReactFlow, useStore, type Rect } from '@xyflow/react';
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
  bounds,
}: {
  locked: boolean;
  onLock: (locked: boolean) => void;
  padding: number;
  bounds?: Rect;
}) {
  const { zoomIn, zoomOut } = useReactFlow();
  const fit = useDiagramFit(padding, bounds);
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
        onClick={() => void fit()}
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
