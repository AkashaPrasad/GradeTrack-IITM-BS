import { useTitle } from '@/lib/hooks';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/Card';
import { Skeleton, SkeletonCard } from '@/components/ui/Skeleton';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip as RTooltip, LineChart, Line, CartesianGrid } from 'recharts';

export default function AdminOverview() {
  useTitle('Admin — Overview');

  const { data: stats, isLoading, isError, refetch } = useQuery({
    queryKey: ['admin-stats'],
    queryFn: async () => {
      const [students, logs, tickets, completions] = await Promise.all([
        supabase.from('profiles').select('id, created_at, last_seen_at, level').eq('role', 'student'),
        supabase.from('app_logs').select('user_id, event_type, created_at, severity').order('created_at', { ascending: false }).limit(500),
        supabase.from('tickets').select('id, status, kind, created_at'),
        supabase.from('assignment_completions').select('id, is_completed, created_at'),
      ]);
      return {
        students: students.data ?? [],
        logs: logs.data ?? [],
        tickets: tickets.data ?? [],
        completions: completions.data ?? [],
      };
    },
    refetchInterval: 30_000,
    retry: 2,
  });

  if (isLoading) return (
    <div className="p-5 space-y-4"><Skeleton className="h-6 w-40" /><div className="grid gap-4 md:grid-cols-4">{[...Array(4)].map((_, i) => <SkeletonCard key={i} />)}</div></div>
  );

  if (isError || !stats) return (
    <div className="p-5 flex flex-col items-start gap-3">
      <p className="text-sm text-fgmuted">Failed to load overview stats.</p>
      <button onClick={() => refetch()} className="text-sm text-accent hover:underline">Retry</button>
    </div>
  );

  const s = stats;
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 86400000);
  const activeThisWeek = s.students.filter(u => u.last_seen_at && new Date(u.last_seen_at) > weekAgo).length;
  const errors = s.logs.filter(l => l.severity === 'error').length;
  const openTickets = s.tickets.filter(t => t.status === 'open').length;
  const foundation = s.students.filter(u => u.level === 'foundation').length;
  const diploma = s.students.filter(u => u.level === 'diploma').length;

  // Daily active users last 14 days
  const dauData: { day: string; users: number }[] = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 86400000);
    const label = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    const dayEnd = dayStart + 86400000;
    const users = new Set(s.logs.filter(l => {
      const t = new Date(l.created_at).getTime();
      return t >= dayStart && t < dayEnd;
    }).map((l: any) => l.user_id)).size;
    dauData.push({ day: label, users });
  }

  // Event type breakdown
  const eventMap = new Map<string, number>();
  s.logs.forEach(l => eventMap.set(l.event_type, (eventMap.get(l.event_type) ?? 0) + 1));
  const eventData = [...eventMap.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8)
    .map(([name, count]) => ({ name, count }));

  return (
    <div className="p-5 space-y-5 max-w-5xl">
      <h1 className="text-lg font-bold tracking-tightest">Overview</h1>

      <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
        {[
          { label: 'Total students', value: s.students.length },
          { label: 'Active this week', value: activeThisWeek },
          { label: 'Open tickets', value: openTickets },
          { label: 'Errors (logs)', value: errors },
        ].map(({ label, value }) => (
          <Card key={label}><CardBody className="py-3">
            <div className="text-[12px] text-fgmuted">{label}</div>
            <div className="text-xl font-bold num">{value}</div>
          </CardBody></Card>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Daily active users (14d)</CardTitle></CardHeader>
          <CardBody className="h-44">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={dauData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="day" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                <RTooltip contentStyle={{ background: 'hsl(var(--surface))', border: '1px solid hsl(var(--border))', borderRadius: 6, fontSize: 12 }} />
                <Line type="monotone" dataKey="users" stroke="hsl(var(--accent))" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </CardBody>
        </Card>
        <Card>
          <CardHeader><CardTitle>Top events</CardTitle></CardHeader>
          <CardBody className="h-44">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={eventData} layout="vertical">
                <XAxis type="number" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                <RTooltip contentStyle={{ background: 'hsl(var(--surface))', border: '1px solid hsl(var(--border))', borderRadius: 6, fontSize: 12 }} />
                <Bar dataKey="count" fill="hsl(var(--accent))" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardBody>
        </Card>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <Card><CardBody>
          <div className="text-[13px] font-semibold mb-2">Level distribution</div>
          <div className="flex gap-6">
            <div><div className="text-2xl font-bold num">{foundation}</div><div className="text-[12px] text-fgmuted">Foundation</div></div>
            <div><div className="text-2xl font-bold num">{diploma}</div><div className="text-[12px] text-fgmuted">Diploma</div></div>
          </div>
        </CardBody></Card>
        <Card><CardBody>
          <div className="text-[13px] font-semibold mb-2">Assignments completed (all time)</div>
          <div className="text-2xl font-bold num">{s.completions.filter(c => c.is_completed).length}</div>
        </CardBody></Card>
      </div>
    </div>
  );
}
