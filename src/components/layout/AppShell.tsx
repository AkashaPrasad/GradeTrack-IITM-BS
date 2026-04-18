import { NavLink, Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { MobileTabs } from './MobileTabs';
import { NotificationBell } from './NotificationBell';
import { OfflineBanner } from '../OfflineBanner';
import { InstallPrompt } from '../InstallPrompt';
import { ErrorBoundary } from '../ErrorBoundary';
import { useAuth } from '@/stores/auth';
import { initialOf } from '@/lib/utils';


function MobileHeader() {
  const { profile } = useAuth();
  return (
    <header className="md:hidden sticky top-0 z-30 glass border-b border-border flex items-center justify-between px-4 h-12">
      <div className="flex items-center gap-2">
        <div className="h-6 w-6 rounded-md bg-accent text-white grid place-items-center">
          <svg width="12" height="12" viewBox="0 0 32 32"><path d="M9 10h14M9 16h10M9 22h14" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/></svg>
        </div>
        <span className="text-[13px] font-semibold tracking-tighter">GradeTrack</span>
      </div>
      <div className="flex items-center gap-1">
        <NotificationBell />
        <NavLink to="/profile" className="flex items-center ml-1">
          {profile?.avatar_url ? (
            <img src={profile.avatar_url} alt="" className="h-8 w-8 rounded-full border-2 border-border" />
          ) : (
            <div className="h-8 w-8 rounded-full bg-surface2 border border-border text-fgmuted grid place-items-center text-[12px] font-medium">
              {initialOf(profile?.full_name ?? profile?.email ?? '·')}
            </div>
          )}
        </NavLink>
      </div>
    </header>
  );
}

function DesktopTopBar() {
  return (
    <header className="hidden md:flex sticky top-0 z-30 items-center justify-end px-5 h-12 border-b border-border bg-surface/80 backdrop-blur-md shrink-0">
      <NotificationBell />
    </header>
  );
}

export function AppShell() {
  return (
    <div className="flex h-full flex-col md:flex-row">
      <OfflineBanner />
      <Sidebar />
      <div className="flex-1 flex flex-col min-h-0">
        <MobileHeader />
        <DesktopTopBar />
        <main className="flex-1 overflow-y-auto pb-20 md:pb-0 scrollbar-thin">
          <ErrorBoundary>
            <Outlet />
          </ErrorBoundary>
        </main>
      </div>
      <MobileTabs />
      <InstallPrompt />
    </div>
  );
}
