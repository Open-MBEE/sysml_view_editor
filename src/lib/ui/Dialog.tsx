import { useLayoutEffect, useRef, type ReactNode, type RefObject } from 'react';
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
  fallbackFocus,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  fallbackFocus?: RefObject<HTMLElement | null>;
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
          const original = returnFocus.current;
          const target =
            original?.isConnected && !original.matches(':disabled')
              ? original
              : fallbackFocus?.current;
          target?.focus();
        }}
      >
        <DialogTitle>{title}</DialogTitle>
        {children}
      </DialogContent>
    </DialogRoot>
  );
}
