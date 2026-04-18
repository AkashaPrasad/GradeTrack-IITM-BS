import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Bug, Lightbulb, HelpCircle, Clock, MessageSquare, Pencil } from 'lucide-react';
import { useTitle } from '@/lib/hooks';
import { useAuth } from '@/stores/auth';
import { supabase } from '@/lib/supabase';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/Card';
import { Input, Textarea } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Skeleton } from '@/components/ui/Skeleton';
import { Empty } from '@/components/ui/Empty';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { Ticket, TicketKind, TicketStatus } from '@/lib/database.types';

const stagger = { hidden: {}, visible: { transition: { staggerChildren: 0.04 } } };
const fadeUp = { hidden: { opacity: 0, y: 8 }, visible: { opacity: 1, y: 0 } };

const KIND_ICONS = { bug: Bug, suggestion: Lightbulb, question: HelpCircle };
const STATUS_VARIANT: Record<TicketStatus, 'danger' | 'warning' | 'success' | 'muted'> = {
  open: 'warning',
  in_progress: 'info' as any,
  resolved: 'success',
  closed: 'muted',
};

const EDITABLE_STATUSES = new Set<TicketStatus>(['open', 'in_progress']);
const DAILY_TICKET_LIMIT = 2;
const TICKET_LIMIT_MESSAGE = 'Your ticket limit for today is done. Try again tomorrow.';

function startOfTodayIso() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());

  const year = Number(parts.find(part => part.type === 'year')?.value);
  const month = Number(parts.find(part => part.type === 'month')?.value);
  const day = Number(parts.find(part => part.type === 'day')?.value);

  return new Date(Date.UTC(year, month - 1, day, 0, 0, 0) - (5 * 60 + 30) * 60 * 1000).toISOString();
}

export default function Support() {
  useTitle('Support');
  const { profile } = useAuth();
  const qc = useQueryClient();

  const { data: tickets = [], isLoading } = useQuery({
    queryKey: ['my-tickets', profile?.id],
    queryFn: async () => {
      if (!profile) return [];
      const { data } = await supabase
        .from('tickets')
        .select('*')
        .eq('user_id', profile.id)
        .order('created_at', { ascending: false });
      return (data ?? []) as Ticket[];
    },
    enabled: !!profile
  });

  const [kind, setKind] = useState<TicketKind>('bug');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);

  const editingTicket = tickets.find(ticket => ticket.id === editingId) ?? null;
  const ticketsToday = useMemo(() => {
    const start = new Date(startOfTodayIso());
    return tickets.filter(ticket => new Date(ticket.created_at) >= start).length;
  }, [tickets]);
  const remainingToday = Math.max(0, DAILY_TICKET_LIMIT - ticketsToday);
  const isEditing = !!editingTicket;
  const createDisabled = !isEditing && remainingToday === 0;

  const resetForm = () => {
    setKind('bug');
    setTitle('');
    setBody('');
    setEditingId(null);
  };

  const startEditing = (ticket: Ticket) => {
    setEditingId(ticket.id);
    setKind(ticket.kind);
    setTitle(ticket.title);
    setBody(ticket.body ?? '');
  };

  const saveTicket = useMutation({
    mutationFn: async () => {
      if (!profile?.id) throw new Error('Not signed in');

      const trimmedTitle = title.trim().slice(0, 200);
      const trimmedBody = body.trim().slice(0, 5000) || null;
      if (!trimmedTitle) throw new Error('Title is required');

      if (editingTicket) {
        const { error } = await supabase
          .from('tickets')
          .update({ kind, title: trimmedTitle, body: trimmedBody })
          .eq('id', editingTicket.id)
          .eq('user_id', profile.id);
        if (error) throw error;
        return 'updated' as const;
      }

      const { count, error: countError } = await supabase
        .from('tickets')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', profile.id)
        .gte('created_at', startOfTodayIso());
      if (countError) throw countError;
      if ((count ?? 0) >= DAILY_TICKET_LIMIT) {
        throw new Error(TICKET_LIMIT_MESSAGE);
      }

      const { error } = await supabase.from('tickets').insert({
        user_id: profile.id,
        kind,
        title: trimmedTitle,
        body: trimmedBody
      });
      if (error) throw error;
      return 'created' as const;
    },
    onSuccess: (mode) => {
      toast.success(mode === 'updated' ? 'Ticket updated' : 'Ticket submitted — we\'ll get back to you soon');
      resetForm();
      qc.invalidateQueries({ queryKey: ['my-tickets', profile?.id] });
      qc.invalidateQueries({ queryKey: ['admin-tickets'] });
    },
    onError: (e: unknown) => {
      const msg = e instanceof Error ? e.message : null;
      const safe = msg === 'Title is required' || msg === 'Not signed in' || msg === TICKET_LIMIT_MESSAGE || msg === 'You can submit only 2 tickets per day.';
      toast.error(safe ? msg : isEditing ? 'Failed to update ticket. Please try again.' : 'Failed to submit. Please try again.');
    }
  });

  return (
    <motion.div initial="hidden" animate="visible" variants={stagger} className="p-4 md:p-6 max-w-2xl mx-auto space-y-5">
      <motion.div variants={fadeUp}>
        <h1 className="text-lg font-bold tracking-tightest">Support</h1>
        <p className="text-sm text-fgmuted">Report bugs, suggest features, or ask a question.</p>
      </motion.div>

      <motion.div variants={fadeUp}>
        <Card>
          <CardHeader>
            <CardTitle>{isEditing ? 'Edit ticket' : 'New ticket'}</CardTitle>
          </CardHeader>
          <CardBody className="space-y-3">
            <div className="rounded-md border border-border bg-surface2/50 px-3 py-2 text-[12px] text-fgmuted">
              You can submit up to <span className="font-semibold text-fg">2 tickets per day</span>.
              {isEditing ? ' Editing a ticket does not count toward the limit.' : ` ${remainingToday} submission${remainingToday === 1 ? '' : 's'} left today.`}
            </div>

            {createDisabled && !isEditing && (
              <div className="rounded-md border border-warning/30 bg-warning/10 px-3 py-2 text-[12px] text-warning">
                {TICKET_LIMIT_MESSAGE}
              </div>
            )}

            <div className="flex gap-2">
              {(['bug', 'suggestion', 'question'] as const).map(k => {
                const Icon = KIND_ICONS[k];
                return (
                  <button
                    key={k}
                    onClick={() => setKind(k)}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[12px] font-medium capitalize transition-colors ${
                      kind === k ? 'bg-accent/15 text-accent' : 'bg-surface2 text-fgmuted hover:text-fg'
                    }`}
                  >
                    <Icon className="h-3 w-3" /> {k}
                  </button>
                );
              })}
            </div>

            <Input
              placeholder="Title — what's the issue?"
              value={title}
              onChange={e => setTitle(e.target.value)}
              maxLength={200}
            />

            <Textarea
              placeholder="Details (optional) — steps to reproduce, expected behaviour, your suggestion…"
              value={body}
              onChange={e => setBody(e.target.value)}
              rows={4}
              maxLength={5000}
            />

            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                onClick={() => saveTicket.mutate()}
                loading={saveTicket.isPending}
                disabled={createDisabled}
              >
                {isEditing ? 'Save changes' : 'Submit ticket'}
              </Button>
              {isEditing && (
                <Button size="sm" variant="ghost" onClick={resetForm} disabled={saveTicket.isPending}>
                  Cancel edit
                </Button>
              )}
            </div>
          </CardBody>
        </Card>
      </motion.div>

      <motion.div variants={fadeUp}>
        <h2 className="text-[13px] font-semibold text-fgmuted mb-2">Your tickets</h2>
        {isLoading ? (
          <div className="space-y-2"><Skeleton className="h-20" /><Skeleton className="h-20" /></div>
        ) : tickets.length === 0 ? (
          <Empty title="No tickets yet" description="Your submitted tickets will appear here." />
        ) : (
          <div className="space-y-2">
            {tickets.map(ticket => {
              const Icon = KIND_ICONS[ticket.kind];
              const editable = EDITABLE_STATUSES.has(ticket.status);
              return (
                <Card key={ticket.id}>
                  <CardBody className="py-3 space-y-1.5">
                    <div className="flex items-start gap-2 justify-between">
                      <div className="flex items-center gap-2 min-w-0">
                        <Icon className="h-3.5 w-3.5 text-fgmuted shrink-0" />
                        <span className="text-[13px] font-medium truncate">{ticket.title}</span>
                      </div>
                      <Badge variant={STATUS_VARIANT[ticket.status] ?? 'muted'}>{ticket.status.replace('_', ' ')}</Badge>
                    </div>
                    {ticket.body && <p className="text-[12px] text-fgmuted">{ticket.body}</p>}
                    {ticket.admin_reply && (
                      <div className="rounded-md bg-accent/8 border border-accent/20 p-2.5 flex items-start gap-2">
                        <MessageSquare className="h-3.5 w-3.5 text-accent shrink-0 mt-0.5" />
                        <p className="text-[12px] text-fg">{ticket.admin_reply}</p>
                      </div>
                    )}
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-1 text-[11px] text-fgsubtle">
                        <Clock className="h-3 w-3" />
                        {new Date(ticket.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </div>
                      {editable && (
                        <div className="flex items-center gap-2">
                          <Button size="sm" variant="ghost" onClick={() => startEditing(ticket)} disabled={saveTicket.isPending}>
                            <Pencil className="h-3.5 w-3.5" />
                            Edit
                          </Button>
                        </div>
                      )}
                    </div>
                  </CardBody>
                </Card>
              );
            })}
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}
