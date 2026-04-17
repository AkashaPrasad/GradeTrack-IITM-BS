import { useState } from 'react';
import { useTitle } from '@/lib/hooks';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '@/components/ui/Select';
import { Skeleton } from '@/components/ui/Skeleton';
import { formatDateTime } from '@/lib/utils';
import type { AppLog } from '@/lib/database.types';

export default function AdminLogs() {
  useTitle('Admin — Logs');
  const [severity, setSeverity] = useState('all');
  const [q, setQ] = useState('');

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ['admin-logs', severity],
    queryFn: async () => {
      let query = supabase.from('app_logs').select('*').order('created_at', { ascending: false }).limit(300);
      if (severity !== 'all') query = query.eq('severity', severity);
      const { data } = await query;
      return (data ?? []) as AppLog[];
    },
    refetchInterval: 15_000
  });

  const filtered = q ? logs.filter(l => l.event_type.includes(q) || JSON.stringify(l.payload).includes(q)) : logs;

  const sev: Record<string, 'success' | 'warning' | 'danger' | 'muted'> = {
    info: 'muted', warn: 'warning', error: 'danger'
  };

  return (
    <div className="p-5 max-w-5xl space-y-4">
      <h1 className="text-lg font-bold tracking-tightest">Logs</h1>
      <div className="flex gap-2 flex-wrap">
        <Select value={severity} onValueChange={setSeverity}>
          <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="info">Info</SelectItem>
            <SelectItem value="warn">Warn</SelectItem>
            <SelectItem value="error">Error</SelectItem>
          </SelectContent>
        </Select>
        <Input className="w-56" placeholder="Search event or payload…" value={q} onChange={e => setQ(e.target.value)} />
      </div>
      {isLoading ? [...Array(8)].map((_, i) => <Skeleton key={i} className="h-10" />) : (
        <div className="space-y-1 font-mono text-[12px]">
          {filtered.map(l => (
            <div key={l.id} className={`rounded px-3 py-2 flex items-start gap-3 ${l.severity === 'error' ? 'bg-danger/8' : l.severity === 'warn' ? 'bg-warning/8' : 'bg-surface2'}`}>
              <Badge variant={sev[l.severity] ?? 'muted'} className="shrink-0">{l.severity}</Badge>
              <span className="text-fgmuted shrink-0">{formatDateTime(l.created_at)}</span>
              <span className="font-semibold shrink-0">{l.event_type}</span>
              {l.path && <span className="text-fgsubtle shrink-0">{l.path}</span>}
              {l.payload && <span className="text-fgsubtle truncate">{JSON.stringify(l.payload)}</span>}
            </div>
          ))}
          {filtered.length === 0 && <div className="text-fgmuted">No logs.</div>}
        </div>
      )}
    </div>
  );
}
