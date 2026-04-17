import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, AlertTriangle, ChevronDown, X } from 'lucide-react';
import { useAuth } from '@/stores/auth';
import { useTitle } from '@/lib/hooks';
import { Card, CardBody } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Progress } from '@/components/ui/Progress';
import { Skeleton, SkeletonCard } from '@/components/ui/Skeleton';
import { useActiveTerm, useAssignments, useMyCompletions, useMyGrades, useMySubjects, useRealtimeAssignments, useToggleCompletion } from '@/hooks/useData';
import { filterWeeklyAssignmentsForEnrolledSubjects, formatWeeklyAssignmentLabel } from '@/lib/assignments';
import { calculateScore, checkEligibility } from '@/lib/grading/calculator';
import { daysUntil, formatDate, percentage } from '@/lib/utils';
import type { Assignment, AssignmentCompletion } from '@/lib/database.types';

const stagger = { hidden: {}, visible: { transition: { staggerChildren: 0.04 } } };
const fadeUp = { hidden: { opacity: 0, y: 8 }, visible: { opacity: 1, y: 0 } };

const EXAM_CATS = ['quiz', 'oppe', 'endterm'];
const CATEGORY_LABELS: Record<string, string> = {
  quiz: 'Quiz', oppe: 'OPPE', endterm: 'End Term',
};

function deadlineFor(a: Assignment, level: string | null | undefined): string | null {
  if (level === 'foundation') return a.foundation_deadline ?? a.degree_diploma_deadline;
  return a.degree_diploma_deadline ?? a.foundation_deadline;
}

// ─── Dashboard Week Group (collapsible, same style as Assignments page) ───────

function DashWeekGroup({ weekNum, items, subjects, level, toggle }: {
  weekNum: number;
  items: Assignment[];
  subjects: any[];
  level: string | null | undefined;
  toggle: ReturnType<typeof useToggleCompletion>;
}) {
  const [open, setOpen] = useState(false);
  const subjectMap = useMemo(() => new Map(subjects.map((s: any) => [s.id, s])), [subjects]);
  const deadline = deadlineFor(items[0], level);
  const days = daysUntil(deadline);

  // All items passed in are already pending (not completed, not skipped) so count is just items.length
  const handleMarkAllDone = (e: React.MouseEvent) => {
    e.stopPropagation();
    for (const a of items) toggle.mutate({ assignmentId: a.id, completed: true, skipped: false });
  };

  const handleMarkAllNotDone = (e: React.MouseEvent) => {
    e.stopPropagation();
    for (const a of items) toggle.mutate({ assignmentId: a.id, completed: false, skipped: true });
  };

  return (
    <div className="rounded-lg border border-border overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-2 px-3 py-2.5 bg-surface2/40 hover:bg-surface2/70 transition-colors"
      >
        <ChevronDown className={`h-3.5 w-3.5 text-fgmuted transition-transform duration-200 shrink-0 ${open ? 'rotate-180' : ''}`} />
        <span className="text-[13px] font-semibold">Week {weekNum}</span>
        <span className="text-[11px] text-fgmuted">{items.length} pending</span>
        <div className="ml-auto flex items-center gap-2">
          <button onClick={handleMarkAllDone} title="Mark all done" className="h-6 w-6 rounded grid place-items-center bg-success/10 text-success hover:bg-success/25 transition-colors">
            <CheckCircle2 className="h-3.5 w-3.5" />
          </button>
          <button onClick={handleMarkAllNotDone} title="Mark all not done" className="h-6 w-6 rounded grid place-items-center bg-danger/10 text-danger hover:bg-danger/20 transition-colors">
            <X className="h-3.5 w-3.5" />
          </button>
          {deadline && <span className="text-[11px] text-fgmuted">Due {formatDate(deadline)}</span>}
          {days !== null && (
            <Badge variant={days === 0 ? 'warning' : days <= 3 ? 'warning' : days <= 7 ? 'info' : 'success'}>
              {days === 0 ? 'Today' : `${days}d`}
            </Badge>
          )}
        </div>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="content"
            initial={{ height: 0 }}
            animate={{ height: 'auto' }}
            exit={{ height: 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-3 pt-2 space-y-1.5 border-t border-border">
              {items.map(a => {
                const subject = a.subject_id ? subjectMap.get(a.subject_id) : null;
                const label = formatWeeklyAssignmentLabel(a, subject?.name);
                return (
                  <div key={a.id} className="flex items-center gap-3 py-2 px-2.5 rounded-md border border-border bg-surface">
                    <div className="flex-1 min-w-0">
                      <span className="text-[13px] font-medium">{label}</span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        onClick={() => toggle.mutate({ assignmentId: a.id, completed: true, skipped: false })}
                        title="Mark as done"
                        className="h-7 w-7 rounded-md grid place-items-center transition-colors bg-surface2 text-fgmuted hover:bg-success/15 hover:text-success"
                      >
                        <CheckCircle2 className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => toggle.mutate({ assignmentId: a.id, completed: false, skipped: true })}
                        title="Mark as not done"
                        className="h-7 w-7 rounded-md grid place-items-center transition-colors bg-surface2 text-fgmuted hover:bg-danger/10 hover:text-danger"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────

export default function Dashboard() {
  useTitle('Dashboard');
  const { profile } = useAuth();
  const { data: term, isLoading: termLoading } = useActiveTerm();
  const subjects = useMySubjects();
  const { data: grades = [], isLoading: gradesLoading } = useMyGrades();
  const { data: assignments = [], isLoading: assLoading } = useAssignments(term?.id);
  const { data: completions = [] } = useMyCompletions();
  const toggle = useToggleCompletion();
  useRealtimeAssignments(term?.id);

  const loading = termLoading || gradesLoading || assLoading;

  const completionMap = useMemo(() => {
    const m = new Map<string, AssignmentCompletion>();
    for (const c of completions) m.set(c.assignment_id, c);
    return m;
  }, [completions]);

  const enrolledSubjectIds = useMemo(() => new Set(subjects.map(s => s.id)), [subjects]);

  const weeklyAssignments = useMemo(
    () => filterWeeklyAssignmentsForEnrolledSubjects(assignments, enrolledSubjectIds),
    [assignments, enrolledSubjectIds]
  );

  const weeklyAssignmentIds = useMemo(
    () => new Set(weeklyAssignments.map(a => a.id)),
    [weeklyAssignments]
  );

  // Weekly assignments: only pending (not done, not skipped), not overdue, next 14 days
  const upcomingWeeks = useMemo(() => {
    const grouped = new Map<number, Assignment[]>();
    for (const a of weeklyAssignments) {
      const dl = deadlineFor(a, profile?.level);
      if (!dl) continue;
      const days = daysUntil(dl);
      if (days === null || days < 0 || days > 14) continue; // skip overdue & far future
      const completion = completionMap.get(a.id);
      if (completion?.is_completed || completion?.skipped) continue; // skip done/skipped
      const w = a.week_number ?? 0;
      if (!grouped.has(w)) grouped.set(w, []);
      grouped.get(w)!.push(a);
    }
    return [...grouped.entries()].sort((a, b) => a[0] - b[0]);
  }, [weeklyAssignments, completionMap, profile?.level]);

  // Upcoming exams (quiz/oppe/endterm only) — next 14 days, with OPPE Day 1/2 merged
  const upcomingExams = useMemo(() => {
    const raw = assignments
      .filter(a => EXAM_CATS.includes(a.category))
      .map(a => {
        const dl = a.exam_date ?? deadlineFor(a, profile?.level);
        return { ...a, deadline: dl, days: daysUntil(dl) };
      })
      .filter(a => a.days !== null && a.days >= 0 && a.days <= 14)
      .sort((a, b) => (a.days ?? 999) - (b.days ?? 999));

    // Merge OPPE "Day 1" and "Day 2" entries (same exam, different shifts)
    const result: typeof raw = [];
    const seenOppeBases = new Set<string>();
    for (const a of raw) {
      if (a.category === 'oppe') {
        const match = a.title.match(/^(.+?)\s+Day\s+[12]$/i);
        if (match) {
          const base = match[1];
          if (!seenOppeBases.has(base)) {
            seenOppeBases.add(base);
            result.push({ ...a, title: `${base} Day 1/2` });
          }
          continue; // skip the duplicate Day 2 entry
        }
      }
      result.push(a);
    }
    return result.slice(0, 8);
  }, [assignments, profile?.level]);

  // Stats
  const totalWeekly = weeklyAssignments.length;
  const completedCount = completions.filter(
    c => c.is_completed && weeklyAssignmentIds.has(c.assignment_id)
  ).length;
  const pendingThisWeek = useMemo(() =>
    weeklyAssignments.filter(a => {
      const dl = deadlineFor(a, profile?.level);
      const days = daysUntil(dl);
      if (days === null || days < 0 || days > 7) return false;
      const completion = completionMap.get(a.id);
      return !completion?.is_completed && !completion?.skipped;
    }).length,
    [weeklyAssignments, completionMap, profile?.level]
  );

  // Grade predictions
  const gradeMap = useMemo(() => new Map(grades.map(g => [g.subject_id, g])), [grades]);

  function getAvgScore(): number {
    let sum = 0, cnt = 0;
    for (const s of subjects) {
      const g = gradeMap.get(s.id);
      if (!g) continue;
      const { total } = calculateScore(s, g);
      if (total > 0) { sum += total; cnt++; }
    }
    return cnt ? Math.round(sum / cnt * 10) / 10 : 0;
  }

  // Eligibility status
  const eligStatuses = subjects.map(s => {
    const g = gradeMap.get(s.id);
    if (!g) return { subject: s, eligible: false, reason: 'No marks entered yet', hasOppe: !!s.grading_config?.hasOppe, oppeScore: null as number | null };
    const e = checkEligibility(s, g);
    const oppeScore = g.oppe1_score !== null ? Math.max(g.oppe1_score ?? 0, g.oppe2_score ?? 0) : null;
    return { subject: s, eligible: e.endterm.eligible, reason: e.endterm.reason, hasOppe: !!s.grading_config?.hasOppe, oppeScore };
  });
  const allElig = eligStatuses.every(e => e.eligible);
  const someInelig = eligStatuses.some(e => !e.eligible);
  const oppeWarnings = eligStatuses.filter(e => e.hasOppe && e.oppeScore !== null && (e.oppeScore as number) < 40);

  if (loading) {
    return (
      <div className="p-4 md:p-6 space-y-4 max-w-5xl mx-auto">
        <Skeleton className="h-6 w-48" />
        <div className="grid gap-4 md:grid-cols-3">
          <SkeletonCard /><SkeletonCard /><SkeletonCard />
        </div>
        <SkeletonCard />
      </div>
    );
  }

  return (
    <motion.div initial="hidden" animate="visible" variants={stagger} className="p-4 md:p-6 max-w-5xl mx-auto space-y-5">
      {/* Header */}
      <motion.div variants={fadeUp}>
        <h1 className="text-lg font-bold tracking-tightest">
          Hi, {profile?.full_name?.split(' ')[0] ?? profile?.roll_number ?? 'there'}
        </h1>
        <p className="text-sm text-fgmuted">
          {term ? `${term.name} · ${subjects.length} courses enrolled` : 'No active term'}
        </p>
      </motion.div>

      {/* Eligibility banner */}
      {subjects.length > 0 && (
        <motion.div variants={fadeUp} className="space-y-2">
          <div className={`rounded-lg p-3 text-sm flex items-center gap-2 ${
            allElig ? 'bg-success/10 text-success' : someInelig ? 'bg-warning/10 text-warning' : 'bg-surface2 text-fgmuted'
          }`}>
            {allElig ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <AlertTriangle className="h-4 w-4 shrink-0" />}
            {allElig
              ? 'You are eligible for the end term exam in all enrolled courses.'
              : `${eligStatuses.filter(e => !e.eligible).length} course(s) are showing as ineligible — please update your marks in Grades to confirm your status.`}
          </div>
          {oppeWarnings.length > 0 && (
            <div className="rounded-lg p-3 text-sm flex items-start gap-2 bg-danger/10 text-danger">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>
                Your OPPE score is below 40 in {oppeWarnings.map(e => e.subject.code).join(', ')} — you may need to sit the OPPE re-attempt. Check the Exams section for re-attempt dates.
              </span>
            </div>
          )}
        </motion.div>
      )}

      {/* Quick stats */}
      <motion.div variants={fadeUp} className="grid gap-3 grid-cols-2 md:grid-cols-4">
        <Card><CardBody className="py-3">
          <div className="text-[12px] text-fgmuted font-medium">Completed</div>
          <div className="text-lg font-bold num">{completedCount}<span className="text-fgsubtle text-sm">/{totalWeekly}</span></div>
        </CardBody></Card>
        <Card><CardBody className="py-3">
          <div className="text-[12px] text-fgmuted font-medium">Pending this week</div>
          <div className="text-lg font-bold num">{pendingThisWeek}</div>
        </CardBody></Card>
        <Card><CardBody className="py-3">
          <div className="text-[12px] text-fgmuted font-medium">Avg predicted</div>
          <div className="text-lg font-bold num">{getAvgScore() || '—'}</div>
        </CardBody></Card>
        <Card><CardBody className="py-3">
          <div className="text-[12px] text-fgmuted font-medium">Completion</div>
          <div className="text-lg font-bold num">{totalWeekly ? percentage(completedCount, totalWeekly) : 0}%</div>
          <Progress value={completedCount} max={totalWeekly || 1} className="mt-1.5" />
        </CardBody></Card>
      </motion.div>

      {/* Upcoming weekly assignments — next 2 weeks, grouped by week */}
      <motion.div variants={fadeUp}>
        <h2 className="text-sm font-semibold tracking-tighter mb-2">Upcoming assignments</h2>
        {upcomingWeeks.length === 0 ? (
          <p className="text-sm text-fgmuted">No upcoming assignments in the next 2 weeks.</p>
        ) : (
          <div className="space-y-2">
            {upcomingWeeks.map(([weekNum, items]) => (
              <DashWeekGroup
                key={weekNum}
                weekNum={weekNum}
                items={items}
                subjects={subjects}
                level={profile?.level}
                toggle={toggle}
              />
            ))}
          </div>
        )}
      </motion.div>

      {/* Upcoming exams */}
      {upcomingExams.length > 0 && (
        <motion.div variants={fadeUp}>
          <h2 className="text-sm font-semibold tracking-tighter mb-2">Upcoming exams</h2>
          <div className="space-y-2">
            {upcomingExams.map(a => (
              <Card key={a.id}>
                <CardBody className="py-2.5 flex items-center justify-between gap-2">
                  <div>
                    <div className="text-sm font-medium">{a.title}</div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <Badge variant="muted">{CATEGORY_LABELS[a.category] ?? a.category}</Badge>
                      {a.deadline && <span className="text-[11px] text-fgmuted">{a.exam_date ? 'Exam' : 'Due'} {formatDate(a.deadline)}</span>}
                    </div>
                  </div>
                  <Badge variant={
                    a.days !== null && a.days <= 0 ? 'muted'
                      : a.days !== null && a.days <= 3 ? 'danger'
                      : a.days !== null && a.days <= 7 ? 'warning'
                      : 'info'
                  }>
                    {a.days !== null && a.days <= 0 ? 'Today/Past' : `${a.days}d`}
                  </Badge>
                </CardBody>
              </Card>
            ))}
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}
