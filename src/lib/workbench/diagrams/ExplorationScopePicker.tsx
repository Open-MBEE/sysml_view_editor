import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { Button } from '$lib/ui/primitives/button';
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from '$lib/ui/primitives/popover';
import {
  NativeSelect,
  NativeSelectOption,
} from '$lib/ui/primitives/native-select';
import type { ExplorationRequest } from '$lib/workspace/exploration';
import type { ModelElement } from '$lib/workspace/project';
import { explorationKindLabel } from './exploration';

export function ExplorationScopePicker({
  scope,
  elements,
  busy,
  active,
  focus,
  onSelect,
}: {
  scope: ExplorationRequest['scope'];
  elements: readonly ModelElement[];
  busy: boolean;
  active: boolean;
  focus: boolean;
  onSelect: (subject: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const subject = scope.kind === 'project' ? '' : scope.subject;
  const kind = subject
    ? explorationKindLabel(
        elements.find((item) => item.id === subject)?.kind ?? scope.kind,
      )
    : 'Project';
  useEffect(() => {
    if (!active) setOpen(false);
  }, [active]);
  useLayoutEffect(() => {
    if (!busy && focus) trigger.current?.focus({ preventScroll: true });
  }, [busy, focus, subject]);
  return (
    <div
      className="exploration-scope-picker"
      role="group"
      aria-label="Current exploration scope"
    >
      <Popover open={active && open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            ref={trigger}
            variant="ghost"
            size="xs"
            className="scope-trigger"
            aria-label="Change exploration scope"
            title={subject || 'Project overview'}
            disabled={busy}
          >
            {subject && <span className="scope-kind">{kind}</span>}
            <strong>{subject || 'Project overview'}</strong>
            <ChevronDown aria-hidden="true" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="scope-picker-content"
          aria-label="Change exploration scope"
          align="start"
        >
          <label htmlFor="exploration-scope">Explore a model scope</label>
          <NativeSelect
            id="exploration-scope"
            aria-label="Exploration scope"
            value={subject}
            disabled={busy}
            onChange={(event) => {
              setOpen(false);
              onSelect(event.target.value);
            }}
          >
            <NativeSelectOption value="">Project overview</NativeSelectOption>
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
        </PopoverContent>
      </Popover>
    </div>
  );
}
