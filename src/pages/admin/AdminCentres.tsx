import { useState, useMemo } from 'react';
import { MapPin, Download, Search, ChevronDown, ChevronRight } from 'lucide-react';
import { Card, CardBody } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/Tabs';
import { WhatsAppButton } from '@/components/ui/WhatsAppButton';
import { useTitle } from '@/lib/hooks';
import { useAdminAllHallTickets, useAdminAllScalerStudents } from '@/hooks/useAdminBusConfig';
import type { ExamType, HallTicket } from '@/lib/database.types';

const EXAM_TYPES: ExamType[] = ['quiz1', 'quiz2', 'endterm'];
const EXAM_LABELS: Record<ExamType, string> = { quiz1: 'Quiz 1', quiz2: 'Quiz 2', endterm: 'End Term' };

type TicketRow = HallTicket & { profile?: { full_name: string | null; email: string } | null };

function exportCSV(data: TicketRow[], filename: string) {
  if (!data.length) return;
  const rows = [
    'Name,Scaler ID,Centre,Hostel,WhatsApp,Exam Date,Timing',
    ...data.map(r =>
      [r.student_name, r.scaler_id, r.centre_name, r.hostel ?? '', r.whatsapp_number ?? '', r.exam_date, r.exam_timing]
        .map(v => `"${String(v).replace(/"/g, '""')}"`)
        .join(',')
    ),
  ];
  const blob = new Blob([rows.join('\n')], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

function CentreTab({ examType }: { examType: ExamType }) {
  const { data: tickets = [], isLoading } = useAdminAllHallTickets(examType);
  const typedTickets = tickets as unknown as TicketRow[];
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return q
      ? typedTickets.filter(t => t.centre_name?.toLowerCase().includes(q) || t.student_name?.toLowerCase().includes(q))
      : typedTickets;
  }, [typedTickets, search]);

  const byCentre = useMemo(() => {
    const map = new Map<string, TicketRow[]>();
    for (const t of filtered) {
      if (!map.has(t.centre_name)) map.set(t.centre_name, []);
      map.get(t.centre_name)!.push(t);
    }
    return Array.from(map.entries()).sort((a, b) => b[1].length - a[1].length);
  }, [filtered]);

  const toggle = (centre: string) => {
    setExpanded(prev => {
      const s = new Set(prev);
      s.has(centre) ? s.delete(centre) : s.add(centre);
      return s;
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-fgmuted" />
          <Input
            placeholder="Search centre or student…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>
        <button
          onClick={() => exportCSV(typedTickets, `centres_${examType}.csv`)}
          className="flex items-center gap-1.5 h-9 px-3 rounded-md text-[13px] border border-border hover:bg-surface2 transition-colors"
        >
          <Download className="h-3.5 w-3.5" /> CSV
        </button>
      </div>

      {isLoading ? (
        <div className="space-y-2">{[1, 2, 3].map(i => <div key={i} className="h-12 shimmer rounded-lg" />)}</div>
      ) : byCentre.length === 0 ? (
        <div className="text-center py-8 text-[13px] text-fgmuted">No hall tickets uploaded yet.</div>
      ) : (
        byCentre.map(([centre, students]) => (
          <Card key={centre}>
            <button
              className="w-full text-left px-4 py-3 flex items-center justify-between hover:bg-surface2/50 transition-colors rounded-lg"
              onClick={() => toggle(centre)}
            >
              <div className="flex items-center gap-2">
                {expanded.has(centre) ? <ChevronDown className="h-4 w-4 text-fgmuted" /> : <ChevronRight className="h-4 w-4 text-fgmuted" />}
                <span className="font-medium text-[14px]">{centre}</span>
                <Badge variant="muted">{students.length} student{students.length !== 1 ? 's' : ''}</Badge>
              </div>
            </button>
            {expanded.has(centre) && (
              <div className="px-4 pb-3 space-y-2">
                {students.map(s => (
                  <div key={s.id} className="flex items-center justify-between gap-2 py-2 border-t border-border/50">
                    <div className="min-w-0">
                      <div className="text-[13px] font-medium">{s.student_name}</div>
                      <div className="text-[11px] text-fgmuted">{s.scaler_id} · {s.hostel ?? '—'}</div>
                    </div>
                    {s.whatsapp_number && <WhatsAppButton number={s.whatsapp_number} size="sm" />}
                  </div>
                ))}
              </div>
            )}
          </Card>
        ))
      )}
    </div>
  );
}

export default function AdminCentres() {
  useTitle('Centre Breakdown — Admin');
  const { data: scaler = [] } = useAdminAllScalerStudents();
  const [activeExam, setActiveExam] = useState<ExamType>('quiz1');

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-5">
      <div className="flex items-center gap-2">
        <MapPin className="h-5 w-5 text-accent" />
        <h1 className="text-lg font-bold tracking-tightest">Centre Breakdown</h1>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Scaler Verified', value: scaler.length },
          { label: 'Total Uploads', value: '—' },
          { label: 'Unique Centres', value: '—' },
          { label: 'No Uploads', value: '—' },
        ].map(({ label, value }) => (
          <Card key={label}>
            <CardBody className="text-center py-3">
              <div className="text-2xl font-bold text-fg">{value}</div>
              <div className="text-[11px] text-fgmuted mt-0.5">{label}</div>
            </CardBody>
          </Card>
        ))}
      </div>

      <Tabs value={activeExam} onValueChange={(v) => setActiveExam(v as ExamType)}>
        <TabsList>
          {EXAM_TYPES.map(et => <TabsTrigger key={et} value={et}>{EXAM_LABELS[et]}</TabsTrigger>)}
        </TabsList>
        {EXAM_TYPES.map(et => (
          <TabsContent key={et} value={et} className="mt-4">
            <CentreTab examType={et} />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
