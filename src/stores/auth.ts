import { create } from 'zustand';
import type { Session, User } from '@supabase/supabase-js';
import { supabase, emailIsAllowed, logEvent } from '@/lib/supabase';
import type { Profile } from '@/lib/database.types';

interface AuthState {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  initializing: boolean;
  profileResolved: boolean;
  domainBlocked: boolean;
  _authSub: { unsubscribe: () => void } | null;
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
  profileResolved: false,
  domainBlocked: false,
  _authSub: null,

  init: async () => {
    // Unsubscribe any previous listener (guards against double-init in React StrictMode)
    get()._authSub?.unsubscribe();

    const { data } = await supabase.auth.getSession();
    const session = data.session;
    if (session?.user) {
      if (!emailIsAllowed(session.user.email)) {
        await supabase.auth.signOut();
        set({
          session: null,
          user: null,
          profile: null,
          domainBlocked: true,
          initializing: false,
          profileResolved: true,
        });
        return;
      }
      set({ session, user: session.user, profileResolved: false });
      await get().refreshProfile();
    } else {
      set({ profileResolved: true });
    }
    set({ initializing: false });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
      if (newSession?.user) {
        if (!emailIsAllowed(newSession.user.email)) {
          await supabase.auth.signOut();
          set({ session: null, user: null, profile: null, domainBlocked: true, profileResolved: true });
          return;
        }
        set({ session: newSession, user: newSession.user, domainBlocked: false, profileResolved: false });
        await get().refreshProfile();
      } else {
        set({ session: null, user: null, profile: null, profileResolved: true });
      }
    });
    set({ _authSub: subscription });
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
    if (!user) {
      set({ profile: null, profileResolved: true });
      return;
    }

    let profile: Profile | null = null;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();

      if (!error && data) {
        profile = data as Profile;
        break;
      }

      if (error && import.meta.env.DEV) {
        console.error('Profile fetch failed', error);
      }

      if (attempt < 2) {
        await new Promise(resolve => window.setTimeout(resolve, 250 * (attempt + 1)));
      }
    }

    set({ profile, profileResolved: true });
    if (profile) {
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
