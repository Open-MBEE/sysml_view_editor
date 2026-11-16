import { Button } from '$lib/ui/primitives/button';
import { useDiagramRead } from './useDiagramRead';
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
  readTarget,
}: {
  locked: boolean;
  onLock: (locked: boolean) => void;
  padding: number;
  bounds?: Rect;
  readTarget?: string;
}) {
  const { zoomIn, zoomOut } = useReactFlow();
  const fit = useDiagramFit(padding, bounds);
  const read = useDiagramRead(readTarget);
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
      <Button
        variant="ghost"
        size="sm"
        aria-label="Read at 100%"
        title="Read selection or first element at 100%"
        onClick={() => void read()}
      >
        100%
      </Button>
      <span className="diagram-zoom" aria-label="Current zoom">
        {Math.round(zoom * 100)}%
      </span>
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
