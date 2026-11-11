import { useCallback } from 'react';
import { useReactFlow, useStore } from '@xyflow/react';
import type { ArtifactNode } from '$lib/workspace/views';

/** A camera action: readable text without moving or resizing model symbols. */
export function useDiagramRead(targetId?: string) {
  const { getNodes, getNodesBounds, setViewport } = useReactFlow();
  const width = useStore((state) => state.width),
    height = useStore((state) => state.height);
  return useCallback(() => {
    const nodes = getNodes().filter((node) => !node.hidden);
    const selected = nodes.find((node) => node.id === targetId);
    const components = nodes.filter(
      (node) => node.type === 'structure' && !node.data.compound,
    );
    const firstComponent =
      components.find(
        (node) => (node.data.item as ArtifactNode)?.kind === 'part',
      ) ?? components[0];
    const target =
      selected ??
      firstComponent ??
      nodes.find((node) => !node.parentId) ??
      nodes[0];
    if (!target || width <= 0 || height <= 0) return Promise.resolve(false);
    const bounds = getNodesBounds([target.id]);
    // Large containers start at their heading; small selections are centered.
    return setViewport({
      x:
        (width - Math.min(bounds.width, Math.max(0, width - 48))) / 2 -
        bounds.x,
      y: selected
        ? (height - Math.min(bounds.height, Math.max(0, height - 48))) / 2 -
          bounds.y
        : 24 - bounds.y,
      zoom: 1,
    });
  }, [getNodes, getNodesBounds, setViewport, width, height, targetId]);
}
