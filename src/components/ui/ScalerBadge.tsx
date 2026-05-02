import { GraduationCap } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ScalerBadgeProps {
  className?: string;
  size?: 'sm' | 'md';
}

export function ScalerBadge({ className, size = 'sm' }: ScalerBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full font-medium bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
        size === 'sm' ? 'px-1.5 py-0.5 text-[11px]' : 'px-2 py-1 text-xs',
        className
      )}
    >
      <GraduationCap className={size === 'sm' ? 'h-3 w-3' : 'h-3.5 w-3.5'} />
      Scaler SST
    </span>
  );
}
