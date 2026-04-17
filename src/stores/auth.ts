import { create } from 'zustand';
import type { Session, User } from '@supabase/supabase-js';
import { supabase, emailIsAllowed, logEvent } from '@/lib/supabase';
import type { Profile } from '@/lib/database.types';

interface AuthState {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  initializing: boolean;
  domainBlocked: boolean;
  init: () => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  updateProfile: (patch: Partial<Profile>) => Promise<void>;
}

export const useAuth = create<AuthState>((set, get) => ({
  session: null,
  user: null,
  profile: null,
  initializing: true,
  domainBlocked: false,

  init: async () => {
    const { data } = await supabase.auth.getSession();
    const session = data.session;
    if (session?.user) {
      if (!emailIsAllowed(session.user.email)) {
        await supabase.auth.signOut();
        set({ session: null, user: null, profile: null, domainBlocked: true, initializing: false });
        return;
      }
      set({ session, user: session.user });
      await get().refreshProfile();
    }
    set({ initializing: false });

    supabase.auth.onAuthStateChange(async (_event, newSession) => {
      if (newSession?.user) {
        if (!emailIsAllowed(newSession.user.email)) {
          await supabase.auth.signOut();
          set({ session: null, user: null, profile: null, domainBlocked: true });
          return;
        }
        set({ session: newSession, user: newSession.user, domainBlocked: false });
        await get().refreshProfile();
      } else {
        set({ session: null, user: null, profile: null });
      }
    });
  },

  signInWithGoogle: async () => {
    const redirectTo = `${window.location.origin}/auth/callback`;
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo,
        queryParams: { prompt: 'select_account' }
      }
    });
  },

  signOut: async () => {
    await logEvent('auth.signout');
    await supabase.auth.signOut();
    set({ session: null, user: null, profile: null });
  },

  refreshProfile: async () => {
    const { user } = get();
    if (!user) return;
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle();
    if (error) {
      // eslint-disable-next-line no-console
      console.error('Profile fetch failed', error);
      return;
    }
    set({ profile: (data as Profile) ?? null });
    if (data) {
      // Fire-and-forget last_seen bump.
      supabase.from('profiles').update({ last_seen_at: new Date().toISOString() }).eq('id', user.id);
    }
  },

  updateProfile: async (patch) => {
    const { user, profile } = get();
    if (!user) return;
    const optimistic = { ...(profile as any), ...patch } as Profile;
    set({ profile: optimistic });
    const { error } = await supabase.from('profiles').update(patch).eq('id', user.id);
    if (error) {
      // revert
      await get().refreshProfile();
      throw error;
    }
  }
}));
