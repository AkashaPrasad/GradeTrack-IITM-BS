import { create } from 'zustand';
import { supabase } from '@/lib/supabase';

type Theme = 'light' | 'dark' | 'system';
const STORAGE_KEY = 'gt-theme';

interface ThemeState {
  theme: Theme;
  effective: 'light' | 'dark';
  init: () => void;
  setTheme: (t: Theme, persist?: boolean) => Promise<void>;
}

function apply(theme: Theme): 'light' | 'dark' {
  const mql = window.matchMedia('(prefers-color-scheme: dark)');
  const resolved: 'light' | 'dark' =
    theme === 'system' ? (mql.matches ? 'dark' : 'light') : theme;
  const html = document.documentElement;
  html.classList.toggle('dark', resolved === 'dark');
  html.classList.toggle('light', resolved === 'light');
  return resolved;
}

export const useTheme = create<ThemeState>((set, get) => ({
  theme: (typeof localStorage !== 'undefined'
    ? ((localStorage.getItem(STORAGE_KEY) as Theme) || 'light')
    : 'light'),
  effective: 'light',
  init: () => {
    const t = get().theme;
    const effective = apply(t);
    set({ effective });
    if (window.matchMedia) {
      window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
        if (get().theme === 'system') {
          set({ effective: apply('system') });
        }
      });
    }
  },
  setTheme: async (t, persist = true) => {
    const effective = apply(t);
    localStorage.setItem(STORAGE_KEY, t);
    set({ theme: t, effective });
    if (persist) {
      const { data } = await supabase.auth.getUser();
      if (data.user) {
        await supabase.from('profiles').update({ theme_preference: t }).eq('id', data.user.id);
      }
    }
  }
}));
