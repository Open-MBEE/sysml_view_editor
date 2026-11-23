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
import { ExplorationScopePicker } from './ExplorationScopePicker';
interface Props {
  active: boolean;
  exploration?: ExplorationRequest;
  explorationFocus?: 'scope' | 'representation';
  elements: readonly ModelElement[];
  onExplore: (
    request: ExplorationRequest,
    focus?: 'scope' | 'representation',
  ) => void;
  view: EvaluatedView | null;
  busy: boolean;
  disabled: boolean;
  onCreatePart: () => void;
  onConnectPorts: () => void;
}
export function DiagramTargetControls({
  active,
  exploration,
  explorationFocus,
  elements,
  onExplore,
  view,
  busy,
  disabled,
  onCreatePart,
  onConnectPorts,
}: Props) {
  const representationControl = useRef<HTMLSelectElement>(null);
  useLayoutEffect(() => {
    if (!busy && explorationFocus === 'representation')
      representationControl.current?.focus({ preventScroll: true });
  }, [busy, explorationFocus]);
  return (
    <div
      className={`diagram-target-controls${exploration ? ' diagram-exploration' : ''}`}
    >
      <div className="diagram-context">
        {exploration && (
          <>
            <ExplorationScopePicker
              scope={exploration.scope}
              elements={elements}
              active={active}
              busy={busy}
              focus={explorationFocus === 'scope'}
              onSelect={(subject) => {
                const item = elements.find((item) => item.id === subject);
                onExplore(
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
            />
            <div className="exploration-field">
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
          </>
        )}
        {!exploration && (
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
        )}
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
