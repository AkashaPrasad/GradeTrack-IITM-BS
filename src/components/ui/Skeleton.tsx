import { cn } from '@/lib/utils';

export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('shimmer rounded-md h-4 w-full', className)} {...props} />;
}

export function SkeletonCard() {
  return (
    <div className="rounded-lg bg-surface hairline p-5 space-y-3">
      <Skeleton className="h-4 w-1/3" />
      <Skeleton className="h-3 w-2/3" />
      <Skeleton className="h-3 w-1/2" />
    </div>
  );
}
