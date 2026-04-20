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
  signInWithEmail: (email: string, password: string) => Promise<string | null>;
  signUpWithEmail: (email: string, password: string) => Promise<string | null>;
  verifyEmailOtp: (email: string, token: string) => Promise<string | null>;
  resendEmailOtp: (email: string) => Promise<string | null>;
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

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, newSession) => {
      // Explicit sign-out — clear everything
      if (event === 'SIGNED_OUT') {
        set({ session: null, user: null, profile: null, profileResolved: true });
        return;
      }

      if (newSession?.user) {
        if (!emailIsAllowed(newSession.user.email)) {
          await supabase.auth.signOut();
          set({ session: null, user: null, profile: null, domainBlocked: true, profileResolved: true });
          return;
        }

        // Always keep the session/user token current
        set({ session: newSession, user: newSession.user, domainBlocked: false });

        // Supabase fires SIGNED_IN on every token refresh, tab return, and
        // hard-reload — not just on explicit sign-in. Calling refreshProfile()
        // every time is wasteful and risks hanging if Supabase's internal token
        // fetch stalls, which leaves the loading screen up forever.
        //
        // Rules:
        //   SIGNED_IN  + no profile  → show loading, fetch profile
        //   SIGNED_IN  + has profile → skip (profile is already current)
        //   USER_UPDATED             → silently re-fetch in background (no loading)
        //   anything else + no profile → silently recover
        if (event === 'SIGNED_IN') {
          if (!get().profile) {
            set({ profileResolved: false });
            await get().refreshProfile();
          }
          // profile already loaded — nothing to do
        } else if (event === 'USER_UPDATED') {
          void get().refreshProfile(); // background, never shows loading
        } else if (!get().profile) {
          // TOKEN_REFRESHED or INITIAL_SESSION with missing profile — recover silently
          await get().refreshProfile();
        }
      } else if (event !== 'INITIAL_SESSION') {
        // Catch-all for any other signed-out state (TOKEN_REFRESH failure, etc.)
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

  signInWithEmail: async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (!error) return null;
    const msg = error.message.toLowerCase();
    if (msg.includes('invalid login credentials') || msg.includes('invalid credentials')) {
      return 'Incorrect email or password. Please try again.';
    }
    if (msg.includes('email not confirmed')) {
      return 'EMAIL_NOT_CONFIRMED';
    }
    return error.message;
  },

  signUpWithEmail: async (email, password) => {
    if (!emailIsAllowed(email)) {
      return 'Only @ds.study.iitm.ac.in email addresses can create an account.';
    }
    const { error } = await supabase.auth.signUp({ email, password });
    if (!error) {
      await logEvent('auth.signup_email', { email });
      return null;
    }
    const msg = error.message.toLowerCase();
    if (msg.includes('already registered') || msg.includes('already exists') || msg.includes('user already')) {
      return 'An account with this email already exists. Try signing in instead.';
    }
    return error.message;
  },

  verifyEmailOtp: async (email, token) => {
    const { error } = await supabase.auth.verifyOtp({ email, token, type: 'email' });
    if (!error) {
      await logEvent('auth.otp_verified', { email });
      return null;
    }
    return 'Invalid or expired code. Please check and try again.';
  },

  resendEmailOtp: async (email) => {
    const { error } = await supabase.auth.resend({ type: 'signup', email });
    if (!error) return null;
    return error.message;
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
    try {
      for (let attempt = 0; attempt < 3; attempt += 1) {
        // Race each DB call against a 5-second timeout so a hung Supabase fetch
        // (e.g. internal token-refresh race in the JS client) never blocks forever.
        const { data, error } = await Promise.race([
          supabase.from('profiles').select('*').eq('id', user.id).maybeSingle(),
          new Promise<{ data: null; error: Error }>(resolve =>
            window.setTimeout(() => resolve({ data: null, error: new Error('timeout') }), 5000)
          ),
        ]);

        if (!error && data) {
          profile = data as Profile;
          break;
        }

        if (import.meta.env.DEV) {
          console.error('Profile fetch attempt', attempt + 1, 'failed:', error?.message);
        }

        if (attempt < 2) {
          await new Promise(resolve => window.setTimeout(resolve, 250 * (attempt + 1)));
        }
      }
    } finally {
      // Always unblock the loading screen — even if every attempt timed out.
      set({ profile, profileResolved: true });
      if (profile) {
        supabase.from('profiles').update({ last_seen_at: new Date().toISOString() }).eq('id', user.id);
      }
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
