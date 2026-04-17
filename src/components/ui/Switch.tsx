import * as Sw from '@radix-ui/react-switch';
import { cn } from '@/lib/utils';
import * as React from 'react';

export const Switch = React.forwardRef<
  React.ElementRef<typeof Sw.Root>,
  React.ComponentPropsWithoutRef<typeof Sw.Root>
>(({ className, ...props }, ref) => (
  <Sw.Root
    ref={ref}
    className={cn(
      'relative inline-flex h-[22px] w-[38px] shrink-0 cursor-pointer items-center rounded-full',
      'bg-borderstrong data-[state=checked]:bg-accent transition-colors',
      'focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:ring-offset-2 focus-visible:ring-offset-bg',
      className
    )}
    {...props}
  >
    <Sw.Thumb className="block h-[18px] w-[18px] rounded-full bg-white shadow-sm transition-transform translate-x-0.5 data-[state=checked]:translate-x-[18px]" />
  </Sw.Root>
));
Switch.displayName = 'Switch';
