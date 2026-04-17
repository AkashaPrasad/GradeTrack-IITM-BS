import * as React from 'react';
import { cn } from '@/lib/utils';

interface Props extends React.HTMLAttributes<HTMLDivElement> {
  value: number;
  max?: number;
  indicatorClassName?: string;
}

export function Progress({ value, max = 100, className, indicatorClassName, ...props }: Props) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div
      role="progressbar"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={max}
      className={cn('relative h-1.5 w-full overflow-hidden rounded-full bg-surface2', className)}
      {...props}
    >
      <div
        className={cn('h-full rounded-full bg-accent transition-[width] duration-300', indicatorClassName)}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
