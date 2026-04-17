import { AnimatePresence, motion } from 'framer-motion';
import { WifiOff } from 'lucide-react';
import { useIsOnline } from '@/lib/hooks';

export function OfflineBanner() {
  const online = useIsOnline();
  return (
    <AnimatePresence>
      {!online && (
        <motion.div
          initial={{ y: -40, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -40, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 380, damping: 26 }}
          className="fixed top-0 inset-x-0 z-50 bg-warning/10 text-warning border-b border-warning/20"
        >
          <div className="mx-auto max-w-6xl px-4 py-1.5 text-[12.5px] flex items-center gap-2 justify-center">
            <WifiOff className="h-3.5 w-3.5" />
            You're offline — changes will sync when you reconnect.
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
