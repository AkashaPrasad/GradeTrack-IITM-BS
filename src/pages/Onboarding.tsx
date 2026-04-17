import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '@/stores/auth';
import { supabase } from '@/lib/supabase';
import { useTitle } from '@/lib/hooks';
import { Button } from '@/components/ui/Button';
import { Label } from '@/components/ui/Input';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { Subject } from '@/lib/database.types';
import { toast } from 'sonner';

export default function Onboarding() {
  useTitle('Get started');
  const { profile, updateProfile } = useAuth();
  const nav = useNavigate();
  const qc = useQueryClient();

  const [step, setStep] = useState<1 | 2>(1);
  const [level, setLevel] = useState<'foundation' | 'diploma'>(profile?.level ?? 'foundation');
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Roll number is auto-derived from the email prefix (e.g. 25f3003984@ds.study.iitm.ac.in)
  const autoRollNumber = profile?.email?.split('@')[0] ?? null;

  const { data: subjects = [], isLoading: subjectsLoading, isError: subjectsError } = useQuery({
    queryKey: ['subjects', level],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('subjects')
        .select('*')
        .eq('level', level)
        .order('code');
      if (error) throw error;
      return (data ?? []) as Subject[];
    },
    enabled: !!profile
  });

  const enrollMut = useMutation({
    mutationFn: async () => {
      if (!profile) throw new Error('No profile');
      await supabase.from('enrolments').delete().eq('user_id', profile.id);
      if (selected.size > 0) {
        await supabase.from('enrolments').insert(
          [...selected].map(sid => ({ user_id: profile.id, subject_id: sid }))
        );
      }
      for (const sid of selected) {
        await supabase.from('grades').upsert(
          { user_id: profile.id, subject_id: sid },
          { onConflict: 'user_id,subject_id' }
        );
      }
      await updateProfile({ level, roll_number: autoRollNumber, onboarded: true });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['enrolments'] });
      qc.invalidateQueries({ queryKey: ['grades'] });
      nav('/dashboard', { replace: true });
    },
    onError: (e: any) => toast.error(e?.message ?? 'Failed to save')
  });

  const toggle = (id: string) => {
    setSelected(prev => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  };

  return (
    <div className="min-h-screen grid place-items-center p-6">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-lg"
      >
        <h1 className="text-xl font-bold tracking-tightest">Welcome to GradeTrack</h1>
        <p className="mt-1 text-sm text-fgmuted">
          Let's set up your profile so we show you the right courses and deadlines.
        </p>

        {step === 1 && (
          <div className="mt-6 space-y-5">
            <div>
              <Label>Your current level</Label>
              <div className="mt-2 grid grid-cols-2 gap-3">
                {(['foundation', 'diploma'] as const).map(l => (
                  <button
                    key={l}
                    onClick={() => { setLevel(l); setSelected(new Set()); }}
                    className={`rounded-lg p-4 text-left hairline transition-colors ${
                      level === l
                        ? 'bg-accent/10 border-accent shadow-ring'
                        : 'bg-surface hover:bg-surface2'
                    }`}
                  >
                    <div className="text-sm font-semibold capitalize">{l}</div>
                    <div className="text-[12px] text-fgmuted mt-0.5">
                      {l === 'foundation' ? '8 courses · Sem 1–2' : '13 courses · Diploma level'}
                    </div>
                  </button>
                ))}
              </div>
            </div>
            <Button onClick={() => setStep(2)} className="w-full">Next — Choose courses</Button>
          </div>
        )}

        {step === 2 && (
          <div className="mt-6">
            <p className="text-sm text-fgmuted mb-3">
              Select the courses you're taking this term. You can change this later in Profile.
            </p>
            {subjectsLoading ? (
              <div className="space-y-2">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="h-14 rounded-lg bg-surface2 animate-pulse" />
                ))}
              </div>
            ) : subjectsError ? (
              <div className="rounded-lg bg-danger/10 border border-danger/20 p-4 text-sm text-danger">
                Could not load courses. Check your Supabase connection and make sure seed.sql has been run in the SQL editor.
              </div>
            ) : subjects.length === 0 ? (
              <div className="rounded-lg bg-warning/10 border border-warning/20 p-4 text-sm text-warning">
                No courses found for {level} level. Go to your Supabase SQL editor and run <strong>seed.sql</strong> to populate the Jan 2026 term.
              </div>
            ) : (
              <div className="space-y-2 max-h-[50vh] overflow-y-auto scrollbar-thin pr-1">
                {subjects.map((s, i) => (
                  <motion.button
                    key={s.id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.04 }}
                    onClick={() => toggle(s.id)}
                    className={`w-full text-left rounded-lg p-3 hairline transition-colors flex items-center gap-3 ${
                      selected.has(s.id)
                        ? 'bg-accent/10 border-accent/40'
                        : 'bg-surface hover:bg-surface2'
                    }`}
                  >
                    <div className={`h-4 w-4 rounded border transition-colors grid place-items-center ${
                      selected.has(s.id)
                        ? 'bg-accent border-accent text-white'
                        : 'border-borderstrong'
                    }`}>
                      {selected.has(s.id) && (
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4"><path d="M20 6L9 17l-5-5" /></svg>
                      )}
                    </div>
                    <div>
                      <div className="text-sm font-medium">{s.name}</div>
                      <div className="text-[12px] text-fgmuted">{s.code} · {s.credits} credits</div>
                    </div>
                  </motion.button>
                ))}
              </div>
            )}
            <div className="flex gap-3 mt-5">
              <Button variant="secondary" onClick={() => setStep(1)} className="flex-1">Back</Button>
              <Button
                onClick={() => enrollMut.mutate()}
                loading={enrollMut.isPending}
                disabled={selected.size === 0 || subjectsLoading || !!subjectsError}
                className="flex-1"
              >
                Start tracking {selected.size > 0 ? `(${selected.size})` : ''}
              </Button>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}
