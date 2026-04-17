import * as T from '@radix-ui/react-tabs';
import { cn } from '@/lib/utils';
import * as React from 'react';

export const Tabs = T.Root;

export function TabsList({ className, ...props }: T.TabsListProps) {
  return (
    <T.List
      className={cn('inline-flex gap-1 rounded-md bg-surface2 p-1', className)}
      {...props}
    />
  );
}

export function TabsTrigger({ className, ...props }: T.TabsTriggerProps) {
  return (
    <T.Trigger
      className={cn(
        'relative px-3 h-8 rounded-sm text-[13px] font-medium text-fgmuted transition-colors',
        'hover:text-fg',
        'data-[state=active]:bg-surface data-[state=active]:text-fg data-[state=active]:shadow-xs',
        className
      )}
      {...props}
    />
  );
}

export function TabsContent({ className, ...props }: T.TabsContentProps) {
  return <T.Content className={cn('mt-4 focus:outline-none', className)} {...props} />;
}
