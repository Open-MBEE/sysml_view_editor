import type { ComponentProps } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Button } from './primitives/button';
import { Tooltip, TooltipTrigger, TooltipContent } from './primitives/tooltip';

/** One accessible name and shared focus/size rules for compact workbench actions. */
export function IconButton({
  label,
  icon: Icon,
  hint,
  size = 'icon-sm',
  variant = 'ghost',
  type = 'button',
  ...props
}: Omit<ComponentProps<typeof Button>, 'children' | 'aria-label'> & {
  label: string;
  icon: LucideIcon;
  hint?: string;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          {...props}
          type={type}
          size={size}
          variant={variant}
          aria-label={label}
        >
          <Icon aria-hidden="true" />
        </Button>
      </TooltipTrigger>
      <TooltipContent>{hint ?? label}</TooltipContent>
    </Tooltip>
  );
}
