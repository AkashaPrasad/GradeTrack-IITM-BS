import { useState } from 'react';
import { useTitle } from '@/lib/hooks';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Card, CardBody } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { Empty } from '@/components/ui/Empty';
import { Search, Download } from 'lucide-react';
import { formatDate, initialOf } from '@/lib/utils';
import type { Profile } from '@/lib/database.types';

export default function AdminStudents() {
  useTitle('Admin — Students');
  const [q, setQ] = useState('');

  const { data: students = [], isLoading } = useQuery({
    queryKey: ['admin-students'],
    queryFn: async () => {
      // Exclude push_subscription (contains browser push endpoint + auth keys — not needed here)
      const { data } = await supabase
        .from('profiles')
        .select('id, email, full_name, avatar_url, roll_number, level, role, onboarded, last_seen_at, created_at')
        .eq('role', 'student')
        .order('created_at');
      return (data ?? []) as Profile[];
    }
  });

  const filtered = students.filter(s =>
    !q || s.email.includes(q) || (s.full_name ?? '').toLowerCase().includes(q.toLowerCase()) || (s.roll_number ?? '').includes(q)
  );

  const exportCsv = () => {
    const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
    const header = 'Name,Email,Roll Number,Level,Onboarded,Last Seen\n';
    const rows = students.map(s =>
      [s.full_name ?? '', s.email, s.roll_number ?? '', s.level ?? '', String(s.onboarded), s.last_seen_at ? formatDate(s.last_seen_at) : '']
        .map(esc).join(',')
    ).join('\n');
    const blob = new Blob([header + rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'students.csv'; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  };

  return (
    <div className="p-5 max-w-4xl space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-lg font-bold tracking-tightest">Students <span className="text-fgmuted font-normal text-sm">({students.length})</span></h1>
        <Button variant="secondary" size="sm" onClick={exportCsv}><Download className="h-3.5 w-3.5" />Export CSV</Button>
      </div>

      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-fgsubtle" />
        <Input className="pl-8" placeholder="Search by name, email or roll number…" value={q} onChange={e => setQ(e.target.value)} />
      </div>

      {isLoading ? [...Array(5)].map((_, i) => <Skeleton key={i} className="h-14" />) :
        filtered.length === 0 ? <Empty title="No students found" /> : (
          <div className="space-y-1.5">
            {filtered.map(s => (
              <Card key={s.id}>
                <CardBody className="py-2.5 flex items-center gap-3">
                  {s.avatar_url
                    ? <img src={s.avatar_url} alt="" className="h-8 w-8 rounded-full" />
                    : <div className="h-8 w-8 rounded-full bg-surface2 text-fgmuted grid place-items-center text-[12px] font-medium">{initialOf(s.full_name)}</div>
                  }
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium">{s.full_name ?? '—'}</div>
                    <div className="text-[12px] text-fgmuted flex flex-wrap gap-2">
                      <span>{s.email}</span>
                      {s.roll_number && <span>#{s.roll_number}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {s.level && <Badge variant={s.level === 'foundation' ? 'info' : 'accent'}>{s.level}</Badge>}
                    {!s.onboarded && <Badge variant="warning">Setup pending</Badge>}
                    {s.last_seen_at && <span className="text-[11px] text-fgsubtle hidden md:block">Last seen {formatDate(s.last_seen_at)}</span>}
                  </div>
                </CardBody>
              </Card>
            ))}
          </div>
        )}
    </div>
  );
}
