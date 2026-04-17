import * as React from 'react';
import { cn } from '@/lib/utils';

type Variant = 'default' | 'accent' | 'success' | 'warning' | 'danger' | 'info' | 'muted';

const map: Record<Variant, string> = {
  default: 'bg-surface2 text-fg',
  accent: 'bg-accent/15 text-accent',
  success: 'bg-success/15 text-success',
  warning: 'bg-warning/15 text-warning',
  danger: 'bg-danger/15 text-danger',
  info: 'bg-info/15 text-info',
  muted: 'bg-surface2 text-fgmuted'
};

export function Badge({
  variant = 'default',
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { variant?: Variant }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-[11px] font-medium',
        map[variant],
        className
      )}
      {...props}
    />
  );
}
