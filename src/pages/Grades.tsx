import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { useTitle } from '@/lib/hooks';
import { PlusCircle, Save, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/Card';
import { Input, Label } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Switch } from '@/components/ui/Switch';
import { Skeleton, SkeletonCard } from '@/components/ui/Skeleton';
import { Empty } from '@/components/ui/Empty';
import { TermSelector } from '@/components/ui/TermSelector';
import { CreateTermModal } from '@/components/features/terms/CreateTermModal';
import {
  useStudentTerms,
  useSetCurrentStudentTerm,
  useAutoMigrateStudentTerms,
  useMyEnrolledSubjectsForStudentTerm,
  useMyGrades,
  useMyEnrolments,
  useSaveGrade,
  useCGPA,
} from '@/hooks/useData';
import { useAuth } from '@/stores/auth';
import {
  calculateScore,
  checkEligibility,
  minFinalForTargets,
  bestWeeklyAverage,
} from '@/lib/grading/calculator';
import { getGradeColor, getGradePoint, GRADE_THRESHOLDS } from '@/lib/grading/letters';
import type { Grade, Subject, Term } from '@/lib/database.types';
import { toast } from 'sonner';
import { ChevronDown, ChevronUp, CheckCircle2, XCircle } from 'lucide-react';

const stagger = { hidden: {}, visible: { transition: { staggerChildren: 0.04 } } };
const fadeUp  = { hidden: { opacity: 0, y: 8 }, visible: { opacity: 1, y: 0 } };

function createEmptyGrade(subjectId: string): Grade {
  return {
    id: '', user_id: '', subject_id: subjectId,
    qz1_score: null, qz2_score: null, final_exam_score: null,
    oppe1_score: null, oppe2_score: null, roe_score: null,
    p1_score: null, p2_score: null, ka_score: null,
    nppe1_score: null, nppe2_score: null, bpta_score: null,
    bonus_score: null, quiz1_attended: false, quiz2_attended: false,
    sct_completed: false, weekly_scores: [], extras: {}, notes: null,
    created_at: '', updated_at: '',
  };
}

function hasAnyRecordedMarks(grade: Grade): boolean {
  const scalars = [
    grade.qz1_score, grade.qz2_score, grade.final_exam_score,
    grade.oppe1_score, grade.oppe2_score, grade.roe_score,
    grade.p1_score, grade.p2_score, grade.ka_score,
    grade.nppe1_score, grade.nppe2_score, grade.bpta_score, grade.bonus_score,
  ];
  if (scalars.some((v) => typeof v === 'number')) return true;
  if ((grade.weekly_scores ?? []).some((v) => typeof v === 'number')) return true;
  if (grade.quiz1_attended || grade.quiz2_attended || grade.sct_completed) return true;
  return Object.values(grade.extras ?? {}).some((v) => {
    if (typeof v === 'number') return true;
    if (Array.isArray(v)) return v.some((i) => typeof i === 'number');
    return false;
  });
}

function calculateTermGpa(subjects: Subject[], grades: Map<string, Grade>): number | null {
  if (subjects.length === 0) return null;
  let weighted = 0, credits = 0, hasMarks = false;
  for (const s of subjects) {
    const g = grades.get(s.id) ?? createEmptyGrade(s.id);
    const r = calculateScore(s, g);
    weighted += getGradePoint(r.letter) * s.credits;
    credits  += s.credits;
    hasMarks ||= hasAnyRecordedMarks(g);
  }
  if (!hasMarks || credits === 0) return null;
  return weighted / credits;
}

// ── Subject grade card ────────────────────────────────────────────────────────

function SubjectGradeCard({
  subject: s,
  grade: g,
  onPreviewGradeChange,
}: {
  subject: Subject;
  grade: Grade | null;
  onPreviewGradeChange?: (preview: Partial<Grade>) => void;
}) {
  const [open, setOpen]       = useState(false);
  const [pending, setPending] = useState<Partial<Grade>>({});
  const save = useSaveGrade();
  const cfg  = s.grading_config;
  const vars = cfg.variables ?? [];
  const grade    = g ?? createEmptyGrade(s.id);
  const effective = { ...grade, ...pending } as Grade;
  const result    = calculateScore(s, effective);
  const elig      = checkEligibility(s, effective);
  const targets   = minFinalForTargets(s, effective, [40, 50, 60, 70, 80, 90]);
  const hasPending = Object.keys(pending).length > 0;

  const updatePending = (next: Partial<Grade> | ((prev: Partial<Grade>) => Partial<Grade>)) => {
    setPending((prev) => {
      const resolved = typeof next === 'function' ? next(prev) : next;
      onPreviewGradeChange?.(resolved);
      return resolved;
    });
  };

  const handleOpen = () => {
    if (open) updatePending({});
    setOpen((p) => !p);
  };

  const handleSave = () => {
    if (!hasPending) return;
    save.mutate({ subject_id: s.id, ...pending }, {
      onSuccess: () => {
        toast.success('Marks saved!', { duration: 1500, id: `save-${s.id}` });
        updatePending({});
      },
    });
  };

  const setField  = (field: keyof Grade, value: unknown) =>
    updatePending((prev) => ({ ...prev, [field]: value }));

  const setWeekly = (index: number, value: number | null) => {
    const ws = [...(effective.weekly_scores ?? [])];
    while (ws.length <= index) ws.push(null);
    ws[index] = value;
    updatePending((prev) => ({ ...prev, weekly_scores: ws }));
  };

  const numInput = (field: keyof Grade, label: string, max = 100) => (
    <div>
      <Label>{label}</Label>
      <Input
        type="number" min={0} max={max} step="0.5"
        className="mt-1"
        placeholder="—"
        defaultValue={(effective[field] as number | null) ?? ''}
        onChange={(e) =>
          setField(field, e.target.value === '' ? null : Number(e.target.value))
        }
      />
    </div>
  );

  return (
    <Card>
      <button onClick={handleOpen} className="w-full text-left px-4 md:px-5 py-3 flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <div className="text-[14px] font-semibold">{s.name}</div>
          <div className="text-[12px] text-fgmuted">{s.code} · {s.credits} cr</div>
        </div>
        <div className="flex items-center gap-2">
          <div className="text-right">
            <div className="text-lg font-bold num" style={{ color: getGradeColor(result.total) }}>
              {result.total > 0 ? result.total.toFixed(1) : '—'}
            </div>
            <div className="text-[11px] font-medium" style={{ color: getGradeColor(result.total) }}>
              {result.total > 0 ? result.letter : ''}
            </div>
          </div>
          {open ? <ChevronUp className="h-4 w-4 text-fgmuted" /> : <ChevronDown className="h-4 w-4 text-fgmuted" />}
        </div>
      </button>

      {open && (
        <CardBody className="pt-0 space-y-5 border-t border-border">
          {/* Eligibility */}
          <div className="flex flex-wrap gap-2 pt-3">
            <div className={`flex items-center gap-1.5 text-[12px] font-medium ${elig.endterm.eligible ? 'text-success' : 'text-danger'}`}>
              {elig.endterm.eligible ? <CheckCircle2 className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}
              End term {elig.endterm.eligible ? 'eligible' : 'ineligible'}
            </div>
            {elig.endterm.reason && <span className="text-[11px] text-fgmuted">— {elig.endterm.reason}</span>}
          </div>

          {/* Score inputs */}
          <div className="grid gap-3 grid-cols-2 md:grid-cols-3">
            {(vars.includes('Qz1') || cfg.formula.includes('Qz1')) && numInput('qz1_score', 'Quiz 1')}
            {(vars.includes('Qz2') || cfg.formula.includes('Qz2')) && numInput('qz2_score', 'Quiz 2')}
            {numInput('final_exam_score', 'Final Exam')}
            {(vars.includes('PE1') || vars.includes('OPPE1')) && numInput('oppe1_score', 'OPPE 1')}
            {(vars.includes('PE2') || vars.includes('OPPE2')) && numInput('oppe2_score', 'OPPE 2')}
            {vars.includes('OPPE') && !vars.includes('OPPE1') && numInput('oppe1_score', 'OPPE')}
            {vars.includes('OP') && !vars.includes('OPPE') && numInput('oppe1_score', 'OPE')}
            {vars.includes('ROE') && numInput('roe_score', 'ROE')}
            {vars.includes('P1') && numInput('p1_score', 'Project 1')}
            {vars.includes('P2') && numInput('p2_score', 'Project 2')}
            {vars.includes('KA') && numInput('ka_score', 'Kaggle Avg')}
            {vars.includes('NPPE1') && numInput('nppe1_score', 'NPPE 1')}
            {vars.includes('NPPE2') && numInput('nppe2_score', 'NPPE 2')}
            {vars.includes('BPTA') && numInput('bpta_score', 'BPT Average')}
          </div>

          {/* Bonus */}
          {s.has_bonus && (
            <div>
              <Label>Bonus marks (max {s.bonus_max})</Label>
              <Input
                type="number" min={0} max={s.bonus_max} step="0.5"
                className="mt-1 w-32" placeholder="0"
                defaultValue={effective.bonus_score ?? ''}
                onChange={(e) => setField('bonus_score', e.target.value === '' ? null : Number(e.target.value))}
              />
            </div>
          )}

          {/* Attendance toggles */}
          <div className="flex flex-wrap gap-4">
            {(vars.includes('Qz1') || cfg.formula.includes('Qz1')) && (
              <label className="flex items-center gap-2 text-[13px]">
                <Switch checked={effective.quiz1_attended} onCheckedChange={(v) => setField('quiz1_attended', v)} />
                Quiz 1 attended
              </label>
            )}
            {(vars.includes('Qz2') || cfg.formula.includes('Qz2')) && (
              <label className="flex items-center gap-2 text-[13px]">
                <Switch checked={effective.quiz2_attended} onCheckedChange={(v) => setField('quiz2_attended', v)} />
                Quiz 2 attended
              </label>
            )}
            {cfg.hasOppe && (
              <label className="flex items-center gap-2 text-[13px]">
                <Switch checked={effective.sct_completed} onCheckedChange={(v) => setField('sct_completed', v)} />
                SCT completed
              </label>
            )}
          </div>

          {/* Weekly scores */}
          <div>
            <Label>Weekly assignment scores (W1–W12)</Label>
            <div className="grid grid-cols-4 md:grid-cols-6 gap-2 mt-2">
              {Array.from({ length: 12 }, (_, i) => (
                <div key={i}>
                  <div className="text-[10px] text-fgsubtle mb-0.5">W{i + 1}</div>
                  <Input
                    type="number" min={0} max={100} step="1"
                    className="h-8 px-2 text-[13px]" placeholder="—"
                    defaultValue={effective.weekly_scores?.[i] ?? ''}
                    onChange={(e) => setWeekly(i, e.target.value === '' ? null : Number(e.target.value))}
                  />
                </div>
              ))}
            </div>
            <div className="text-[12px] text-fgmuted mt-1.5">
              Best 5 of 7 average: <strong>{bestWeeklyAverage(effective.weekly_scores).toFixed(1)}</strong>
            </div>
          </div>

          {/* BDM GA scores */}
          {s.code === 'BDM' && (
            <div>
              <Label>BDM Graded Assignments (GA1–GA4, each /10)</Label>
              <div className="grid grid-cols-4 gap-2 mt-2">
                {[0, 1, 2, 3].map((i) => (
                  <Input
                    key={i}
                    type="number" min={0} max={10} step="0.5"
                    className="h-8 px-2 text-[13px]"
                    placeholder={`GA${i + 1}`}
                    defaultValue={(effective.extras as Record<string, number[]>)?.BDM_GA?.[i] ?? ''}
                    onChange={(e) => {
                      const arr = [...((effective.extras as Record<string, number[]>)?.BDM_GA ?? [0, 0, 0, 0])];
                      arr[i] = e.target.value === '' ? 0 : Number(e.target.value);
                      updatePending((prev) => ({ ...prev, extras: { ...effective.extras, BDM_GA: arr } }));
                    }}
                  />
                ))}
              </div>
            </div>
          )}

          {/* BA assignment scores */}
          {s.code === 'BA' && (
            <div>
              <Label>BA Assignments (A1–A3, each /10)</Label>
              <div className="grid grid-cols-3 gap-2 mt-2">
                {[0, 1, 2].map((i) => (
                  <Input
                    key={i}
                    type="number" min={0} max={10} step="0.5"
                    className="h-8 px-2 text-[13px]"
                    placeholder={`A${i + 1}`}
                    defaultValue={(effective.extras as Record<string, number[]>)?.BA_A?.[i] ?? ''}
                    onChange={(e) => {
                      const arr = [...((effective.extras as Record<string, number[]>)?.BA_A ?? [0, 0, 0])];
                      arr[i] = e.target.value === '' ? 0 : Number(e.target.value);
                      updatePending((prev) => ({ ...prev, extras: { ...effective.extras, BA_A: arr } }));
                    }}
                  />
                ))}
              </div>
            </div>
          )}

          {/* DBMS extras */}
          {s.code === 'DBMS' && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>GAA2 (W2-3 SQL avg)</Label>
                <Input type="number" min={0} max={100} step="0.5" className="mt-1" placeholder="—"
                  defaultValue={(effective.extras as Record<string, number>)?.GAA2 ?? ''}
                  onChange={(e) =>
                    updatePending((prev) => ({
                      ...prev,
                      extras: { ...effective.extras, GAA2: e.target.value === '' ? 0 : Number(e.target.value) },
                    }))
                  }
                />
              </div>
              <div>
                <Label>GAA3 (W7 prog)</Label>
                <Input type="number" min={0} max={100} step="0.5" className="mt-1" placeholder="—"
                  defaultValue={(effective.extras as Record<string, number>)?.GAA3 ?? ''}
                  onChange={(e) =>
                    updatePending((prev) => ({
                      ...prev,
                      extras: { ...effective.extras, GAA3: e.target.value === '' ? 0 : Number(e.target.value) },
                    }))
                  }
                />
              </div>
            </div>
          )}

          {/* Save */}
          <div className="flex items-center gap-3">
            <Button onClick={handleSave} loading={save.isPending} disabled={!hasPending} size="sm" className="gap-2">
              <Save className="h-3.5 w-3.5" /> Save marks
            </Button>
            {hasPending && <span className="text-[12px] text-warning">Unsaved changes</span>}
          </div>

          {/* Results panel */}
          <div className="rounded-lg bg-surface2 p-4 space-y-3">
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold num" style={{ color: getGradeColor(result.total) }}>
                {result.total.toFixed(1)}
              </span>
              <Badge variant={result.total >= 40 ? 'success' : 'danger'}>{result.letter}</Badge>
              {result.bonusApplied > 0 && <span className="text-[11px] text-fgmuted">+{result.bonusApplied} bonus</span>}
              {result.capped && <span className="text-[11px] text-fgmuted">(capped at {cfg.capTotalAt ?? 100})</span>}
              {result.error && <span className="text-[11px] text-danger">{result.error}</span>}
            </div>
            <div className="relative h-3 rounded-full bg-surface overflow-hidden flex">
              {GRADE_THRESHOLDS.slice().reverse().map((g) => (
                <div key={g.letter} style={{ width: `${g.letter === 'U' ? 40 : 10}%`, background: g.color + '40' }} className="relative">
                  <span className="absolute top-full mt-0.5 left-0 text-[9px] text-fgsubtle">{g.letter}</span>
                </div>
              ))}
              <div className="absolute top-0 h-full w-1 bg-fg rounded-full" style={{ left: `${Math.min(result.total, 100)}%` }} />
            </div>
            {!grade.final_exam_score && (
              <div>
                <div className="text-[11px] text-fgmuted mb-1">You need in the final exam:</div>
                <div className="flex flex-wrap gap-2">
                  {targets.filter((t) => t.minScore >= 40).map((t) => (
                    <div key={`${t.minScore}-${t.letter}`} className="text-[12px]">
                      <Badge variant="muted">{t.minScore === 40 ? 'E(Pass)' : t.letter}</Badge>
                      <span className="ml-1">{t.achievable ? `${t.minFinalExamNeeded}/100` : 'N/A'}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {cfg.notes && <div className="text-[11px] text-fgsubtle">{cfg.notes}</div>}
          </div>
        </CardBody>
      )}
    </Card>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function Grades() {
  useTitle('Grades');
  const { profile } = useAuth();

  const { data: studentTerms = [], isLoading: stLoading } = useStudentTerms();
  const { data: enrolments = [], isLoading: enrolLoading } = useMyEnrolments();
  const { data: grades = [], isLoading: gradesLoading } = useMyGrades();

  const [selectedStudentTermId, setSelectedStudentTermId] = useState<string | null>(null);
  const [showCreateTerm, setShowCreateTerm] = useState(false);

  const setCurrentTerm = useSetCurrentStudentTerm();

  // Auto-migrate existing enrolments → student_terms for users who pre-date this feature
  useAutoMigrateStudentTerms();

  // Auto-select current term once loaded
  useEffect(() => {
    if (selectedStudentTermId === null && studentTerms.length > 0) {
      const current = studentTerms.find((st) => st.is_current) ?? studentTerms[0];
      setSelectedStudentTermId(current.id);
    }
  }, [selectedStudentTermId, studentTerms]);

  const selectedStudentTerm = studentTerms.find((st) => st.id === selectedStudentTermId) ?? null;
  const isCurrentTerm = selectedStudentTerm?.is_current ?? false;

  // Build Term-shaped objects from student_terms for the selector (using student_term.id)
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

  const subjects = useMyEnrolledSubjectsForStudentTerm(selectedStudentTerm);
  const [previewGrades, setPreviewGrades] = useState<Record<string, Partial<Grade>>>({});
  const { cgpa, termsWithMarks } = useCGPA();

  const gradeMap     = new Map(grades.map((g) => [g.subject_id, g]));
  const effectiveMap = new Map(
    subjects.map((s) => {
      const saved = gradeMap.get(s.id) ?? createEmptyGrade(s.id);
      return [s.id, { ...saved, ...(previewGrades[s.id] ?? {}) } as Grade];
    }),
  );
  const termGpa = calculateTermGpa(subjects, effectiveMap);

  const isLoading = stLoading || gradesLoading;

  if (isLoading) {
    return (
      <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-4">
        <Skeleton className="h-6 w-32" />
        <SkeletonCard /><SkeletonCard />
      </div>
    );
  }

  // No terms at all — fresh user, not yet migrated
  if (!stLoading && !enrolLoading && studentTerms.length === 0 && enrolments.length === 0) {
    return (
      <motion.div initial="hidden" animate="visible" variants={stagger} className="p-4 md:p-6 max-w-4xl mx-auto space-y-4">
        <motion.div variants={fadeUp}>
          <h1 className="text-lg font-bold tracking-tightest">Grades</h1>
        </motion.div>
        <motion.div variants={fadeUp}>
          <Empty
            title="No terms yet"
            description="Add your first academic term to start tracking your courses and marks."
          />
          <div className="flex justify-center mt-4">
            <Button onClick={() => setShowCreateTerm(true)} className="gap-1.5">
              <PlusCircle className="h-4 w-4" /> Add your first term
            </Button>
          </div>
        </motion.div>
        <CreateTermModal
          open={showCreateTerm}
          onOpenChange={setShowCreateTerm}
          existingCount={0}
        />
      </motion.div>
    );
  }

  return (
    <motion.div initial="hidden" animate="visible" variants={stagger} className="p-4 md:p-6 max-w-4xl mx-auto space-y-4">
      <motion.div variants={fadeUp}>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-lg font-bold tracking-tightest">Grades</h1>
          <Badge variant="muted" className="text-[11px] font-semibold">
            Term GPA {termGpa === null ? '—' : termGpa.toFixed(2)}
          </Badge>
          {cgpa !== null && termsWithMarks > 1 && (
            <Badge variant="accent" className="text-[11px] font-semibold">
              CGPA {cgpa.toFixed(2)}
            </Badge>
          )}
          <div className="ml-auto flex items-center gap-2">
            <TermSelector value={selectedStudentTermId} onChange={setSelectedStudentTermId} terms={termsForSelector} />
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowCreateTerm(true)}
              className="gap-1 px-2"
              title="Add a term"
            >
              <PlusCircle className="h-4 w-4" />
              <span className="hidden sm:inline text-[13px]">Add term</span>
            </Button>
          </div>
        </div>
        <p className="text-sm text-fgmuted mt-1">
          {isCurrentTerm
            ? 'Add courses, enter marks, and press Save.'
            : 'Viewing a past term — enter marks or switch to current.'}
        </p>
      </motion.div>

      {/* Past-term notice with "Switch to current" */}
      {selectedStudentTerm && !isCurrentTerm && (
        <motion.div variants={fadeUp}>
          <div className="flex items-center gap-3 rounded-lg border border-border bg-surface2 px-3 py-2.5">
            <div className="flex-1 text-[12px] text-fgmuted">
              Viewing a past term. Assignments &amp; deadlines on the dashboard reflect your current term.
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setCurrentTerm.mutate(selectedStudentTerm.id)}
              loading={setCurrentTerm.isPending}
            >
              Set as current
            </Button>
          </div>
        </motion.div>
      )}


      {subjects.length === 0 ? (
        <motion.div variants={fadeUp}>
          <Empty
            title="No courses enrolled"
            description={
              isCurrentTerm
                ? "Use 'Add / remove courses' above to select your courses for this term."
                : 'No courses were enrolled for this term.'
            }
          />
        </motion.div>
      ) : (
        subjects.map((s) => (
          <motion.div key={s.id} variants={fadeUp}>
            <SubjectGradeCard
              subject={s}
              grade={gradeMap.get(s.id) ?? null}
              onPreviewGradeChange={(preview) => {
                setPreviewGrades((prev) => {
                  if (Object.keys(preview).length === 0) {
                    if (!(s.id in prev)) return prev;
                    const next = { ...prev };
                    delete next[s.id];
                    return next;
                  }
                  return { ...prev, [s.id]: preview };
                });
              }}
            />
          </motion.div>
        ))
      )}

      <CreateTermModal
        open={showCreateTerm}
        onOpenChange={setShowCreateTerm}
        existingCount={studentTerms.length}
      />
    </motion.div>
  );
}
