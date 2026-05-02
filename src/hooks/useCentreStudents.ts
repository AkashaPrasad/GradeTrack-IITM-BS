import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { ExamType, HallTicket } from '@/lib/database.types';
import { toast } from 'sonner';

export function useCentreStudents(centreName: string | null, examType: ExamType | null) {
  const qc = useQueryClient();
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());

  const query = useQuery({
    queryKey: ['centre_students', examType, centreName],
    queryFn: async () => {
      if (!centreName || !examType) return [] as HallTicket[];
      const { data, error } = await supabase
        .from('hall_tickets')
        .select('*')
        .eq('centre_name', centreName)
        .eq('exam_type', examType)
        .eq('is_active', true)
        .order('uploaded_at', { ascending: true });
      if (error) throw error;
      setLastRefreshed(new Date());
      return (data ?? []) as HallTicket[];
    },
    enabled: !!centreName && !!examType,
  });

  // Realtime subscription — delayed slightly so React StrictMode double-mount
  // doesn't create a channel that's immediately torn down before connecting.
  useEffect(() => {
    if (!centreName || !examType) return;

    let channel: ReturnType<typeof supabase.channel> | null = null;
    const timer = setTimeout(() => {
      channel = supabase
        .channel(`centre_students_${examType}_${centreName}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'hall_tickets',
            filter: `exam_type=eq.${examType}`,
          },
          (payload) => {
            void qc.invalidateQueries({ queryKey: ['centre_students', examType, centreName] });
            setLastRefreshed(new Date());
            if (payload.eventType === 'INSERT') {
              const newRecord = payload.new as HallTicket;
              if (newRecord.centre_name === centreName && newRecord.is_active) {
                toast.info(`${newRecord.student_name} just uploaded their hall ticket at your centre!`);
              }
            }
          }
        )
        .subscribe();
    }, 100);

    return () => {
      clearTimeout(timer);
      if (channel) void supabase.removeChannel(channel);
    };
  }, [centreName, examType, qc]);

  return { ...query, lastRefreshed };
}
