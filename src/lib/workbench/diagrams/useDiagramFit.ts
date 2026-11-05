import { useCallback } from 'react';
import {
  getViewportForBounds,
  useReactFlow,
  useStore,
  type Rect,
} from '@xyflow/react';
/** Exploration routes and labels participate in fitting without adding model nodes. */
export function useDiagramFit(padding: number, bounds?: Rect) {
  const { fitView, setViewport } = useReactFlow();
  const width = useStore((state) => state.width),
    height = useStore((state) => state.height),
    minZoom = useStore((state) => state.minZoom);
  return useCallback(
    () =>
      bounds && width > 0 && height > 0
        ? setViewport(
            getViewportForBounds(bounds, width, height, minZoom, 1, padding),
          )
        : fitView({ padding, maxZoom: 1 }),
    [bounds, width, height, minZoom, padding, fitView, setViewport],
  );
}
