import { useState } from 'react';
import { useTitle } from '@/lib/hooks';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/stores/auth';
import { Card, CardBody } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input, Label, Textarea } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Switch } from '@/components/ui/Switch';
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '@/components/ui/Select';
import { Dialog, DialogTrigger, DialogContent, DialogTitle, DialogClose } from '@/components/ui/Dialog';
import { Skeleton } from '@/components/ui/Skeleton';
import { Empty } from '@/components/ui/Empty';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, Eye, EyeOff } from 'lucide-react';
import { formatDate, toUserMessage } from '@/lib/utils';
import type { Assignment, Term, Subject } from '@/lib/database.types';

const CATEGORIES = ['weekly','quiz','endterm','oppe','project','bonus','roe','bpt','ka','extra'] as const;

export default function AdminAssignments() {
  useTitle('Admin — Assignments');
  const { profile } = useAuth();
  const qc = useQueryClient();
  const [termId, setTermId] = useState<string>('');
  const [editing, setEditing] = useState<Partial<Assignment> | null>(null);

  const { data: terms = [] } = useQuery({
    queryKey: ['admin-terms'],
    queryFn: async () => {
      const { data } = await supabase.from('terms').select('*').order('start_date', { ascending: false });
      return (data ?? []) as Term[];
    }
  });

  const activeTerm = terms.find(t => t.is_active);
  const selectedTerm = termId || activeTerm?.id || '';

  const { data: subjects = [] } = useQuery({
    queryKey: ['admin-subjects', selectedTerm],
    queryFn: async () => {
      if (!selectedTerm) return [];
      const { data } = await supabase.from('subjects').select('*').eq('term_id', selectedTerm);
      return (data ?? []) as Subject[];
    },
    enabled: !!selectedTerm
  });

  const { data: assignments = [], isLoading } = useQuery({
    queryKey: ['admin-assignments', selectedTerm],
    queryFn: async () => {
      if (!selectedTerm) return [];
      const { data } = await supabase.from('assignments').select('*').eq('term_id', selectedTerm).order('week_number', { nullsFirst: false }).order('created_at');
      return (data ?? []) as Assignment[];
    },
    enabled: !!selectedTerm
  });

  const saveMut = useMutation({
    mutationFn: async (a: Partial<Assignment>) => {
      if (a.category === 'weekly' && !a.subject_id) {
        throw new Error('Weekly assignments must be linked to a subject.');
      }
      if (a.category === 'weekly' && !a.week_number) {
        throw new Error('Weekly assignments must have a week number.');
      }

      const subject = a.subject_id ? subjects.find(s => s.id === a.subject_id) : undefined;
      const payload = {
        ...a,
        term_id: selectedTerm,
        created_by: profile?.id,
        level: subject?.level ?? a.level ?? null,
        title: a.category === 'weekly' && a.week_number ? `Week ${a.week_number}` : a.title
      };

      if (a.id) {
        const { error } = await supabase.from('assignments').update(payload).eq('id', a.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('assignments').insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-assignments', selectedTerm] }); setEditing(null); toast.success('Saved'); },
    onError: (e: unknown) => toast.error(toUserMessage(e, 'Failed to save assignment'))
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('assignments').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-assignments', selectedTerm] }); toast.success('Deleted'); },
    onError: (e: unknown) => toast.error(toUserMessage(e, 'Failed to delete assignment'))
  });

  const togglePublish = (a: Assignment) => saveMut.mutate({ ...a, is_published: !a.is_published });

  return (
    <div className="p-5 max-w-4xl space-y-4">
      <div className="flex flex-wrap items-center gap-3 justify-between">
        <h1 className="text-lg font-bold tracking-tightest">Assignments</h1>
        <div className="flex gap-2">
          <Select value={selectedTerm} onValueChange={setTermId}>
            <SelectTrigger className="w-44"><SelectValue placeholder="Select term" /></SelectTrigger>
            <SelectContent>
              {terms.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Dialog open={!!editing && !editing.id} onOpenChange={o => { if (!o) setEditing(null); }}>
            <DialogTrigger asChild>
              <Button size="sm" onClick={() => setEditing({ title: '', category: 'weekly', is_published: true })}>
                <Plus className="h-4 w-4" />New
              </Button>
            </DialogTrigger>
            <AssignmentDialog a={editing} subjects={subjects} onSave={saveMut.mutate} loading={saveMut.isPending} onClose={() => setEditing(null)} />
          </Dialog>
        </div>
      </div>

      {!selectedTerm ? <Empty title="Select a term" /> :
        isLoading ? [...Array(4)].map((_, i) => <Skeleton key={i} className="h-14" />) :
        assignments.length === 0 ? <Empty title="No assignments" description="Create the first one." /> : (
          <div className="space-y-1.5">
            {assignments.map(a => (
              <Card key={a.id} className={!a.is_published ? 'opacity-60' : ''}>
                <CardBody className="py-2.5 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium flex items-center gap-2 flex-wrap">
                      {a.title}
                      <Badge variant="muted">{a.category}</Badge>
                      {a.week_number && <Badge variant="muted">W{a.week_number}</Badge>}
                      {a.level && <Badge variant="accent">{a.level}</Badge>}
                      {!a.is_published && <Badge variant="warning">Draft</Badge>}
                    </div>
                    <div className="text-[11px] text-fgmuted mt-0.5 flex flex-wrap gap-2">
                      {a.foundation_deadline && <span>Foundation: {formatDate(a.foundation_deadline)}</span>}
                      {a.degree_diploma_deadline && <span>Diploma: {formatDate(a.degree_diploma_deadline)}</span>}
                      {a.exam_date && <span>Exam: {formatDate(a.exam_date)}</span>}
                    </div>
                  </div>
                  <button onClick={() => togglePublish(a)} title={a.is_published ? 'Unpublish' : 'Publish'} className="p-1.5 rounded text-fgmuted hover:text-fg">
                    {a.is_published ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                  </button>
                  <Dialog open={editing?.id === a.id} onOpenChange={o => { if (!o) setEditing(null); }}>
                    <DialogTrigger asChild>
                      <Button variant="ghost" size="icon" onClick={() => setEditing(a)}><Pencil className="h-3.5 w-3.5" /></Button>
                    </DialogTrigger>
                    <AssignmentDialog a={editing} subjects={subjects} onSave={saveMut.mutate} loading={saveMut.isPending} onClose={() => setEditing(null)} />
                  </Dialog>
                  <DeleteButton onConfirm={() => deleteMut.mutate(a.id)} />
                </CardBody>
              </Card>
            ))}
          </div>
        )}
    </div>
  );
}

function DeleteButton({ onConfirm }: { onConfirm: () => void }) {
  const [confirming, setConfirming] = useState(false);
  if (confirming) {
    return (
      <div className="flex items-center gap-1">
        <Button variant="ghost" size="sm" className="text-danger h-7 px-2 text-xs" onClick={() => { onConfirm(); setConfirming(false); }}>Yes, delete</Button>
        <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => setConfirming(false)}>Cancel</Button>
      </div>
    );
  }
  return (
    <Button variant="ghost" size="icon" className="text-danger" onClick={() => setConfirming(true)}>
      <Trash2 className="h-3.5 w-3.5" />
    </Button>
  );
}

function AssignmentDialog({ a, subjects, onSave, loading, onClose }: any) {
  const [form, setForm] = useState<Partial<Assignment>>(a ?? {});
  if (!a) return null;
  const set = (k: string, v: any) => setForm(p => ({ ...p, [k]: v }));
  return (
    <DialogContent className="max-h-[90vh] overflow-y-auto">
      <DialogTitle>{a.id ? 'Edit assignment' : 'New assignment'}</DialogTitle>
      <div className="mt-4 space-y-3">
        <div><Label>Title</Label><Input className="mt-1" value={form.title ?? ''} onChange={e => set('title', e.target.value)} /></div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Category</Label>
            <Select value={form.category ?? 'weekly'} onValueChange={v => set('category', v)}>
              <SelectTrigger className="mt-1 w-full"><SelectValue /></SelectTrigger>
              <SelectContent>{CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label>Week #</Label><Input type="number" className="mt-1" value={form.week_number ?? ''} onChange={e => set('week_number', e.target.value ? Number(e.target.value) : null)} /></div>
        </div>
        <div>
          <Label>Level (leave blank for both)</Label>
          <Select value={form.level ?? '__none__'} onValueChange={v => set('level', v === '__none__' ? null : v)}>
            <SelectTrigger className="mt-1 w-full"><SelectValue placeholder="Both" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">Both</SelectItem>
              <SelectItem value="foundation">Foundation</SelectItem>
              <SelectItem value="diploma">Diploma</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Subject (optional)</Label>
          <Select value={form.subject_id ?? '__none__'} onValueChange={v => set('subject_id', v === '__none__' ? null : v)}>
            <SelectTrigger className="mt-1 w-full"><SelectValue placeholder="All subjects" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">All subjects</SelectItem>
              {subjects.map((s: Subject) => <SelectItem key={s.id} value={s.id}>{s.code} — {s.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Foundation deadline</Label><Input type="datetime-local" className="mt-1" value={form.foundation_deadline?.slice(0, 16) ?? ''} onChange={e => set('foundation_deadline', e.target.value || null)} /></div>
          <div><Label>Diploma deadline</Label><Input type="datetime-local" className="mt-1" value={form.degree_diploma_deadline?.slice(0, 16) ?? ''} onChange={e => set('degree_diploma_deadline', e.target.value || null)} /></div>
        </div>
        <div><Label>Exam date</Label><Input type="datetime-local" className="mt-1" value={form.exam_date?.slice(0, 16) ?? ''} onChange={e => set('exam_date', e.target.value || null)} /></div>
        <div><Label>Comments</Label><Textarea className="mt-1" rows={2} value={form.comments ?? ''} onChange={e => set('comments', e.target.value)} /></div>
        <label className="flex items-center gap-2 text-sm"><Switch checked={form.is_published ?? true} onCheckedChange={v => set('is_published', v)} />Published</label>
      </div>
      <div className="flex gap-2 mt-5">
        <Button onClick={() => onSave(form)} loading={loading} className="flex-1">Save</Button>
        <DialogClose asChild><Button variant="secondary" onClick={onClose} className="flex-1">Cancel</Button></DialogClose>
      </div>
    </DialogContent>
  );
}
