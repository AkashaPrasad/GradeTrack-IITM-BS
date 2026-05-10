import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/stores/auth';
import type { Subject, Enrolment, Grade, Assignment, AssignmentCompletion, Term, AppNotification, StudentTerm, TermType, CourseLevel } from '@/lib/database.types';
import { toast } from 'sonner';
import { toUserMessage } from '@/lib/utils';
import { calculateScore } from '@/lib/grading/calculator';
import { getGradePoint } from '@/lib/grading/letters';

function createRealtimeChannelName(base: string) {
  const id =
    globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `${base}:${id}`;
}

export function useActiveTerm() {
  return useQuery({
    queryKey: ['activeTerm'],
    queryFn: async () => {
      const { data } = await supabase.from('terms').select('*').eq('is_active', true).maybeSingle();
      return data as Term | null;
    },
    staleTime: 60_000,
    retry: 2,
  });
}

/** All terms (past + active + future), sorted newest first — for the term selector UI */
export function useAllTerms() {
  return useQuery({
    queryKey: ['allTerms'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('terms')
        .select('*')
        .order('start_date', { ascending: false });
      if (error) throw error;
      return (data ?? []) as Term[];
    },
    staleTime: 120_000,
  });
}

// ─── Student Terms ────────────────────────────────────────────────────────────

export type StudentTermWithTerm = StudentTerm & { term: Term };

/** The student's own tracked terms, newest first */
export function useStudentTerms() {
  const { profile } = useAuth();
  return useQuery({
    queryKey: ['student_terms', profile?.id],
    queryFn: async () => {
      if (!profile) return [] as StudentTermWithTerm[];
      const { data, error } = await supabase
        .from('student_terms')
        .select('*, term:terms(*)')
        .eq('user_id', profile.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as StudentTermWithTerm[];
    },
    enabled: !!profile,
    staleTime: 30_000,
  });
}

export function useStudentCurrentTerm(): { termId: string | null; level: CourseLevel | null; studentTerm: StudentTerm | null; isLoading: boolean } {
  const { profile } = useAuth();
  const { data: studentTerms = [], isLoading: stLoading } = useStudentTerms();
  const { data: activeTerm, isLoading: atLoading } = useActiveTerm();

  if (stLoading || atLoading) return { termId: null, level: null, studentTerm: null, isLoading: true };

  if (studentTerms.length > 0) {
    const current = studentTerms.find(st => st.is_current) ?? null;
    if (current) {
      // Use the linked global term for assignments/deadlines.
      // If no global term was found at creation time, fall back to the active global term.
      const effectiveTermId = current.term_id ?? activeTerm?.id ?? null;
      return { termId: effectiveTermId, level: (current.level as CourseLevel) ?? null, studentTerm: current, isLoading: false };
    }
    // Has past student_terms but none is current — prompt to start a new one
    return { termId: activeTerm?.id ?? null, level: null, studentTerm: null, isLoading: false };
  }

  // Pre-migration: no student_terms yet — fall back to global active term + profile level
  return { termId: activeTerm?.id ?? null, level: profile?.level ?? null, studentTerm: null, isLoading: false };
}

export function useCreateStudentTerm() {
  const { profile } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ termType, level, customName, subjectIds }: {
      termType: TermType; level: string; customName: string; subjectIds: string[];
    }) => {
      if (!profile) throw new Error('Not signed in');
      const { data: matchingTerms } = await supabase
        .from('terms').select('id')
        .eq('term_type', termType)
        .order('start_date', { ascending: false })
        .limit(1);
      let termId = matchingTerms?.[0]?.id ?? null;
      // Fall back to the active global term so assignments/deadlines still load
      if (!termId) {
        const { data: activeTerms } = await supabase
          .from('terms').select('id').eq('is_active', true).limit(1);
        termId = activeTerms?.[0]?.id ?? null;
      }
      await supabase.from('student_terms')
        .update({ is_current: false })
        .eq('user_id', profile.id)
        .eq('is_current', true);
      const { error } = await supabase.from('student_terms').insert({
        user_id: profile.id, term_id: termId, term_type: termType,
        level, custom_name: customName, is_current: true,
        subject_ids: subjectIds,
      });
      if (error) throw error;
      if (subjectIds.length > 0) {
        await supabase.from('enrolments').upsert(
          subjectIds.map(sid => ({ user_id: profile.id, subject_id: sid })),
          { onConflict: 'user_id,subject_id', ignoreDuplicates: true }
        );
      }
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['student_terms'] });
      void qc.invalidateQueries({ queryKey: ['enrolments'] });
      toast.success('Term created!');
    },
    onError: (e) => toast.error(toUserMessage(e, 'Failed to create term')),
  });
}

export function useSetCurrentStudentTerm() {
  const { profile } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (studentTermId: string) => {
      if (!profile) throw new Error('Not signed in');
      await supabase.from('student_terms').update({ is_current: false }).eq('user_id', profile.id);
      const { error } = await supabase.from('student_terms')
        .update({ is_current: true }).eq('id', studentTermId);
      if (error) throw error;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['student_terms'] });
      toast.success('Switched to selected term.');
    },
    onError: (e) => toast.error(toUserMessage(e, 'Failed to switch term')),
  });
}

export function useDeleteStudentTerm() {
  const { profile } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (studentTermId: string) => {
      if (!profile) throw new Error('Not signed in');
      const { error } = await supabase.from('student_terms')
        .delete()
        .eq('id', studentTermId)
        .eq('user_id', profile.id);
      if (error) throw error;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['student_terms'] });
      toast.success('Term removed.');
    },
    onError: (e) => toast.error(toUserMessage(e, 'Failed to remove term')),
  });
}

function inferTermType(name: string): TermType | null {
  const n = name.toLowerCase();
  if (n.includes('jan')) return 'jan';
  if (n.includes('may')) return 'may';
  if (n.includes('sep')) return 'sep';
  return null;
}

/** Silently migrates existing enrolments → student_terms for users who pre-date this feature.
 *  Call this hook once near the top of the app (Dashboard, Grades). It's idempotent. */
export function useAutoMigrateStudentTerms() {
  const { profile } = useAuth();
  const qc = useQueryClient();
  const { data: studentTerms = [], isLoading: stLoading } = useStudentTerms();
  const { data: enrolments = [], isLoading: enrolLoading } = useMyEnrolments();
  const hasRun = useRef(false);

  useEffect(() => {
    if (hasRun.current) return;
    if (stLoading || enrolLoading) return;
    if (studentTerms.length > 0) return;
    if (enrolments.length === 0 || !profile) return;

    hasRun.current = true;

    const termIds = [...new Set(
      enrolments.map(e => e.subject?.term_id).filter((id): id is string => !!id)
    )];
    if (termIds.length === 0) return;

    // Infer level from enrolled subjects (most common level wins)
    const levelCounts = { foundation: 0, diploma: 0 };
    for (const e of enrolments) {
      if (e.subject?.level === 'foundation') levelCounts.foundation++;
      else if (e.subject?.level === 'diploma') levelCounts.diploma++;
    }
    const level: CourseLevel = levelCounts.diploma > levelCounts.foundation ? 'diploma' : 'foundation';

    void supabase.from('terms').select('*').in('id', termIds).then(({ data: terms }) => {
      if (!terms || terms.length === 0) return;
      const sorted = [...terms].sort((a, b) =>
        new Date(b.start_date).getTime() - new Date(a.start_date).getTime()
      );
      void Promise.all(sorted.map((t, i) => {
        const termType = (t as any).term_type || inferTermType(t.name);
        if (!termType) return; // skip if we can't determine the semester type
        return supabase.from('student_terms').insert({
          user_id: profile.id,
          term_id: t.id,
          term_type: termType,
          level,
          custom_name: t.name,
          is_current: i === 0,
        });
      })).then(() => qc.invalidateQueries({ queryKey: ['student_terms'] }));
    });
  }, [stLoading, enrolLoading, studentTerms.length, enrolments.length, profile, qc]);
}

/** All subjects for a given level — deduped by code, independent of global term. */
export function useSubjectsByLevel(level: CourseLevel | string | null | undefined) {
  return useQuery({
    queryKey: ['subjects_by_level', level],
    queryFn: async () => {
      if (!level) return [] as Subject[];
      const { data, error } = await supabase
        .from('subjects').select('*').eq('level', level).order('code');
      if (error) throw error;
      // Deduplicate by code — admin may have the same course across multiple global terms
      const seen = new Set<string>();
      return (data ?? []).filter(s => {
        if (seen.has(s.code)) return false;
        seen.add(s.code);
        return true;
      }) as Subject[];
    },
    enabled: !!level,
  });
}

/** Fetches available courses for a new term — scoped to the most-recent global term of that type + level.
 *  Falls back to all subjects for the level if no global term exists. Used in CreateTermModal step 3. */
export function useSubjectsForNewTerm(termType: TermType | null, level: string | null) {
  return useQuery({
    queryKey: ['subjects_new_term', termType, level],
    queryFn: async () => {
      if (!termType || !level) return [] as Subject[];
      const { data: terms } = await supabase
        .from('terms').select('id')
        .eq('term_type', termType)
        .order('start_date', { ascending: false })
        .limit(1);
      let globalTermId = terms?.[0]?.id ?? null;
      // Fall back to the active global term when no type-tagged term exists yet
      if (!globalTermId) {
        const { data: activeTerms } = await supabase
          .from('terms').select('id').eq('is_active', true).limit(1);
        globalTermId = activeTerms?.[0]?.id ?? null;
      }
      let q = supabase.from('subjects').select('*').eq('level', level);
      if (globalTermId) q = q.eq('term_id', globalTermId);
      const { data, error } = await q.order('code');
      if (error) throw error;
      const seen = new Set<string>();
      return (data ?? []).filter(s => { if (seen.has(s.code)) return false; seen.add(s.code); return true; }) as Subject[];
    },
    enabled: !!termType && !!level,
  });
}

/** Returns enrolled subjects properly scoped to a specific student_term.
 *  Priority: explicit subject_ids list → term_id+level filter → level-only fallback */
export function useMyEnrolledSubjectsForStudentTerm(
  studentTerm: { term_id: string | null; level: string; subject_ids?: string[] } | null | undefined
): Subject[] {
  const { data: enrolments = [] } = useMyEnrolments();
  if (!studentTerm) return [];

  // Primary: use the subject_ids stored at term creation time (exact per-term list)
  const ids = studentTerm.subject_ids ?? [];
  if (ids.length > 0) {
    const idSet = new Set(ids);
    return enrolments
      .filter(e => idSet.has(e.subject_id))
      .map(e => e.subject)
      .filter(Boolean) as Subject[];
  }

  // Fallback for migrated terms: filter by both global term_id AND level to prevent bleed-over
  if (studentTerm.term_id) {
    return enrolments
      .filter(e => e.subject?.term_id === studentTerm.term_id && e.subject?.level === studentTerm.level)
      .map(e => e.subject)
      .filter(Boolean) as Subject[];
  }

  // Last resort: level-only (pre-migration, term_id unknown)
  return enrolments
    .filter(e => e.subject?.level === studentTerm.level)
    .map(e => e.subject)
    .filter(Boolean) as Subject[];
}

/** Returns enrolled subjects filtered by level. Pass null to get all enrolled subjects (pre-migration fallback). */
export function useMyEnrolledSubjectsByLevel(level: CourseLevel | string | null | undefined): Subject[] {
  const { data: enrolments = [] } = useMyEnrolments();
  if (!level) return enrolments.map(e => e.subject).filter(Boolean) as Subject[];
  return enrolments
    .filter(e => e.subject?.level === level)
    .map(e => e.subject)
    .filter(Boolean) as Subject[];
}

/** All subjects for a given term — no enrolment filter, used to let students pick courses */
export function useTermSubjects(termId: string | null | undefined) {
  const { profile } = useAuth();
  return useQuery({
    queryKey: ['term_subjects', termId, profile?.level],
    queryFn: async () => {
      if (!termId) return [] as Subject[];
      let q = supabase.from('subjects').select('*').eq('term_id', termId);
      if (profile?.level) q = q.eq('level', profile.level);
      const { data, error } = await q.order('name');
      if (error) throw error;
      return (data ?? []) as Subject[];
    },
    enabled: !!termId,
  });
}

export function useMyEnrolments() {
  const { profile } = useAuth();
  return useQuery({
    queryKey: ['enrolments', profile?.id],
    queryFn: async () => {
      if (!profile) return [];
      const { data } = await supabase.from('enrolments').select('*, subject:subjects(*)').eq('user_id', profile.id);
      return (data ?? []) as (Enrolment & { subject: Subject })[];
    },
    enabled: !!profile
  });
}

/** Subjects for the active term (existing behaviour, used by Assignments page) */
export function useMySubjects() {
  const { data: enrolments = [] } = useMyEnrolments();
  return enrolments.map(e => e.subject).filter(Boolean);
}

/** Subjects for a specific term — filters enrolments by term_id */
export function useMySubjectsForTerm(termId: string | null | undefined) {
  const { data: enrolments = [] } = useMyEnrolments();
  if (!termId) return [] as Subject[];
  return enrolments
    .filter((e) => e.subject?.term_id === termId)
    .map((e) => e.subject)
    .filter(Boolean) as Subject[];
}

export function useEnrolInSubject() {
  const { profile } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (subjectId: string) => {
      if (!profile) throw new Error('Not signed in');
      const { error } = await supabase
        .from('enrolments')
        .insert({ user_id: profile.id, subject_id: subjectId });
      if (error && !error.message.includes('duplicate')) throw error;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['enrolments'] });
      toast.success('Course added.');
    },
    onError: (e) => toast.error(toUserMessage(e, 'Failed to add course')),
  });
}

export function useUnenrolFromSubject() {
  const { profile } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (subjectId: string) => {
      if (!profile) throw new Error('Not signed in');
      const { error } = await supabase
        .from('enrolments')
        .delete()
        .eq('user_id', profile.id)
        .eq('subject_id', subjectId);
      if (error) throw error;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['enrolments'] });
      toast.success('Course removed.');
    },
    onError: (e) => toast.error(toUserMessage(e, 'Failed to remove course')),
  });
}

export function useMyGrades() {
  const { profile } = useAuth();
  return useQuery({
    queryKey: ['grades', profile?.id],
    queryFn: async () => {
      if (!profile) return [];
      const { data } = await supabase.from('grades').select('*').eq('user_id', profile.id);
      return (data ?? []) as Grade[];
    },
    enabled: !!profile
  });
}

export function useGradeForSubject(subjectId: string | undefined) {
  const { data: grades = [] } = useMyGrades();
  return grades.find(g => g.subject_id === subjectId) ?? null;
}

export function useSaveGrade() {
  const { profile } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (patch: Partial<Grade> & { subject_id: string }) => {
      if (!profile) throw new Error('Not signed in');
      const { error } = await supabase.from('grades').upsert(
        { user_id: profile.id, ...patch },
        { onConflict: 'user_id,subject_id' }
      );
      if (error) throw error;
    },
    onMutate: async (patch) => {
      await qc.cancelQueries({ queryKey: ['grades', profile?.id] });
      const prev = qc.getQueryData<Grade[]>(['grades', profile?.id]);
      qc.setQueryData<Grade[]>(['grades', profile?.id], old => {
        if (!old) return old;
        const idx = old.findIndex(g => g.subject_id === patch.subject_id);
        if (idx >= 0) {
          const copy = [...old];
          copy[idx] = { ...copy[idx], ...patch } as Grade;
          return copy;
        }
        return [...old, { user_id: profile!.id, ...patch } as Grade];
      });
      return { prev };
    },
    onError: (e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(['grades', profile?.id], ctx.prev);
      toast.error(toUserMessage(e, 'Failed to save grade'));
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['grades', profile?.id] })
  });
}

/**
 * CGPA across ALL enrolled subjects across ALL terms where marks have been entered.
 * Returns null if no marks have been recorded anywhere.
 * Formula: weighted sum of (grade_point * credits) / total_credits
 */
export function useCGPA(): { cgpa: number | null; totalCredits: number; termsWithMarks: number } {
  const { data: enrolments = [] } = useMyEnrolments();
  const { data: grades = [] }     = useMyGrades();

  return useMemo(() => {
    if (enrolments.length === 0) return { cgpa: null, totalCredits: 0, termsWithMarks: 0 };

    const gradeMap = new Map(grades.map((g) => [g.subject_id, g]));
    const termsSeen = new Set<string>();
    let weightedSum = 0;
    let totalCredits = 0;
    let hasAnyMarks = false;

    for (const enrolment of enrolments) {
      const subject = enrolment.subject;
      if (!subject) continue;
      const grade = gradeMap.get(subject.id);
      if (!grade) continue;

      // Only include subjects where at least one score has been entered
      const anyScore = [
        grade.qz1_score, grade.qz2_score, grade.final_exam_score,
        grade.oppe1_score, grade.oppe2_score, grade.roe_score,
        grade.p1_score, grade.p2_score, grade.ka_score,
        grade.nppe1_score, grade.nppe2_score, grade.bpta_score, grade.bonus_score,
      ].some((v) => typeof v === 'number');
      if (!anyScore) continue;

      hasAnyMarks = true;
      const result = calculateScore(subject, grade);
      const gp = getGradePoint(result.letter as Parameters<typeof getGradePoint>[0]);
      weightedSum  += gp * subject.credits;
      totalCredits += subject.credits;
      termsSeen.add(subject.term_id);
    }

    if (!hasAnyMarks || totalCredits === 0) return { cgpa: null, totalCredits: 0, termsWithMarks: 0 };
    return {
      cgpa: Math.round((weightedSum / totalCredits) * 100) / 100,
      totalCredits,
      termsWithMarks: termsSeen.size,
    };
  }, [enrolments, grades]);
}

export function useAssignments(termId: string | undefined, level?: CourseLevel | null) {
  const { profile } = useAuth();
  const effectiveLevel = level ?? profile?.level ?? null;
  return useQuery({
    queryKey: ['assignments', termId, effectiveLevel],
    queryFn: async () => {
      if (!termId) return [];
      let q = supabase.from('assignments').select('*').eq('term_id', termId).eq('is_published', true).order('week_number', { ascending: true, nullsFirst: false });
      const { data } = await q;
      const assignments = (data ?? []) as Assignment[];
      if (!effectiveLevel) return assignments;
      return assignments.filter(a => !a.level || a.level === effectiveLevel);
    },
    enabled: !!termId
  });
}

export function useMyCompletions() {
  const { profile } = useAuth();
  return useQuery({
    queryKey: ['completions', profile?.id],
    queryFn: async () => {
      if (!profile) return [];
      const { data } = await supabase.from('assignment_completions').select('*').eq('user_id', profile.id);
      return (data ?? []) as AssignmentCompletion[];
    },
    enabled: !!profile
  });
}

export function useToggleCompletion() {
  const { profile } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ assignmentId, completed, skipped }: { assignmentId: string; completed: boolean; skipped?: boolean }) => {
      if (!profile) throw new Error('Not signed in');
      const { error } = await supabase.from('assignment_completions').upsert(
        {
          user_id: profile.id,
          assignment_id: assignmentId,
          is_completed: completed,
          skipped: skipped ?? false,
          completed_at: completed ? new Date().toISOString() : null
        },
        { onConflict: 'user_id,assignment_id' }
      );
      if (error) throw error;
    },
    onMutate: async ({ assignmentId, completed, skipped }) => {
      await qc.cancelQueries({ queryKey: ['completions', profile?.id] });
      const prev = qc.getQueryData<AssignmentCompletion[]>(['completions', profile?.id]);
      qc.setQueryData<AssignmentCompletion[]>(['completions', profile?.id], old => {
        if (!old) return old;
        const idx = old.findIndex(c => c.assignment_id === assignmentId);
        const patch = { is_completed: completed, skipped: skipped ?? false, completed_at: completed ? new Date().toISOString() : null };
        if (idx >= 0) {
          const copy = [...old];
          copy[idx] = { ...copy[idx], ...patch };
          return copy;
        }
        return [...old, { user_id: profile!.id, assignment_id: assignmentId, ...patch } as any];
      });
      return { prev };
    },
    onError: (e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(['completions', profile?.id], ctx.prev);
      toast.error(toUserMessage(e, 'Failed to update'));
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['completions', profile?.id] })
  });
}

export function useRealtimeAssignments(termId: string | undefined) {
  const qc = useQueryClient();
  const { profile } = useAuth();
  const { level } = useStudentCurrentTerm();
  const effectiveLevel = level ?? profile?.level ?? null;
  useEffect(() => {
    if (!termId) return;

    const channel = supabase
      .channel(createRealtimeChannelName(`assignments-changes:${termId}`))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'assignments', filter: `term_id=eq.${termId}` }, () => {
        qc.invalidateQueries({ queryKey: ['assignments', termId, effectiveLevel] });
      })
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [effectiveLevel, qc, termId]);
}

// ─── Notifications ────────────────────────────────────────────────────────────

export interface NotificationsData {
  notifications: AppNotification[];
  reads: Set<string>;
}

export function useNotifications() {
  const { profile } = useAuth();
  return useQuery<NotificationsData>({
    queryKey: ['notifications', profile?.id],
    queryFn: async () => {
      if (!profile) return { notifications: [], reads: new Set<string>() };
      const [notifRes, readsRes] = await Promise.all([
        supabase.from('notifications').select('*').order('created_at', { ascending: false }).limit(50),
        supabase.from('notification_reads').select('notification_id').eq('user_id', profile.id),
      ]);
      const reads = new Set<string>((readsRes.data ?? []).map((r: any) => r.notification_id as string));
      return {
        notifications: (notifRes.data ?? []) as AppNotification[],
        reads,
      };
    },
    enabled: !!profile,
    staleTime: 60_000,
  });
}

export function useUnreadNotificationCount() {
  const { data } = useNotifications();
  if (!data) return 0;
  return data.notifications.filter(n => !data.reads.has(n.id)).length;
}

export function useMarkNotificationsRead() {
  const { profile } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (ids: string[]) => {
      if (!profile || ids.length === 0) return;
      const { error } = await supabase.from('notification_reads').upsert(
        ids.map(id => ({ user_id: profile.id, notification_id: id })),
        { onConflict: 'user_id,notification_id', ignoreDuplicates: true }
      );
      if (error) throw error;
    },
    onMutate: async (ids) => {
      // Optimistically update the reads set so the badge drops instantly
      await qc.cancelQueries({ queryKey: ['notifications', profile?.id] });
      qc.setQueryData<NotificationsData>(['notifications', profile?.id], old => {
        if (!old) return old;
        const reads = new Set(old.reads);
        ids.forEach(id => reads.add(id));
        return { ...old, reads };
      });
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });
}

export function useCreateNotification() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (n: { title: string; body?: string; kind?: string; target_level?: string | null }) => {
      const { error } = await supabase.from('notifications').insert({
        title: n.title.trim().slice(0, 200),
        body: n.body?.trim().slice(0, 1000) || null,
        kind: n.kind ?? 'announcement',
        target_level: n.target_level ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });
}

// Realtime subscription — new notifications appear instantly for all connected users
export function useRealtimeNotifications() {
  const qc = useQueryClient();
  const { profile } = useAuth();

  useEffect(() => {
    if (!profile) return;

    const channel = supabase
      .channel(createRealtimeChannelName(`notifications-changes:${profile.id}`))
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications' }, () => {
        qc.invalidateQueries({ queryKey: ['notifications'] });
      })
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [profile?.id, qc]);
}
