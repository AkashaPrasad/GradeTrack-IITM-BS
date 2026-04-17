import webPush from "npm:web-push@3.6.7";

declare const Deno: {
  env: { get(name: string): string | undefined };
  serve(handler: (req: Request) => Response | Promise<Response>): void;
};

type Json = Record<string, unknown>;

type ProfileRow = {
  id: string;
  email: string;
  level: 'foundation' | 'diploma' | null;
  push_subscription: PushSubscriptionJSON | null;
  notify_assignments: boolean | null;
  notify_exams: boolean | null;
};

type EnrolmentRow = {
  user_id: string;
  subject_id: string;
};

type AssignmentRow = {
  id: string;
  title: string;
  category: string;
  subject_id: string | null;
  foundation_deadline: string | null;
  degree_diploma_deadline: string | null;
  exam_date: string | null;
  level: 'foundation' | 'diploma' | null;
  comments: string | null;
};

// Restrict CORS to the deployed app origin. Wildcard is unsafe for authenticated endpoints.
const ALLOWED_ORIGIN = Deno.env.get('APP_ORIGIN') ?? 'https://gradetrack.vercel.app';

function corsHeaders(origin: string | null) {
  const allowed = origin === ALLOWED_ORIGIN || origin === 'http://localhost:5173';
  return {
    'Access-Control-Allow-Origin': allowed ? (origin ?? ALLOWED_ORIGIN) : ALLOWED_ORIGIN,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  };
}

function json(body: unknown, status: number, origin: string | null) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
  });
}

function isPushSubscription(value: unknown): value is PushSubscriptionJSON {
  return !!value && typeof value === 'object' && 'endpoint' in value;
}

function daysUntil(dateString: string | null): number | null {
  if (!dateString) return null;
  const target = new Date(dateString);
  if (Number.isNaN(target.getTime())) return null;
  const now = new Date();
  const delta = target.getTime() - now.getTime();
  return Math.ceil(delta / (1000 * 60 * 60 * 24));
}

function deadlineForAssignment(assignment: AssignmentRow, level: ProfileRow['level']) {
  if (assignment.exam_date) return assignment.exam_date;
  if (level === 'foundation') {
    return assignment.foundation_deadline ?? assignment.degree_diploma_deadline;
  }
  return assignment.degree_diploma_deadline ?? assignment.foundation_deadline;
}

function buildMessage(assignment: AssignmentRow, level: ProfileRow['level']) {
  if (assignment.exam_date) {
    const days = daysUntil(assignment.exam_date);
    return {
      kind: 'exam',
      title: `${assignment.title} reminder`,
      body: days === 1
        ? `${assignment.title} is tomorrow.`
        : `${assignment.title} is in ${days} days.`,
    };
  }

  const deadline = deadlineForAssignment(assignment, level);
  const days = daysUntil(deadline);
  return {
    kind: 'assignment',
    title: `${assignment.title} due soon`,
    body: days === 1
      ? `${assignment.title} is due tomorrow.`
      : `${assignment.title} is due in ${days} days.`,
  };
}

function assignmentMatchesProfile(
  assignment: AssignmentRow,
  profile: ProfileRow,
  enrolledSubjectIds: ReadonlySet<string>
) {
  if (assignment.level && profile.level && assignment.level !== profile.level) return false;
  if (assignment.level && !profile.level) return false;

  if (assignment.category === 'weekly' && assignment.subject_id === null) {
    return false;
  }

  if (assignment.subject_id) {
    return enrolledSubjectIds.has(assignment.subject_id);
  }

  return assignment.category !== 'weekly';
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get('Origin');

  if (req.method === 'OPTIONS') {
    return new Response('ok', { status: 204, headers: corsHeaders(origin) });
  }

  if (req.method !== 'POST') {
    return json({ ok: false, error: 'Method not allowed' }, 405, origin);
  }

  try {
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const baseUrl = Deno.env.get('SUPABASE_URL') ?? '';

    // ── Authorization ────────────────────────────────────────────────────────
    // Allow two callers:
    //   1. pg_cron / scheduled job — sends Bearer <service_role_key>
    //   2. Admin user from the app — sends Bearer <user_jwt> (must be role=admin)
    const authHeader = req.headers.get('Authorization') ?? '';
    const isServiceRoleCall = serviceRoleKey && authHeader === `Bearer ${serviceRoleKey}`;

    if (!isServiceRoleCall) {
      if (!authHeader.startsWith('Bearer ')) {
        return json({ ok: false, error: 'Unauthorized' }, 401, origin);
      }
      // Verify the user JWT and check admin role
      const userRes = await fetch(`${baseUrl}/auth/v1/user`, {
        headers: { Authorization: authHeader, apikey: serviceRoleKey },
      });
      if (!userRes.ok) {
        return json({ ok: false, error: 'Unauthorized' }, 401, origin);
      }
      const userData = await userRes.json() as { id?: string };
      const userId = userData?.id;
      if (!userId) {
        return json({ ok: false, error: 'Unauthorized' }, 401, origin);
      }
      // Check profile role
      const profileRes = await fetch(
        `${baseUrl}/rest/v1/profiles?id=eq.${encodeURIComponent(userId)}&select=role`,
        { headers: { Authorization: `Bearer ${serviceRoleKey}`, apikey: serviceRoleKey } }
      );
      const profiles = profileRes.ok ? await profileRes.json() as Array<{ role: string }> : [];
      if (!profiles[0] || profiles[0].role !== 'admin') {
        return json({ ok: false, error: 'Admin access required' }, 403, origin);
      }
    }

    const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY');
    const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY');
    const vapidSubject = Deno.env.get('VAPID_SUBJECT') ?? 'mailto:noreply@example.com';

    if (!vapidPublicKey || !vapidPrivateKey) {
      throw new Error('VAPID keys not configured.');
    }

    webPush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);

    // Always use service role for internal data fetches — never forward user JWT
    const serviceHeaders = {
      Authorization: `Bearer ${serviceRoleKey}`,
      apikey: serviceRoleKey,
    };

    const [profilesRes, assignmentsRes, enrolmentsRes] = await Promise.all([
      fetch(`${baseUrl}/rest/v1/profiles?select=id,email,level,push_subscription,notify_assignments,notify_exams&push_subscription=not.is.null`, { headers: serviceHeaders }),
      fetch(`${baseUrl}/rest/v1/assignments?select=id,title,category,subject_id,foundation_deadline,degree_diploma_deadline,exam_date,level,comments&is_published=eq.true`, { headers: serviceHeaders }),
      fetch(`${baseUrl}/rest/v1/enrolments?select=user_id,subject_id`, { headers: serviceHeaders }),
    ]);

    if (!profilesRes.ok) throw new Error('Profiles fetch failed');
    if (!assignmentsRes.ok) throw new Error('Assignments fetch failed');
    if (!enrolmentsRes.ok) throw new Error('Enrolments fetch failed');

    const allProfiles = (await profilesRes.json()) as ProfileRow[];
    const assignments = (await assignmentsRes.json()) as AssignmentRow[];
    const enrolments = (await enrolmentsRes.json()) as EnrolmentRow[];

    const enrolmentsByUser = new Map<string, Set<string>>();
    for (const enrolment of enrolments) {
      const subjectIds = enrolmentsByUser.get(enrolment.user_id) ?? new Set<string>();
      subjectIds.add(enrolment.subject_id);
      enrolmentsByUser.set(enrolment.user_id, subjectIds);
    }

    const rawBody = await req.json().catch(() => ({} as Json));
    const testMode = rawBody.testMode === true;

    // Sanitize testMode content — cap lengths, strip to plain text
    const testTitle = testMode && typeof rawBody.title === 'string'
      ? rawBody.title.replace(/[<>"']/g, '').slice(0, 100)
      : null;
    const testBody = testMode && typeof rawBody.body === 'string'
      ? rawBody.body.replace(/[<>"']/g, '').slice(0, 500)
      : null;

    let candidateCount = 0;
    const sent: Array<{ userId: string; kind: string }> = [];
    const failed: Array<{ userId: string; error: string }> = [];

    for (const profile of allProfiles) {
      if (!isPushSubscription(profile.push_subscription)) continue;
      const sub = profile.push_subscription;
      if (!sub.endpoint) continue;

      const enrolledSubjectIds = enrolmentsByUser.get(profile.id) ?? new Set<string>();

      for (const assignment of assignments) {
        if (!assignmentMatchesProfile(assignment, profile, enrolledSubjectIds)) continue;

        const targetDate = deadlineForAssignment(assignment, profile.level);
        const days = daysUntil(targetDate);
        if (days === null) continue;

        if (assignment.exam_date) {
          if (days !== 7 && days !== 1) continue;
        } else if (days !== 3 && days !== 1) {
          continue;
        }

        candidateCount += 1;

        const message = testMode && testTitle && testBody
          ? { kind: 'test', title: testTitle, body: testBody }
          : buildMessage(assignment, profile.level);

        if (message.kind === 'assignment' && profile.notify_assignments === false) continue;
        if (message.kind === 'exam' && profile.notify_exams === false) continue;

        try {
          await webPush.sendNotification(
            sub as webPush.PushSubscription,
            JSON.stringify({
              title: message.title,
              body: message.body,
              icon: '/icons/icon-192.png',
              badge: '/icons/icon-192.png',
              tag: `gradetrack-${assignment.id}`,
              url: '/',
            })
          );
          // Only log userId (never endpoint/auth keys) to avoid credential exposure in logs
          sent.push({ userId: profile.id, kind: String(message.kind) });
        } catch (pushErr) {
          const errMsg = pushErr instanceof Error ? pushErr.message : 'Push error';
          failed.push({ userId: profile.id, error: errMsg });
        }

        if (testMode) break;
      }
    }

    return json(
      { ok: true, candidateCount, sentCount: sent.length, failedCount: failed.length, sent, failed },
      200,
      origin
    );
  } catch (error) {
    // Never expose internal error details externally
    console.error('[send-deadline-reminders] Error:', error instanceof Error ? error.message : error);
    return json({ ok: false, error: 'Internal server error' }, 500, origin);
  }
});
