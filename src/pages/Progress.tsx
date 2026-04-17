import { motion } from 'framer-motion';
import { useTitle } from '@/lib/hooks';
import { useMySubjects, useMyGrades, useMyCompletions, useAssignments, useActiveTerm } from '@/hooks/useData';
import { calculateScore, bestWeeklyAverage } from '@/lib/grading/calculator';
import { getGradeColor, getGradeLetter } from '@/lib/grading/letters';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Skeleton, SkeletonCard } from '@/components/ui/Skeleton';
import { Empty } from '@/components/ui/Empty';
import { filterWeeklyAssignmentsForEnrolledSubjects } from '@/lib/assignments';
import { percentage } from '@/lib/utils';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip as RTooltip, LineChart, Line, CartesianGrid } from 'recharts';

const stagger = { hidden: {}, visible: { transition: { staggerChildren: 0.04 } } };
const fadeUp = { hidden: { opacity: 0, y: 8 }, visible: { opacity: 1, y: 0 } };

export default function Progress() {
  useTitle('Progress');
  const subjects = useMySubjects();
  const { data: grades = [], isLoading } = useMyGrades();
  const { data: term } = useActiveTerm();
  const { data: assignments = [] } = useAssignments(term?.id);
  const { data: completions = [] } = useMyCompletions();

  const gradeMap = new Map(grades.map(g => [g.subject_id, g]));
  const enrolledSubjectIds = new Set(subjects.map(s => s.id));
  const weeklyAssignments = filterWeeklyAssignmentsForEnrolledSubjects(assignments, enrolledSubjectIds);
  const weeklyAssignmentIds = new Set(weeklyAssignments.map(a => a.id));

  const subjectData = subjects.map(s => {
    const g = gradeMap.get(s.id);
    const result = g ? calculateScore(s, g) : { total: 0, letter: 'U' };
    const weeklyAvg = g ? bestWeeklyAverage(g.weekly_scores) : 0;
    return { ...s, total: result.total, letter: result.letter, weeklyAvg, grade: g };
  });

  const barData = subjectData.map(s => ({
    name: s.code,
    score: Math.round(s.total * 10) / 10,
    fill: getGradeColor(s.total)
  }));

  const weeklyTrendData = (() => {
    const weekData: { week: string; [code: string]: any }[] = [];
    for (let w = 0; w < 12; w++) {
      const entry: any = { week: `W${w + 1}` };
      for (const s of subjectData) {
        const score = s.grade?.weekly_scores?.[w];
        if (typeof score === 'number') entry[s.code] = score;
      }
      weekData.push(entry);
    }
    return weekData;
  })();

  const totalAssignments = weeklyAssignments.length;
  const completedCount = completions.filter(
    c => c.is_completed && weeklyAssignmentIds.has(c.assignment_id)
  ).length;
  const bestSubject = subjectData.length
    ? subjectData.reduce((b, s) => s.total > b.total ? s : b, subjectData[0])
    : null;
  const avgScore = subjectData.length
    ? subjectData.reduce((s, d) => s + d.total, 0) / subjectData.length
    : 0;

  if (isLoading) return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-4">
      <Skeleton className="h-6 w-32" /><SkeletonCard /><SkeletonCard />
    </div>
  );
  if (subjects.length === 0) return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto">
      <Empty title="No progress yet" description="Enrol in courses to see your progress overview." />
    </div>
  );

  return (
    <motion.div initial="hidden" animate="visible" variants={stagger} className="p-4 md:p-6 max-w-5xl mx-auto space-y-5">
      <motion.div variants={fadeUp}>
        <h1 className="text-lg font-bold tracking-tightest">Progress</h1>
        <p className="text-sm text-fgmuted">Historical overview of your performance.</p>
      </motion.div>

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
          <div className="text-lg font-bold num">{percentage(completedCount, totalAssignments || 1)}%</div>
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
                <RTooltip
                  contentStyle={{ background: 'hsl(var(--surface))', border: '1px solid hsl(var(--border))', borderRadius: 6, fontSize: 12 }}
                />
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
          {subjectData.map(s => (
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
              <LineChart data={weeklyTrendData}>
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
    </motion.div>
  );
}
