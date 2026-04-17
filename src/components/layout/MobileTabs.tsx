import { NavLink } from 'react-router-dom';
import { LayoutDashboard, GraduationCap, CheckSquare, LineChart, MessageCircleQuestion } from 'lucide-react';
import { cn } from '@/lib/utils';

const tabs = [
  { to: '/dashboard', label: 'Home', icon: LayoutDashboard },
  { to: '/grades', label: 'Grades', icon: GraduationCap },
  { to: '/assignments', label: 'Tasks', icon: CheckSquare },
  { to: '/progress', label: 'Progress', icon: LineChart },
  { to: '/support', label: 'Support', icon: MessageCircleQuestion },
];

export function MobileTabs() {
  return (
    <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 glass border-t border-border pb-[env(safe-area-inset-bottom,0)]">
      <div className="flex justify-around h-14">
        {tabs.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              cn(
                'flex flex-col items-center justify-center gap-0.5 w-14 text-[10px] transition-colors',
                isActive ? 'text-accent' : 'text-fgmuted'
              )
            }
          >
            <Icon className="h-[18px] w-[18px]" />
            {label}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
