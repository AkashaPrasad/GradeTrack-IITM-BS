import { useState } from 'react';
import { useTitle } from '@/lib/hooks';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Card, CardBody } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Textarea } from '@/components/ui/Input';
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '@/components/ui/Select';
import { Dialog, DialogTrigger, DialogContent, DialogTitle, DialogClose } from '@/components/ui/Dialog';
import { Skeleton } from '@/components/ui/Skeleton';
import { Empty } from '@/components/ui/Empty';
import { toast } from 'sonner';
import { Bug, Lightbulb, HelpCircle } from 'lucide-react';
import { formatDate } from '@/lib/utils';
import type { TicketStatus, TicketWithProfile } from '@/lib/database.types';

const kindIcon = { bug: Bug, suggestion: Lightbulb, question: HelpCircle };
const statusVariant: Record<TicketStatus, 'danger' | 'warning' | 'success' | 'muted'> = {
  open: 'danger', in_progress: 'warning', resolved: 'success', closed: 'muted'
};

export default function AdminTickets() {
  useTitle('Admin — Tickets');
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState('open');
  const [selected, setSelected] = useState<TicketWithProfile | null>(null);
  const [reply, setReply] = useState('');

  const { data: tickets = [], isLoading } = useQuery({
    queryKey: ['admin-tickets', statusFilter],
    queryFn: async () => {
      let q = supabase.from('tickets').select('*, profile:profiles(full_name,email)').order('created_at', { ascending: false });
      if (statusFilter !== 'all') q = q.eq('status', statusFilter);
      const { data } = await q;
      return (data ?? []) as TicketWithProfile[];
    }
  });

  const updateMut = useMutation({
    mutationFn: async ({ id, status, admin_reply }: { id: string; status: TicketStatus; admin_reply?: string }) => {
      const { error } = await supabase.from('tickets').update({ status, admin_reply: admin_reply ?? null }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-tickets'] });
      setSelected(null); setReply('');
      toast.success('Ticket updated');
    },
    onError: (e: any) => toast.error(e?.message ?? 'Failed')
  });

  return (
    <div className="p-5 max-w-3xl space-y-4">
      <div className="flex items-center gap-3 justify-between">
        <h1 className="text-lg font-bold tracking-tightest">Tickets</h1>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="open">Open</SelectItem>
            <SelectItem value="in_progress">In progress</SelectItem>
            <SelectItem value="resolved">Resolved</SelectItem>
            <SelectItem value="closed">Closed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? [...Array(4)].map((_, i) => <Skeleton key={i} className="h-16" />) :
        tickets.length === 0 ? <Empty title="No tickets" description="Nothing to review." /> : (
          <div className="space-y-2">
            {tickets.map(t => {
              const Icon = kindIcon[t.kind];
              return (
                <Dialog key={t.id} open={selected?.id === t.id} onOpenChange={o => { if (!o) { setSelected(null); setReply(''); } }}>
                  <DialogTrigger asChild>
                    <Card className="cursor-pointer hover:bg-surface2 transition-colors">
                      <CardBody className="py-3 flex items-start gap-3">
                        <Icon className="h-4 w-4 mt-0.5 text-fgmuted shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium">{t.title}</div>
                          <div className="text-[12px] text-fgmuted mt-0.5 flex flex-wrap gap-2">
                            {(t as any).profile?.email ?? 'Anonymous'} · {formatDate(t.created_at)}
                          </div>
                          {t.admin_reply && <div className="text-[11px] text-success mt-1">↳ {t.admin_reply}</div>}
                        </div>
                        <Badge variant={statusVariant[t.status]}>{t.status.replace('_', ' ')}</Badge>
                      </CardBody>
                    </Card>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogTitle>{t.title}</DialogTitle>
                    <div className="mt-3 space-y-3 text-sm">
                      {t.body && <p className="text-fgmuted">{t.body}</p>}
                      <div className="text-[12px] text-fgsubtle">From: {(t as any).profile?.email ?? 'Anonymous'} · {formatDate(t.created_at)}</div>
                      <div>
                        <label className="text-[13px] font-medium block mb-1">Reply to user</label>
                        <Textarea rows={3} value={reply} onChange={e => setReply(e.target.value)} placeholder="Optional admin reply…" />
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {(['open', 'in_progress', 'resolved', 'closed'] as TicketStatus[]).map(s => (
                          <Button key={s} size="sm" variant={t.status === s ? 'primary' : 'secondary'}
                            onClick={() => { setSelected(t); updateMut.mutate({ id: t.id, status: s, admin_reply: reply || t.admin_reply || undefined }); }}>
                            {s.replace('_', ' ')}
                          </Button>
                        ))}
                      </div>
                    </div>
                    <DialogClose asChild><Button variant="ghost" size="sm" className="mt-2">Close</Button></DialogClose>
                  </DialogContent>
                </Dialog>
              );
            })}
          </div>
        )}
    </div>
  );
}
