import { it, expect } from 'vitest';
import fixture from '../../../../tests/fixtures/exploration-assembly-artifact.json';
import type { ViewArtifact } from '$lib/workspace/views';
import { layoutExploration, explorationEdgePath } from './exploration';
import { absolutePositions } from './structure';

it('routes every native assembly overview link and label clear of declaration cards and headers', () => {
  const artifact = fixture as ViewArtifact;
  const { nodes, edges } = layoutExploration(artifact);
  const positions = absolutePositions(nodes);
  const cards = nodes.map((node) => ({
    id: node.id,
    x: positions[node.id]!.x,
    y: positions[node.id]!.y,
    width: Number(node.style!.width),
    height: node.data.compound ? 52 : Number(node.style!.height),
  }));
  const hits: string[] = [];
  const labels: { x: number; y: number; width: number; height: number }[] = [];
  for (const edge of edges) {
    const source = nodes.find((n) => n.id === edge.source)!,
      target = nodes.find((n) => n.id === edge.target)!;
    const from = {
      x:
        positions[source.id]!.x +
        (edge.sourceHandle === 'exploration-source-left'
          ? 0
          : Number(source.style!.width)),
      y: positions[source.id]!.y + Number(source.style!.height) / 2,
    };
    const to = {
      x:
        positions[target.id]!.x +
        (edge.targetHandle === 'node-target' ? 0 : Number(target.style!.width)),
      y: positions[target.id]!.y + Number(target.style!.height) / 2,
    };
    const route = edge.data?.route as
      | {
          points: { x: number; y: number }[];
          labelX: number;
          labelY: number;
          labelWidth: number;
        }
      | undefined;
    let points: { x: number; y: number }[] = [];
    if (route) {
      for (let i = 1; i < route.points.length; i++) {
        const a = route.points[i - 1]!,
          b = route.points[i]!;
        const steps = Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 2);
        for (let n = 0; n <= steps; n++)
          points.push({
            x: a.x + ((b.x - a.x) * n) / steps,
            y: a.y + ((b.y - a.y) * n) / steps,
          });
      }
    } else {
      const values = explorationEdgePath(
        from.x,
        from.y,
        to.x,
        to.y,
        Number(edge.data?.lane ?? 0),
      )
        .path.match(/-?\d+(?:\.\d+)?/g)!
        .map(Number);
      for (let n = 0; n <= 1000; n++) {
        const t = n / 1000,
          u = 1 - t;
        points.push({
          x:
            u * u * u * values[0]! +
            3 * u * u * t * values[2]! +
            3 * u * t * t * values[4]! +
            t * t * t * values[6]!,
          y:
            u * u * u * values[1]! +
            3 * u * u * t * values[3]! +
            3 * u * t * t * values[5]! +
            t * t * t * values[7]!,
        });
      }
    }
    for (const card of cards)
      if (
        points.some(
          (p) =>
            p.x > card.x + 1 &&
            p.x < card.x + card.width - 1 &&
            p.y > card.y + 1 &&
            p.y < card.y + card.height - 1,
        )
      )
        hits.push(`${edge.id} crosses ${card.id}`);
    const label =
      route ??
      explorationEdgePath(
        from.x,
        from.y,
        to.x,
        to.y,
        Number(edge.data?.lane ?? 0),
      );
    const width = route?.labelWidth ?? 64;
    const bounds = {
      x: label.labelX - width / 2,
      y: label.labelY - 10,
      width,
      height: 20,
    };
    for (const card of cards)
      if (
        bounds.x < card.x + card.width &&
        bounds.x + width > card.x &&
        bounds.y < card.y + card.height &&
        bounds.y + 20 > card.y
      )
        hits.push(`${edge.id} label covers ${card.id}`);
    for (const other of labels)
      if (
        bounds.x < other.x + other.width &&
        bounds.x + width > other.x &&
        bounds.y < other.y + other.height &&
        bounds.y + 20 > other.y
      )
        hits.push(`${edge.id} overlaps another label`);
    labels.push(bounds);
  }
  expect(hits).toEqual([]);
  expect(edges.map((e) => e.id)).toEqual(
    artifact.edges.map((_, i) => `edge:${i}`),
  );
  expect(edges.map((e) => [e.source, e.target, e.label])).toEqual(
    artifact.edges.map((e) => [e.from, e.to, e.label || e.kind]),
  );
});

it('keeps routes between nonadjacent packages below intervening cards and includes their labels in scene bounds', () => {
  const artifact: ViewArtifact = {
    kind: 'tree',
    nodes: [
      { id: 'a', name: 'A', kind: 'package' },
      { id: 'source', name: 'source', kind: 'part', parent: 'a' },
      { id: 'b', name: 'B', kind: 'package' },
      { id: 'blocker', name: 'blocker', kind: 'part', parent: 'b' },
      { id: 'c', name: 'C', kind: 'package' },
      { id: 'target', name: 'target', kind: 'part', parent: 'c' },
    ],
    edges: [
      { from: 'source', to: 'target', kind: 'reference', label: 'forward' },
      { from: 'target', to: 'source', kind: 'reference', label: 'reverse' },
    ],
  };
  const { nodes, edges, bounds } = layoutExploration(artifact);
  const bottom = Math.max(
    ...nodes
      .filter((node) => !node.parentId)
      .map((node) => node.position.y + Number(node.style!.height)),
  );
  for (const edge of edges) {
    const route = edge.data!.route as {
      points: { x: number; y: number }[];
      labelY: number;
    };
    expect(route.labelY).toBeGreaterThan(bottom);
    expect(
      route.points.filter((point) => point.y > bottom).length,
    ).toBeGreaterThanOrEqual(2);
    expect(bounds!.y + bounds!.height).toBeGreaterThanOrEqual(
      route.labelY + 12,
    );
  }
  expect(edges[1]!.targetHandle).toBe('exploration-target-right');
  expect(edges[0]!.data!.route).not.toEqual(edges[1]!.data!.route);
});
