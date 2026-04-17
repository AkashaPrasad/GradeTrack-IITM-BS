import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anon) {
  // Surface a clear error early — better than opaque network failures later.
  // eslint-disable-next-line no-console
  console.error(
    '[GradeTrack] Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. See .env.example.'
  );
}

export const supabase = createClient(url ?? '', anon ?? '', {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    flowType: 'pkce'
  },
  global: {
    headers: { 'x-app': 'gradetrack' }
  }
});

export const ALLOWED_DOMAIN =
  (import.meta.env.VITE_ALLOWED_EMAIL_DOMAIN as string | undefined) ??
  '@ds.study.iitm.ac.in';

export const COLLEGE_NAME =
  (import.meta.env.VITE_COLLEGE_NAME as string | undefined) ??
  'IITM BS Programme';

export function emailIsAllowed(email: string | null | undefined): boolean {
  if (!email) return false;
  return email.toLowerCase().endsWith(ALLOWED_DOMAIN.toLowerCase());
}

export async function logEvent(
  eventType: string,
  payload?: Record<string, any>,
  severity: 'info' | 'warn' | 'error' = 'info'
) {
  try {
    const { data: userRes } = await supabase.auth.getUser();
    await supabase.from('app_logs').insert({
      user_id: userRes?.user?.id ?? null,
      event_type: eventType,
      payload: payload ?? null,
      user_agent: navigator.userAgent,
      path: typeof location !== 'undefined' ? location.pathname : null,
      severity
    });
  } catch {
    // Swallow: logging is best-effort.
  }
}
