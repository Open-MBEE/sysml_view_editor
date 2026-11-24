import { useLayoutEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { Button } from '$lib/ui/primitives/button';
import { IconButton } from '$lib/ui/IconButton';
export interface ContentTab {
  id: string;
  label: string;
}
export function ContentTabs({
  label,
  tabs,
  active,
  disabled,
  focusRequest,
  onSelect,
  onClose,
}: {
  label: string;
  tabs: readonly ContentTab[];
  active?: string;
  disabled?: boolean;
  focusRequest?: number;
  onSelect: (id: string) => void;
  onClose: (id: string) => void;
}) {
  const list = useRef<HTMLDivElement>(null);
  const focusedRequest = useRef(focusRequest);
  useLayoutEffect(() => {
    if (focusRequest === focusedRequest.current) return;
    const selected = list.current?.querySelector<HTMLButtonElement>(
      '[role="tab"][aria-selected="true"]',
    );
    if (selected) {
      selected.focus();
      focusedRequest.current = focusRequest;
    }
  }, [focusRequest, tabs, active]);
  const closing = useRef<string | null>(null);
  useLayoutEffect(() => {
    if (!closing.current || tabs.some((tab) => tab.id === closing.current))
      return;
    closing.current = null;
    list.current
      ?.querySelector<HTMLButtonElement>('[role="tab"][aria-selected="true"]')
      ?.focus();
  }, [tabs, active]);
  return (
    <div
      ref={list}
      className="content-tabs"
      role="tablist"
      aria-label={label}
      onKeyDown={(event) => {
        if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key))
          return;
        const buttons = [
          ...event.currentTarget.querySelectorAll<HTMLButtonElement>(
            '[role="tab"]:not(:disabled)',
          ),
        ];
        const index = buttons.indexOf(
          document.activeElement as HTMLButtonElement,
        );
        if (index < 0 || !buttons.length) return;
        const next =
          event.key === 'Home'
            ? 0
            : event.key === 'End'
              ? buttons.length - 1
              : (index +
                  (event.key === 'ArrowRight' ? 1 : -1) +
                  buttons.length) %
                buttons.length;
        event.preventDefault();
        buttons[next]?.click();
        buttons[next]?.focus();
      }}
    >
      {tabs.map((tab) => (
        <div
          className="content-tab"
          key={tab.id}
          data-active={tab.id === active}
        >
          <Button
            role="tab"
            aria-selected={tab.id === active}
            tabIndex={tab.id === active ? 0 : -1}
            variant="ghost"
            size="xs"
            disabled={disabled}
            title={tab.id}
            onClick={() => onSelect(tab.id)}
          >
            {tab.label}
          </Button>
          <IconButton
            size="icon-xs"
            icon={X}
            label={`Close ${tab.label} tab`}
            disabled={disabled || tabs.length === 1}
            hint={
              tabs.length === 1 ? 'Keep one tab open' : `Close ${tab.label} tab`
            }
            onClick={() => {
              closing.current = tab.id;
              onClose(tab.id);
            }}
          />
        </div>
      ))}
    </div>
  );
}
