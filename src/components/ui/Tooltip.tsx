import * as T from '@radix-ui/react-tooltip';
import { cn } from '@/lib/utils';
import * as React from 'react';

export const TooltipProvider = T.Provider;
export const TooltipRoot = T.Root;
export const TooltipTrigger = T.Trigger;

export function TooltipContent({ className, ...props }: T.TooltipContentProps) {
  return (
    <T.Portal>
      <T.Content
        sideOffset={6}
        className={cn(
          'z-50 rounded-md bg-surface hairline px-2 py-1 text-xs text-fg shadow-md animate-fade-in',
          className
        )}
        {...props}
      />
    </T.Portal>
  );
}
