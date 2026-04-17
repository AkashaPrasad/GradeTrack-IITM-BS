import * as C from '@radix-ui/react-checkbox';
import { Check } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import * as React from 'react';

export const Checkbox = React.forwardRef<
  React.ElementRef<typeof C.Root>,
  React.ComponentPropsWithoutRef<typeof C.Root>
>(({ className, ...props }, ref) => (
  <C.Root
    ref={ref}
    className={cn(
      'relative h-[18px] w-[18px] shrink-0 rounded-[5px] border border-borderstrong bg-surface',
      'transition-colors data-[state=checked]:bg-accent data-[state=checked]:border-accent',
      'focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:ring-offset-2 focus-visible:ring-offset-bg',
      className
    )}
    {...props}
  >
    <C.Indicator asChild>
      <motion.span
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', stiffness: 500, damping: 22 }}
        className="flex h-full w-full items-center justify-center text-white"
      >
        <Check className="h-3 w-3" strokeWidth={3.5} />
      </motion.span>
    </C.Indicator>
  </C.Root>
));
Checkbox.displayName = 'Checkbox';
