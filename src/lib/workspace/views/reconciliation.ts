import type { AppliedModel } from '../project';
import type { SemanticCommand } from '../editing';
import type { EvaluatedView, ViewPresentation } from './index';
import {
  originKey,
  transportSpan,
  unchangedHeader,
  type Splice,
} from '../editing/evidence';

export interface LayoutNotice {
  readonly view: string;
  readonly retained: number;
  readonly invalidated: number;
  readonly reason?: string;
}

export function remapName(id: string, command?: SemanticCommand): string {
  if (
    command?.kind !== 'rename' ||
    (id !== command.target && !id.startsWith(command.target + '::'))
  )
    return id;
  const split = command.target.lastIndexOf('::');
  return (
    (split >= 0 ? command.target.slice(0, split + 2) : '') +
    command.name +
    id.slice(command.target.length)
  );
}

/** Verified per-occurrence joins; no renderer IDs or labels establish lineage. */
export function reconcileView(input: {
  oldView: EvaluatedView;
  newView: EvaluatedView;
  presentation: ViewPresentation;
  before: AppliedModel;
  after: AppliedModel;
  edits: readonly Splice[];
  command?: SemanticCommand;
}): { presentation: ViewPresentation; notice: LayoutNotice } {
  const { oldView, newView, presentation, before, after, edits, command } =
    input;
  if (
    oldView.status !== 'complete' ||
    newView.status !== 'complete' ||
    newView.renderStatus !== 'available' ||
    !oldView.artifact ||
    !newView.artifact
  )
    throw new Error('View evaluation or rendering is unavailable.');
  const origins = new Map(
    oldView.correspondence.map((item) => [
      item.subject.id,
      item.subject.origin,
    ]),
  );
  const duplicated = new Set<string>();
  for (const item of oldView.correspondence) {
    if (
      JSON.stringify(origins.get(item.subject.id)) !==
      JSON.stringify(item.subject.origin)
    )
      duplicated.add(item.subject.id);
  }
  function mappedOrigin(key: string): string | undefined {
    const origin = origins.get(key);
    if (
      !origin ||
      duplicated.has(key) ||
      (!command && !unchangedHeader(origin, edits))
    )
      return;
    const moved = transportSpan(origin, edits);
    return moved && originKey(moved);
  }
  function compatibleSubject(
    oldName: string | undefined,
    newName: string | undefined,
  ) {
    if (!oldName || remapName(oldName, command) !== newName) return false;
    const old = before.elements.find((item) => item.id === oldName);
    const fresh = after.elements.find((item) => item.id === newName);
    return (
      !!old &&
      !!fresh &&
      old.kind === fresh.kind &&
      (old.ownerId ? remapName(old.ownerId, command) : null) ===
        fresh.ownerId &&
      (old.typeId ? remapName(old.typeId, command) : undefined) === fresh.typeId
    );
  }
  const joined = new Map<string, string>();
  const claimed = new Set<string>();
  for (const item of oldView.correspondence) {
    const subject = mappedOrigin(item.subject.id);
    const context = item.context.map(mappedOrigin);
    if (!subject || context.some((entry) => !entry)) continue;
    const matches = newView.correspondence.filter(
      (candidate) =>
        candidate.subject.id === subject &&
        JSON.stringify(candidate.context) === JSON.stringify(context) &&
        compatibleSubject(
          item.subject.qualifiedName,
          candidate.subject.qualifiedName,
        ),
    );
    if (matches.length !== 1) continue;
    const match = matches[0]!;
    if (claimed.has(match.symbol)) {
      for (const [old, next] of joined)
        if (next === match.symbol) joined.delete(old);
      continue;
    }
    // Every ancestor must also have the intended semantic name and binding.
    if (
      item.context.some((key, i) => {
        const oldEntries = oldView.correspondence.filter(
          (entry) => entry.subject.id === key,
        );
        const freshEntries = newView.correspondence.filter(
          (entry) => entry.subject.id === context[i],
        );
        return (
          !oldEntries.length ||
          !freshEntries.length ||
          !compatibleSubject(
            oldEntries[0]!.subject.qualifiedName,
            freshEntries[0]!.subject.qualifiedName,
          )
        );
      })
    )
      continue;
    claimed.add(match.symbol);
    joined.set(item.symbol, match.symbol);
  }
  const positions: Record<string, { x: number; y: number }> = {};
  const oldNodes = new Map(
    oldView.artifact.nodes.map((node) => [node.id, node]),
  );
  const freshNodes = new Map(
    newView.artifact.nodes.map((node) => [node.id, node]),
  );
  for (const [symbol, point] of Object.entries(presentation.positions)) {
    const mapped = joined.get(symbol);
    const old = oldNodes.get(symbol),
      fresh = mapped && freshNodes.get(mapped);
    if (
      !old ||
      !fresh ||
      old.kind !== fresh.kind ||
      (old.parent ? joined.get(old.parent) : undefined) !== fresh.parent
    )
      continue;
    positions[mapped!] = { ...point };
  }
  const retained = Object.keys(positions).length;
  const invalidated = Object.keys(presentation.positions).length - retained;
  return {
    presentation: {
      sourceHash: after.sourceHash,
      modelHash: after.modelHash,
      positions,
    },
    notice: {
      view: newView.view,
      retained,
      invalidated,
      ...(invalidated
        ? { reason: 'Some symbols have no verified compatible correspondence.' }
        : {}),
    },
  };
}
