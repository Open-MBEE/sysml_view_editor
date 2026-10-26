import { useLayoutEffect, useRef, type ReactNode } from 'react';
import {
  Dialog as DialogRoot,
  DialogContent,
  DialogTitle,
} from './primitives/dialog';

// Controlled workbench actions can open a dialog without a Radix Trigger.
export function Dialog({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const returnFocus = useRef<HTMLElement | null>(null);
  useLayoutEffect(() => {
    if (open && document.activeElement instanceof HTMLElement)
      returnFocus.current = document.activeElement;
  }, [open]);
  return (
    <DialogRoot
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <DialogContent
        className="app-dialog"
        aria-describedby={undefined}
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          returnFocus.current?.focus();
        }}
      >
        <DialogTitle>{title}</DialogTitle>
        {children}
      </DialogContent>
    </DialogRoot>
  );
}
