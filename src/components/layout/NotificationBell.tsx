import { useState, useRef, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Bell, Megaphone, AlertCircle, Check } from 'lucide-react';
import { useNotifications, useMarkNotificationsRead, useRealtimeNotifications } from '@/hooks/useData';
import { cn, relativeTime } from '@/lib/utils';
import type { NotificationKind } from '@/lib/database.types';

// ── Kind metadata ────────────────────────────────────────────────────────────

const KIND_META: Record<NotificationKind, { icon: React.ElementType; bg: string; fg: string; label: string }> = {
  announcement: { icon: Megaphone,    bg: 'bg-accent/15',  fg: 'text-accent',  label: 'Announcement' },
  reminder:     { icon: Bell,         bg: 'bg-warning/15', fg: 'text-warning', label: 'Reminder'     },
  alert:        { icon: AlertCircle,  bg: 'bg-danger/15',  fg: 'text-danger',  label: 'Alert'        },
};

// ── Dropdown animation ────────────────────────────────────────────────────────

const panelVariants = {
  hidden: { opacity: 0, scale: 0.96, y: -6 },
  show:   { opacity: 1, scale: 1,    y: 0,  transition: { duration: 0.14, ease: [0.16, 1, 0.3, 1] } },
  exit:   { opacity: 0, scale: 0.96, y: -6, transition: { duration: 0.1  } },
};

// ── Component ─────────────────────────────────────────────────────────────────

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const { data } = useNotifications();
  const markRead = useMarkNotificationsRead();
  useRealtimeNotifications();

  const notifications = data?.notifications ?? [];
  const reads         = data?.reads ?? new Set<string>();
  const unread        = notifications.filter(n => !reads.has(n.id));
  const unreadCount   = unread.length;

  // Close on outside click or Escape
  useEffect(() => {
    const onMouse = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onMouse);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onMouse);
      document.removeEventListener('keydown', onKey);
    };
  }, []);

  const handleOpen = () => {
    const next = !open;
    setOpen(next);
    // Mark all unread as read as soon as the panel opens
    if (next && unread.length > 0) {
      markRead.mutate(unread.map(n => n.id));
    }
  };

  return (
    <div ref={ref} className="relative">

      {/* ── Trigger button ── */}
      <button
        onClick={handleOpen}
        aria-label="Notifications"
        aria-haspopup="true"
        aria-expanded={open}
        className={cn(
          'relative h-8 w-8 grid place-items-center rounded-md transition-colors',
          open ? 'bg-surface2 text-fg' : 'text-fgmuted hover:text-fg hover:bg-surface2'
        )}
      >
        <Bell className="h-[17px] w-[17px]" />
        <AnimatePresence>
          {unreadCount > 0 && (
            <motion.span
              key="badge"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0 }}
              transition={{ type: 'spring', stiffness: 500, damping: 30 }}
              className="absolute -top-0.5 -right-0.5 h-[16px] min-w-[16px] rounded-full bg-danger text-white text-[9px] font-bold grid place-items-center px-[3px] pointer-events-none leading-none"
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </motion.span>
          )}
        </AnimatePresence>
      </button>

      {/* ── Dropdown panel ── */}
      <AnimatePresence>
        {open && (
          <motion.div
            key="panel"
            variants={panelVariants}
            initial="hidden"
            animate="show"
            exit="exit"
            style={{ transformOrigin: 'top right' }}
            className="absolute right-0 top-[38px] z-[200] w-[360px] rounded-xl border border-border bg-surface shadow-2xl overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-border">
              <div className="flex items-center gap-2">
                <Bell className="h-3.5 w-3.5 text-fgmuted" />
                <span className="text-[13px] font-semibold tracking-tight">Notifications</span>
                {unreadCount > 0 && (
                  <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-accent/15 text-accent">
                    {unreadCount} new
                  </span>
                )}
              </div>
              {notifications.length > 0 && (
                <button
                  onClick={() => markRead.mutate(notifications.map(n => n.id))}
                  className="flex items-center gap-1 text-[11px] text-fgmuted hover:text-fg transition-colors"
                >
                  <Check className="h-3 w-3" />
                  Mark all read
                </button>
              )}
            </div>

            {/* Items */}
            <div className="max-h-[440px] overflow-y-auto overscroll-contain">
              {notifications.length === 0 ? (
                /* Empty state */
                <div className="py-12 flex flex-col items-center gap-2">
                  <div className="h-10 w-10 rounded-full bg-surface2 grid place-items-center">
                    <Bell className="h-5 w-5 text-fgsubtle" />
                  </div>
                  <p className="text-sm font-medium text-fgmuted">All caught up</p>
                  <p className="text-[12px] text-fgsubtle text-center max-w-[180px]">
                    Admin announcements and alerts will appear here.
                  </p>
                </div>
              ) : (
                notifications.map((n, i) => {
                  const isUnread = !reads.has(n.id);
                  const meta     = KIND_META[n.kind] ?? KIND_META.announcement;
                  const Icon     = meta.icon;
                  const isLast   = i === notifications.length - 1;

                  return (
                    <div
                      key={n.id}
                      className={cn(
                        'relative flex items-start gap-3 px-4 py-3 transition-colors',
                        !isLast && 'border-b border-border/60',
                        isUnread ? 'bg-accent/[0.04] dark:bg-accent/[0.06]' : 'hover:bg-surface2/60'
                      )}
                    >
                      {/* Unread accent stripe */}
                      {isUnread && (
                        <span className="absolute left-0 top-3 bottom-3 w-[3px] rounded-r-full bg-accent" />
                      )}

                      {/* Kind icon */}
                      <div className={cn('mt-0.5 h-7 w-7 rounded-md grid place-items-center shrink-0', meta.bg)}>
                        <Icon className={cn('h-3.5 w-3.5', meta.fg)} />
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline justify-between gap-2">
                          <span className={cn('text-[13px] leading-snug', isUnread ? 'font-semibold text-fg' : 'font-medium text-fg/80')}>
                            {n.title}
                          </span>
                          <span className="text-[10px] text-fgsubtle whitespace-nowrap shrink-0">
                            {relativeTime(n.created_at)}
                          </span>
                        </div>
                        {n.body && (
                          <p className="text-[12px] text-fgmuted mt-0.5 leading-relaxed line-clamp-2">
                            {n.body}
                          </p>
                        )}
                        <div className="flex items-center gap-1.5 mt-1">
                          <span className={cn('text-[10px] font-medium', meta.fg)}>{meta.label}</span>
                          {n.target_level && (
                            <>
                              <span className="text-fgsubtle">·</span>
                              <span className="text-[10px] text-fgsubtle capitalize">{n.target_level} only</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
