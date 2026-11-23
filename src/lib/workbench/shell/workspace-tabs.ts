import type { ExplorationRequest } from '$lib/workspace/exploration';
export type WorkspaceTab =
  | { id: string; label: string; kind: 'view' | 'document'; target: string }
  | {
      id: string;
      label: string;
      kind: 'exploration';
      request: ExplorationRequest;
    }
  | { id: string; label: string; kind: 'table' | 'matrix' };
/** Revisit a tab without duplicating its identity; refresh its current label. */
export function openTab<T extends { id: string }>(
  tabs: readonly T[],
  tab: T,
): T[] {
  return tabs.some((item) => item.id === tab.id)
    ? tabs.map((item) => (item.id === tab.id ? tab : item))
    : [...tabs, tab];
}
