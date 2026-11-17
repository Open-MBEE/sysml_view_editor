import { useLayoutEffect, useRef } from 'react';
import { SquarePlus, Cable } from 'lucide-react';
import { Button } from '$lib/ui/primitives/button';
import {
  NativeSelect,
  NativeSelectOption,
} from '$lib/ui/primitives/native-select';
import type { ExplorationRequest } from '$lib/workspace/exploration';
import type { ModelElement } from '$lib/workspace/project';
import type { EvaluatedView } from '$lib/workspace/views';
import { explorationKindLabel } from './exploration';
interface Props {
  exploration?: ExplorationRequest;
  explorationFocus?: 'scope' | 'representation';
  elements: readonly ModelElement[];
  onExplore: (
    request: ExplorationRequest,
    focus?: 'scope' | 'representation',
  ) => void;
  view: EvaluatedView | null;
  views: readonly { id: string; name: string }[];
  busy: boolean;
  disabled: boolean;
  onOpenView: (id: string) => void;
  onCreatePart: () => void;
  onConnectPorts: () => void;
}
export function DiagramTargetControls({
  exploration,
  explorationFocus,
  elements,
  onExplore,
  view,
  views,
  busy,
  disabled,
  onOpenView,
  onCreatePart,
  onConnectPorts,
}: Props) {
  const scopeControl = useRef<HTMLSelectElement>(null);
  const representationControl = useRef<HTMLSelectElement>(null);
  useLayoutEffect(() => {
    if (!busy && explorationFocus)
      (explorationFocus === 'scope'
        ? scopeControl
        : representationControl
      ).current?.focus({ preventScroll: true });
  }, [busy, explorationFocus]);
  const explorationSubject =
    exploration?.scope.kind !== 'project'
      ? exploration?.scope.subject
      : undefined;
  const viewNames = new Map<string, number>();
  for (const item of views)
    viewNames.set(item.name, (viewNames.get(item.name) ?? 0) + 1);
  return (
    <div
      className={`diagram-target-controls${exploration ? ' diagram-exploration' : ''}`}
    >
      <div className="diagram-context">
        <NativeSelect
          size="sm"
          aria-label="Named view"
          title={view?.view ?? 'Choose a named view'}
          value={view?.view ?? ''}
          disabled={busy}
          onChange={(event) =>
            event.target.value
              ? onOpenView(event.target.value)
              : onExplore?.({
                  scope: { kind: 'project' },
                  representation: 'tree',
                })
          }
        >
          <NativeSelectOption value="">Explore model</NativeSelectOption>
          {views.map((item) => (
            <NativeSelectOption key={item.id} value={item.id}>
              {viewNames.get(item.name) === 1 ? item.name : item.id}
            </NativeSelectOption>
          ))}
        </NativeSelect>
        {exploration && (
          <>
            <div className="exploration-field exploration-scope-field">
              <label htmlFor="exploration-scope">Scope</label>
              <NativeSelect
                size="sm"
                ref={scopeControl}
                id="exploration-scope"
                aria-label="Exploration scope"
                value={
                  exploration.scope.kind === 'project'
                    ? ''
                    : exploration.scope.subject
                }
                disabled={busy}
                onChange={(event) => {
                  const subject = event.target.value;
                  const item = elements.find((item) => item.id === subject);
                  onExplore?.(
                    !subject
                      ? { scope: { kind: 'project' }, representation: 'tree' }
                      : item?.kind === 'package'
                        ? {
                            scope: { kind: 'package', subject },
                            representation: 'tree',
                          }
                        : {
                            scope: { kind: 'element', subject },
                            representation: 'tree',
                          },
                    'scope',
                  );
                }}
              >
                <NativeSelectOption value="">
                  Project overview
                </NativeSelectOption>
                {elements
                  .filter((item) =>
                    ['package', 'partDef', 'partUsage'].includes(item.kind),
                  )
                  .map((item) => (
                    <NativeSelectOption key={item.id} value={item.id}>
                      {item.id} · {explorationKindLabel(item.kind)}
                    </NativeSelectOption>
                  ))}
              </NativeSelect>
            </div>
            <div className="exploration-field">
              <label htmlFor="exploration-representation">Representation</label>
              <NativeSelect
                size="sm"
                ref={representationControl}
                id="exploration-representation"
                aria-label="Exploration representation"
                value={exploration.representation}
                disabled={busy}
                onChange={(event) =>
                  onExplore?.(
                    event.target.value === 'interconnection' &&
                      exploration.scope.kind === 'element'
                      ? {
                          scope: exploration.scope,
                          representation: 'interconnection',
                        }
                      : { ...exploration, representation: 'tree' },
                    'representation',
                  )
                }
              >
                <NativeSelectOption value="tree">
                  Ownership overview
                </NativeSelectOption>
                <NativeSelectOption
                  value="interconnection"
                  disabled={exploration.scope.kind !== 'element'}
                >
                  Structure
                </NativeSelectOption>
              </NativeSelect>
            </div>
            <div
              className="exploration-current"
              role="group"
              aria-label="Current exploration scope"
            >
              <span>
                {exploration.scope.kind === 'project'
                  ? 'Project'
                  : explorationKindLabel(
                      elements.find((item) => item.id === explorationSubject)
                        ?.kind ?? exploration.scope.kind,
                    )}
              </span>
              <strong>
                {exploration.scope.kind === 'project'
                  ? 'Project overview'
                  : exploration.scope.subject}
              </strong>
            </div>
          </>
        )}
        <div className="diagram-context-meta">
          {view?.artifact && (
            <span className="diagram-representation">
              {view.artifact.kind === 'interconnection'
                ? 'Structure'
                : view.artifact.kind === 'requirement'
                  ? 'Requirements'
                  : view.artifact.kind === 'action'
                    ? 'Mission flow'
                    : view.artifact.kind === 'state'
                      ? 'Operating states'
                      : view.artifact.kind === 'tree'
                        ? exploration
                          ? 'Ownership overview'
                          : 'Overview tree'
                        : 'Named view'}
            </span>
          )}
        </div>
      </div>
      {!exploration && view?.artifact?.kind === 'interconnection' && (
        <div className="diagram-actions">
          <Button
            variant="ghost"
            disabled={disabled || !view}
            onClick={onCreatePart}
          >
            <SquarePlus aria-hidden="true" />
            New part
          </Button>
          <Button
            variant="ghost"
            disabled={disabled || view?.artifact?.kind !== 'interconnection'}
            onClick={onConnectPorts}
          >
            <Cable aria-hidden="true" />
            Connect ports
          </Button>
        </div>
      )}
    </div>
  );
}
