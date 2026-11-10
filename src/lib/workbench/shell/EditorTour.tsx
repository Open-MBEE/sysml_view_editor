import { useEffect, useId, useRef, useState } from 'react';
import { CircleHelp } from 'lucide-react';
import { Button } from '$lib/ui/primitives/button';
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
  PopoverTrigger,
} from '$lib/ui/primitives/popover';

const steps = [
  {
    title: 'Find your files and views',
    text: 'Use Explorer to open source files, choose named views and browse model elements.',
    target: '[data-tour-explorer]',
    hidden: 'Choose Show Explorer to reopen the panel.',
  },
  {
    title: 'Choose a layout',
    text: 'Switch between source, a split view and the diagram using these controls.',
    target: '[aria-label="Editor layout"]',
  },
  {
    title: 'Apply source changes',
    text: 'Source edits stay in a draft until you choose Apply source. Issues explain errors while your draft is retained.',
    target: '[aria-label="Source actions"]',
  },
  {
    title: 'Inspect your model',
    text: 'Choose Diagram view, Requirements table or Traceability matrix to inspect the applied model.',
    target: '[aria-label="Model representation"]',
    hidden: 'Choose Split or Diagram to reveal these controls.',
  },
  {
    title: 'Save your project',
    text: 'Download project saves your source, drafts and diagram positions in a portable project file.',
    target: 'button[data-tour-download]',
  },
] as const;

export function EditorTour() {
  const descriptionId = useId();
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);
  const trigger = useRef<HTMLButtonElement>(null);
  const anchor = useRef<HTMLElement | null>(null);
  const [target, setTarget] = useState<HTMLElement | null>(null);
  useEffect(() => {
    if (!open) return;
    const candidate = document.querySelector<HTMLElement>(steps[index]!.target);
    const visible = candidate && candidate.getClientRects().length > 0;
    const next = visible ? candidate : trigger.current;
    anchor.current = next;
    setTarget(next);
    if (next !== trigger.current) next?.classList.add('tour-highlight');
    return () => {
      if (next !== trigger.current) next?.classList.remove('tour-highlight');
    };
  }, [open, index]);
  const step = steps[index]!;
  const hint =
    target === trigger.current && 'hidden' in step ? step.hidden : undefined;
  return (
    <Popover
      open={open}
      onOpenChange={(value) => {
        setOpen(value);
        if (value) setIndex(0);
      }}
    >
      <PopoverTrigger asChild>
        <Button ref={trigger} variant="ghost" aria-label="Guide to the editor">
          <CircleHelp aria-hidden="true" />
          <span className="button-label">Guide</span>
        </Button>
      </PopoverTrigger>
      {target && <PopoverAnchor virtualRef={anchor} />}
      <PopoverContent
        aria-label="Editor guide"
        aria-describedby={descriptionId}
        side="bottom"
        align="center"
        collisionPadding={12}
      >
        <div className="editor-tour">
          <div
            id={descriptionId}
            className="editor-tour"
            aria-live="polite"
            aria-atomic="true"
          >
            <p className="editor-tour-progress">
              {index + 1} of {steps.length}
            </p>
            <h2>{step.title}</h2>
            <p>{step.text}</p>
            {hint && <p>{hint}</p>}
          </div>
          <div className="editor-tour-actions">
            <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
              Close
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={index === 0}
              onClick={() => setIndex(index - 1)}
            >
              Back
            </Button>
            <Button
              size="sm"
              onClick={() =>
                index === steps.length - 1
                  ? setOpen(false)
                  : setIndex(index + 1)
              }
            >
              {index === steps.length - 1 ? 'Done' : 'Next'}
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
