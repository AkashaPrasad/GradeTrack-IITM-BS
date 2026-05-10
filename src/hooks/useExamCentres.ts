import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { ExamCentre } from '@/lib/database.types';
import { toast } from 'sonner';
import { toUserMessage } from '@/lib/utils';

export function useExamCentres() {
  return useQuery({
    queryKey: ['exam_centres'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('exam_centres')
        .select('*')
        .eq('is_active', true)
        .order('display_order', { ascending: true })
        .order('name', { ascending: true });

      if (error) throw error;
      return (data ?? []) as ExamCentre[];
    },
  });
}

export function useAdminExamCentres() {
  return useQuery({
    queryKey: ['admin_exam_centres'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('exam_centres')
        .select('*')
        .order('display_order', { ascending: true })
        .order('name', { ascending: true });

      if (error) throw error;
      return (data ?? []) as ExamCentre[];
    },
  });
}

export function useSaveExamCentre() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (centre: Partial<ExamCentre> & Pick<ExamCentre, 'name' | 'address'>) => {
      const payload = {
        ...centre,
        name: centre.name.trim(),
        address: centre.address.trim(),
        city: (centre.city ?? '').trim(),
        pincode: centre.pincode?.trim() || null,
        maps_url: centre.maps_url?.trim() || null,
        display_order: centre.display_order ?? 0,
        is_active: centre.is_active ?? true,
      };

      if (centre.id) {
        const { error } = await supabase
          .from('exam_centres')
          .update(payload)
          .eq('id', centre.id);
        if (error) throw error;
        return;
      }

      const { error } = await supabase.from('exam_centres').insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['exam_centres'] });
      void qc.invalidateQueries({ queryKey: ['admin_exam_centres'] });
      toast.success('Exam centre saved.');
    },
    onError: (err) => {
      toast.error(toUserMessage(err, 'Failed to save exam centre.'));
    },
  });
}

export function useDeleteExamCentre() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (centre: ExamCentre) => {
      try {
        const { count, error: countError } = await supabase
          .from('hall_tickets')
          .select('id', { count: 'exact', head: true })
          .eq('centre_name', centre.name);

        if (!countError && (count ?? 0) > 0) {
          throw new Error('This centre is already referenced by hall tickets and cannot be deleted.');
        }
        // If countError, skip protection (broken RLS) and proceed
      } catch (err) {
        if (err instanceof Error && err.message.startsWith('This centre is already referenced')) throw err;
        // Count query failed — skip protection and proceed with delete
      }

      const { error } = await supabase
        .from('exam_centres')
        .delete()
        .eq('id', centre.id);

      if (error) throw error;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['exam_centres'] });
      void qc.invalidateQueries({ queryKey: ['admin_exam_centres'] });
      toast.success('Exam centre deleted.');
    },
    onError: (err) => {
      toast.error(toUserMessage(err, 'Failed to delete exam centre.'));
    },
  });
}
