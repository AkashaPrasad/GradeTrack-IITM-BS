import { useState } from 'react';
import { useTitle } from '@/lib/hooks';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/stores/auth';
import { Card, CardBody } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input, Label } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Switch } from '@/components/ui/Switch';
import { Dialog, DialogTrigger, DialogContent, DialogTitle, DialogClose } from '@/components/ui/Dialog';
import { Skeleton } from '@/components/ui/Skeleton';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { formatDate } from '@/lib/utils';
import type { Term } from '@/lib/database.types';

export default function AdminTerms() {
  useTitle('Admin — Terms');
  const { profile } = useAuth();
  const qc = useQueryClient();

  const { data: terms = [], isLoading } = useQuery({
    queryKey: ['admin-terms'],
    queryFn: async () => {
      const { data } = await supabase.from('terms').select('*').order('start_date', { ascending: false });
      return (data ?? []) as Term[];
    }
  });

  const [editing, setEditing] = useState<Partial<Term> | null>(null);

  const saveMut = useMutation({
    mutationFn: async (t: Partial<Term>) => {
      if (t.id) {
        const { error } = await supabase.from('terms').update(t).eq('id', t.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('terms').insert({ ...t, created_by: profile?.id });
        if (error) throw error;
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-terms'] }); qc.invalidateQueries({ queryKey: ['activeTerm'] }); setEditing(null); toast.success('Saved'); },
    onError: (e: any) => toast.error(e?.message ?? 'Failed')
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('terms').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-terms'] }); toast.success('Deleted'); },
    onError: (e: any) => toast.error(e?.message ?? 'Failed')
  });

  return (
    <div className="p-5 max-w-3xl space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold tracking-tightest">Terms</h1>
        <Dialog open={editing !== null && !editing.id} onOpenChange={o => { if (!o) setEditing(null); }}>
          <DialogTrigger asChild>
            <Button size="sm" onClick={() => setEditing({ name: '', start_date: '', end_date: '', is_active: false })}>
              <Plus className="h-4 w-4" />New term
            </Button>
          </DialogTrigger>
          <TermDialog term={editing} onSave={t => saveMut.mutate(t)} loading={saveMut.isPending} onClose={() => setEditing(null)} />
        </Dialog>
      </div>

      {isLoading ? [...Array(3)].map((_, i) => <Skeleton key={i} className="h-16" />) : (
        <div className="space-y-2">
          {terms.map(term => (
            <Card key={term.id}>
              <CardBody className="flex items-center gap-3 py-3">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold flex items-center gap-2">
                    {term.name}
                    {term.is_active && <Badge variant="success">Active</Badge>}
                  </div>
                  <div className="text-[12px] text-fgmuted">{formatDate(term.start_date)} → {formatDate(term.end_date)}</div>
                </div>
                <label className="flex items-center gap-1.5 text-[12px]">
                  <Switch checked={term.is_active} onCheckedChange={v => saveMut.mutate({ ...term, is_active: v })} />
                  Active
                </label>
                <Dialog open={editing?.id === term.id} onOpenChange={o => { if (!o) setEditing(null); }}>
                  <DialogTrigger asChild>
                    <Button variant="ghost" size="icon" onClick={() => setEditing(term)}><Pencil className="h-3.5 w-3.5" /></Button>
                  </DialogTrigger>
                  <TermDialog term={editing} onSave={t => saveMut.mutate(t)} loading={saveMut.isPending} onClose={() => setEditing(null)} />
                </Dialog>
                <Button variant="ghost" size="icon" className="text-danger" onClick={() => { if (confirm('Delete term?')) deleteMut.mutate(term.id); }}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </CardBody>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function TermDialog({ term, onSave, loading, onClose }: { term: Partial<Term> | null; onSave: (t: any) => void; loading: boolean; onClose: () => void }) {
  const [form, setForm] = useState(term ?? {});
  if (!term) return null;
  const set = (k: string, v: any) => setForm(p => ({ ...p, [k]: v }));
  return (
    <DialogContent>
      <DialogTitle>{term.id ? 'Edit term' : 'New term'}</DialogTitle>
      <div className="mt-4 space-y-3">
        <div><Label>Name</Label><Input className="mt-1" value={(form as any).name ?? ''} onChange={e => set('name', e.target.value)} /></div>
        <div><Label>Start date</Label><Input type="date" className="mt-1" value={(form as any).start_date ?? ''} onChange={e => set('start_date', e.target.value)} /></div>
        <div><Label>End date</Label><Input type="date" className="mt-1" value={(form as any).end_date ?? ''} onChange={e => set('end_date', e.target.value)} /></div>
        <label className="flex items-center gap-2 text-sm"><Switch checked={(form as any).is_active ?? false} onCheckedChange={v => set('is_active', v)} />Active term</label>
      </div>
      <div className="flex gap-2 mt-5">
        <Button onClick={() => onSave(form)} loading={loading} className="flex-1">Save</Button>
        <DialogClose asChild><Button variant="secondary" onClick={onClose} className="flex-1">Cancel</Button></DialogClose>
      </div>
    </DialogContent>
  );
}
