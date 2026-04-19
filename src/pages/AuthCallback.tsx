import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase, emailIsAllowed, logEvent } from '@/lib/supabase';
import { useAuth } from '@/stores/auth';
import { useTitle } from '@/lib/hooks';

export default function AuthCallback() {
  useTitle('Signing in…');
  const nav = useNavigate();
  const { refreshProfile } = useAuth();

  useEffect(() => {
    let active = true;

    const finishSignIn = async () => {
      const params = new URLSearchParams(window.location.search);
      const providerError = params.get('error_description') ?? params.get('error');

      if (providerError) {
        await logEvent('auth.callback_failed', { providerError }, 'error');
        if (providerError.toLowerCase().includes('database error saving new user')) {
          useAuth.setState({ domainBlocked: true });
        }
        if (active) nav('/', { replace: true });
        return;
      }

      const { data, error } = await supabase.auth.getSession();
      let session = data.session;

      if (!session && !error) {
        const code = params.get('code');
        if (code) {
          const { data: exchanged, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
          if (exchangeError) {
            await logEvent('auth.callback_failed', { message: exchangeError.message }, 'error');
            if (active) nav('/', { replace: true });
            return;
          }
          session = exchanged.session;
        }
      }

      if (error || !session) {
        await logEvent('auth.callback_missing_session', { message: error?.message ?? null }, 'warn');
        if (active) nav('/', { replace: true });
        return;
      }

      const email = session.user.email;
      if (!emailIsAllowed(email)) {
        await logEvent('auth.domain_blocked', { email }, 'warn');
        await supabase.auth.signOut();
        useAuth.setState({ domainBlocked: true });
        if (active) nav('/', { replace: true });
        return;
      }

      useAuth.setState({
        session,
        user: session.user,
        domainBlocked: false,
        profileResolved: false,
      });

      await logEvent('auth.login', { email });

      // Race against an 8-second timeout so the page never hangs forever
      // if the profile fetch stalls. profileResolved is guaranteed by try/finally
      // in refreshProfile, so navigation is always safe after this.
      await Promise.race([
        refreshProfile(),
        new Promise<void>(resolve => setTimeout(resolve, 8000)),
      ]);

      if (active) {
        nav('/dashboard', { replace: true });
      }
    };

    void finishSignIn();

    return () => {
      active = false;
    };
  }, [nav, refreshProfile]);

  return (
    <div className="min-h-screen grid place-items-center">
      <div className="flex items-center gap-2 text-fgmuted text-sm">
        <span className="h-2 w-2 rounded-full bg-accent animate-pulse" />
        Signing you in…
      </div>
    </div>
  );
}
