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
  examType: ExamType;
  studentName: string;
  scalerId: string;
  centreName: string;
  examDate: string;
  examTiming: string;
  whatsappNumber: string;
  hostel: 'Uniworld 1' | 'Uniworld 2';
  pdfFile?: File;
}

export function useUploadHallTicket() {
  const { user, updateProfile } = useAuth();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: UploadHallTicketInput) => {
      if (!user) throw new Error('Not logged in');

      let pdfPath: string | null = null;
      if (input.pdfFile) {
        const path = `${user.id}/${input.examType}/hall_ticket.pdf`;
        const { error: uploadError } = await supabase.storage
          .from('hall-tickets')
          .upload(path, input.pdfFile, { upsert: true, contentType: 'application/pdf' });
        if (uploadError) throw uploadError;
        pdfPath = path;
      }

      const examDate = new Date(input.examDate);
      const expiresAt = new Date(examDate);
      expiresAt.setDate(expiresAt.getDate() + 10);

      const { error } = await supabase.from('hall_tickets').upsert(
        {
          user_id: user.id,
          exam_type: input.examType,
          student_name: input.studentName.trim(),
          scaler_id: input.scalerId.trim(),
          centre_name: normaliseCentreName(input.centreName),
          exam_date: input.examDate,
          exam_timing: input.examTiming.trim(),
          whatsapp_number: input.whatsappNumber.trim() || null,
          hostel: input.hostel,
          pdf_storage_path: pdfPath,
          expires_at: expiresAt.toISOString(),
          is_active: true,
        },
        { onConflict: 'user_id,exam_type' }
      );
      if (error) throw error;

      // Persist whatsapp + hostel to profile for reuse
      await updateProfile({
        whatsapp_number: input.whatsappNumber.trim() || null,
        hostel: input.hostel,
        scaler_id: input.scalerId.trim() || null,
      });
    },
    onSuccess: (_, vars) => {
      void qc.invalidateQueries({ queryKey: ['hall_tickets'] });
      void qc.invalidateQueries({ queryKey: ['centre_students', vars.examType] });
      toast.success('Hall ticket uploaded successfully!');
    },
    onError: (err) => {
      toast.error(toUserMessage(err, 'Upload failed. Please try again.'));
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
      toast.success('Hall ticket removed.');
    },
    onError: (err) => {
      toast.error(toUserMessage(err));
    },
  });
}
