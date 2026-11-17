import type { EvaluatedView } from '$lib/workspace/views';

/** Renderer capability is distinct from a successful engine evaluation. */
export function supportsDiagram(view: EvaluatedView | null): boolean {
  return !!(
    view?.status === 'complete' &&
    view.renderStatus === 'available' &&
    view.artifact &&
    [
      'tree',
      'interconnection',
      'definition',
      'requirement',
      'action',
      'state',
    ].includes(view.artifact.kind)
  );
}
