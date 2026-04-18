import { useEffect, useRef, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/stores/auth';

// If the loading screen is still showing after this many ms, force it away.
// Something has gone wrong internally — better to redirect the user than
// leave them on a spinner forever.
const LOADING_TIMEOUT_MS = 10_000;

function useLoadingTimeout(isLoading: boolean): boolean {
  const [timedOut, setTimedOut] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (isLoading) {
      timer.current = setTimeout(() => setTimedOut(true), LOADING_TIMEOUT_MS);
    } else {
      if (timer.current) clearTimeout(timer.current);
      setTimedOut(false);
    }
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [isLoading]);

  return timedOut;
}

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { session, initializing, profile, profileResolved } = useAuth();
  const loc = useLocation();

  const isLoading = initializing || (!!session && !profileResolved);
  const timedOut = useLoadingTimeout(isLoading);

  if (isLoading && !timedOut) {
    return (
      <div className="min-h-screen grid place-items-center">
        <div className="flex items-center gap-2 text-fgmuted text-sm">
          <span className="h-2 w-2 rounded-full bg-accent animate-pulse" />
          Loading…
        </div>
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/" replace state={{ from: loc.pathname }} />;
  }

  if (profile && !profile.onboarded && loc.pathname !== '/onboarding') {
    return <Navigate to="/onboarding" replace />;
  }

  return <>{children}</>;
}

export function AdminGuard({ children }: { children: React.ReactNode }) {
  const { profile, initializing, session, profileResolved } = useAuth();

  const isLoading = initializing || (!!session && !profileResolved);
  const timedOut = useLoadingTimeout(isLoading);

  if (isLoading && !timedOut) {
    return (
      <div className="min-h-screen grid place-items-center">
        <div className="flex items-center gap-2 text-fgmuted text-sm">
          <span className="h-2 w-2 rounded-full bg-accent animate-pulse" />
          Loading…
        </div>
      </div>
    );
  }
  if (!profile || profile.role !== 'admin') {
    return (
      <div className="min-h-screen grid place-items-center p-6">
        <div className="max-w-sm text-center">
          <div className="mx-auto mb-4 h-12 w-12 rounded-xl bg-danger/15 grid place-items-center">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 8v5M12 17h.01" />
              <circle cx="12" cy="12" r="10" />
            </svg>
          </div>
          <h1 className="text-lg font-semibold tracking-tighter">Admin access required</h1>
          <p className="mt-1 text-sm text-fgmuted">You don't have permission to view this page.</p>
        </div>
      </div>
    );
  }
  return <>{children}</>;
}
