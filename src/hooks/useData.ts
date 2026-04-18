import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/stores/auth';
import type { Subject, Enrolment, Grade, Assignment, AssignmentCompletion, Term, AppNotification } from '@/lib/database.types';
import { toast } from 'sonner';
import { toUserMessage } from '@/lib/utils';

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

export function useMySubjects() {
  const { data: enrolments = [] } = useMyEnrolments();
  return enrolments.map(e => e.subject).filter(Boolean);
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

export function useAssignments(termId: string | undefined) {
  const { profile } = useAuth();
  return useQuery({
    queryKey: ['assignments', termId, profile?.level],
    queryFn: async () => {
      if (!termId) return [];
      let q = supabase.from('assignments').select('*').eq('term_id', termId).eq('is_published', true).order('week_number', { ascending: true, nullsFirst: false });
      const { data } = await q;
      const assignments = (data ?? []) as Assignment[];
      const lvl = profile?.level;
      if (!lvl) return assignments;
      return assignments.filter(a => !a.level || a.level === lvl);
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
  useEffect(() => {
    if (!termId) return;

    const channel = supabase
      .channel(createRealtimeChannelName(`assignments-changes:${termId}`))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'assignments', filter: `term_id=eq.${termId}` }, () => {
        qc.invalidateQueries({ queryKey: ['assignments', termId, profile?.level] });
      })
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [profile?.level, qc, termId]);
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
