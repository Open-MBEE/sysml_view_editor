import { BaseEdge, useReactFlow, type EdgeProps } from '@xyflow/react';
import type { Point } from '$lib/workspace/views';

export interface LayoutRoute {
  points: Point[];
  labelX?: number;
  labelY?: number;
  container?: { id: string; position: Point };
}

/** ELK routes are presentation geometry, separate from modeled source routes. */
export function RoutedEdge(props: EdgeProps) {
  const route = props.data!.route as LayoutRoute;
  const { getNode } = useReactFlow();
  const offset = { x: 0, y: 0 };
  if (route.container) {
    let node = getNode(route.container.id);
    while (node) {
      offset.x += node.position.x;
      offset.y += node.position.y;
      node = node.parentId ? getNode(node.parentId) : undefined;
    }
    offset.x -= route.container.position.x;
    offset.y -= route.container.position.y;
  }
  const original = route.points;
  let points = original.map((point) => ({
    x: point.x + offset.x,
    y: point.y + offset.y,
  }));
  const last = points.length - 1;
  points[0] = { x: props.sourceX, y: props.sourceY };
  points[last] = { x: props.targetX, y: props.targetY };
  if (points.length > 2) {
    if (original[1]!.x === original[0]!.x) points[1]!.x = props.sourceX;
    else points[1]!.y = props.sourceY;
    if (original[last - 1]!.x === original[last]!.x)
      points[last - 1]!.x = props.targetX;
    else points[last - 1]!.y = props.targetY;
  }
  let labelX = route.labelX === undefined ? undefined : route.labelX + offset.x;
  let labelY = route.labelY === undefined ? undefined : route.labelY + offset.y;
  if (points.length === 2) {
    const start = points[0]!,
      end = points[1]!;
    const middle = { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 };
    if (labelX !== undefined)
      labelX += middle.x - (original[0]!.x + original[1]!.x) / 2 - offset.x;
    if (labelY !== undefined)
      labelY += middle.y - (original[0]!.y + original[1]!.y) / 2 - offset.y;
    points =
      Math.abs(original[0]!.y - original[1]!.y) < 1e-6
        ? [start, { x: middle.x, y: start.y }, { x: middle.x, y: end.y }, end]
        : [start, { x: start.x, y: middle.y }, { x: end.x, y: middle.y }, end];
  }
  return (
    <BaseEdge
      id={props.id}
      path={points
        .map((point, index) => `${index ? 'L' : 'M'} ${point.x} ${point.y}`)
        .join(' ')}
      label={props.label}
      labelX={labelX}
      labelY={labelY}
      markerEnd={props.markerEnd}
      style={props.style}
      interactionWidth={props.interactionWidth}
      labelBgPadding={[5, 4]}
      labelBgBorderRadius={3}
    />
  );
}
