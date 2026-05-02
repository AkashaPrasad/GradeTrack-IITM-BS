import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/stores/auth';
import type { BusFormConfig, BusRegistration, BusRegistrationWithProfile, ExamType, HallTicket } from '@/lib/database.types';
import { toast } from 'sonner';
import { toUserMessage } from '@/lib/utils';

export function useAdminBusRegistrations(examType: ExamType) {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ['admin_bus_registrations', examType],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bus_registrations')
        .select('*, profile:profiles(full_name, email, avatar_url)')
        .eq('exam_type', examType)
        .order('submitted_at', { ascending: true });
      if (error) throw error;
      return (data ?? []) as BusRegistrationWithProfile[];
    },
  });

  // Realtime updates for admin table
  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null;
    const timer = setTimeout(() => {
      channel = supabase
        .channel(`admin_bus_${examType}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'bus_registrations', filter: `exam_type=eq.${examType}` },
          () => void qc.invalidateQueries({ queryKey: ['admin_bus_registrations', examType] })
        )
        .subscribe();
    }, 100);
    return () => {
      clearTimeout(timer);
      if (channel) void supabase.removeChannel(channel);
    };
  }, [examType, qc]);

  return query;
}

export function useAdminAllHallTickets(examType: ExamType) {
  return useQuery({
    queryKey: ['admin_hall_tickets', examType],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('hall_tickets')
        .select('*, profile:profiles(full_name, email)')
        .eq('exam_type', examType)
        .order('centre_name')
        .order('uploaded_at');
      if (error) throw error;
      return (data ?? []) as Array<HallTicket & { profile?: { full_name: string | null; email: string } | null }>;
    },
  });
}

export function useAdminAllScalerStudents() {
  return useQuery({
    queryKey: ['admin_scaler_students'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, email, roll_number, is_scaler_verified, scaler_email, scaler_id, hostel, whatsapp_number')
        .eq('is_scaler_verified', true)
        .order('full_name');
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useUpdateBusConfig() {
  const { user } = useAuth();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (config: Partial<BusFormConfig> & { exam_type: ExamType }) => {
      const { exam_type, ...rest } = config;
      const { error } = await supabase
        .from('bus_form_config')
        .update({ ...rest, updated_at: new Date().toISOString(), updated_by: user?.id ?? null })
        .eq('exam_type', exam_type);
      if (error) throw error;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['bus_form_config'] });
      toast.success('Bus configuration saved.');
    },
    onError: (err) => toast.error(toUserMessage(err)),
  });
}

export function useConfirmBusSeat() {
  const { user } = useAuth();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, examType, confirm }: { id: string; examType: ExamType; confirm: boolean }) => {
      const { error } = await supabase
        .from('bus_registrations')
        .update({
          seat_confirmed: confirm,
          confirmed_by: confirm ? (user?.id ?? null) : null,
          confirmed_at: confirm ? new Date().toISOString() : null,
        })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      void qc.invalidateQueries({ queryKey: ['admin_bus_registrations', vars.examType] });
    },
    onError: (err) => toast.error(toUserMessage(err)),
  });
}

export function useAdminExamSchedule() {
  return useQuery({
    queryKey: ['exam_schedule'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('exam_schedule')
        .select('*')
        .order('exam_date');
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useUpsertExamSchedule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ exam_type, exam_date }: { exam_type: ExamType; exam_date: string }) => {
      const { error } = await supabase.from('exam_schedule').upsert(
        { exam_type, exam_date, academic_year: '2025-26', updated_at: new Date().toISOString() },
        { onConflict: 'exam_type,academic_year' }
      );
      if (error) throw error;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['exam_schedule'] });
      toast.success('Exam schedule saved.');
    },
    onError: (err) => toast.error(toUserMessage(err)),
  });
}
