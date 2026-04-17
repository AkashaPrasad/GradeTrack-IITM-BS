import { useState } from 'react';
import { useTitle } from '@/lib/hooks';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Card, CardBody } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input, Label } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { toast } from 'sonner';

export default function AdminPush() {
  useTitle('Admin — Push');
  const [title, setTitle] = useState('GradeTrack');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);

  const { data: subscribedCount } = useQuery({
    queryKey: ['push-subs-count'],
    queryFn: async () => {
      const { count } = await supabase.from('profiles').select('id', { count: 'exact', head: true }).not('push_subscription', 'is', null);
      return count ?? 0;
    }
  });

  const sendTest = async () => {
    if (!body.trim()) { toast.error('Enter a message body'); return; }
    setSending(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-deadline-reminders`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.session?.access_token}`
          },
          body: JSON.stringify({ testMode: true, title, body })
        }
      );
      if (!res.ok) throw new Error(await res.text());
      toast.success('Test notification sent to all subscribed users');
    } catch {
      toast.error('Failed to send test notification. Check edge function logs.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="p-5 max-w-2xl space-y-5">
      <div>
        <h1 className="text-lg font-bold tracking-tightest">Push Notifications</h1>
        <p className="text-sm text-fgmuted">Manage and test push notifications to students.</p>
      </div>

      <Card>
        <CardBody className="space-y-1">
          <div className="text-sm font-medium">Subscribed devices</div>
          <div className="text-2xl font-bold num">{subscribedCount ?? '—'}</div>
          <div className="text-[12px] text-fgmuted">Daily reminders run at 03:00 UTC via pg_cron.</div>
        </CardBody>
      </Card>

      <Card>
        <CardBody className="space-y-3">
          <div className="text-sm font-semibold">Send test notification</div>
          <div>
            <Label>Title</Label>
            <Input className="mt-1" value={title} onChange={e => setTitle(e.target.value)} />
          </div>
          <div>
            <Label>Body</Label>
            <Textarea className="mt-1" rows={2} value={body} onChange={e => setBody(e.target.value)} placeholder="Your message…" />
          </div>
          <Button onClick={sendTest} loading={sending} disabled={!body.trim()}>
            Send to all subscribed users
          </Button>
          <p className="text-[11px] text-fgsubtle">
            This calls the edge function in test mode — all subscribed users receive the notification immediately.
          </p>
        </CardBody>
      </Card>

      <Card>
        <CardBody className="space-y-2">
          <div className="text-sm font-semibold">Automatic schedule</div>
          <div className="text-[13px] text-fgmuted space-y-1">
            <p>• <strong>Assignment reminders:</strong> 1 day and 3 days before each deadline.</p>
            <p>• <strong>Exam reminders:</strong> 7 days and 1 day before each exam date.</p>
            <p>• Runs daily at 03:00 UTC via pg_cron → edge function.</p>
          </div>
          <Badge variant="success">Configured in supabase/schema.sql</Badge>
        </CardBody>
      </Card>
    </div>
  );
}
