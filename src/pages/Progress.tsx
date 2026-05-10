import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useTitle } from '@/lib/hooks';
import {
  useStudentTerms,
  useAutoMigrateStudentTerms,
  useMyEnrolledSubjectsForStudentTerm,
  useMyGrades,
  useMyCompletions,
  useAssignments,
  useCGPA,
} from '@/hooks/useData';
import type { Term } from '@/lib/database.types';
import { calculateScore, bestWeeklyAverage } from '@/lib/grading/calculator';
import { getGradeColor, getGradeLetter } from '@/lib/grading/letters';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Skeleton, SkeletonCard } from '@/components/ui/Skeleton';
import { Empty } from '@/components/ui/Empty';
import { TermSelector } from '@/components/ui/TermSelector';
import { filterWeeklyAssignmentsForEnrolledSubjects } from '@/lib/assignments';
import { percentage } from '@/lib/utils';
import {
  BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip as RTooltip,
  LineChart, Line, CartesianGrid,
} from 'recharts';

const stagger = { hidden: {}, visible: { transition: { staggerChildren: 0.04 } } };
const fadeUp  = { hidden: { opacity: 0, y: 8 }, visible: { opacity: 1, y: 0 } };

export default function Progress() {
  useTitle('Progress');

  const { data: studentTerms = [], isLoading: termsLoading } = useStudentTerms();
  const [selectedTermId, setSelectedTermId] = useState<string | null>(null);

  useAutoMigrateStudentTerms();

  useEffect(() => {
    if (selectedTermId === null && studentTerms.length > 0) {
      const current = studentTerms.find((st) => st.is_current) ?? studentTerms[0];
      setSelectedTermId(current?.id ?? null);
    }
  }, [selectedTermId, studentTerms]);

  const selectedStudentTerm = studentTerms.find((st) => st.id === selectedTermId);
  const termLevel = selectedStudentTerm?.level ?? null;
  const globalTermId = selectedStudentTerm?.term_id ?? null;

  const termsForSelector: Term[] = studentTerms.map((st) => ({
    id:         st.id,
    name:       st.custom_name || `${st.term_type.charAt(0).toUpperCase() + st.term_type.slice(1)} (${st.level})`,
    is_active:  st.is_current,
    term_type:  st.term?.term_type ?? st.term_type,
    start_date: st.term?.start_date ?? '',
    end_date:   st.term?.end_date ?? '',
    created_by: null,
    created_at: st.created_at,
  }));

  const subjects                            = useMyEnrolledSubjectsForStudentTerm(selectedStudentTerm);
  const { data: grades = [], isLoading }    = useMyGrades();
  const { data: assignments = [] }          = useAssignments(globalTermId ?? undefined, termLevel);
  const { data: completions = [] }          = useMyCompletions();
  const { cgpa, termsWithMarks, totalCredits } = useCGPA();

  const gradeMap       = new Map(grades.map((g) => [g.subject_id, g]));
  const enrolledIds    = new Set(subjects.map((s) => s.id));
  const weeklyAssigns  = filterWeeklyAssignmentsForEnrolledSubjects(assignments, enrolledIds);
  const weeklyIds      = new Set(weeklyAssigns.map((a) => a.id));

  const subjectData = subjects.map((s) => {
    const g      = gradeMap.get(s.id);
    const result = g ? calculateScore(s, g) : { total: 0, letter: 'U' };
    const weeklyAvg = g ? bestWeeklyAverage(g.weekly_scores) : 0;
    return { ...s, total: result.total, letter: result.letter, weeklyAvg, grade: g };
  });

  const barData = subjectData.map((s) => ({
    name:  s.code,
    score: Math.round(s.total * 10) / 10,
    fill:  getGradeColor(s.total),
  }));

  const weeklyTrend = (() => {
    const data: { week: string; [code: string]: unknown }[] = [];
    for (let w = 0; w < 12; w++) {
      const entry: { week: string; [code: string]: unknown } = { week: `W${w + 1}` };
      for (const s of subjectData) {
        const score = s.grade?.weekly_scores?.[w];
        if (typeof score === 'number') entry[s.code] = score;
      }
      data.push(entry);
    }
    return data;
  })();

  const totalAssigns  = weeklyAssigns.length;
  const completedCnt  = completions.filter((c) => c.is_completed && weeklyIds.has(c.assignment_id)).length;
  const bestSubject   = subjectData.length
    ? subjectData.reduce((b, s) => (s.total > b.total ? s : b), subjectData[0])
    : null;
  const avgScore = subjectData.length
    ? subjectData.reduce((s, d) => s + d.total, 0) / subjectData.length
    : 0;

  if (termsLoading || isLoading) {
    return (
      <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-4">
        <Skeleton className="h-6 w-32" /><SkeletonCard /><SkeletonCard />
      </div>
    );
  }

  return (
    <motion.div initial="hidden" animate="visible" variants={stagger} className="p-4 md:p-6 max-w-5xl mx-auto space-y-5">
      <motion.div variants={fadeUp}>
        <div className="flex flex-wrap items-center gap-3">
          <div>
            <h1 className="text-lg font-bold tracking-tightest">Progress</h1>
            <p className="text-sm text-fgmuted">Performance overview for the selected term.</p>
          </div>
          <div className="ml-auto">
            <TermSelector value={selectedTermId} onChange={setSelectedTermId} terms={termsForSelector} />
          </div>
        </div>
      </motion.div>

      {subjects.length === 0 ? (
        <motion.div variants={fadeUp}>
          <Empty
            title="No courses enrolled"
            description="Select a term above and add your courses in the Grades page."
          />
        </motion.div>
      ) : (
        <>
          {/* CGPA banner — shown when data spans more than one term */}
          {cgpa !== null && termsWithMarks > 1 && (
            <motion.div variants={fadeUp}>
              <div className="rounded-lg border border-accent/30 bg-accent/5 px-4 py-3 flex items-center gap-4 flex-wrap">
                <div>
                  <div className="text-[11px] text-fgmuted font-medium uppercase tracking-wide">Overall CGPA</div>
                  <div className="text-2xl font-bold num text-accent">{cgpa.toFixed(2)}</div>
                </div>
                <div className="text-[12px] text-fgmuted">
                  {totalCredits} credits · {termsWithMarks} term{termsWithMarks !== 1 ? 's' : ''}
                </div>
              </div>
            </motion.div>
          )}

          {/* Quick stats */}
          <motion.div variants={fadeUp} className="grid gap-3 grid-cols-2 md:grid-cols-4">
            <Card><CardBody className="py-3">
              <div className="text-[12px] text-fgmuted font-medium">Avg score</div>
              <div className="text-lg font-bold num" style={{ color: getGradeColor(avgScore) }}>
                {avgScore.toFixed(1)}
              </div>
            </CardBody></Card>
            <Card><CardBody className="py-3">
              <div className="text-[12px] text-fgmuted font-medium">Best subject</div>
              <div className="text-lg font-bold">{bestSubject?.code ?? '—'}</div>
              <div className="text-[11px] text-fgmuted">{bestSubject?.total.toFixed(1) ?? ''}</div>
            </CardBody></Card>
            <Card><CardBody className="py-3">
              <div className="text-[12px] text-fgmuted font-medium">Assignments done</div>
              <div className="text-lg font-bold num">{percentage(completedCnt, totalAssigns || 1)}%</div>
            </CardBody></Card>
            <Card><CardBody className="py-3">
              <div className="text-[12px] text-fgmuted font-medium">Courses enrolled</div>
              <div className="text-lg font-bold num">{subjects.length}</div>
            </CardBody></Card>
          </motion.div>

          {/* Score bar chart */}
          <motion.div variants={fadeUp}>
            <Card>
              <CardHeader><CardTitle>Predicted scores by subject</CardTitle></CardHeader>
              <CardBody className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={barData}>
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                    <RTooltip contentStyle={{ background: 'hsl(var(--surface))', border: '1px solid hsl(var(--border))', borderRadius: 6, fontSize: 12 }} />
                    <Bar dataKey="score" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardBody>
            </Card>
          </motion.div>

          {/* Performance heatmap */}
          <motion.div variants={fadeUp}>
            <h2 className="text-sm font-semibold tracking-tighter mb-2">Performance heatmap</h2>
            <div className="grid gap-2 grid-cols-2 md:grid-cols-4">
              {subjectData.map((s) => (
                <div
                  key={s.id}
                  className="rounded-lg p-3 text-center hairline"
                  style={{ backgroundColor: getGradeColor(s.total) + '18' }}
                >
                  <div className="text-sm font-semibold" style={{ color: getGradeColor(s.total) }}>{s.letter}</div>
                  <div className="text-[13px] font-medium mt-0.5">{s.code}</div>
                  <div className="text-[11px] text-fgmuted num">{s.total.toFixed(1)}</div>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Weekly trend */}
          <motion.div variants={fadeUp}>
            <Card>
              <CardHeader><CardTitle>Weekly assignment scores trend</CardTitle></CardHeader>
              <CardBody className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={weeklyTrend}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="week" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                    <RTooltip contentStyle={{ background: 'hsl(var(--surface))', border: '1px solid hsl(var(--border))', borderRadius: 6, fontSize: 12 }} />
                    {subjectData.map((s, i) => (
                      <Line
                        key={s.code}
                        type="monotone"
                        dataKey={s.code}
                        stroke={`hsl(${(i * 45 + 239) % 360} 70% 60%)`}
                        strokeWidth={1.5}
                        dot={false}
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </CardBody>
            </Card>
          </motion.div>
        </>
      )}
    </motion.div>
  );
}
