import * as React from 'react';
import * as RD from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useMediaQuery } from '@/lib/hooks';

export const Dialog = RD.Root;
export const DialogTrigger = RD.Trigger;
export const DialogClose = RD.Close;

export function DialogContent({
  className,
  children,
  showClose = true,
  ...props
}: RD.DialogContentProps & { showClose?: boolean }) {
  const mobile = useMediaQuery('(max-width: 640px)');

  return (
    <RD.Portal>
      <AnimatePresence>
        <RD.Overlay asChild forceMount>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
          />
        </RD.Overlay>
        <RD.Content forceMount asChild {...props}>
          <motion.div
            initial={mobile ? { y: '100%' } : { opacity: 0, scale: 0.98 }}
            animate={mobile ? { y: 0 } : { opacity: 1, scale: 1 }}
            exit={mobile ? { y: '100%' } : { opacity: 0, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 400, damping: 28 }}
            className={cn(
              'fixed z-50 bg-surface hairline shadow-lg',
              mobile
                ? 'inset-x-0 bottom-0 rounded-t-xl p-5 pb-[env(safe-area-inset-bottom,0)]'
                : 'left-1/2 top-1/2 w-[min(520px,calc(100vw-32px))] -translate-x-1/2 -translate-y-1/2 rounded-lg p-6',
              className
            )}
          >
            {children}
            {showClose && (
              <RD.Close asChild>
                <button
                  aria-label="Close"
                  className="absolute right-3 top-3 rounded-md p-1.5 text-fgmuted hover:bg-surface2 hover:text-fg"
                >
                  <X className="h-4 w-4" />
                </button>
              </RD.Close>
            )}
          </motion.div>
        </RD.Content>
      </AnimatePresence>
    </RD.Portal>
  );
}

export function DialogTitle({ className, ...props }: RD.DialogTitleProps) {
  return <RD.Title className={cn('text-base font-semibold tracking-tighter', className)} {...props} />;
}
export function DialogDescription({ className, ...props }: RD.DialogDescriptionProps) {
  return <RD.Description className={cn('text-[13px] text-fgmuted mt-1', className)} {...props} />;
}
