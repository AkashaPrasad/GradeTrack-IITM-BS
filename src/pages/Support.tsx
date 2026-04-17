import { useState } from 'react';
import { motion } from 'framer-motion';
import { Bug, Lightbulb, HelpCircle, Clock, CheckCircle2, MessageSquare } from 'lucide-react';
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
import type { Ticket, TicketKind } from '@/lib/database.types';

const stagger = { hidden: {}, visible: { transition: { staggerChildren: 0.04 } } };
const fadeUp = { hidden: { opacity: 0, y: 8 }, visible: { opacity: 1, y: 0 } };

const KIND_ICONS = { bug: Bug, suggestion: Lightbulb, question: HelpCircle };
const STATUS_VARIANT: Record<string, 'danger' | 'warning' | 'success' | 'muted'> = {
  open: 'warning',
  in_progress: 'info' as any,
  resolved: 'success',
  closed: 'muted',
};

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

  const submit = useMutation({
    mutationFn: async () => {
      if (!profile?.id) throw new Error('Not signed in');
      const trimmedTitle = title.trim().slice(0, 200);
      if (!trimmedTitle) throw new Error('Title is required');
      const { error } = await supabase.from('tickets').insert({
        user_id: profile.id,
        kind,
        title: trimmedTitle,
        body: body.trim().slice(0, 5000) || null
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Ticket submitted — we\'ll get back to you soon');
      setTitle(''); setBody('');
      qc.invalidateQueries({ queryKey: ['my-tickets', profile?.id] });
    },
    onError: (e: unknown) => {
      const msg = e instanceof Error ? e.message : null;
      toast.error(msg === 'Title is required' || msg === 'Not signed in' ? msg : 'Failed to submit. Please try again.');
    }
  });

  return (
    <motion.div initial="hidden" animate="visible" variants={stagger} className="p-4 md:p-6 max-w-2xl mx-auto space-y-5">
      <motion.div variants={fadeUp}>
        <h1 className="text-lg font-bold tracking-tightest">Support</h1>
        <p className="text-sm text-fgmuted">Report bugs, suggest features, or ask a question.</p>
      </motion.div>

      {/* New ticket form */}
      <motion.div variants={fadeUp}>
        <Card>
          <CardHeader><CardTitle>New ticket</CardTitle></CardHeader>
          <CardBody className="space-y-3">
            {/* Kind selector */}
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
            <Button size="sm" onClick={() => submit.mutate()} loading={submit.isPending}>
              Submit ticket
            </Button>
          </CardBody>
        </Card>
      </motion.div>

      {/* Past tickets */}
      <motion.div variants={fadeUp}>
        <h2 className="text-[13px] font-semibold text-fgmuted mb-2">Your tickets</h2>
        {isLoading ? (
          <div className="space-y-2"><Skeleton className="h-20" /><Skeleton className="h-20" /></div>
        ) : tickets.length === 0 ? (
          <Empty title="No tickets yet" description="Your submitted tickets will appear here." />
        ) : (
          <div className="space-y-2">
            {tickets.map(t => {
              const Icon = KIND_ICONS[t.kind];
              return (
                <Card key={t.id}>
                  <CardBody className="py-3 space-y-1.5">
                    <div className="flex items-start gap-2 justify-between">
                      <div className="flex items-center gap-2 min-w-0">
                        <Icon className="h-3.5 w-3.5 text-fgmuted shrink-0" />
                        <span className="text-[13px] font-medium truncate">{t.title}</span>
                      </div>
                      <Badge variant={STATUS_VARIANT[t.status] ?? 'muted'}>{t.status.replace('_', ' ')}</Badge>
                    </div>
                    {t.body && <p className="text-[12px] text-fgmuted">{t.body}</p>}
                    {t.admin_reply && (
                      <div className="rounded-md bg-accent/8 border border-accent/20 p-2.5 flex items-start gap-2">
                        <MessageSquare className="h-3.5 w-3.5 text-accent shrink-0 mt-0.5" />
                        <p className="text-[12px] text-fg">{t.admin_reply}</p>
                      </div>
                    )}
                    <div className="flex items-center gap-1 text-[11px] text-fgsubtle">
                      <Clock className="h-3 w-3" />
                      {new Date(t.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
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
