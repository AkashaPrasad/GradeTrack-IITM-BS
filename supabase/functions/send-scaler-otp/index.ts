declare const Deno: {
  env: { get(name: string): string | undefined };
  serve(handler: (req: Request) => Response | Promise<Response>): void;
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-app',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

type ProfileRow = {
  id: string;
  is_scaler_verified: boolean | null;
};

type OtpRow = {
  id: string;
  scaler_email: string;
  code_hash?: string;
  expires_at?: string;
  attempts?: number | null;
  consumed_at?: string | null;
  send_count: number | null;
  last_sent_at: string | null;
  created_at: string;
};

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function normalizeScalerEmail(email: string) {
  return email.trim().toLowerCase();
}

function createOtpCode() {
  const values = new Uint32Array(1);
  crypto.getRandomValues(values);
  return String(values[0] % 1_000_000).padStart(6, '0');
}

async function sha256Hex(input: string) {
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

async function getAuthedUserId(authHeader: string, supabaseUrl: string, serviceRoleKey: string) {
  const res = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: { Authorization: authHeader, apikey: serviceRoleKey },
  });
  if (!res.ok) return null;
  const user = await res.json() as { id?: string };
  return user.id ?? null;
}

function buildEmailHtml(code: string, ttlMinutes: number) {
  return `
<div style="font-family:Arial,sans-serif;line-height:1.5;color:#111827;max-width:560px;margin:0 auto;">
  <h2 style="margin-bottom:12px;">Verify your Scaler email</h2>
  <p style="margin:0 0 12px;">Use this one-time code to verify your Scaler School of Technology email in GradeTrack.</p>
  <div style="font-size:32px;font-weight:700;letter-spacing:8px;background:#f3f4f6;border-radius:12px;padding:16px 20px;text-align:center;margin:16px 0;">
    ${code}
  </div>
  <p style="margin:0 0 8px;">This code expires in ${ttlMinutes} minutes.</p>
  <p style="margin:0;color:#6b7280;font-size:14px;">If you did not request this code, ignore this email.</p>
</div>`;
}

function buildEmailText(code: string, ttlMinutes: number) {
  return [
    'Verify your Scaler email',
    '',
    'Use this one-time code to verify your Scaler School of Technology email in GradeTrack:',
    '',
    code,
    '',
    `This code expires in ${ttlMinutes} minutes.`,
    '',
    'If you did not request this code, ignore this email.',
  ].join('\n');
}

async function sendViaBrevo(
  apiKey: string,
  fromEmail: string,
  fromName: string,
  toEmail: string,
  code: string,
  ttlMinutes: number,
): Promise<void> {
  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'api-key': apiKey,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      sender: { name: fromName, email: fromEmail },
      to: [{ email: toEmail }],
      subject: 'Your GradeTrack Scaler verification code',
      htmlContent: buildEmailHtml(code, ttlMinutes),
      textContent: buildEmailText(code, ttlMinutes),
    }),
  });

  if (!res.ok) {
    let msg = 'Email delivery failed.';
    try {
      const err = await res.json() as { message?: string };
      if (err.message) msg = `Email delivery failed: ${err.message}`;
    } catch { /* non-JSON body */ }
    throw new Error(msg);
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return json({ ok: false, error: 'Method not allowed' }, 405);
  }

  try {
    const supabaseUrl      = Deno.env.get('SUPABASE_URL') ?? '';
    const serviceRoleKey   = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const brevoApiKey      = Deno.env.get('BREVO_API_KEY') ?? '';
    const fromEmail        = Deno.env.get('SCALER_VERIFICATION_FROM_EMAIL') ?? '';
    const fromName         = Deno.env.get('SCALER_VERIFICATION_FROM_NAME') ?? 'GradeTrack';
    const scalerDomain     = (Deno.env.get('SCALER_EMAIL_DOMAIN') ?? '@sst.scaler.com').toLowerCase();
    const otpTtlMinutes    = Number(Deno.env.get('SCALER_OTP_TTL_MINUTES') ?? '10');
    const cooldownSeconds  = Number(Deno.env.get('SCALER_OTP_RESEND_COOLDOWN_SECONDS') ?? '60');
    const maxSends         = Number(Deno.env.get('SCALER_OTP_MAX_SENDS_PER_WINDOW') ?? '5');
    const sendWindowMin    = Number(Deno.env.get('SCALER_OTP_SEND_WINDOW_MINUTES') ?? '60');
    const isDevMode        = Deno.env.get('SCALER_OTP_DEV_MODE') === 'true';

    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error('Supabase secrets are not configured.');
    }
    if (!isDevMode && (!brevoApiKey || !fromEmail)) {
      throw new Error('Email secrets not configured: set BREVO_API_KEY and SCALER_VERIFICATION_FROM_EMAIL.');
    }

    const authHeader = req.headers.get('Authorization') ?? '';
    if (!authHeader.startsWith('Bearer ')) {
      return json({ ok: false, error: 'Unauthorized' }, 401);
    }

    const userId = await getAuthedUserId(authHeader, supabaseUrl, serviceRoleKey);
    if (!userId) {
      return json({ ok: false, error: 'Unauthorized' }, 401);
    }

    const body        = await req.json().catch(() => ({})) as Record<string, unknown>;
    const action      = typeof body.action === 'string' ? body.action : 'send';
    const scalerEmail = normalizeScalerEmail(typeof body.scalerEmail === 'string' ? body.scalerEmail : '');

    if (!scalerEmail.endsWith(scalerDomain)) {
      return json({ ok: false, error: `Email must end in ${scalerDomain}.` }, 400);
    }

    const svcHeaders = {
      Authorization: `Bearer ${serviceRoleKey}`,
      apikey: serviceRoleKey,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    };

    const [profileRes, claimedRes, otpRes] = await Promise.all([
      fetch(`${supabaseUrl}/rest/v1/profiles?id=eq.${encodeURIComponent(userId)}&select=id,is_scaler_verified`, { headers: svcHeaders }),
      fetch(`${supabaseUrl}/rest/v1/profiles?id=neq.${encodeURIComponent(userId)}&scaler_email=eq.${encodeURIComponent(scalerEmail)}&select=id`, { headers: svcHeaders }),
      fetch(`${supabaseUrl}/rest/v1/scaler_verification_otps?user_id=eq.${encodeURIComponent(userId)}&select=id,scaler_email,code_hash,expires_at,attempts,consumed_at,send_count,last_sent_at,created_at`, { headers: svcHeaders }),
    ]);

    if (!profileRes.ok || !claimedRes.ok || !otpRes.ok) {
      throw new Error('Failed to read verification state.');
    }

    const profileRows = await profileRes.json() as ProfileRow[];
    const claimedRows = await claimedRes.json() as { id: string }[];
    const otpRows     = await otpRes.json() as OtpRow[];
    const profile     = profileRows[0];
    const existingOtp = otpRows[0] ?? null;

    if (!profile) return json({ ok: false, error: 'Profile not found.' }, 404);
    if (profile.is_scaler_verified) return json({ ok: false, error: 'Scaler email is already verified for this account.' }, 409);
    if (claimedRows.length > 0) return json({ ok: false, error: 'This Scaler email is already verified on another account.' }, 409);

    // ── VERIFY action ────────────────────────────────────────────────────────
    if (action === 'verify') {
      const code = String(typeof body.code === 'string' ? body.code : '').trim();
      if (!/^\d{6}$/.test(code)) {
        return json({ ok: false, error: 'Enter the 6-digit code from your email.' }, 400);
      }
      if (!existingOtp || existingOtp.consumed_at) {
        return json({ ok: false, error: 'No active verification code found. Request a new one.' }, 404);
      }
      if (normalizeScalerEmail(existingOtp.scaler_email) !== scalerEmail) {
        return json({ ok: false, error: 'This code was sent to a different Scaler email.' }, 400);
      }
      if (!existingOtp.expires_at || new Date(existingOtp.expires_at).getTime() < Date.now()) {
        return json({ ok: false, error: 'This code has expired. Request a new one.' }, 400);
      }
      if (!existingOtp.code_hash) throw new Error('Stored OTP is missing a code hash.');

      const codeHash = await sha256Hex(code);
      if (codeHash !== existingOtp.code_hash) {
        const nextAttempts = (existingOtp.attempts ?? 0) + 1;
        await fetch(`${supabaseUrl}/rest/v1/scaler_verification_otps?id=eq.${encodeURIComponent(existingOtp.id)}`, {
          method: 'PATCH',
          headers: svcHeaders,
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
      const [patchProfile, patchOtp] = await Promise.all([
        fetch(`${supabaseUrl}/rest/v1/profiles?id=eq.${encodeURIComponent(userId)}`, {
          method: 'PATCH',
          headers: svcHeaders,
          body: JSON.stringify({ is_scaler_verified: true, scaler_email: scalerEmail, scaler_verified_at: verifiedAt }),
        }),
        fetch(`${supabaseUrl}/rest/v1/scaler_verification_otps?id=eq.${encodeURIComponent(existingOtp.id)}`, {
          method: 'PATCH',
          headers: svcHeaders,
          body: JSON.stringify({ consumed_at: verifiedAt }),
        }),
      ]);
      if (!patchProfile.ok || !patchOtp.ok) throw new Error('Failed to complete verification.');
      return json({ ok: true, message: 'Scaler email verified.', scalerEmail, verifiedAt }, 200);
    }

    // ── SEND action ──────────────────────────────────────────────────────────
    if (existingOtp?.last_sent_at) {
      const lastSentMs = new Date(existingOtp.last_sent_at).getTime();
      if (Date.now() - lastSentMs < cooldownSeconds * 1000) {
        return json({ ok: false, error: `Please wait ${cooldownSeconds} seconds before requesting another code.` }, 429);
      }
    }
    if (existingOtp) {
      const windowMs = sendWindowMin * 60 * 1000;
      const createdMs = new Date(existingOtp.created_at).getTime();
      if (Date.now() - createdMs < windowMs && (existingOtp.send_count ?? 0) >= maxSends) {
        return json({ ok: false, error: `Too many codes requested. Try again in ${sendWindowMin} minutes.` }, 429);
      }
    }

    const code      = createOtpCode();
    const codeHash  = await sha256Hex(code);
    const nowIso    = new Date().toISOString();
    const expiresAt = new Date(Date.now() + otpTtlMinutes * 60 * 1000).toISOString();
    const inWindow  = existingOtp && Date.now() - new Date(existingOtp.created_at).getTime() < sendWindowMin * 60 * 1000;
    const sendCount = inWindow ? (existingOtp!.send_count ?? 0) + 1 : 1;

    const upsertRes = await fetch(
      `${supabaseUrl}/rest/v1/scaler_verification_otps?on_conflict=user_id`,
      {
        method: 'POST',
        headers: { ...svcHeaders, Prefer: 'resolution=merge-duplicates,return=representation' },
        body: JSON.stringify({
          user_id: userId,
          scaler_email: scalerEmail,
          code_hash: codeHash,
          expires_at: expiresAt,
          attempts: 0,
          send_count: sendCount,
          last_sent_at: nowIso,
          consumed_at: null,
          created_at: inWindow ? existingOtp!.created_at : nowIso,
        }),
      },
    );
    if (!upsertRes.ok) {
      const details = await upsertRes.text();
      throw new Error(`Failed to store OTP: ${details}`);
    }

    // Dev mode: skip email and return the code directly for local testing.
    if (isDevMode) {
      return json({ ok: true, devMode: true, devCode: code, message: 'Dev mode: code returned in response.', expiresInMinutes: otpTtlMinutes }, 200);
    }

    await sendViaBrevo(brevoApiKey, fromEmail, fromName, scalerEmail, code, otpTtlMinutes);

    return json({ ok: true, message: 'Verification code sent.', expiresInMinutes: otpTtlMinutes }, 200);

  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return json({ ok: false, error: message }, 500);
  }
});
