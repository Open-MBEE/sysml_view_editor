import { useDiagramRead } from './useDiagramRead';
import { useCallback } from 'react';
import {
  getViewportForBounds,
  useReactFlow,
  useStore,
  type Rect,
} from '@xyflow/react';
/** Exploration routes and labels participate in fitting without adding model nodes. */
export function useDiagramFit(
  padding: number,
  bounds?: Rect,
  readableEntry = false,
) {
  const read = useDiagramRead();
  const { fitView, setViewport, getNodes, getNodesBounds } = useReactFlow();
  const width = useStore((state) => state.width),
    height = useStore((state) => state.height),
    minZoom = useStore((state) => state.minZoom);
  return useCallback(() => {
    if (readableEntry && width > 0 && height > 0 && getNodes().length) {
      const overview = getViewportForBounds(
        bounds ?? getNodesBounds(getNodes()),
        width,
        height,
        minZoom,
        1,
        padding,
      );
      if (overview.zoom < 0.6) return read();
    }
    return bounds && width > 0 && height > 0
      ? setViewport(
          getViewportForBounds(bounds, width, height, minZoom, 1, padding),
        )
      : fitView({ padding, maxZoom: 1 });
  }, [
    bounds,
    width,
    height,
    minZoom,
    padding,
    fitView,
    setViewport,
    readableEntry,
    read,
    getNodes,
    getNodesBounds,
  ]);
}
