import * as React from 'react';
import { cn } from '@/lib/utils';

interface Props {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export function Empty({ icon, title, description, action, className }: Props) {
  return (
    <div className={cn('flex flex-col items-center justify-center text-center py-14 px-6', className)}>
      <div className="mb-4 opacity-60">
        {icon ?? (
          <svg width="56" height="56" viewBox="0 0 56 56" fill="none">
            <rect x="8" y="12" width="40" height="32" rx="4" stroke="currentColor" strokeWidth="1.5" />
            <path d="M16 22h24M16 28h18M16 34h14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        )}
      </div>
      <h3 className="text-[15px] font-semibold tracking-tighter">{title}</h3>
      {description && <p className="mt-1 max-w-sm text-[13px] text-fgmuted">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
