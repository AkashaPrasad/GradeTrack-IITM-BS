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
    (async () => {
      const { data, error } = await supabase.auth.getSession();
      if (error || !data.session) {
        nav('/', { replace: true });
        return;
      }
      const email = data.session.user.email;
      if (!emailIsAllowed(email)) {
        await logEvent('auth.domain_blocked', { email }, 'warn');
        await supabase.auth.signOut();
        useAuth.setState({ domainBlocked: true });
        nav('/', { replace: true });
        return;
      }
      await logEvent('auth.login', { email });
      await refreshProfile();
      nav('/dashboard', { replace: true });
    })();
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
