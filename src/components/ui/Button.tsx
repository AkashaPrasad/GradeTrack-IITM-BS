import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const btn = cva(
  'inline-flex items-center justify-center gap-2 rounded-md font-medium btn-press select-none whitespace-nowrap transition-colors disabled:opacity-50 disabled:pointer-events-none focus-visible:ring-2 focus-visible:ring-accent/50 focus-visible:ring-offset-2 focus-visible:ring-offset-bg',
  {
    variants: {
      variant: {
        primary: 'bg-accent text-accentfg hover:bg-accent/90 shadow-sm',
        secondary: 'bg-surface hairline text-fg hover:bg-surface2',
        ghost: 'text-fgmuted hover:text-fg hover:bg-surface2',
        danger: 'bg-danger text-white hover:bg-danger/90 shadow-sm',
        outline: 'border border-border bg-transparent text-fg hover:bg-surface2'
      },
      size: {
        sm: 'h-8 px-3 text-[13px]',
        md: 'h-9 px-4 text-sm',
        lg: 'h-11 px-5 text-[15px]',
        icon: 'h-9 w-9 p-0'
      }
    },
    defaultVariants: { variant: 'primary', size: 'md' }
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof btn> {
  asChild?: boolean;
  loading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild, loading, children, disabled, ...props }, ref) => {
    const Comp: any = asChild ? Slot : 'button';
    return (
      <Comp
        ref={ref}
        className={cn(btn({ variant, size }), className)}
        disabled={disabled || loading}
        {...props}
      >
        {loading && (
          <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.25" />
            <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
          </svg>
        )}
        {children}
      </Comp>
    );
  }
);
Button.displayName = 'Button';
