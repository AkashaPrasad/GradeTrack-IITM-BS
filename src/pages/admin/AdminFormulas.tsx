import { useState } from 'react';
import { useTitle } from '@/lib/hooks';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input, Label, Textarea } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '@/components/ui/Select';
import { Switch } from '@/components/ui/Switch';
import { Skeleton } from '@/components/ui/Skeleton';
import { toast } from 'sonner';
import { validateFormula } from '@/lib/grading/formula';
import { compileFormula } from '@/lib/grading/formula';
import { toUserMessage } from '@/lib/utils';
import type { Subject, Term } from '@/lib/database.types';

export default function AdminFormulas() {
  useTitle('Admin — Formulas');
  const qc = useQueryClient();
  const [termId, setTermId] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);

  const { data: terms = [] } = useQuery({
    queryKey: ['admin-terms'],
    queryFn: async () => {
      const { data } = await supabase.from('terms').select('*').order('start_date', { ascending: false });
      return (data ?? []) as Term[];
    }
  });

  const activeTerm = terms.find(t => t.is_active);
  const selected = termId || activeTerm?.id || '';

  const { data: subjects = [], isLoading } = useQuery({
    queryKey: ['admin-subjects-formulas', selected],
    queryFn: async () => {
      if (!selected) return [];
      const { data } = await supabase.from('subjects').select('*').eq('term_id', selected).order('code');
      return (data ?? []) as Subject[];
    },
    enabled: !!selected
  });

  const saveMut = useMutation({
    mutationFn: async ({ id, grading_config, has_bonus, bonus_max }: Partial<Subject> & { id: string }) => {
      const { error } = await supabase.from('subjects').update({ grading_config, has_bonus, bonus_max, updated_at: new Date().toISOString() }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-subjects-formulas'] }); setEditingId(null); toast.success('Formula saved'); },
    onError: (e: unknown) => toast.error(toUserMessage(e, 'Failed to save formula'))
  });

  return (
    <div className="p-5 max-w-4xl space-y-4">
      <div className="flex items-center gap-3 flex-wrap justify-between">
        <div>
          <h1 className="text-lg font-bold tracking-tightest">Grade Formulas</h1>
          <p className="text-sm text-fgmuted">Edit per-course formula strings. Supports: numbers, +−×÷, parens, max(), min().</p>
        </div>
        <Select value={selected} onValueChange={setTermId}>
          <SelectTrigger className="w-44"><SelectValue placeholder="Select term" /></SelectTrigger>
          <SelectContent>{terms.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent>
        </Select>
      </div>

      {isLoading ? [...Array(4)].map((_, i) => <Skeleton key={i} className="h-24" />) : (
        <div className="space-y-3">
          {subjects.map(s => (
            <FormulaCard
              key={s.id}
              subject={s}
              editing={editingId === s.id}
              onEdit={() => setEditingId(editingId === s.id ? null : s.id)}
              onSave={(patch) => saveMut.mutate({ id: s.id, ...patch })}
              loading={saveMut.isPending}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function FormulaCard({ subject: s, editing, onEdit, onSave, loading }: {
  subject: Subject; editing: boolean; onEdit: () => void; onSave: (p: any) => void; loading: boolean;
}) {
  const [formula, setFormula] = useState(s.grading_config.formula);
  const [bonusFormula, setBonusFormula] = useState(s.grading_config.bonusFormula ?? '');
  const [bonusCap, setBonusCap] = useState(s.grading_config.bonusCap ?? 0);
  const [hasBonus, setHasBonus] = useState(s.has_bonus);
  const [notes, setNotes] = useState(s.grading_config.notes ?? '');

  const validation = validateFormula(formula);
  const bonusValidation = bonusFormula ? validateFormula(bonusFormula) : { ok: true };

  const testFormula = () => {
    if (!validation.ok) { toast.error('Fix formula first'); return; }
    try {
      const vars: Record<string, number> = {};
      (s.grading_config.variables ?? []).forEach((v: string) => vars[v] = 50);
      ['GAA','GAA2','GAA3','GLA','GA','A','B'].forEach(v => vars[v] = vars[v] ?? 5);
      const result = compileFormula(formula).evaluate(vars);
      toast.success(`Test (all inputs=50): T = ${result.toFixed(2)}`);
    } catch (e: any) {
      toast.error(e?.message);
    }
  };

  return (
    <Card>
      <button onClick={onEdit} className="w-full text-left px-4 py-3 flex items-center gap-3">
        <div className="flex-1">
          <div className="text-sm font-semibold">{s.code} — {s.name}</div>
          <code className="text-[11px] text-fgmuted font-mono block mt-0.5 truncate">{s.grading_config.formula}</code>
        </div>
        <div className="flex gap-1.5">
          <Badge variant={s.level === 'foundation' ? 'info' : 'accent'}>{s.level}</Badge>
          {s.has_bonus && <Badge variant="success">+bonus</Badge>}
        </div>
      </button>

      {editing && (
        <CardBody className="border-t border-border space-y-3 pt-4">
          <div>
            <Label>Formula</Label>
            <p className="text-[11px] text-fgsubtle mb-1">
              Variables available: {(s.grading_config.variables ?? []).join(', ')}, GAA, B (bonus)
            </p>
            <Input
              className="font-mono text-[13px]"
              value={formula}
              onChange={e => setFormula(e.target.value)}
            />
            {!validation.ok && <p className="text-[11px] text-danger mt-1">{(validation as any).error}</p>}
          </div>

          <label className="flex items-center gap-2 text-sm">
            <Switch checked={hasBonus} onCheckedChange={setHasBonus} />
            Has bonus marks
          </label>

          {hasBonus && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Bonus formula</Label>
                <Input className="mt-1 font-mono text-[13px]" value={bonusFormula} onChange={e => setBonusFormula(e.target.value)} placeholder="B" />
                {!bonusValidation.ok && <p className="text-[11px] text-danger mt-1">{(bonusValidation as any).error}</p>}
              </div>
              <div>
                <Label>Bonus cap</Label>
                <Input type="number" className="mt-1" value={bonusCap} onChange={e => setBonusCap(Number(e.target.value))} />
              </div>
            </div>
          )}

          <div>
            <Label>Notes (shown to students)</Label>
            <Textarea className="mt-1" rows={2} value={notes} onChange={e => setNotes(e.target.value)} />
          </div>

          <div className="flex gap-2">
            <Button size="sm" variant="secondary" onClick={testFormula}>Test formula</Button>
            <Button size="sm" loading={loading} disabled={!validation.ok || !bonusValidation.ok}
              onClick={() => onSave({
                has_bonus: hasBonus,
                bonus_max: bonusCap,
                grading_config: {
                  ...s.grading_config,
                  formula,
                  bonusFormula: hasBonus && bonusFormula ? bonusFormula : null,
                  bonusCap: hasBonus ? bonusCap : 0,
                  notes
                }
              })}>
              Save
            </Button>
          </div>
        </CardBody>
      )}
    </Card>
  );
}
