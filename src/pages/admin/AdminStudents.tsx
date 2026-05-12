import { useEffect, useMemo, useState } from 'react';
import { useTitle } from '@/lib/hooks';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Card, CardBody } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { Empty } from '@/components/ui/Empty';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs';
import { Search, Download, ChevronDown, RefreshCw, ShieldOff, Trash2, CheckCircle, Clock } from 'lucide-react';
import { formatDate, formatDateTime, initialOf } from '@/lib/utils';
import {
  useAdminAllScalerStudents,
  useAdminOtpRecords,
  useAdminDeleteOtp,
  useResetScalerVerification,
} from '@/hooks/useAdminBusConfig';
import { calculateScore } from '@/lib/grading/calculator';
import { getGradePoint, getGradeColor } from '@/lib/grading/letters';
import type { Grade, Profile, Subject, CourseLevel, GradingConfig } from '@/lib/database.types';

// ── Types ─────────────────────────────────────────────────────────────────────

type StudentSummary = Pick<
  Profile,
  'id' | 'email' | 'full_name' | 'avatar_url' | 'roll_number' | 'level' | 'role' | 'onboarded' | 'last_seen_at' | 'created_at'
>;

type AdminSubject = {
  id: string;
  code: string;
  name: string;
  credits: number;
  level: CourseLevel;
  term_id: string | null;
  grading_config: GradingConfig;
  has_bonus: boolean;
  bonus_max: number;
};

type AdminGrade = Grade & { subject: AdminSubject | null };

type AdminStudentTerm = {
  id: string;
  user_id: string;
  term_id: string | null;
  term_type: string;
  level: string;
  custom_name: string;
  is_current: boolean;
  subject_ids: string[];
  created_at: string;
  term: { id: string; name: string; term_type: string | null } | null;
};

type ExamFieldKey =
  | 'qz1_score' | 'qz2_score' | 'final_exam_score'
  | 'oppe1_score' | 'oppe2_score' | 'roe_score'
  | 'p1_score' | 'p2_score' | 'ka_score'
  | 'nppe1_score' | 'nppe2_score' | 'bpta_score' | 'bonus_score';

const EXAM_FIELDS: Array<{ key: ExamFieldKey; label: string }> = [
  { key: 'qz1_score', label: 'Quiz 1' },
  { key: 'qz2_score', label: 'Quiz 2' },
  { key: 'final_exam_score', label: 'Final Exam' },
  { key: 'oppe1_score', label: 'OPPE 1' },
  { key: 'oppe2_score', label: 'OPPE 2' },
  { key: 'roe_score', label: 'ROE' },
  { key: 'p1_score', label: 'Project 1' },
  { key: 'p2_score', label: 'Project 2' },
  { key: 'ka_score', label: 'Kaggle Avg' },
  { key: 'nppe1_score', label: 'NPPE 1' },
  { key: 'nppe2_score', label: 'NPPE 2' },
  { key: 'bpta_score', label: 'BPT Average' },
  { key: 'bonus_score', label: 'Bonus' },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function normalizeFullSubject(raw: unknown): AdminSubject | null {
  const s = Array.isArray(raw) ? (raw[0] ?? null) : raw;
  if (!s || typeof s !== 'object') return null;
  const obj = s as Record<string, unknown>;
  if (!('id' in obj)) return null;
  return {
    id: String(obj.id ?? ''),
    code: String(obj.code ?? ''),
    name: String(obj.name ?? ''),
    credits: typeof obj.credits === 'number' ? obj.credits : 0,
    level: (obj.level as CourseLevel) ?? 'foundation',
    term_id: obj.term_id ? String(obj.term_id) : null,
    grading_config: (obj.grading_config as GradingConfig) ?? { formula: '0', variables: [] },
    has_bonus: Boolean(obj.has_bonus ?? false),
    bonus_max: typeof obj.bonus_max === 'number' ? obj.bonus_max : 0,
  };
}

function normalizeAdminStudentTerm(raw: unknown): AdminStudentTerm | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;
  const rawTerm = Array.isArray(obj.term) ? (obj.term[0] ?? null) : (obj.term ?? null);
  const term = rawTerm && typeof rawTerm === 'object'
    ? { id: String((rawTerm as Record<string, unknown>).id ?? ''), name: String((rawTerm as Record<string, unknown>).name ?? ''), term_type: (rawTerm as Record<string, unknown>).term_type as string | null }
    : null;
  return {
    id: String(obj.id ?? ''),
    user_id: String(obj.user_id ?? ''),
    term_id: obj.term_id ? String(obj.term_id) : null,
    term_type: String(obj.term_type ?? ''),
    level: String(obj.level ?? ''),
    custom_name: String(obj.custom_name ?? ''),
    is_current: Boolean(obj.is_current ?? false),
    subject_ids: Array.isArray(obj.subject_ids) ? (obj.subject_ids as string[]) : [],
    created_at: String(obj.created_at ?? ''),
    term,
  };
}

function hasAnyMarks(g: AdminGrade): boolean {
  return EXAM_FIELDS.some(({ key }) => g[key] !== null) ||
    (g.weekly_scores ?? []).some((v) => typeof v === 'number') ||
    g.quiz1_attended || g.quiz2_attended || g.sct_completed;
}

function computeTermGpa(
  termGrades: AdminGrade[],
): number | null {
  let weighted = 0, credits = 0, hasMarks = false;
  for (const tg of termGrades) {
    if (!tg.subject || !hasAnyMarks(tg)) continue;
    hasMarks = true;
    const result = calculateScore(tg.subject as unknown as Subject, tg);
    const pts = getGradePoint(result.letter);
    weighted += pts * tg.subject.credits;
    credits += tg.subject.credits;
  }
  if (!hasMarks || credits === 0) return null;
  return Math.round((weighted / credits) * 100) / 100;
}

function termDisplayName(st: AdminStudentTerm): string {
  return st.custom_name || st.term?.name || `${st.term_type} (${st.level})`;
}

// ── Scaler Verification Panel ─────────────────────────────────────────────────

function ScalerVerificationPanel() {
  const { data: verified = [], isLoading: vLoading } = useAdminAllScalerStudents();
  const { data: otpRecords = [], isLoading: otpLoading } = useAdminOtpRecords();
  const resetVerification = useResetScalerVerification();
  const deleteOtp = useAdminDeleteOtp();

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-semibold mb-3">Verified Scaler Students ({verified.length})</h3>
        {vLoading ? (
          <Skeleton className="h-32" />
        ) : verified.length === 0 ? (
          <Empty title="No verified students" />
        ) : (
          <div className="space-y-2">
            {(verified as Array<{
              id: string; full_name: string | null; email: string;
              scaler_email: string | null; scaler_verified_at: string | null;
              scaler_id: string | null;
            }>).map((student) => (
              <Card key={student.id}>
                <CardBody className="flex items-center gap-3 py-2.5">
                  <CheckCircle className="h-4 w-4 text-success shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-medium">{student.full_name ?? student.email}</div>
                    <div className="text-[11px] text-fgmuted">
                      {student.scaler_email}
                      {student.scaler_verified_at ? ` · verified ${formatDate(student.scaler_verified_at)}` : ''}
                    </div>
                  </div>
                  <Button
                    variant="ghost" size="sm" className="text-danger gap-1"
                    loading={resetVerification.isPending}
                    onClick={() => {
                      if (window.confirm(`Reset Scaler verification for ${student.full_name ?? student.email}? They will need to re-verify.`)) {
                        resetVerification.mutate(student.id);
                      }
                    }}
                  >
                    <ShieldOff className="h-3.5 w-3.5" /> Reset
                  </Button>
                </CardBody>
              </Card>
            ))}
          </div>
        )}
      </div>

      <div>
        <h3 className="text-sm font-semibold mb-3">Pending OTP Records ({otpRecords.length})</h3>
        {otpLoading ? (
          <Skeleton className="h-24" />
        ) : otpRecords.length === 0 ? (
          <p className="text-[13px] text-fgmuted">No pending OTP records.</p>
        ) : (
          <div className="space-y-2">
            {otpRecords.map((otp) => (
              <Card key={otp.id}>
                <CardBody className="flex items-center gap-3 py-2.5">
                  {otp.consumed_at
                    ? <CheckCircle className="h-4 w-4 text-success shrink-0" />
                    : <Clock className="h-4 w-4 text-warning shrink-0" />}
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-medium">{otp.scaler_email}</div>
                    <div className="text-[11px] text-fgmuted">
                      {otp.consumed_at ? `Consumed ${formatDateTime(otp.consumed_at)}` : `Expires ${formatDateTime(otp.expires_at)}`}
                      {' · '}{otp.attempts} attempt{otp.attempts !== 1 ? 's' : ''}
                      {' · '}sent {otp.send_count}×
                    </div>
                  </div>
                  <Button variant="ghost" size="sm" className="text-danger" loading={deleteOtp.isPending} onClick={() => deleteOtp.mutate(otp.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </CardBody>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Student marks expanded section ───────────────────────────────────────────

function StudentMarksSection({ student }: { student: StudentSummary }) {
  const qc = useQueryClient();
  const [expandedTermId, setExpandedTermId] = useState<string | null>(null);

  const { data: studentTerms = [], isLoading: termsLoading } = useQuery({
    queryKey: ['admin-student-terms', student.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('student_terms')
        .select('*, term:terms(id, name, term_type)')
        .eq('user_id', student.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []).map(normalizeAdminStudentTerm).filter(Boolean) as AdminStudentTerm[];
    },
  });

  const { data: grades = [], isLoading: gradesLoading, refetch, isFetching } = useQuery({
    queryKey: ['admin-student-grades', student.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('grades')
        .select('*, subject:subjects(id, code, name, credits, level, term_id, grading_config, has_bonus, bonus_max)')
        .eq('user_id', student.id);
      if (error) throw error;
      return (data ?? []).map((g: any) => ({
        ...g,
        subject: normalizeFullSubject(g.subject),
      })) as AdminGrade[];
    },
    staleTime: 0,
  });

  useEffect(() => {
    const channel = supabase
      .channel(`admin-student-grades-${student.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'grades', filter: `user_id=eq.${student.id}` }, () => {
        qc.invalidateQueries({ queryKey: ['admin-student-grades', student.id] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [qc, student.id]);

  // Organise grades per student_term using subject_ids
  const termSummaries = useMemo(() => {
    return studentTerms.map((st) => {
      const subjectIdSet = new Set(st.subject_ids ?? []);

      let termGrades: AdminGrade[];
      if (subjectIdSet.size > 0) {
        termGrades = grades.filter((g) => subjectIdSet.has(g.subject_id));
      } else if (st.term_id) {
        termGrades = grades.filter((g) => g.subject?.term_id === st.term_id && g.subject?.level === st.level);
      } else {
        termGrades = grades.filter((g) => g.subject?.level === st.level);
      }

      const gpa = computeTermGpa(termGrades);
      return { st, displayName: termDisplayName(st), gpa, termGrades };
    });
  }, [studentTerms, grades]);

  const isLoading = termsLoading || gradesLoading;

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-fg">Academic Record</div>
          <div className="mt-1 text-[12px] text-fgmuted">
            {student.email}
            {student.roll_number ? ` · ${student.roll_number}` : ''}
            {student.level ? ` · ${student.level}` : ''}
          </div>
        </div>
        <Button size="sm" variant="secondary" onClick={() => void refetch()} loading={isFetching}>
          <RefreshCw className="h-3.5 w-3.5" /> Refresh
        </Button>
      </div>

      {isLoading ? (
        <><Skeleton className="h-12" /><Skeleton className="h-12" /></>
      ) : termSummaries.length === 0 ? (
        <Empty title="No terms yet" description="This student hasn't created any terms." />
      ) : (
        <div className="space-y-2">
          {termSummaries.map(({ st, displayName, gpa, termGrades }) => {
            const isExpanded = expandedTermId === st.id;
            return (
              <div key={st.id} className="rounded-lg border border-border bg-surface overflow-hidden">
                {/* Term header row */}
                <button
                  className="w-full text-left flex items-center gap-3 px-3 py-2.5 hover:bg-surface2/40 transition-colors"
                  onClick={() => setExpandedTermId((prev) => (prev === st.id ? null : st.id))}
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-semibold flex items-center gap-2 flex-wrap">
                      {displayName}
                      {st.is_current && <Badge variant="accent" className="text-[10px]">Current</Badge>}
                    </div>
                    <div className="text-[11px] text-fgmuted mt-0.5">
                      {st.level} · {termGrades.length} course{termGrades.length !== 1 ? 's' : ''}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    {gpa !== null ? (
                      <div className="text-right">
                        <div className="text-[10px] text-fgmuted">Term GPA</div>
                        <div className="text-sm font-bold num text-accent">{gpa.toFixed(2)}</div>
                      </div>
                    ) : (
                      <span className="text-[11px] text-fgsubtle italic">No marks yet</span>
                    )}
                    <ChevronDown className={`h-4 w-4 text-fgmuted transition-transform duration-150 ${isExpanded ? 'rotate-180' : ''}`} />
                  </div>
                </button>

                {/* Expanded marks for each course in this term */}
                {isExpanded && (
                  <div className="border-t border-border px-3 py-3 space-y-2.5 bg-surface2/20">
                    {termGrades.length === 0 ? (
                      <div className="text-[12px] text-fgmuted py-1">No enrolled courses found for this term.</div>
                    ) : (
                      termGrades.map((grade) => {
                        const visibleExamFields = EXAM_FIELDS.filter(({ key }) => grade[key] !== null);
                        const weeklyScores = (grade.weekly_scores ?? [])
                          .map((v, i) => ({ week: i + 1, score: v }))
                          .filter((w) => w.score !== null);
                        const subjectResult = grade.subject
                          ? calculateScore(grade.subject as unknown as Subject, grade)
                          : null;

                        return (
                          <div key={grade.id} className="rounded-md border border-border bg-surface p-3 space-y-2">
                            {/* Subject header */}
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <div className="text-[13px] font-semibold">
                                  {grade.subject?.name ?? 'Unknown subject'}
                                </div>
                                <div className="text-[11px] text-fgmuted">
                                  {grade.subject?.code ?? '—'} · {grade.subject?.credits ?? 0} cr
                                </div>
                              </div>
                              {subjectResult && subjectResult.total > 0 && (
                                <div className="text-right shrink-0">
                                  <div
                                    className="text-base font-bold num"
                                    style={{ color: getGradeColor(subjectResult.total) }}
                                  >
                                    {subjectResult.total.toFixed(1)}
                                  </div>
                                  <div
                                    className="text-[11px] font-semibold"
                                    style={{ color: getGradeColor(subjectResult.total) }}
                                  >
                                    {subjectResult.letter}
                                  </div>
                                </div>
                              )}
                            </div>

                            {/* Exam field marks */}
                            {visibleExamFields.length > 0 && (
                              <div className="grid gap-1.5 grid-cols-3 sm:grid-cols-4 lg:grid-cols-5">
                                {visibleExamFields.map(({ key, label }) => (
                                  <div key={key} className="rounded bg-surface2/70 px-2 py-1.5">
                                    <div className="text-[10px] text-fgmuted">{label}</div>
                                    <div className="text-[12px] font-semibold">{String(grade[key])}</div>
                                  </div>
                                ))}
                              </div>
                            )}

                            {/* Weekly scores */}
                            {weeklyScores.length > 0 && (
                              <div>
                                <div className="text-[10px] text-fgmuted mb-1">Weekly scores</div>
                                <div className="flex flex-wrap gap-1">
                                  {weeklyScores.map(({ week, score }) => (
                                    <div key={week} className="rounded bg-surface2/70 px-1.5 py-1 text-center min-w-[36px]">
                                      <div className="text-[9px] text-fgsubtle">W{week}</div>
                                      <div className="text-[11px] font-semibold">{score}</div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {visibleExamFields.length === 0 && weeklyScores.length === 0 && (
                              <div className="text-[11px] text-fgmuted">No marks saved yet.</div>
                            )}

                            <div className="text-[10px] text-fgsubtle pt-0.5">
                              Updated {formatDateTime(grade.updated_at)}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function AdminStudents() {
  useTitle('Admin — Students');
  const [q, setQ] = useState('');
  const [expandedStudentId, setExpandedStudentId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'students' | 'scaler'>('students');

  const { data: students = [], isLoading } = useQuery({
    queryKey: ['admin-students'],
    queryFn: async () => {
      const { data } = await supabase
        .from('profiles')
        .select('id, email, full_name, avatar_url, roll_number, level, role, onboarded, last_seen_at, created_at')
        .eq('role', 'student')
        .order('created_at');
      return (data ?? []) as StudentSummary[];
    },
  });

  const filtered = students.filter(
    (s) =>
      !q ||
      s.email.includes(q) ||
      (s.full_name ?? '').toLowerCase().includes(q.toLowerCase()) ||
      (s.roll_number ?? '').includes(q),
  );

  const exportCsv = async () => {
    const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;

    // Fetch all grades with full subject info
    const { data: gradesRaw } = await supabase
      .from('grades')
      .select(
        'user_id, subject_id, updated_at, qz1_score, qz2_score, final_exam_score, oppe1_score, oppe2_score, roe_score, p1_score, p2_score, ka_score, nppe1_score, nppe2_score, bpta_score, bonus_score, weekly_scores, subject:subjects(id, code, name, credits, level, term_id, grading_config, has_bonus, bonus_max)',
      );

    // Fetch all student_terms
    const { data: termsRaw } = await supabase
      .from('student_terms')
      .select('id, user_id, term_type, level, custom_name, is_current, subject_ids, term:terms(name, term_type)');

    const allGrades = (gradesRaw ?? []).map((g: any) => ({
      ...(g as object),
      subject: normalizeFullSubject(g.subject),
    })) as AdminGrade[];

    const allStudentTerms = (termsRaw ?? [])
      .map(normalizeAdminStudentTerm)
      .filter(Boolean) as AdminStudentTerm[];

    // Build a map: subjectId -> AdminStudentTerm (first match wins)
    const subjectIdToTerm = new Map<string, AdminStudentTerm>();
    for (const st of allStudentTerms) {
      for (const sid of st.subject_ids ?? []) {
        if (!subjectIdToTerm.has(sid)) subjectIdToTerm.set(sid, st);
      }
    }

    // Build student terms list per user for fallback lookup
    const termsByUser = new Map<string, AdminStudentTerm[]>();
    for (const st of allStudentTerms) {
      const arr = termsByUser.get(st.user_id) ?? [];
      arr.push(st);
      termsByUser.set(st.user_id, arr);
    }

    function findTermForGrade(grade: AdminGrade): AdminStudentTerm | null {
      // Primary: subject_ids match
      const bySubjectId = subjectIdToTerm.get(grade.subject_id);
      if (bySubjectId && bySubjectId.user_id === grade.user_id) return bySubjectId;
      // Fallback: match by term_id + level
      const userTerms = termsByUser.get(grade.user_id) ?? [];
      if (grade.subject?.term_id) {
        const byTermId = userTerms.find(
          (st) => st.term_id === grade.subject?.term_id && st.level === grade.subject?.level,
        );
        if (byTermId) return byTermId;
      }
      return null;
    }

    const gradesByStudent = new Map<string, AdminGrade[]>();
    for (const g of allGrades) {
      const arr = gradesByStudent.get(g.user_id) ?? [];
      arr.push(g);
      gradesByStudent.set(g.user_id, arr);
    }

    // CSV columns
    const WEEKLY_COUNT = 12;
    const weeklyHeaders = Array.from({ length: WEEKLY_COUNT }, (_, i) => `W${i + 1}`);
    const header = [
      'Name', 'Email', 'Roll Number', 'Onboarded', 'Last Seen',
      'Term Name', 'Term Type', 'Term Level', 'Is Current Term',
      'Subject Code', 'Subject Name', 'Credits',
      'Calculated Total', 'Grade Letter',
      ...EXAM_FIELDS.map((f) => f.label),
      ...weeklyHeaders,
      'Marks Updated At',
    ].join(',');

    const rows = students.flatMap((student) => {
      const studentGrades = gradesByStudent.get(student.id) ?? [];
      if (studentGrades.length === 0) {
        return [[
          student.full_name ?? '', student.email, student.roll_number ?? '',
          String(student.onboarded), student.last_seen_at ? formatDate(student.last_seen_at) : '',
          '', '', '', '',
          '', '', '',
          '', '',
          ...EXAM_FIELDS.map(() => ''),
          ...Array(WEEKLY_COUNT).fill(''),
          '',
        ]];
      }

      return studentGrades.map((grade) => {
        const st = findTermForGrade(grade);
        const termName = st ? termDisplayName(st) : '';
        const termType = st?.term?.term_type ?? st?.term_type ?? '';
        const termLevel = st?.level ?? grade.subject?.level ?? '';
        const isCurrent = st ? String(st.is_current) : '';

        const subjectResult = grade.subject
          ? calculateScore(grade.subject as unknown as Subject, grade)
          : null;
        const calcTotal = subjectResult && subjectResult.total > 0 ? subjectResult.total.toFixed(1) : '';
        const gradeLetter = subjectResult && subjectResult.total > 0 ? subjectResult.letter : '';

        const weekly = grade.weekly_scores ?? [];
        const weeklyValues = Array.from({ length: WEEKLY_COUNT }, (_, i) =>
          weekly[i] !== null && weekly[i] !== undefined ? String(weekly[i]) : '',
        );

        return [
          student.full_name ?? '', student.email, student.roll_number ?? '',
          String(student.onboarded), student.last_seen_at ? formatDate(student.last_seen_at) : '',
          termName, termType, termLevel, isCurrent,
          grade.subject?.code ?? '', grade.subject?.name ?? '', String(grade.subject?.credits ?? ''),
          calcTotal, gradeLetter,
          ...EXAM_FIELDS.map(({ key }) => (grade[key] === null || grade[key] === undefined ? '' : String(grade[key]))),
          ...weeklyValues,
          formatDateTime(grade.updated_at),
        ];
      });
    });

    const csv = [header, ...rows.map((row) => row.map(esc).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'students-with-marks.csv';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  };

  return (
    <div className="p-5 max-w-4xl space-y-4">
      <h1 className="text-lg font-bold tracking-tightest">Students</h1>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'students' | 'scaler')}>
        <TabsList>
          <TabsTrigger value="students">All Students ({students.length})</TabsTrigger>
          <TabsTrigger value="scaler">Scaler Verification</TabsTrigger>
        </TabsList>

        <TabsContent value="students" className="mt-4 space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-fgsubtle" />
              <Input
                className="pl-8"
                placeholder="Search by name, email or roll number…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </div>
            <Button variant="secondary" size="sm" onClick={() => void exportCsv()}>
              <Download className="h-3.5 w-3.5" /> Export CSV
            </Button>
          </div>

          {isLoading ? (
            [...Array(5)].map((_, i) => <Skeleton key={i} className="h-14" />)
          ) : filtered.length === 0 ? (
            <Empty title="No students found" />
          ) : (
            <div className="space-y-2">
              {filtered.map((student) => {
                const expanded = expandedStudentId === student.id;
                return (
                  <Card key={student.id}>
                    <button
                      onClick={() =>
                        setExpandedStudentId((current) =>
                          current === student.id ? null : student.id,
                        )
                      }
                      className="w-full text-left"
                    >
                      <CardBody className="py-2.5 flex items-center gap-3">
                        {student.avatar_url ? (
                          <img src={student.avatar_url} alt="" className="h-8 w-8 rounded-full" />
                        ) : (
                          <div className="h-8 w-8 rounded-full bg-surface2 text-fgmuted grid place-items-center text-[12px] font-medium">
                            {initialOf(student.full_name)}
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium">{student.full_name ?? '—'}</div>
                          <div className="text-[12px] text-fgmuted flex flex-wrap gap-2">
                            <span>{student.email}</span>
                            {student.roll_number && <span>#{student.roll_number}</span>}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {student.level && (
                            <Badge variant={student.level === 'foundation' ? 'info' : 'accent'}>
                              {student.level}
                            </Badge>
                          )}
                          {!student.onboarded && <Badge variant="warning">Setup pending</Badge>}
                          {student.last_seen_at && (
                            <span className="text-[11px] text-fgsubtle hidden md:block">
                              Last seen {formatDate(student.last_seen_at)}
                            </span>
                          )}
                          <ChevronDown
                            className={`h-4 w-4 text-fgmuted transition-transform duration-150 ${expanded ? 'rotate-180' : ''}`}
                          />
                        </div>
                      </CardBody>
                    </button>

                    {expanded && (
                      <div className="border-t border-border px-4 pb-4 pt-3">
                        <StudentMarksSection student={student} />
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="scaler" className="mt-4">
          <ScalerVerificationPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}
