import { NavLink } from 'react-router-dom';
import { LayoutDashboard, GraduationCap, CheckSquare, LineChart, MessageCircleQuestion, Shield, LogOut } from 'lucide-react';
import { useAuth } from '@/stores/auth';
import { cn, initialOf } from '@/lib/utils';

const items = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/grades', label: 'Grades', icon: GraduationCap },
  { to: '/assignments', label: 'Assignments', icon: CheckSquare },
  { to: '/progress', label: 'Progress', icon: LineChart },
  { to: '/support', label: 'Support', icon: MessageCircleQuestion },
];

export function Sidebar() {
  const { profile, signOut } = useAuth();
  return (
    <aside className="hidden md:flex md:flex-col md:w-56 md:shrink-0 border-r border-border bg-surface/50">
      <div className="px-4 pt-5 pb-3 flex items-center gap-2">
        <div className="h-7 w-7 rounded-md bg-accent text-white grid place-items-center">
          <svg width="14" height="14" viewBox="0 0 32 32"><path d="M9 10h14M9 16h10M9 22h14" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/></svg>
        </div>
        <div className="leading-tight">
          <div className="text-[13px] font-semibold tracking-tighter">GradeTrack</div>
          <div className="text-[11px] text-fgsubtle">IITM BS</div>
        </div>
      </div>
      <nav className="px-2 py-2 space-y-0.5">
        {items.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-2.5 h-8 px-2.5 rounded-md text-[13px] font-medium transition-colors',
                isActive
                  ? 'bg-surface2 text-fg'
                  : 'text-fgmuted hover:text-fg hover:bg-surface2/60'
              )
            }
          >
            <Icon className="h-[15px] w-[15px]" />
            {label}
          </NavLink>
        ))}
        {profile?.role === 'admin' && (
          <NavLink
            to="/admin"
            className={({ isActive }) =>
              cn(
                'flex items-center gap-2.5 h-8 px-2.5 rounded-md text-[13px] font-medium transition-colors',
                isActive ? 'bg-accent/15 text-accent' : 'text-accent hover:bg-accent/10'
              )
            }
          >
            <Shield className="h-[15px] w-[15px]" />
            Admin
          </NavLink>
        )}
      </nav>

      {/* Profile area — always anchored to bottom of sidebar */}
      <div className="mt-auto p-3 border-t border-border">
        <NavLink
          to="/profile"
          className={({ isActive }) =>
            cn(
              'flex items-center gap-2.5 px-1.5 py-1.5 rounded-md transition-colors group',
              isActive ? 'bg-surface2' : 'hover:bg-surface2/60'
            )
          }
        >
          {profile?.avatar_url ? (
            <img src={profile.avatar_url} alt="" className="h-7 w-7 rounded-full" />
          ) : (
            <div className="h-7 w-7 rounded-full bg-surface2 text-fgmuted grid place-items-center text-[11px] font-medium">
              {initialOf(profile?.full_name ?? profile?.email ?? '·')}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="text-[12.5px] font-medium truncate">{profile?.full_name ?? 'Student'}</div>
            <div className="text-[11px] text-fgsubtle truncate">{profile?.roll_number ?? profile?.email}</div>
          </div>
        </NavLink>
        <button
          onClick={signOut}
          title="Sign out"
          className="mt-1 w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-[12px] text-fgmuted hover:text-danger hover:bg-danger/8 transition-colors"
        >
          <LogOut className="h-3.5 w-3.5" /> Sign out
        </button>
      </div>
    </aside>
  );
}
