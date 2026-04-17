import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Download, X } from 'lucide-react';
import { Button } from './ui/Button';

const DISMISS_KEY = 'gt-install-dismissed';
const VISIT_KEY = 'gt-visit-count';

interface BIPEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function InstallPrompt() {
  const [evt, setEvt] = useState<BIPEvent | null>(null);
  const [show, setShow] = useState(false);

  useEffect(() => {
    // Track visits
    const cur = Number(localStorage.getItem(VISIT_KEY) ?? '0') + 1;
    localStorage.setItem(VISIT_KEY, String(cur));

    const handler = (e: Event) => {
      e.preventDefault();
      setEvt(e as BIPEvent);
      const dismissed = localStorage.getItem(DISMISS_KEY);
      if (!dismissed && cur >= 2) setShow(true);
    };

    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const install = async () => {
    if (!evt) return;
    await evt.prompt();
    const choice = await evt.userChoice;
    if (choice.outcome === 'accepted') {
      setShow(false);
    }
  };

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, '1');
    setShow(false);
  };

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 80, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 360, damping: 28 }}
          className="fixed bottom-20 md:bottom-6 right-4 left-4 md:left-auto md:right-6 md:w-[320px] z-40"
        >
          <div className="rounded-lg bg-surface hairline shadow-lg p-4 relative">
            <button
              onClick={dismiss}
              aria-label="Dismiss"
              className="absolute right-2 top-2 rounded-md p-1.5 text-fgmuted hover:bg-surface2"
            >
              <X className="h-3.5 w-3.5" />
            </button>
            <div className="flex items-start gap-3">
              <div className="h-9 w-9 rounded-md bg-accent/15 text-accent grid place-items-center">
                <Download className="h-4 w-4" />
              </div>
              <div className="flex-1 pr-4">
                <p className="text-sm font-medium">Install GradeTrack</p>
                <p className="text-[12.5px] text-fgmuted mt-0.5">
                  Add to your home screen for faster access and deadline notifications.
                </p>
                <Button size="sm" className="mt-3" onClick={install}>Install</Button>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
