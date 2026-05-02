import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/stores/auth';
import type { BusFormConfig, BusRegistration, ExamType } from '@/lib/database.types';
import { toast } from 'sonner';
import { toUserMessage } from '@/lib/utils';

export function useBusFormConfig(examType: ExamType) {
  return useQuery({
    queryKey: ['bus_form_config', examType],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bus_form_config')
        .select('*')
        .eq('exam_type', examType)
        .maybeSingle();
      if (error) throw error;
      return data as BusFormConfig | null;
    },
    refetchInterval: 60_000, // poll every minute to pick up time-based open/close
  });
}

export function useAllBusFormConfigs() {
  return useQuery({
    queryKey: ['bus_form_config', 'all'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bus_form_config')
        .select('*')
        .order('exam_type');
      if (error) throw error;
      return (data ?? []) as BusFormConfig[];
    },
  });
}

export function useMyBusRegistration(examType: ExamType) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['bus_registrations', 'mine', user?.id, examType],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bus_registrations')
        .select('*')
        .eq('user_id', user!.id)
        .eq('exam_type', examType)
        .maybeSingle();
      if (error) throw error;
      return data as BusRegistration | null;
    },
    enabled: !!user,
  });
}

interface RegisterBusInput {
  examType: ExamType;
  studentName: string;
  scalerId: string;
  centreName: string;
  whatsappNumber: string;
  hostel: string;
}

export function useRegisterBus() {
  const { user } = useAuth();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: RegisterBusInput) => {
      if (!user) throw new Error('Not logged in');

      // Atomic seat increment — throws if seats are full
      const { error: rpcError } = await supabase.rpc('increment_bus_seats', {
        exam_type_param: input.examType,
      });
      if (rpcError) {
        if (rpcError.message.includes('No seats available')) {
          throw new Error('Sorry, all bus seats are taken.');
        }
        throw rpcError;
      }

      const { error } = await supabase.from('bus_registrations').insert({
        user_id: user.id,
        exam_type: input.examType,
        student_name: input.studentName.trim(),
        scaler_id: input.scalerId.trim(),
        centre_name: input.centreName.trim(),
        whatsapp_number: input.whatsappNumber.trim() || null,
        hostel: input.hostel || null,
      });

      if (error) {
        // Roll back the seat increment
        await supabase.rpc('decrement_bus_seats', { exam_type_param: input.examType });
        throw error;
      }
    },
    onSuccess: (_, vars) => {
      void qc.invalidateQueries({ queryKey: ['bus_registrations', 'mine'] });
      void qc.invalidateQueries({ queryKey: ['bus_form_config', vars.examType] });
      toast.success('Bus registration submitted! Admin will confirm your seat soon.');
    },
    onError: (err) => {
      toast.error(toUserMessage(err, 'Registration failed. Please try again.'));
    },
  });
}

export function useCancelBusRegistration() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, examType }: { id: string; examType: ExamType }) => {
      const { error } = await supabase.from('bus_registrations').delete().eq('id', id);
      if (error) throw error;
      await supabase.rpc('decrement_bus_seats', { exam_type_param: examType });
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['bus_registrations'] });
      void qc.invalidateQueries({ queryKey: ['bus_form_config'] });
      toast.success('Bus registration cancelled.');
    },
    onError: (err) => {
      toast.error(toUserMessage(err));
    },
  });
}
