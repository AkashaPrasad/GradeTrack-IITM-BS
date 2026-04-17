import { NavLink, Link, Outlet } from 'react-router-dom';
import { BarChart2, BookOpen, Calendar, Users, FileText, Ticket, FlaskConical, Bell, LayoutDashboard, ArrowLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ErrorBoundary } from '@/components/ErrorBoundary';

const nav = [
  { to: '/admin', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/admin/terms', label: 'Terms', icon: Calendar },
  { to: '/admin/assignments', label: 'Assignments', icon: BookOpen },
  { to: '/admin/students', label: 'Students', icon: Users },
  { to: '/admin/logs', label: 'Logs', icon: FileText },
  { to: '/admin/tickets', label: 'Tickets', icon: Ticket },
  { to: '/admin/formulas', label: 'Formulas', icon: FlaskConical },
  { to: '/admin/push', label: 'Push', icon: Bell },
];

export default function AdminShell() {
  return (
    <div className="flex h-full">
      <aside className="hidden md:flex flex-col w-48 shrink-0 border-r border-border bg-surface/50">
        <div className="px-4 pt-5 pb-3">
          <div className="text-[13px] font-semibold text-accent tracking-tighter">Admin Panel</div>
        </div>
        <nav className="px-2 space-y-0.5">
          {nav.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                cn('flex items-center gap-2 h-8 px-2.5 rounded-md text-[13px] font-medium transition-colors',
                  isActive ? 'bg-surface2 text-fg' : 'text-fgmuted hover:text-fg hover:bg-surface2/60')
              }
            >
              <Icon className="h-[15px] w-[15px]" />{label}
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto px-2 pb-4 border-t border-border pt-3">
          <Link
            to="/dashboard"
            className="flex items-center gap-2 h-8 px-2.5 rounded-md text-[13px] font-medium text-fgmuted hover:text-fg hover:bg-surface2/60 transition-colors"
          >
            <ArrowLeft className="h-[15px] w-[15px]" />Back to Dashboard
          </Link>
        </div>
      </aside>
      {/* Mobile: horizontal scroll nav */}
      <div className="flex flex-col flex-1 overflow-hidden">
        <div className="md:hidden flex gap-1 overflow-x-auto px-3 py-2 border-b border-border scrollbar-thin">
          <Link
            to="/dashboard"
            className="flex items-center gap-1.5 shrink-0 px-3 h-8 rounded-md text-[12px] font-medium whitespace-nowrap text-fgmuted"
          >
            <ArrowLeft className="h-3.5 w-3.5" />Dashboard
          </Link>
          {nav.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end}
              className={({ isActive }) =>
                cn('flex items-center gap-1.5 shrink-0 px-3 h-8 rounded-md text-[12px] font-medium whitespace-nowrap',
                  isActive ? 'bg-surface2 text-fg' : 'text-fgmuted')
              }
            >
              <Icon className="h-3.5 w-3.5" />{label}
            </NavLink>
          ))}
        </div>
        <main className="flex-1 overflow-y-auto scrollbar-thin">
          <ErrorBoundary><Outlet /></ErrorBoundary>
        </main>
      </div>
    </div>
  );
}
