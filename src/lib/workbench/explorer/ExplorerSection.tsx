import { useId, useLayoutEffect, useState, type ReactNode } from 'react';
import { ChevronRight, type LucideIcon } from 'lucide-react';
import { Button } from '$lib/ui/primitives/button';

/** Navigation chrome only: collapsing preserves the mounted projection. */
export function ExplorerSection({
  title,
  icon: Icon,
  actions,
  revealRequest,
  children,
}: {
  title: string;
  icon: LucideIcon;
  actions?: ReactNode;
  revealRequest?: number;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(true);
  const content = useId();
  useLayoutEffect(() => {
    if (revealRequest) setOpen(true);
  }, [revealRequest]);
  return (
    <section className="explorer-section">
      <div className="section-heading">
        <h2>
          <Button
            variant="ghost"
            aria-expanded={open}
            aria-controls={content}
            onClick={() => setOpen(!open)}
          >
            <ChevronRight
              aria-hidden="true"
              className={open ? 'expanded' : undefined}
            />
            <Icon aria-hidden="true" />
            {title}
          </Button>
        </h2>
        {actions}
      </div>
      <div id={content} hidden={!open} inert={!open}>
        {children}
      </div>
    </section>
  );
}
