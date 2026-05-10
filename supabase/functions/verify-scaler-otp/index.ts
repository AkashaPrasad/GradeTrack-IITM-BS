declare const Deno: {
  env: { get(name: string): string | undefined };
  serve(handler: (req: Request) => Response | Promise<Response>): void;
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

type ProfileRow = {
  id: string;
  is_scaler_verified: boolean | null;
};

type OtpRow = {
  id: string;
  scaler_email: string;
  code_hash: string;
  expires_at: string;
  attempts: number | null;
  consumed_at: string | null;
};

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  });
}

function normalizeScalerEmail(email: string) {
  return email.trim().toLowerCase();
}

async function sha256Hex(input: string) {
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

async function getAuthedUserId(authHeader: string, supabaseUrl: string, serviceRoleKey: string) {
  const userRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: {
      Authorization: authHeader,
      apikey: serviceRoleKey,
    },
  });

  if (!userRes.ok) return null;
  const user = await userRes.json() as { id?: string };
  return user.id ?? null;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return json({ ok: false, error: 'Method not allowed' }, 405);
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const scalerDomain = (Deno.env.get('SCALER_EMAIL_DOMAIN') ?? '@sst.scaler.com').toLowerCase();

    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error('Supabase secrets are not configured.');
    }

    const authHeader = req.headers.get('Authorization') ?? '';
    if (!authHeader.startsWith('Bearer ')) {
      return json({ ok: false, error: 'Unauthorized' }, 401);
    }

    const userId = await getAuthedUserId(authHeader, supabaseUrl, serviceRoleKey);
    if (!userId) {
      return json({ ok: false, error: 'Unauthorized' }, 401);
    }

    const body = await req.json().catch(() => ({})) as { scalerEmail?: string; code?: string };
    const scalerEmail = normalizeScalerEmail(body.scalerEmail ?? '');
    const code = String(body.code ?? '').trim();

    if (!scalerEmail.endsWith(scalerDomain)) {
      return json({ ok: false, error: `Email must end in ${scalerDomain}.` }, 400);
    }

    if (!/^\d{6}$/.test(code)) {
      return json({ ok: false, error: 'Enter the 6-digit code from your email.' }, 400);
    }

    const serviceHeaders = {
      Authorization: `Bearer ${serviceRoleKey}`,
      apikey: serviceRoleKey,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    };

    const [profileRes, otpRes, claimedRes] = await Promise.all([
      fetch(
        `${supabaseUrl}/rest/v1/profiles?id=eq.${encodeURIComponent(userId)}&select=id,is_scaler_verified`,
        { headers: serviceHeaders },
      ),
      fetch(
        `${supabaseUrl}/rest/v1/scaler_verification_otps?user_id=eq.${encodeURIComponent(userId)}&select=id,scaler_email,code_hash,expires_at,attempts,consumed_at`,
        { headers: serviceHeaders },
      ),
      fetch(
        `${supabaseUrl}/rest/v1/profiles?id=neq.${encodeURIComponent(userId)}&select=id&scaler_email=eq.${encodeURIComponent(scalerEmail)}`,
        { headers: serviceHeaders },
      ),
    ]);

    if (!profileRes.ok || !otpRes.ok || !claimedRes.ok) {
      throw new Error('Failed to load verification state.');
    }

    const profile = (await profileRes.json() as ProfileRow[])[0];
    const otp = (await otpRes.json() as OtpRow[])[0];
    const claimedRows = await claimedRes.json() as Array<{ id: string }>;

    if (!profile) {
      return json({ ok: false, error: 'Profile not found.' }, 404);
    }

    if (profile.is_scaler_verified) {
      return json({ ok: false, error: 'Scaler email is already verified for this account.' }, 409);
    }

    if (claimedRows.length > 0) {
      return json({ ok: false, error: 'This Scaler email is already verified on another account.' }, 409);
    }

    if (!otp || otp.consumed_at) {
      return json({ ok: false, error: 'No active verification code found. Request a new one.' }, 404);
    }

    if (normalizeScalerEmail(otp.scaler_email) !== scalerEmail) {
      return json({ ok: false, error: 'This code was sent to a different Scaler email.' }, 400);
    }

    if (new Date(otp.expires_at).getTime() < Date.now()) {
      return json({ ok: false, error: 'This code has expired. Request a new one.' }, 400);
    }

    const codeHash = await sha256Hex(code);
    if (codeHash !== otp.code_hash) {
      const nextAttempts = (otp.attempts ?? 0) + 1;
      await fetch(`${supabaseUrl}/rest/v1/scaler_verification_otps?id=eq.${encodeURIComponent(otp.id)}`, {
        method: 'PATCH',
        headers: serviceHeaders,
        body: JSON.stringify({
          attempts: nextAttempts,
          consumed_at: nextAttempts >= 5 ? new Date().toISOString() : null,
        }),
      });

      return json(
        { ok: false, error: nextAttempts >= 5 ? 'Too many incorrect attempts. Request a new code.' : 'Incorrect code. Please try again.' },
        400,
      );
    }

    const verifiedAt = new Date().toISOString();

    const [profileUpdateRes, otpConsumeRes] = await Promise.all([
      fetch(`${supabaseUrl}/rest/v1/profiles?id=eq.${encodeURIComponent(userId)}`, {
        method: 'PATCH',
        headers: serviceHeaders,
        body: JSON.stringify({
          is_scaler_verified: true,
          scaler_email: scalerEmail,
          scaler_verified_at: verifiedAt,
        }),
      }),
      fetch(`${supabaseUrl}/rest/v1/scaler_verification_otps?id=eq.${encodeURIComponent(otp.id)}`, {
        method: 'PATCH',
        headers: serviceHeaders,
        body: JSON.stringify({
          consumed_at: verifiedAt,
        }),
      }),
    ]);

    if (!profileUpdateRes.ok || !otpConsumeRes.ok) {
      throw new Error('Failed to complete verification.');
    }

    return json({ ok: true, message: 'Scaler email verified.', scalerEmail, verifiedAt }, 200);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return json({ ok: false, error: message }, 500);
  }
});
