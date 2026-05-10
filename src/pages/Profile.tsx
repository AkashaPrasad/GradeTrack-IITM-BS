import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useTitle } from '@/lib/hooks';
import { useAuth } from '@/stores/auth';
import {
  useStudentTerms,
  useSetCurrentStudentTerm,
  useDeleteStudentTerm,
  useMyEnrolments,
  useMyGrades,
  useCGPA,
} from '@/hooks/useData';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/Card';
import { Label } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Switch } from '@/components/ui/Switch';
import { ThemeToggle } from '@/components/layout/ThemeToggle';
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '@/components/ui/Select';
import { ScalerVerification } from '@/components/features/scaler/ScalerVerification';
import { CreateTermModal } from '@/components/features/terms/CreateTermModal';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { LogOut, Bell, BellOff, BookOpen, TrendingUp, ArrowRight, PlusCircle, Trash2 } from 'lucide-react';
import { initialOf } from '@/lib/utils';
import { calculateScore } from '@/lib/grading/calculator';
import { getGradePoint, getGradeColor } from '@/lib/grading/letters';


const stagger = { hidden: {}, visible: { transition: { staggerChildren: 0.04 } } };
const fadeUp  = { hidden: { opacity: 0, y: 8 }, visible: { opacity: 1, y: 0 } };

function TermHistoryCard({
  onNavigateToGrades,
  onAddTerm,
}: {
  onNavigateToGrades: () => void;
  onAddTerm: () => void;
}) {
  const { data: studentTerms = [] } = useStudentTerms();
  const { data: enrolments = [] }   = useMyEnrolments();
  const { data: grades = [] }       = useMyGrades();
  const { cgpa, totalCredits, termsWithMarks } = useCGPA();
  const setCurrentTerm = useSetCurrentStudentTerm();
  const deleteTerm     = useDeleteStudentTerm();

  const gradeMap = useMemo(() => new Map(grades.map((g) => [g.subject_id, g])), [grades]);

  const termSummaries = useMemo(() => {
    return studentTerms.map((st) => {
      const enrolledSubjects = enrolments
        .filter((e) => e.subject?.term_id === st.term_id)
        .map((e) => e.subject!)
        .filter(Boolean);

      let weighted = 0, credits = 0, hasMarks = false;
      for (const s of enrolledSubjects) {
        const g = gradeMap.get(s.id);
        if (!g) continue;
        const anyScore = [
          g.qz1_score, g.qz2_score, g.final_exam_score, g.oppe1_score,
          g.oppe2_score, g.roe_score, g.p1_score, g.p2_score, g.ka_score, g.bonus_score,
        ].some((v) => typeof v === 'number');
        if (!anyScore) continue;
        hasMarks = true;
        const r = calculateScore(s, g);
        weighted += getGradePoint(r.letter as Parameters<typeof getGradePoint>[0]) * s.credits;
        credits  += s.credits;
      }
      const gpa = hasMarks && credits > 0 ? Math.round((weighted / credits) * 100) / 100 : null;
      const displayName = st.custom_name || st.term?.name || 'Unknown';
      return { studentTerm: st, displayName, enrolledCount: enrolledSubjects.length, gpa };
    });
  }, [studentTerms, enrolments, gradeMap]);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-accent" />
            Academic History
          </CardTitle>
          <div className="flex items-center gap-2">
            {cgpa !== null && termsWithMarks > 1 && (
              <div className="text-right mr-1">
                <div className="text-[11px] text-fgmuted">CGPA</div>
                <div className="text-lg font-bold num text-accent">{cgpa.toFixed(2)}</div>
              </div>
            )}
            <Button variant="ghost" size="sm" onClick={onAddTerm} className="gap-1.5 px-2">
              <PlusCircle className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Add term</span>
            </Button>
          </div>
        </div>
        {cgpa !== null && termsWithMarks > 1 && (
          <div className="text-[12px] text-fgmuted mt-0.5">
            {totalCredits} credits across {termsWithMarks} term{termsWithMarks !== 1 ? 's' : ''}
          </div>
        )}
      </CardHeader>
      <CardBody className="space-y-2 pt-0">
        {termSummaries.length === 0 ? (
          <p className="text-[13px] text-fgmuted">
            No terms yet. Add your first academic term to start tracking your progress.
          </p>
        ) : (
          termSummaries.map(({ studentTerm: st, displayName, enrolledCount, gpa }) => (
            <div
              key={st.id}
              className="flex items-center gap-3 rounded-lg border border-border px-3 py-2.5"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[13px] font-medium truncate">{displayName}</span>
                  {st.is_current && <Badge variant="success" className="text-[10px] shrink-0">Current</Badge>}
                </div>
                <div className="text-[11px] text-fgmuted">
                  {st.term?.name && st.custom_name && st.custom_name !== st.term.name
                    ? `${st.term.name} · `
                    : ''}
                  {enrolledCount} course{enrolledCount !== 1 ? 's' : ''}
                  {gpa !== null && ` · GPA ${gpa.toFixed(2)}`}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {gpa !== null && (
                  <div
                    className="text-base font-bold num"
                    style={{ color: getGradeColor(gpa * 10) }}
                  >
                    {gpa.toFixed(2)}
                  </div>
                )}
                {!st.is_current && (
                  <button
                    type="button"
                    onClick={() => setCurrentTerm.mutate(st.id)}
                    disabled={setCurrentTerm.isPending}
                    className="text-[11px] text-accent hover:underline"
                  >
                    Set current
                  </button>
                )}
                {!st.is_current && (
                  <button
                    type="button"
                    onClick={() => {
                      if (window.confirm(`Remove "${displayName}" from your history? Your enrolled courses and marks are kept.`)) {
                        deleteTerm.mutate(st.id);
                      }
                    }}
                    className="text-fgmuted hover:text-danger"
                    title="Remove term"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>
          ))
        )}
        <button
          type="button"
          onClick={onNavigateToGrades}
          className="w-full flex items-center justify-center gap-1.5 text-[12px] text-accent hover:underline pt-1"
        >
          <BookOpen className="h-3.5 w-3.5" />
          View &amp; manage courses
          <ArrowRight className="h-3 w-3" />
        </button>
      </CardBody>
    </Card>
  );
}

function decodeVapidPublicKey(key: string): ArrayBuffer {
  const normalized = key.trim().replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
  const raw = window.atob(padded);
  const buffer = new ArrayBuffer(raw.length);
  const bytes = new Uint8Array(buffer);

  for (let i = 0; i < raw.length; i += 1) {
    bytes[i] = raw.charCodeAt(i);
  }

  return buffer;
}

export default function Profile() {
  useTitle('Profile');
  const { profile, updateProfile, signOut } = useAuth();
  const nav = useNavigate();
  const [notifLoading, setNotifLoading] = useState(false);
  const [showCreateTerm, setShowCreateTerm] = useState(false);
  const { data: studentTerms = [] } = useStudentTerms();

  const changeLevel = async (val: string) => {
    try {
      await updateProfile({ level: val as any });
      toast.success('Level updated. Re-select your courses.');
      nav('/onboarding');
    } catch {
      toast.error('Failed to update level');
    }
  };

  const hasNotifications = !!profile?.push_subscription;

  const toggleNotifications = async (nextChecked: boolean) => {
    setNotifLoading(true);
    try {
      if (!nextChecked) {
        if ('serviceWorker' in navigator && 'PushManager' in window) {
          const reg = await navigator.serviceWorker.getRegistration();
          const existing = await reg?.pushManager.getSubscription();
          if (existing) {
            await existing.unsubscribe();
          }
        }
        await updateProfile({ push_subscription: null });
        toast.success('Push notifications disabled.');
      } else {
        if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
          toast.error('Push notifications are not supported in this browser.');
          return;
        }

        const vapidKey = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined;
        if (!vapidKey) {
          toast.error('Push notifications are not configured yet. Contact the admin.');
          return;
        }

        const permission = await Notification.requestPermission();
        if (permission !== 'granted') {
          toast.error('Notification permission denied. Enable it in your browser settings and try again.');
          return;
        }

        const reg = await Promise.race([
          navigator.serviceWorker.ready,
          new Promise<never>((_, reject) =>
            setTimeout(
              () => reject(new Error('Service worker is taking too long. Try refreshing the page.')),
              10_000,
            )
          ),
        ]);

        // Reuse an existing subscription if one already exists (avoids duplicate
        // subscriptions after e.g. clearing app data or re-installing the PWA)
        const existing = await reg.pushManager.getSubscription();
        const sub = existing ?? await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: decodeVapidPublicKey(vapidKey),
        });

        await updateProfile({ push_subscription: sub.toJSON() as any });
        toast.success('Push notifications enabled! You\'ll be reminded before deadlines.');
      }
    } catch (e: any) {
      toast.error(e?.message ?? 'Failed to update notifications. Please try again.');
    } finally {
      setNotifLoading(false);
    }
  };

  return (
    <motion.div initial="hidden" animate="visible" variants={stagger} className="p-4 md:p-6 max-w-2xl mx-auto space-y-5">
      <motion.div variants={fadeUp}>
        <h1 className="text-lg font-bold tracking-tightest">Profile</h1>
      </motion.div>

      {/* User info */}
      <motion.div variants={fadeUp}>
        <Card>
          <CardBody className="flex items-center gap-4">
            {profile?.avatar_url ? (
              <img src={profile.avatar_url} alt="" className="h-14 w-14 rounded-full" />
            ) : (
              <div className="h-14 w-14 rounded-full bg-surface2 text-fgmuted grid place-items-center text-xl font-medium">
                {initialOf(profile?.full_name)}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="text-[15px] font-semibold">{profile?.full_name ?? '—'}</div>
              <div className="text-sm text-fgmuted truncate">{profile?.email}</div>
              <div className="flex gap-2 mt-1">
                <Badge variant="accent">{profile?.level ?? '—'}</Badge>
                {profile?.role === 'admin' && <Badge variant="warning">Admin</Badge>}
                {profile?.roll_number && <Badge variant="muted">{profile.roll_number}</Badge>}
              </div>
            </div>
          </CardBody>
        </Card>
      </motion.div>

      {/* Level + courses */}
      <motion.div variants={fadeUp}>
        <Card>
          <CardHeader><CardTitle>Level & Courses</CardTitle></CardHeader>
          <CardBody className="space-y-4">
            <div>
              <Label>Current level</Label>
              <Select value={profile?.level ?? 'foundation'} onValueChange={changeLevel}>
                <SelectTrigger className="mt-1 w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="foundation">Foundation</SelectItem>
                  <SelectItem value="diploma">Diploma</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-[11px] text-fgsubtle mt-1">Changing level resets your course enrolment.</p>
            </div>
            <div>
              <Button variant="ghost" size="sm" className="gap-1.5" onClick={() => nav('/grades')}>
                <BookOpen className="h-3.5 w-3.5" /> View &amp; manage courses in Grades
              </Button>
            </div>
          </CardBody>
        </Card>
      </motion.div>

      {/* Term history + CGPA */}
      <motion.div variants={fadeUp}>
        <TermHistoryCard
          onNavigateToGrades={() => nav('/grades')}
          onAddTerm={() => setShowCreateTerm(true)}
        />
      </motion.div>

      {/* Notifications */}
      <motion.div variants={fadeUp}>
        <Card>
          <CardHeader><CardTitle>Notifications</CardTitle></CardHeader>
          <CardBody className="space-y-3">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2.5">
                {hasNotifications
                  ? <Bell className="h-4 w-4 text-success" />
                  : <BellOff className="h-4 w-4 text-fgmuted" />
                }
                <div>
                  <div className="text-sm font-medium">
                    {hasNotifications ? 'Notifications are on' : 'Notifications are off'}
                  </div>
                  <div className="text-[12px] text-fgmuted">
                    Get reminded 1 day and 3 days before assignment deadlines, and 1 and 7 days before exams.
                  </div>
                </div>
              </div>
              <Switch checked={hasNotifications} onCheckedChange={toggleNotifications} disabled={notifLoading} />
            </div>
            {hasNotifications && (
              <div className="flex flex-wrap gap-3 pt-1">
                <label className="flex items-center gap-2 text-sm">
                  <Switch
                    checked={profile?.notify_assignments ?? true}
                    onCheckedChange={v => updateProfile({ notify_assignments: v })}
                  />
                  Assignment reminders
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <Switch
                    checked={profile?.notify_exams ?? true}
                    onCheckedChange={v => updateProfile({ notify_exams: v })}
                  />
                  Exam reminders
                </label>
              </div>
            )}
          </CardBody>
        </Card>
      </motion.div>

      {/* Scaler verification */}
      <ScalerVerification />

      {/* Theme */}
      <motion.div variants={fadeUp}>
        <Card>
          <CardHeader><CardTitle>Appearance</CardTitle></CardHeader>
          <CardBody><ThemeToggle /></CardBody>
        </Card>
      </motion.div>

      {/* Sign out */}
      <motion.div variants={fadeUp}>
        <Button variant="ghost" className="text-danger w-full justify-start gap-2" onClick={signOut}>
          <LogOut className="h-4 w-4" /> Sign out
        </Button>
      </motion.div>

      <CreateTermModal
        open={showCreateTerm}
        onOpenChange={setShowCreateTerm}
        existingCount={studentTerms.length}
      />
    </motion.div>
  );
}
