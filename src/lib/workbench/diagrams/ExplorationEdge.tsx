import { overviewPolyline, type OverviewRoute } from './overview-routing';
import { BaseEdge, type EdgeProps } from '@xyflow/react';
import { explorationEdgePath } from './exploration';
export function ExplorationEdge(props: EdgeProps) {
  const route = props.data?.route as OverviewRoute | undefined;
  const points = route?.points.map((point) => ({ ...point }));
  if (points?.length) {
    points[0] = { x: props.sourceX, y: props.sourceY };
    points[points.length - 1] = { x: props.targetX, y: props.targetY };
    if (points.length > 2) {
      points[1]!.y = props.sourceY;
      points[points.length - 2]!.y = props.targetY;
    }
  }
  const { path, labelX, labelY } =
    route && points
      ? {
          path: overviewPolyline(points),
          labelX: route.labelX,
          labelY: route.labelY,
        }
      : explorationEdgePath(
          props.sourceX,
          props.sourceY,
          props.targetX,
          props.targetY,
          Number(props.data?.lane ?? 0),
        );
  return (
    <BaseEdge
      id={props.id}
      path={path}
      labelX={labelX}
      labelY={labelY}
      label={props.label}
      markerStart={props.markerStart}
      markerEnd={props.markerEnd}
      style={props.style}
      interactionWidth={props.interactionWidth}
      labelBgPadding={[5, 4]}
      labelBgBorderRadius={3}
    />
  );
}
