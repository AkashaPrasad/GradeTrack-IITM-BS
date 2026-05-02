import { cn } from '@/lib/utils';

interface LiveIndicatorProps {
  className?: string;
  label?: string;
}

export function LiveIndicator({ className, label = 'Live' }: LiveIndicatorProps) {
  return (
    <span className={cn('inline-flex items-center gap-1.5 text-[11px] font-medium text-success', className)}>
      <span className="relative flex h-2 w-2">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75" />
        <span className="relative inline-flex rounded-full h-2 w-2 bg-success" />
      </span>
      {label}
    </span>
  );
}
