import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/stores/auth';
import type { ExamType, HallTicket } from '@/lib/database.types';
import { normaliseCentreName } from '@/lib/hallTicketParser';
import { toast } from 'sonner';
import { toUserMessage } from '@/lib/utils';

export function useMyHallTickets() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['hall_tickets', 'mine', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('hall_tickets')
        .select('*')
        .eq('user_id', user!.id)
        .order('uploaded_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as HallTicket[];
    },
    enabled: !!user,
  });
}

export function useHallTicketForExam(examType: ExamType) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['hall_tickets', 'mine', user?.id, examType],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('hall_tickets')
        .select('*')
        .eq('user_id', user!.id)
        .eq('exam_type', examType)
        .maybeSingle();
      if (error) throw error;
      return data as HallTicket | null;
    },
    enabled: !!user,
  });
}

export function useExamSchedule() {
  return useQuery({
    queryKey: ['exam_schedule'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('exam_schedule')
        .select('*')
        .order('exam_date', { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });
}

interface UploadHallTicketInput {
  examType:       ExamType;
  studentName:    string;
  scalerId:       string;
  centreName:     string;
  centreAddress?: string;
  examDate:       string | null;
  whatsappNumber: string;
  hostel:         'Uniworld 1' | 'Uniworld 2';
  isSuggested:    boolean;
}

export function useUploadHallTicket() {
  const { user, updateProfile } = useAuth();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: UploadHallTicketInput) => {
      if (!user) throw new Error('Not logged in');

      // expires_at: exam date + 10 days if known, otherwise 6 months from now
      let expiresAt: Date;
      if (input.examDate) {
        expiresAt = new Date(input.examDate);
        expiresAt.setDate(expiresAt.getDate() + 10);
      } else {
        expiresAt = new Date();
        expiresAt.setMonth(expiresAt.getMonth() + 6);
      }

      const { error } = await supabase.from('hall_tickets').upsert(
        {
          user_id:          user.id,
          exam_type:        input.examType,
          student_name:     input.studentName.trim(),
          scaler_id:        input.scalerId.trim(),
          centre_name:      normaliseCentreName(input.centreName),
          centre_address:   input.centreAddress?.trim() || null,
          exam_date:        input.examDate ?? null,
          reporting_time:   null,
          exam_timing:      null,
          shift:            null,
          whatsapp_number:  input.whatsappNumber.trim() || null,
          hostel:           input.hostel,
          pdf_storage_path: null,
          uploaded_via:     'manual',
          expires_at:       expiresAt.toISOString(),
          is_active:        true,
          is_suggested:     input.isSuggested,
          suggested_status: input.isSuggested ? 'pending' : 'approved',
        },
        { onConflict: 'user_id,exam_type' },
      );
      if (error) throw error;

      // Sync profile fields (best-effort)
      try {
        await updateProfile({
          whatsapp_number: input.whatsappNumber.trim() || null,
          hostel:          input.hostel,
          scaler_id:       input.scalerId.trim() || null,
        });
      } catch {
        // Profile sync is best-effort; centre registration already saved
      }
    },
    onSuccess: (_, vars) => {
      void qc.invalidateQueries({ queryKey: ['hall_tickets'] });
      void qc.invalidateQueries({ queryKey: ['centre_students', vars.examType] });
      toast.success(
        vars.isSuggested
          ? 'Centre saved! Your suggestion is pending admin review.'
          : 'Exam centre registered successfully.',
      );
    },
    onError: (err) => {
      toast.error(toUserMessage(err, 'Failed to save. Please try again.'));
    },
  });
}

export function useDeleteHallTicket() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('hall_tickets').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['hall_tickets'] });
      toast.success('Exam centre registration removed.');
    },
    onError: (err) => {
      toast.error(toUserMessage(err));
    },
  });
}
