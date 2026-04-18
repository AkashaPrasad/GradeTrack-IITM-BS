import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CalendarDays, List, CheckCircle2, X, CalendarClock, BookOpen, ChevronDown } from 'lucide-react';
import { useTitle } from '@/lib/hooks';
import { useAuth } from '@/stores/auth';
import { useActiveTerm, useAssignments, useMyCompletions, useMySubjects, useToggleCompletion, useRealtimeAssignments } from '@/hooks/useData';
import { Card, CardBody } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Progress } from '@/components/ui/Progress';
import { Button } from '@/components/ui/Button';
import { Skeleton, SkeletonCard } from '@/components/ui/Skeleton';
import { Empty } from '@/components/ui/Empty';
import { daysUntil, formatDate, percentage } from '@/lib/utils';
import { filterWeeklyAssignmentsForEnrolledSubjects, formatWeeklyAssignmentLabel } from '@/lib/assignments';
import type { Assignment, AssignmentCompletion } from '@/lib/database.types';

const stagger = { hidden: {}, visible: { transition: { staggerChildren: 0.04 } } };
const fadeUp = { hidden: { opacity: 0, y: 8 }, visible: { opacity: 1, y: 0 } };

type MainTab = 'assignments' | 'exams';
type View = 'list' | 'calendar';

function deadlineFor(a: Assignment, level: string | null | undefined): string | null {
  if (level === 'foundation') return a.foundation_deadline ?? a.degree_diploma_deadline;
  return a.degree_diploma_deadline ?? a.foundation_deadline;
}

const EXAM_CATEGORIES = ['quiz', 'endterm', 'oppe', 'roe', 'bpt', 'ka', 'project', 'bonus', 'extra'];

export default function Assignments() {
  useTitle('Assignments');
  const { profile } = useAuth();
  const { data: term, isLoading: tl } = useActiveTerm();
  const { data: allAssignments = [], isLoading: al } = useAssignments(term?.id);
  const { data: completions = [] } = useMyCompletions();
  const subjects = useMySubjects();
  const toggle = useToggleCompletion();
  useRealtimeAssignments(term?.id);

  const [tab, setTab] = useState<MainTab>('assignments');
  const [view, setView] = useState<View>('list');

  const completionMap = useMemo(() => {
    const m = new Map<string, AssignmentCompletion>();
    for (const c of completions) m.set(c.assignment_id, c);
    return m;
  }, [completions]);

  // Build a set of enrolled subject IDs for fast lookup
  const enrolledSubjectIds = useMemo(() => new Set(subjects.map(s => s.id)), [subjects]);

  const weeklyAssignments = useMemo(
    () => filterWeeklyAssignmentsForEnrolledSubjects(allAssignments, enrolledSubjectIds),
    [allAssignments, enrolledSubjectIds]
  );

  // Exam assignments — non-weekly categories
  // Filter OPPE out if none of the user's enrolled subjects actually have an OPPE component
  const userHasOppe = useMemo(() => subjects.some(s => s.grading_config?.hasOppe), [subjects]);
  const examAssignments = useMemo(() =>
    allAssignments.filter(a => {
      if (!EXAM_CATEGORIES.includes(a.category)) return false;
      if (a.category === 'oppe' && !userHasOppe) return false;
      return true;
    }),
    [allAssignments, userHasOppe]
  );

  // Count for progress bar (only weekly)
  const totalWeekly = weeklyAssignments.length;
  const doneCount = weeklyAssignments.filter(a => completionMap.get(a.id)?.is_completed).length;

  if (tl || al) return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-4">
      <Skeleton className="h-6 w-40" />
      <SkeletonCard /><SkeletonCard /><SkeletonCard />
    </div>
  );

  return (
    <motion.div initial="hidden" animate="visible" variants={stagger} className="p-4 md:p-6 max-w-4xl mx-auto space-y-4">
      {/* Header */}
      <motion.div variants={fadeUp} className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold tracking-tightest">
            {tab === 'assignments' ? 'Assignments' : 'Exams & Deadlines'}
          </h1>
          {tab === 'assignments' && (
            <div>
              <p className="text-sm text-fgmuted">{doneCount}/{totalWeekly} completed · {totalWeekly > 0 ? percentage(doneCount, totalWeekly) : 0}%</p>
              <Progress value={doneCount} max={totalWeekly || 1} className="mt-1.5 w-40" />
            </div>
          )}
          {tab === 'exams' && (
            <p className="text-sm text-fgmuted">Quizzes, OPPEs & end term — filtered for your level</p>
          )}
        </div>
        {tab === 'assignments' && (
          <div className="flex gap-1.5">
            <Button variant={view === 'list' ? 'secondary' : 'ghost'} size="icon" onClick={() => setView('list')} aria-label="List view">
              <List className="h-4 w-4" />
            </Button>
            <Button variant={view === 'calendar' ? 'secondary' : 'ghost'} size="icon" onClick={() => setView('calendar')} aria-label="Calendar view">
              <CalendarDays className="h-4 w-4" />
            </Button>
          </div>
        )}
      </motion.div>

      {/* Tabs */}
      <motion.div variants={fadeUp} className="flex gap-1 p-1 bg-surface2 rounded-lg w-fit">
        <button
          onClick={() => setTab('assignments')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[13px] font-medium transition-colors ${
            tab === 'assignments' ? 'bg-surface text-fg shadow-sm' : 'text-fgmuted hover:text-fg'
          }`}
        >
          <BookOpen className="h-3.5 w-3.5" /> Assignments
        </button>
        <button
          onClick={() => setTab('exams')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[13px] font-medium transition-colors ${
            tab === 'exams' ? 'bg-surface text-fg shadow-sm' : 'text-fgmuted hover:text-fg'
          }`}
        >
          <CalendarClock className="h-3.5 w-3.5" /> Exams
        </button>
      </motion.div>

      {/* Assignments Tab */}
      {tab === 'assignments' && (
        <>
          {view === 'list' && (
            <WeeklyList
              assignments={weeklyAssignments}
              completionMap={completionMap}
              subjects={subjects}
              level={profile?.level}
              toggle={toggle}
            />
          )}
          {view === 'calendar' && (
            <CalendarView assignments={weeklyAssignments} completionMap={completionMap} level={profile?.level} />
          )}
        </>
      )}

      {/* Exams Tab */}
      {tab === 'exams' && (
        <ExamList
          assignments={examAssignments}
          allOppeAssignments={allAssignments.filter(a => a.category === 'oppe')}
          completionMap={completionMap}
          level={profile?.level}
          toggle={toggle}
        />
      )}
    </motion.div>
  );
}

// ─── Weekly Assignments (grouped by week) ────────────────────────────────────

function WeeklyList({ assignments, completionMap, subjects, level, toggle }: {
  assignments: Assignment[];
  completionMap: Map<string, AssignmentCompletion>;
  subjects: any[];
  level: string | null | undefined;
  toggle: ReturnType<typeof useToggleCompletion>;
}) {
  // Group by week number
  const weeks = useMemo(() => {
    const map = new Map<number, Assignment[]>();
    for (const a of assignments) {
      const w = a.week_number ?? 0;
      if (!map.has(w)) map.set(w, []);
      map.get(w)!.push(a);
    }
    return [...map.entries()].sort((a, b) => a[0] - b[0]);
  }, [assignments]);

  if (weeks.length === 0) {
    return <Empty title="No weekly assignments" description="Enrol in courses to see per-subject weekly assignments here." />;
  }

  return (
    <div className="space-y-2">
      {weeks.map(([weekNum, items]) => (
        <WeekGroup
          key={weekNum}
          weekNum={weekNum}
          items={items}
          completionMap={completionMap}
          level={level}
          toggle={toggle}
          subjects={subjects}
        />
      ))}
    </div>
  );
}

function WeekGroup({ weekNum, items, completionMap, level, toggle, subjects }: {
  weekNum: number;
  items: Assignment[];
  completionMap: Map<string, AssignmentCompletion>;
  level: string | null | undefined;
  toggle: ReturnType<typeof useToggleCompletion>;
  subjects: any[];
}) {
  const [open, setOpen] = useState(false);
  const subjectMap = useMemo(() => new Map(subjects.map(s => [s.id, s])), [subjects]);

  const deadline = deadlineFor(items[0], level);
  const days = daysUntil(deadline);
  const doneInWeek = items.filter(a => completionMap.get(a.id)?.is_completed).length;
  const allDone = doneInWeek === items.length;

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
      {/* Week header — click to expand/collapse */}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-2 px-3 py-2.5 bg-surface2/40 hover:bg-surface2/70 transition-colors"
      >
        <ChevronDown className={`h-3.5 w-3.5 text-fgmuted transition-transform duration-200 shrink-0 ${open ? 'rotate-180' : ''}`} />
        <span className="text-[13px] font-semibold">Week {weekNum}</span>
        <span className="text-[11px] text-fgmuted">{doneInWeek}/{items.length} done</span>
        <div className="ml-auto flex items-center gap-2">
          {/* Collective action buttons */}
          <button
            onClick={handleMarkAllDone}
            title="Mark all as done"
            className="h-6 w-6 rounded grid place-items-center bg-success/10 text-success hover:bg-success/25 transition-colors"
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={handleMarkAllNotDone}
            title="Mark all as not done"
            className="h-6 w-6 rounded grid place-items-center bg-danger/10 text-danger hover:bg-danger/20 transition-colors"
          >
            <X className="h-3.5 w-3.5" />
          </button>
          {deadline && <span className="text-[11px] text-fgmuted">Due {formatDate(deadline)}</span>}
          {allDone
            ? <Badge variant="success">Done</Badge>
            : days !== null && (
              <Badge variant={days <= 0 ? 'danger' : days <= 3 ? 'warning' : 'info'}>
                {days === 0 ? 'Today' : days < 0 ? 'Overdue' : `${days}d`}
              </Badge>
            )
          }
        </div>
      </button>

      {/* Expanded content */}
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
            {/* Per-subject items */}
            <div className="px-3 pb-3 pt-2 space-y-1.5 border-t border-border">
              {items.map(a => {
                const c = completionMap.get(a.id);
                const done = c?.is_completed ?? false;
                const skipped = c?.skipped ?? false;
                const subject = a.subject_id ? subjectMap.get(a.subject_id) : null;
                const label = formatWeeklyAssignmentLabel(a, subject?.name);

                return (
                  <div
                    key={a.id}
                    className={`flex items-center gap-3 py-2 px-2.5 rounded-md border border-border ${
                      done ? 'bg-success/5' : skipped ? 'bg-surface2/30 opacity-60' : 'bg-surface'
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <span className={`text-[13px] font-medium ${done ? 'line-through text-fgmuted' : skipped ? 'line-through text-fgsubtle' : ''}`}>
                        {label}
                      </span>
                    </div>
                    {done && <span className="text-[11px] font-medium text-success flex items-center gap-1 shrink-0"><CheckCircle2 className="h-3.5 w-3.5" /> Done</span>}
                    {skipped && !done && <span className="text-[11px] font-medium text-fgsubtle flex items-center gap-1 shrink-0"><X className="h-3.5 w-3.5" /> Skipped</span>}
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        onClick={() => toggle.mutate({ assignmentId: a.id, completed: !done, skipped: false })}
                        title={done ? 'Mark as not done' : 'Mark as done'}
                        className={`h-7 w-7 rounded-md grid place-items-center transition-colors ${
                          done ? 'bg-success/20 text-success hover:bg-success/30' : 'bg-surface2 text-fgmuted hover:bg-success/15 hover:text-success'
                        }`}
                      >
                        <CheckCircle2 className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => toggle.mutate({ assignmentId: a.id, completed: false, skipped: !skipped })}
                        title={skipped ? 'Unmark as skipped' : 'Mark as not done'}
                        className={`h-7 w-7 rounded-md grid place-items-center transition-colors ${
                          skipped ? 'bg-danger/15 text-danger hover:bg-danger/25' : 'bg-surface2 text-fgmuted hover:bg-danger/10 hover:text-danger'
                        }`}
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

// ─── Exams Section ────────────────────────────────────────────────────────────

const CATEGORY_LABELS: Record<string, string> = {
  quiz: 'Quiz',
  endterm: 'End Term',
  oppe: 'OPPE',
  roe: 'ROE',
  bpt: 'BPT',
  ka: 'Kaggle',
  project: 'Project',
  bonus: 'Bonus',
  extra: 'Extra',
};

const CATEGORY_ORDER = ['quiz', 'oppe', 'endterm', 'roe', 'bpt', 'ka', 'project', 'bonus', 'extra'];

function ExamList({ assignments, allOppeAssignments, completionMap, level, toggle }: {
  assignments: Assignment[];
  allOppeAssignments: Assignment[];
  completionMap: Map<string, AssignmentCompletion>;
  level: string | null | undefined;
  toggle: ReturnType<typeof useToggleCompletion>;
}) {
  // OPPE bases that have a Day 3 or beyond — these are multi-day sessions (OPPE 2) and must NOT be merged
  const oppeMultiDayBases = useMemo(() => {
    const s = new Set<string>();
    for (const a of allOppeAssignments) {
      if (/Day\s+[3-9]/i.test(a.title)) {
        const m = a.title.match(/^(.+?)\s+Day\s+\d+$/i);
        if (m) s.add(m[1]);
      }
    }
    return s;
  }, [allOppeAssignments]);

  const grouped = useMemo(() => {
    const map = new Map<string, Assignment[]>();
    for (const a of assignments) {
      if (!map.has(a.category)) map.set(a.category, []);
      map.get(a.category)!.push(a);
    }
    // Sort each group by date, then merge 2-day OPPE sessions (e.g. OPPE 1 Day 1 + Day 2)
    for (const [cat, items] of map) {
      items.sort((a, b) => {
        const da = a.exam_date ?? deadlineFor(a, level) ?? '';
        const db = b.exam_date ?? deadlineFor(b, level) ?? '';
        return da.localeCompare(db);
      });
      if (cat === 'oppe') {
        // Merge Day 1 + Day 2 into "Day 1/2" ONLY for groups with exactly 2 days (like OPPE 1).
        // Groups with Day 3+ (like OPPE 2) stay separate.
        const merged: Assignment[] = [];
        const seen = new Set<string>();
        for (const a of items) {
          const m = a.title.match(/^(.+?)\s+Day\s+([12])$/i);
          if (m && !oppeMultiDayBases.has(m[1])) {
            const base = m[1];
            if (!seen.has(base)) {
              seen.add(base);
              merged.push({ ...a, title: `${base} — Day 1/2` });
            }
            // skip the Day 2 duplicate
          } else {
            merged.push(a);
          }
        }
        map.set(cat, merged);
      }
    }
    return map;
  }, [assignments, level, oppeMultiDayBases]);

  const orderedCategories = CATEGORY_ORDER.filter(c => grouped.has(c));

  if (orderedCategories.length === 0) {
    return <Empty title="No exams scheduled" description="Exam dates will appear here once published." />;
  }

  return (
    <div className="space-y-5">
      {orderedCategories.map(cat => (
        <div key={cat}>
          <h2 className="text-[13px] font-semibold text-fgmuted uppercase tracking-wide mb-2">
            {CATEGORY_LABELS[cat] ?? cat}
          </h2>
          <div className="space-y-2">
            {grouped.get(cat)!.map((a, i) => {
              const c = completionMap.get(a.id);
              const attended = c?.is_completed ?? false;
              const date = a.exam_date ?? deadlineFor(a, level);
              const days = daysUntil(date);

              return (
                <motion.div
                  key={a.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04 }}
                >
                  <Card className={attended ? 'opacity-70' : ''}>
                    <CardBody className="py-3 flex items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <div className={`text-sm font-medium ${attended ? 'line-through text-fgmuted' : ''}`}>
                          {a.title}
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5 mt-1">
                          <Badge variant="muted">{CATEGORY_LABELS[a.category] ?? a.category}</Badge>
                          {date && <span className="text-[11px] text-fgmuted">{a.exam_date ? 'Exam' : 'Due'} {formatDate(date)}</span>}
                        </div>
                        {a.comments && <div className="text-[11px] text-fgsubtle mt-1">{a.comments}</div>}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {days !== null && (
                          <Badge variant={days <= 0 ? 'muted' : days <= 3 ? 'danger' : days <= 7 ? 'warning' : 'info'}>
                            {days <= 0 ? 'Done' : `${days}d`}
                          </Badge>
                        )}
                        {/* Attended toggle */}
                        <button
                          onClick={() => toggle.mutate({ assignmentId: a.id, completed: !attended, skipped: false })}
                          title={attended ? 'Mark as not attended' : 'Mark as attended'}
                          className={`h-7 w-7 rounded-md grid place-items-center transition-colors ${
                            attended
                              ? 'bg-success/20 text-success hover:bg-success/30'
                              : 'bg-surface2 text-fgmuted hover:bg-success/15 hover:text-success'
                          }`}
                        >
                          <CheckCircle2 className="h-4 w-4" />
                        </button>
                      </div>
                    </CardBody>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Calendar View ────────────────────────────────────────────────────────────

function CalendarView({ assignments, completionMap, level }: {
  assignments: Assignment[];
  completionMap: Map<string, AssignmentCompletion>;
  level?: string | null;
}) {
  const [month, setMonth] = useState(() => new Date().getMonth());
  const [year, setYear] = useState(() => new Date().getFullYear());

  const first = new Date(year, month, 1);
  const startDay = first.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const monthName = first.toLocaleString('default', { month: 'long', year: 'numeric' });

  const enriched = useMemo(() =>
    assignments.map(a => {
      const c = completionMap.get(a.id);
      const dl = deadlineFor(a, level);
      return { ...a, deadline: dl, done: c?.is_completed ?? false, overdue: !c?.is_completed && daysUntil(dl) !== null && (daysUntil(dl) ?? 0) < 0 };
    }),
    [assignments, completionMap, level]
  );

  const dayMap = useMemo(() => {
    const m = new Map<number, typeof enriched>();
    for (const a of enriched) {
      if (!a.deadline) continue;
      const d = new Date(a.deadline);
      if (d.getMonth() === month && d.getFullYear() === year) {
        const day = d.getDate();
        if (!m.has(day)) m.set(day, []);
        m.get(day)!.push(a);
      }
    }
    return m;
  }, [enriched, month, year]);

  const prevMonth = () => {
    if (month === 0) { setMonth(11); setYear(y => y - 1); } else setMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (month === 11) { setMonth(0); setYear(y => y + 1); } else setMonth(m => m + 1);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <Button variant="ghost" size="sm" onClick={prevMonth}>←</Button>
        <span className="text-sm font-semibold">{monthName}</span>
        <Button variant="ghost" size="sm" onClick={nextMonth}>→</Button>
      </div>
      <div className="grid grid-cols-7 text-center text-[11px] text-fgmuted mb-1">
        {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(d => <div key={d}>{d}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-px">
        {Array.from({ length: startDay }, (_, i) => <div key={`e${i}`} />)}
        {Array.from({ length: daysInMonth }, (_, i) => {
          const day = i + 1;
          const items = dayMap.get(day);
          const isToday = day === new Date().getDate() && month === new Date().getMonth() && year === new Date().getFullYear();
          return (
            <div key={day} className={`relative p-1 min-h-[48px] rounded-md text-[12px] ${isToday ? 'bg-accent/10' : ''}`}>
              <span className={isToday ? 'font-bold text-accent' : 'text-fgmuted'}>{day}</span>
              {items && (
                <div className="flex flex-wrap gap-0.5 mt-0.5">
                  {items.slice(0, 3).map((a: any) => (
                    <div
                      key={a.id}
                      className={`h-1.5 w-1.5 rounded-full ${a.done ? 'bg-success' : a.overdue ? 'bg-danger' : 'bg-accent'}`}
                      title={a.title}
                    />
                  ))}
                  {items.length > 3 && <span className="text-[8px] text-fgsubtle">+{items.length - 3}</span>}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
