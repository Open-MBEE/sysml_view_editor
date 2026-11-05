import type { Edge, Rect } from '@xyflow/react';
import type { ViewArtifact } from '$lib/workspace/views';
import type { StructureNode } from './structure';
export const explorationHeaderHeight = 52;
export interface RoutePoint {
  x: number;
  y: number;
}
export interface OverviewRoute {
  points: RoutePoint[];
  labelX: number;
  labelY: number;
  labelWidth: number;
}
interface Gutter {
  indices: number[];
  width: number;
  labelWidth: number;
}
const rowHeight = 24;
const labelWidth = (text: string) => Math.max(64, text.length * 7 + 16);

/** Only native containment identifies the shared routing owner. */
export function overviewGutters(artifact: ViewArtifact) {
  const parents = new Map(artifact.nodes.map((node) => [node.id, node.parent]));
  const ancestors = (id: string) => {
    const out: string[] = [];
    let current: string | undefined = id;
    while (current) {
      out.push(current);
      current = parents.get(current);
    }
    return out;
  };
  const owners = artifact.edges.map((edge) => {
    const source = ancestors(edge.from),
      target = new Set(ancestors(edge.to));
    return (
      source.find(
        (id) => target.has(id) && (edge.from !== edge.to || id !== edge.from),
      ) ?? ''
    );
  });
  const gutters = new Map<string, Gutter>();
  owners.forEach((owner, index) => {
    const gutter = gutters.get(owner) ?? {
      indices: [],
      width: 0,
      labelWidth: 0,
    };
    gutter.indices.push(index);
    gutter.labelWidth = Math.max(
      gutter.labelWidth,
      labelWidth(artifact.edges[index]!.label || artifact.edges[index]!.kind),
    );
    gutter.width = gutter.labelWidth + 32 + (gutter.indices.length - 1) * 18;
    gutters.set(owner, gutter);
  });
  return { owners, gutters };
}

export function overviewPolyline(points: readonly RoutePoint[]) {
  return points
    .map((point, index) => `${index ? 'L' : 'M'} ${point.x} ${point.y}`)
    .join(' ');
}
const overlaps = (a: Rect, b: Rect) =>
  a.x < b.x + b.width &&
  a.x + a.width > b.x &&
  a.y < b.y + b.height &&
  a.y + a.height > b.y;

/** Vertical sibling packing leaves a clear horizontal exit to the shared owner's gutter. */
export function routeOverview(
  artifact: ViewArtifact,
  nodes: readonly StructureNode[],
  absolute: ReadonlyMap<string, RoutePoint>,
  plan: ReturnType<typeof overviewGutters>,
) {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const rect = (id: string): Rect => {
    const node = byId.get(id)!;
    return {
      ...absolute.get(id)!,
      width: Number(node.style!.width),
      height: Number(node.style!.height),
    };
  };
  const rootOf = (id: string) => {
    let node = byId.get(id)!;
    while (node.parentId) node = byId.get(node.parentId)!;
    return node.id;
  };
  const roots = nodes.filter((node) => !node.parentId);
  const occupied: Rect[] = [];
  const routes: OverviewRoute[] = [];
  const edges: Edge[] = artifact.edges.map((edge, index) => {
    const source = rect(edge.from),
      target = rect(edge.to);
    const owner = plan.owners[index]!,
      gutter = plan.gutters.get(owner)!;
    let sourceHandle = 'node-source',
      targetHandle = 'exploration-target-right';
    let start = { x: source.x + source.width, y: source.y + source.height / 2 };
    let end = { x: target.x + target.width, y: target.y + target.height / 2 };
    const text = edge.label || edge.kind;
    const textWidth = labelWidth(text);
    const preferredY =
      edge.from === edge.to ? start.y + rowHeight : (start.y + end.y) / 2;
    let labelX: number, minY: number, maxY: number;
    let entryX: number, exitX: number;
    if (owner) {
      const bounds = rect(owner);
      const lane = gutter.indices.indexOf(index);
      entryX =
        bounds.x +
        bounds.width -
        gutter.width +
        16 +
        gutter.labelWidth / 2 +
        lane * 18;
      exitX = entryX;
      labelX = entryX;
      minY = bounds.y + explorationHeaderHeight + 12;
      maxY = bounds.y + bounds.height - 12;
    } else {
      const sourceRoot = rect(rootOf(edge.from)),
        targetRoot = rect(rootOf(edge.to));
      const right = sourceRoot.x < targetRoot.x;
      if (!right) {
        sourceHandle = 'exploration-source-left';
        targetHandle = 'exploration-target-right';
        start = { x: source.x, y: start.y };
        end = { x: target.x + target.width, y: end.y };
      } else {
        targetHandle = 'node-target';
        end = { x: target.x, y: end.y };
      }
      entryX = right ? sourceRoot.x + sourceRoot.width + 16 : sourceRoot.x - 16;
      exitX = right ? targetRoot.x - 16 : targetRoot.x + targetRoot.width + 16;
      labelX = (entryX + exitX) / 2;
      const between = roots.filter((root) => {
        const r = rect(root.id);
        return (
          r.x > Math.min(sourceRoot.x, targetRoot.x) &&
          r.x < Math.max(sourceRoot.x, targetRoot.x)
        );
      });
      minY = between.length
        ? Math.max(
            ...roots.map((root) => {
              const r = rect(root.id);
              return r.y + r.height;
            }),
          ) + 24
        : 12;
      maxY = Infinity;
    }
    let labelY = Math.max(minY, Math.min(maxY, preferredY));
    let placed = false;
    for (
      let offset = 0;
      offset < artifact.edges.length * 4 + 8 && !placed;
      offset++
    ) {
      for (const direction of offset ? [1, -1] : [1]) {
        const candidate = labelY + offset * rowHeight * direction;
        const bounds = {
          x: labelX - textWidth / 2 - 3,
          y: candidate - 11,
          width: textWidth + 6,
          height: 22,
        };
        if (
          candidate >= minY &&
          candidate <= maxY &&
          !occupied.some((other) => overlaps(bounds, other))
        ) {
          labelY = candidate;
          occupied.push(bounds);
          placed = true;
          break;
        }
      }
    }
    if (!placed)
      throw new Error('Overview has no clear relationship label row.');
    let points: RoutePoint[];
    if (
      owner &&
      labelY >= Math.min(start.y, end.y) &&
      labelY <= Math.max(start.y, end.y) &&
      start.y !== end.y
    ) {
      points = [start, { x: entryX, y: start.y }, { x: entryX, y: end.y }, end];
    } else {
      // A short second lane keeps equal-height endpoints and outlying label rows
      // connected without retracing a vertical segment over its own label.
      if (owner) {
        entryX -= 8;
        exitX += 8;
      }
      points = [
        start,
        { x: entryX, y: start.y },
        { x: entryX, y: labelY },
        { x: exitX, y: labelY },
        { x: exitX, y: end.y },
        end,
      ];
    }
    points = points.filter(
      (p, i) => i === 0 || p.x !== points[i - 1]!.x || p.y !== points[i - 1]!.y,
    );
    const route = { points, labelX, labelY, labelWidth: textWidth };
    routes.push(route);
    return {
      id: `edge:${index}`,
      source: edge.from,
      target: edge.to,
      sourceHandle,
      targetHandle,
      type: 'exploration',
      data: { route },
      label: text,
      ariaLabel: `${edge.kind} ${edge.label ?? ''}: ${byId.get(edge.from)!.data.item.name} to ${byId.get(edge.to)!.data.item.name}`,
      interactionWidth: 20,
      zIndex: 1,
      deletable: false,
    };
  });
  const rectangles = nodes.map((node) => rect(node.id));
  for (const route of routes) {
    for (const point of route.points)
      rectangles.push({ ...point, width: 0, height: 0 });
    rectangles.push({
      x: route.labelX - route.labelWidth / 2 - 6,
      y: route.labelY - 12,
      width: route.labelWidth + 12,
      height: 24,
    });
  }
  const left = Math.min(...rectangles.map((r) => r.x)),
    top = Math.min(...rectangles.map((r) => r.y));
  const right = Math.max(...rectangles.map((r) => r.x + r.width)),
    bottom = Math.max(...rectangles.map((r) => r.y + r.height));
  return {
    edges,
    bounds: rectangles.length
      ? { x: left, y: top, width: right - left, height: bottom - top }
      : undefined,
  };
}
