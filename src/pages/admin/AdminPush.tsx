import { useState } from 'react';
import { useTitle } from '@/lib/hooks';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Card, CardBody } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input, Label } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '@/components/ui/Select';
import { toast } from 'sonner';
import { Megaphone, Bell, Send } from 'lucide-react';
import { useCreateNotification } from '@/hooks/useData';
import { toUserMessage } from '@/lib/utils';

export default function AdminPush() {
  useTitle('Admin — Push');

  // Push test state
  const [pushTitle, setPushTitle] = useState('GradeTrack');
  const [pushBody, setPushBody] = useState('');
  const [sending, setSending] = useState(false);

  // Announcement state
  const [annTitle, setAnnTitle] = useState('');
  const [annBody, setAnnBody] = useState('');
  const [annLevel, setAnnLevel] = useState<string>('__all__');
  const [alsoPush, setAlsoPush] = useState(false);

  const createNotif = useCreateNotification();

  const { data: subscribedCount } = useQuery({
    queryKey: ['push-subs-count'],
    queryFn: async () => {
      const { count } = await supabase
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .not('push_subscription', 'is', null);
      return count ?? 0;
    }
  });

  const sendPushTest = async () => {
    if (!pushBody.trim()) { toast.error('Enter a message body'); return; }
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
          body: JSON.stringify({ testMode: true, title: pushTitle, body: pushBody })
        }
      );
      if (!res.ok) throw new Error(await res.text());
      toast.success('Test push sent to all subscribed users');
    } catch {
      toast.error('Failed to send test notification. Check edge function logs.');
    } finally {
      setSending(false);
    }
  };

  const sendAnnouncement = async () => {
    const trimmedTitle = annTitle.trim();
    if (!trimmedTitle) { toast.error('Title is required'); return; }

    try {
      await createNotif.mutateAsync({
        title: trimmedTitle,
        body: annBody.trim() || undefined,
        kind: 'announcement',
        target_level: annLevel === '__all__' ? null : annLevel,
      });

      // Optionally also send as a push notification
      if (alsoPush) {
        const { data: session } = await supabase.auth.getSession();
        const res = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-deadline-reminders`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${session.session?.access_token}`
            },
            body: JSON.stringify({ testMode: true, title: trimmedTitle, body: annBody.trim() || trimmedTitle })
          }
        );
        if (!res.ok) toast.error('Announcement saved but push delivery failed — check edge function logs.');
        else toast.success('Announcement published and push sent');
      } else {
        toast.success('Announcement published — visible to all students in-app');
      }

      setAnnTitle(''); setAnnBody(''); setAnnLevel('__all__'); setAlsoPush(false);
    } catch (e) {
      toast.error(toUserMessage(e, 'Failed to publish announcement'));
    }
  };

  return (
    <div className="p-5 max-w-2xl space-y-5">
      <div>
        <h1 className="text-lg font-bold tracking-tightest">Push & Notifications</h1>
        <p className="text-sm text-fgmuted">Send announcements to students and manage push notifications.</p>
      </div>

      {/* Devices stat */}
      <Card>
        <CardBody className="space-y-1">
          <div className="text-sm font-medium">Subscribed devices</div>
          <div className="text-2xl font-bold num">{subscribedCount ?? '—'}</div>
          <div className="text-[12px] text-fgmuted">Automatic deadline reminders run daily at 03:00 UTC via pg_cron.</div>
        </CardBody>
      </Card>

      {/* ── Announcement (in-app + optional push) ── */}
      <Card>
        <CardBody className="space-y-3">
          <div className="flex items-center gap-2">
            <Megaphone className="h-4 w-4 text-accent" />
            <div className="text-sm font-semibold">Send announcement</div>
          </div>
          <p className="text-[12px] text-fgmuted -mt-1">
            Announcements appear in the in-app notification bell for all students. Optionally also send as a push notification.
          </p>

          <div>
            <Label>Title</Label>
            <Input
              className="mt-1"
              placeholder="e.g. Assignment deadline extended"
              value={annTitle}
              onChange={e => setAnnTitle(e.target.value)}
              maxLength={200}
            />
          </div>
          <div>
            <Label>Body (optional)</Label>
            <Textarea
              className="mt-1"
              rows={3}
              placeholder="Details about this announcement…"
              value={annBody}
              onChange={e => setAnnBody(e.target.value)}
              maxLength={1000}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Target audience</Label>
              <Select value={annLevel} onValueChange={setAnnLevel}>
                <SelectTrigger className="mt-1 w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">All students</SelectItem>
                  <SelectItem value="foundation">Foundation only</SelectItem>
                  <SelectItem value="diploma">Diploma only</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <label className="flex items-center gap-2 text-[13px] cursor-pointer">
            <input
              type="checkbox"
              checked={alsoPush}
              onChange={e => setAlsoPush(e.target.checked)}
              className="accent-accent"
            />
            Also send as push notification to subscribed devices
          </label>

          <Button
            onClick={sendAnnouncement}
            loading={createNotif.isPending}
            disabled={!annTitle.trim()}
            className="gap-2"
          >
            <Send className="h-3.5 w-3.5" />
            Publish announcement
          </Button>
        </CardBody>
      </Card>

      {/* ── Push test ── */}
      <Card>
        <CardBody className="space-y-3">
          <div className="flex items-center gap-2">
            <Bell className="h-4 w-4 text-fgmuted" />
            <div className="text-sm font-semibold">Test push notification</div>
          </div>
          <p className="text-[12px] text-fgmuted -mt-1">
            Sends directly to all subscribed devices without creating an in-app notification.
          </p>
          <div>
            <Label>Title</Label>
            <Input className="mt-1" value={pushTitle} onChange={e => setPushTitle(e.target.value)} />
          </div>
          <div>
            <Label>Body</Label>
            <Textarea className="mt-1" rows={2} value={pushBody} onChange={e => setPushBody(e.target.value)} placeholder="Your message…" />
          </div>
          <Button onClick={sendPushTest} loading={sending} disabled={!pushBody.trim()} variant="secondary">
            Send push only
          </Button>
          <p className="text-[11px] text-fgsubtle">
            Calls the edge function in test mode — all subscribed users receive the push immediately.
          </p>
        </CardBody>
      </Card>

      {/* Schedule info */}
      <Card>
        <CardBody className="space-y-2">
          <div className="text-sm font-semibold">Automatic schedule</div>
          <div className="text-[13px] text-fgmuted space-y-1">
            <p>• <strong>Assignment reminders:</strong> 1 and 3 days before each deadline.</p>
            <p>• <strong>Exam reminders:</strong> 7 and 1 day before each exam date.</p>
            <p>• Runs daily at 03:00 UTC via pg_cron → edge function.</p>
          </div>
          <Badge variant="success">Configured in supabase/schema.sql</Badge>
        </CardBody>
      </Card>
    </div>
  );
}
