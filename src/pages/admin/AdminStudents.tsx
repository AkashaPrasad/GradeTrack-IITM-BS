import { useEffect, useState } from 'react';
import { useTitle } from '@/lib/hooks';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Card, CardBody } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { Empty } from '@/components/ui/Empty';
import { Search, Download, ChevronDown, RefreshCw } from 'lucide-react';
import { formatDate, formatDateTime, initialOf } from '@/lib/utils';
import type { Grade, Profile, Subject } from '@/lib/database.types';

type StudentSummary = Pick<
  Profile,
  'id' | 'email' | 'full_name' | 'avatar_url' | 'roll_number' | 'level' | 'role' | 'onboarded' | 'last_seen_at' | 'created_at'
>;

type StudentGrade = Grade & {
  subject: Pick<Subject, 'code' | 'name'> | null;
};

type ExamFieldKey =
  | 'qz1_score'
  | 'qz2_score'
  | 'final_exam_score'
  | 'oppe1_score'
  | 'oppe2_score'
  | 'roe_score'
  | 'p1_score'
  | 'p2_score'
  | 'ka_score'
  | 'nppe1_score'
  | 'nppe2_score'
  | 'bpta_score'
  | 'bonus_score';

type StudentGradeExport = Pick<Grade, 'user_id' | 'updated_at' | ExamFieldKey> & {
  subject: Pick<Subject, 'code' | 'name'> | null;
};

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

function normalizeSubject(subject: unknown): Pick<Subject, 'code' | 'name'> | null {
  if (!subject) return null;
  if (Array.isArray(subject)) return normalizeSubject(subject[0] ?? null);
  if (typeof subject === 'object' && subject !== null && 'code' in subject && 'name' in subject) {
    const entry = subject as { code: unknown; name: unknown };
    return {
      code: String(entry.code ?? ''),
      name: String(entry.name ?? ''),
    };
  }
  return null;
}

export default function AdminStudents() {
  useTitle('Admin — Students');
  const [q, setQ] = useState('');
  const [expandedStudentId, setExpandedStudentId] = useState<string | null>(null);

  const { data: students = [], isLoading } = useQuery({
    queryKey: ['admin-students'],
    queryFn: async () => {
      const { data } = await supabase
        .from('profiles')
        .select('id, email, full_name, avatar_url, roll_number, level, role, onboarded, last_seen_at, created_at')
        .eq('role', 'student')
        .order('created_at');
      return (data ?? []) as StudentSummary[];
    }
  });

  const filtered = students.filter(s =>
    !q || s.email.includes(q) || (s.full_name ?? '').toLowerCase().includes(q.toLowerCase()) || (s.roll_number ?? '').includes(q)
  );

  const exportCsv = async () => {
    const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
    const { data } = await supabase
      .from('grades')
      .select('user_id, updated_at, qz1_score, qz2_score, final_exam_score, oppe1_score, oppe2_score, roe_score, p1_score, p2_score, ka_score, nppe1_score, nppe2_score, bpta_score, bonus_score, subject:subjects(code,name)');

    const grades = (data ?? []).map((grade: any) => ({
      ...grade,
      subject: normalizeSubject(grade.subject),
    })) as StudentGradeExport[];

    const header = [
      'Name',
      'Email',
      'Roll Number',
      'Level',
      'Onboarded',
      'Last Seen',
      'Subject Code',
      'Subject Name',
      ...EXAM_FIELDS.map(field => field.label),
      'Marks Updated At',
    ].join(',');

    const gradeMap = new Map<string, typeof grades>();
    for (const grade of grades) {
      const rows = gradeMap.get(grade.user_id) ?? [];
      rows.push(grade);
      gradeMap.set(grade.user_id, rows);
    }

    const rows = students.flatMap(student => {
      const studentGrades = gradeMap.get(student.id) ?? [];
      if (studentGrades.length === 0) {
        return [[
          student.full_name ?? '',
          student.email,
          student.roll_number ?? '',
          student.level ?? '',
          String(student.onboarded),
          student.last_seen_at ? formatDate(student.last_seen_at) : '',
          '',
          '',
          ...EXAM_FIELDS.map(() => ''),
          '',
        ]];
      }

      return studentGrades.map(grade => [
        student.full_name ?? '',
        student.email,
        student.roll_number ?? '',
        student.level ?? '',
        String(student.onboarded),
        student.last_seen_at ? formatDate(student.last_seen_at) : '',
        grade.subject?.code ?? '',
        grade.subject?.name ?? '',
        ...EXAM_FIELDS.map(field => grade[field.key] === null ? '' : String(grade[field.key])),
        formatDateTime(grade.updated_at),
      ]);
    });

    const csv = [header, ...rows.map(row => row.map(cell => esc(cell)).join(','))].join('\n');
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
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-lg font-bold tracking-tightest">
          Students <span className="text-fgmuted font-normal text-sm">({students.length})</span>
        </h1>
        <Button variant="secondary" size="sm" onClick={() => void exportCsv()}>
          <Download className="h-3.5 w-3.5" />
          Export CSV
        </Button>
      </div>

      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-fgsubtle" />
        <Input className="pl-8" placeholder="Search by name, email or roll number…" value={q} onChange={e => setQ(e.target.value)} />
      </div>

      {isLoading ? [...Array(5)].map((_, i) => <Skeleton key={i} className="h-14" />) :
        filtered.length === 0 ? <Empty title="No students found" /> : (
          <div className="space-y-2">
            {filtered.map(student => {
              const expanded = expandedStudentId === student.id;
              return (
                <Card key={student.id}>
                  <button
                    onClick={() => setExpandedStudentId(current => current === student.id ? null : student.id)}
                    className="w-full text-left"
                  >
                    <CardBody className="py-2.5 flex items-center gap-3">
                      {student.avatar_url
                        ? <img src={student.avatar_url} alt="" className="h-8 w-8 rounded-full" />
                        : <div className="h-8 w-8 rounded-full bg-surface2 text-fgmuted grid place-items-center text-[12px] font-medium">{initialOf(student.full_name)}</div>
                      }
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium">{student.full_name ?? '—'}</div>
                        <div className="text-[12px] text-fgmuted flex flex-wrap gap-2">
                          <span>{student.email}</span>
                          {student.roll_number && <span>#{student.roll_number}</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {student.level && <Badge variant={student.level === 'foundation' ? 'info' : 'accent'}>{student.level}</Badge>}
                        {!student.onboarded && <Badge variant="warning">Setup pending</Badge>}
                        {student.last_seen_at && <span className="text-[11px] text-fgsubtle hidden md:block">Last seen {formatDate(student.last_seen_at)}</span>}
                        <ChevronDown className={`h-4 w-4 text-fgmuted transition-transform ${expanded ? 'rotate-180' : ''}`} />
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
    </div>
  );
}

function StudentMarksSection({ student }: { student: StudentSummary }) {
  const qc = useQueryClient();

  const { data: grades = [], isLoading, refetch, isFetching } = useQuery({
    queryKey: ['admin-student-grades', student.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('grades')
        .select('*, subject:subjects(code,name)')
        .eq('user_id', student.id)
        .order('updated_at', { ascending: false });
      return (data ?? []).map((grade: any) => ({
        ...grade,
        subject: normalizeSubject(grade.subject),
      })) as StudentGrade[];
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

    return () => {
      supabase.removeChannel(channel);
    };
  }, [qc, student.id]);

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-fg">Exam marks record</div>
          <div className="mt-1 text-[12px] text-fgmuted">
            {student.email}
            {student.roll_number ? ` · ${student.roll_number}` : ''}
            {student.level ? ` · ${student.level}` : ''}
          </div>
        </div>
        <Button size="sm" variant="secondary" onClick={() => void refetch()} loading={isFetching}>
          <RefreshCw className="h-3.5 w-3.5" />
          Refresh
        </Button>
      </div>

      {isLoading ? (
        <>
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </>
      ) : grades.length === 0 ? (
        <Empty title="No marks yet" description="This student has not saved any marks yet." />
      ) : (
        grades.map(grade => {
          const visibleFields = EXAM_FIELDS.filter(({ key }) => grade[key] !== null);
          return (
            <div key={grade.id} className="rounded-lg border border-border bg-surface p-3 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold">{grade.subject?.name ?? 'Unknown subject'}</div>
                  <div className="text-[12px] text-fgmuted">{grade.subject?.code ?? '—'}</div>
                </div>
                <span className="text-[11px] text-fgsubtle">
                  Updated {formatDateTime(grade.updated_at)}
                </span>
              </div>

              {visibleFields.length === 0 ? (
                <div className="text-[12px] text-fgmuted">No exam marks saved yet.</div>
              ) : (
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {visibleFields.map(field => (
                    <div key={field.key} className="rounded-md bg-surface2/50 px-3 py-2">
                      <div className="text-[11px] text-fgmuted">{field.label}</div>
                      <div className="text-sm font-semibold">{String(grade[field.key])}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}
