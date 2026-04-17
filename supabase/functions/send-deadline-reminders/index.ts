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

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    const [profilesRes, assignmentsRes, enrolmentsRes] = await Promise.all([
      fetch(`${Deno.env.get('SUPABASE_URL')}/rest/v1/profiles?select=id,email,level,push_subscription,notify_assignments,notify_exams&push_subscription=not.is.null`, {
        headers: {
          Authorization: authHeader ?? `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
          apikey: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
        },
      }),
      fetch(`${Deno.env.get('SUPABASE_URL')}/rest/v1/assignments?select=id,title,category,subject_id,foundation_deadline,degree_diploma_deadline,exam_date,level,comments&is_published=eq.true`, {
        headers: {
          Authorization: authHeader ?? `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
          apikey: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
        },
      }),
      fetch(`${Deno.env.get('SUPABASE_URL')}/rest/v1/enrolments?select=user_id,subject_id`, {
        headers: {
          Authorization: authHeader ?? `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
          apikey: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
        },
      }),
    ]);

    if (!profilesRes.ok) throw new Error(`Profiles fetch failed: ${await profilesRes.text()}`);
    if (!assignmentsRes.ok) throw new Error(`Assignments fetch failed: ${await assignmentsRes.text()}`);
    if (!enrolmentsRes.ok) throw new Error(`Enrolments fetch failed: ${await enrolmentsRes.text()}`);

    const profiles = (await profilesRes.json()) as ProfileRow[];
    const assignments = (await assignmentsRes.json()) as AssignmentRow[];
    const enrolments = (await enrolmentsRes.json()) as EnrolmentRow[];
    const enrolmentsByUser = new Map<string, Set<string>>();
    for (const enrolment of enrolments) {
      const subjectIds = enrolmentsByUser.get(enrolment.user_id) ?? new Set<string>();
      subjectIds.add(enrolment.subject_id);
      enrolmentsByUser.set(enrolment.user_id, subjectIds);
    }

    const body = await req.json().catch(() => ({} as Json));
    const testMode = body.testMode === true;
    let candidateCount = 0;
    const sent = [] as Array<{ userId: string; endpoint: string; kind: string }>;

    for (const profile of profiles) {
      if (!isPushSubscription(profile.push_subscription)) continue;
      const endpoint = profile.push_subscription.endpoint;
      if (!endpoint) continue;
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

        const message = testMode && typeof body.title === 'string' && typeof body.body === 'string'
          ? { kind: 'test', title: body.title, body: body.body }
          : buildMessage(assignment, profile.level);

        if (message.kind === 'assignment' && profile.notify_assignments === false) continue;
        if (message.kind === 'exam' && profile.notify_exams === false) continue;

        // Stub dispatch: keep the function deployable without requiring extra npm modules.
        // In production, replace this with web-push dispatch using VAPID keys.
        console.log('Would send push notification', {
          userId: profile.id,
          endpoint,
          title: message.title,
          body: message.body,
          assignmentId: assignment.id,
        });

        sent.push({ userId: profile.id, endpoint, kind: String(message.kind) });

        if (testMode) break;
      }
    }

    return new Response(JSON.stringify({ ok: true, candidateCount, sentCount: sent.length, sent }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error) {
    return new Response(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : 'Unknown error' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
