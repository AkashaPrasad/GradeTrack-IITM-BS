import { Moon, Sun, Monitor } from 'lucide-react';
import { useTheme } from '@/stores/theme';
import { cn } from '@/lib/utils';

const options = [
  { value: 'light', icon: Sun, label: 'Light' },
  { value: 'system', icon: Monitor, label: 'System' },
  { value: 'dark', icon: Moon, label: 'Dark' }
] as const;

export function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const { theme, setTheme } = useTheme();
  return (
    <div className="inline-flex gap-0.5 rounded-md bg-surface2 p-0.5">
      {options.map(({ value, icon: Icon, label }) => {
        const active = theme === value;
        return (
          <button
            key={value}
            aria-label={label}
            title={label}
            onClick={() => setTheme(value)}
            className={cn(
              'inline-flex items-center justify-center rounded-[4px] transition-colors',
              compact ? 'h-6 w-6' : 'h-7 w-7',
              active ? 'bg-surface text-fg shadow-xs' : 'text-fgmuted hover:text-fg'
            )}
          >
            <Icon className="h-3.5 w-3.5" />
          </button>
        );
      })}
    </div>
  );
}
