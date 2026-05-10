import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/stores/auth';
import type { BusFormConfig, BusRegistrationWithProfile, ExamType, HallTicket } from '@/lib/database.types';
import { toast } from 'sonner';
import { toUserMessage } from '@/lib/utils';

// ── Bus registrations ─────────────────────────────────────────────────────────

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
          () => void qc.invalidateQueries({ queryKey: ['admin_bus_registrations', examType] }),
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

// ── Hall tickets (centre registrations) ──────────────────────────────────────

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

/** Suggested centres (all exam types) that students submitted manually */
export function useAdminSuggestedCentres() {
  return useQuery({
    queryKey: ['admin_suggested_centres'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('hall_tickets')
        .select('*, profile:profiles(full_name, email)')
        .eq('is_suggested', true)
        .order('uploaded_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as Array<HallTicket & { profile?: { full_name: string | null; email: string } | null }>;
    },
  });
}

export function useReviewSuggestedCentre() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: 'approved' | 'rejected' }) => {
      const { error } = await supabase
        .from('hall_tickets')
        .update({ suggested_status: status })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      void qc.invalidateQueries({ queryKey: ['admin_suggested_centres'] });
      void qc.invalidateQueries({ queryKey: ['admin_hall_tickets'] });
      toast.success(vars.status === 'approved' ? 'Centre approved.' : 'Centre rejected.');
    },
    onError: (err) => toast.error(toUserMessage(err)),
  });
}

// ── Scaler-verified students ──────────────────────────────────────────────────

export function useAdminAllScalerStudents() {
  return useQuery({
    queryKey: ['admin_scaler_students'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, email, roll_number, is_scaler_verified, scaler_email, scaler_id, hostel, whatsapp_number, scaler_verified_at')
        .eq('is_scaler_verified', true)
        .order('full_name');
      if (error) throw error;
      return data ?? [];
    },
  });
}

// ── OTP records (admin management) ───────────────────────────────────────────

export interface OtpRecord {
  id:          string;
  user_id:     string;
  scaler_email: string;
  attempts:    number;
  send_count:  number;
  expires_at:  string;
  consumed_at: string | null;
  created_at:  string;
  last_sent_at: string;
}

export function useAdminOtpRecords() {
  return useQuery({
    queryKey: ['admin_otp_records'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('scaler_verification_otps')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data ?? []) as OtpRecord[];
    },
  });
}

export function useAdminDeleteOtp() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('scaler_verification_otps')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['admin_otp_records'] });
      toast.success('OTP record deleted.');
    },
    onError: (err) => toast.error(toUserMessage(err)),
  });
}

/** Reset a student's Scaler verification (admin only) */
export function useResetScalerVerification() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (userId: string) => {
      // Delete OTP record first (if any)
      await supabase
        .from('scaler_verification_otps')
        .delete()
        .eq('user_id', userId);

      // Reset verification on profile
      const { error } = await supabase
        .from('profiles')
        .update({
          is_scaler_verified: false,
          scaler_email:       null,
          scaler_verified_at: null,
        })
        .eq('id', userId);
      if (error) throw error;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['admin_scaler_students'] });
      void qc.invalidateQueries({ queryKey: ['admin_otp_records'] });
      toast.success('Scaler verification reset. Student will need to re-verify.');
    },
    onError: (err) => toast.error(toUserMessage(err, 'Failed to reset verification.')),
  });
}

// ── Bus config ────────────────────────────────────────────────────────────────

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
          confirmed_by:   confirm ? (user?.id ?? null) : null,
          confirmed_at:   confirm ? new Date().toISOString() : null,
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
    mutationFn: async ({
      exam_type, exam_date, centre_reg_open,
    }: { exam_type: ExamType; exam_date: string; centre_reg_open?: boolean | null }) => {
      const { error } = await supabase.from('exam_schedule').upsert(
        {
          exam_type, exam_date,
          academic_year: '2025-26',
          updated_at: new Date().toISOString(),
          ...(centre_reg_open !== undefined ? { centre_reg_open } : {}),
        },
        { onConflict: 'exam_type,academic_year' },
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
