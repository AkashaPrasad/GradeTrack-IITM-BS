import * as S from '@radix-ui/react-select';
import { Check, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import * as React from 'react';

export const Select = S.Root;
export const SelectValue = S.Value;

export const SelectTrigger = React.forwardRef<
  React.ElementRef<typeof S.Trigger>,
  React.ComponentPropsWithoutRef<typeof S.Trigger>
>(({ className, children, ...props }, ref) => (
  <S.Trigger
    ref={ref}
    className={cn(
      'inline-flex h-9 items-center justify-between rounded-md bg-surface hairline px-3 text-sm text-fg',
      'focus:outline-none focus:ring-2 focus:ring-accent/40 data-[placeholder]:text-fgsubtle',
      className
    )}
    {...props}
  >
    {children}
    <S.Icon asChild>
      <ChevronDown className="ml-2 h-4 w-4 opacity-60" />
    </S.Icon>
  </S.Trigger>
));
SelectTrigger.displayName = 'SelectTrigger';

export function SelectContent({ className, children, ...props }: S.SelectContentProps) {
  return (
    <S.Portal>
      <S.Content
        className={cn(
          'z-50 min-w-[10rem] overflow-hidden rounded-md bg-surface hairline shadow-lg',
          'animate-fade-in',
          className
        )}
        position="popper"
        sideOffset={4}
        {...props}
      >
        <S.Viewport className="p-1">{children}</S.Viewport>
      </S.Content>
    </S.Portal>
  );
}

export const SelectItem = React.forwardRef<
  React.ElementRef<typeof S.Item>,
  React.ComponentPropsWithoutRef<typeof S.Item>
>(({ className, children, ...props }, ref) => (
  <S.Item
    ref={ref}
    className={cn(
      'relative flex cursor-pointer select-none items-center rounded-sm py-1.5 px-2 pr-8 text-sm text-fg',
      'outline-none data-[highlighted]:bg-surface2 data-[state=checked]:text-accent',
      className
    )}
    {...props}
  >
    <S.ItemText>{children}</S.ItemText>
    <S.ItemIndicator className="absolute right-2 flex h-4 w-4 items-center justify-center">
      <Check className="h-3.5 w-3.5" />
    </S.ItemIndicator>
  </S.Item>
));
SelectItem.displayName = 'SelectItem';
