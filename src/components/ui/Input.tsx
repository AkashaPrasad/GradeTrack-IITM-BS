import * as React from 'react';
import { cn } from '@/lib/utils';

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        'h-9 w-full rounded-md bg-surface hairline px-3 text-sm text-fg placeholder:text-fgsubtle',
        'focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent',
        'disabled:opacity-60 disabled:cursor-not-allowed transition-[box-shadow,border-color] num',
        className
      )}
      {...props}
    />
  )
);
Input.displayName = 'Input';

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => (
  <textarea
    ref={ref}
    className={cn(
      'min-h-[80px] w-full rounded-md bg-surface hairline p-3 text-sm text-fg placeholder:text-fgsubtle',
      'focus:outline-none focus:ring-2 focus:ring-accent/40',
      'resize-y',
      className
    )}
    {...props}
  />
));
Textarea.displayName = 'Textarea';

export function Label({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn('text-[13px] font-medium text-fgmuted', className)} {...props} />;
}
