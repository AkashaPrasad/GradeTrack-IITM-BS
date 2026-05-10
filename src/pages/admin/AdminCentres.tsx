import { useMemo, useState } from 'react';
import { Download, MapPin, Search, CheckCircle, XCircle, Clock } from 'lucide-react';
import { Card, CardBody } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs';
import { WhatsAppButton } from '@/components/ui/WhatsAppButton';
import { ExpandableAddress } from '@/components/ui/ExpandableAddress';
import { AdminCentreList } from '@/components/features/admin/AdminCentreList';
import { useTitle } from '@/lib/hooks';
import {
  useAdminAllHallTickets,
  useAdminAllScalerStudents,
  useAdminSuggestedCentres,
  useReviewSuggestedCentre,
} from '@/hooks/useAdminBusConfig';
import { useSaveExamCentre } from '@/hooks/useExamCentres';
import type { ExamType, HallTicket } from '@/lib/database.types';

const EXAM_TYPES: ExamType[]              = ['quiz1', 'quiz2', 'endterm'];
const EXAM_LABELS: Record<ExamType, string> = { quiz1: 'Quiz 1', quiz2: 'Quiz 2', endterm: 'End Term' };

type TicketRow = HallTicket & { profile?: { full_name: string | null; email: string } | null };

function exportCSV(data: TicketRow[], filename: string) {
  if (!data.length) return;
  const rows = [
    'Name,Roll No,Centre,Centre Address,Hostel,WhatsApp,Upload Mode,Suggested',
    ...data.map((r) =>
      [
        r.student_name, r.scaler_id, r.centre_name,
        r.centre_address ?? '', r.hostel ?? '',
        r.whatsapp_number ?? '', r.uploaded_via,
        r.is_suggested ? 'Yes' : 'No',
      ]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(','),
    ),
  ];
  const blob = new Blob([rows.join('\n')], { type: 'text/csv' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

// ── Centre Breakdown ──────────────────────────────────────────────────────────

function CentreBreakdown({ examType }: { examType: ExamType }) {
  const { data: tickets = [], isLoading } = useAdminAllHallTickets(examType);
  const rows = tickets as TicketRow[];
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((t) =>
      [t.centre_name, t.student_name, t.scaler_id]
        .filter(Boolean)
        .some((v) => v.toLowerCase().includes(q)),
    );
  }, [rows, search]);

  const grouped = useMemo(() => {
    const map = new Map<string, TicketRow[]>();
    for (const t of filtered) {
      if (!map.has(t.centre_name)) map.set(t.centre_name, []);
      map.get(t.centre_name)!.push(t);
    }
    return Array.from(map.entries()).sort((a, b) => b[1].length - a[1].length);
  }, [filtered]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-fgmuted" />
          <Input
            placeholder="Search centre or student..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>
        <button
          onClick={() => exportCSV(rows, `centres_${examType}.csv`)}
          className="flex items-center gap-1.5 h-9 px-3 rounded-md text-[13px] border border-border hover:bg-surface2 transition-colors"
        >
          <Download className="h-3.5 w-3.5" /> CSV
        </button>
      </div>

      {isLoading ? (
        <div className="text-[13px] text-fgmuted">Loading registrations…</div>
      ) : grouped.length === 0 ? (
        <div className="text-[13px] text-fgmuted">No centre registrations yet.</div>
      ) : (
        grouped.map(([centre, students]) => {
          const first = students[0];
          return (
            <Card key={centre}>
              <CardBody className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    {first.centre_address ? (
                      <ExpandableAddress centreName={centre} address={first.centre_address} showInCard />
                    ) : (
                      <div className="text-[14px] font-medium">{centre}</div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {students.some((s) => s.is_suggested) && (
                      <Badge variant="warning" className="text-[10px]">Has suggestions</Badge>
                    )}
                    <Badge variant="muted">{students.length} student{students.length !== 1 ? 's' : ''}</Badge>
                  </div>
                </div>

                <div className="space-y-2">
                  {students.map((student) => (
                    <div key={student.id} className="flex items-center justify-between gap-3 border-t border-border/60 pt-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <div className="text-[13px] font-medium">{student.student_name}</div>
                          {student.is_suggested && student.suggested_status === 'pending' && (
                            <Badge variant="warning" className="text-[10px]">Pending</Badge>
                          )}
                        </div>
                        <div className="text-[11px] text-fgmuted">
                          {student.scaler_id} · {student.hostel ?? '—'}
                        </div>
                      </div>
                      {student.whatsapp_number && <WhatsAppButton number={student.whatsapp_number} size="sm" />}
                    </div>
                  ))}
                </div>
              </CardBody>
            </Card>
          );
        })
      )}
    </div>
  );
}

// ── Suggested Centres Review ──────────────────────────────────────────────────

function SuggestedCentresPanel() {
  const { data: suggestions = [], isLoading } = useAdminSuggestedCentres();
  const review    = useReviewSuggestedCentre();
  const saveToList = useSaveExamCentre();

  const pending  = suggestions.filter((s) => s.suggested_status === 'pending');
  const reviewed = suggestions.filter((s) => s.suggested_status !== 'pending');

  const handleApprove = async (ticket: TicketRow) => {
    if (ticket.centre_address) {
      await saveToList.mutateAsync({
        name:    ticket.centre_name,
        address: ticket.centre_address,
      });
    }
    await review.mutateAsync({ id: ticket.id, status: 'approved' });
  };

  const handleReject = (ticket: TicketRow) =>
    review.mutate({ id: ticket.id, status: 'rejected' });

  if (isLoading) return <div className="text-[13px] text-fgmuted">Loading suggestions…</div>;

  if (suggestions.length === 0) {
    return (
      <div className="text-center py-10 text-[13px] text-fgmuted">
        No suggested centres from students.
      </div>
    );
  }

  const renderCard = (ticket: TicketRow, showActions: boolean) => (
    <Card key={ticket.id}>
      <CardBody className="space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="text-[14px] font-semibold">{ticket.centre_name}</div>
            {ticket.centre_address && (
              <div className="text-[12px] text-fgmuted mt-0.5 line-clamp-2">{ticket.centre_address}</div>
            )}
          </div>
          <Badge
            variant={
              ticket.suggested_status === 'approved'
                ? 'success'
                : ticket.suggested_status === 'rejected'
                ? 'danger'
                : 'warning'
            }
          >
            {ticket.suggested_status === 'pending' && <Clock className="h-3 w-3" />}
            {ticket.suggested_status === 'approved' && <CheckCircle className="h-3 w-3" />}
            {ticket.suggested_status === 'rejected' && <XCircle className="h-3 w-3" />}
            {ticket.suggested_status}
          </Badge>
        </div>

        <div className="text-[12px] text-fgmuted">
          Suggested by <span className="font-medium">{ticket.student_name}</span>
          {' · '}{EXAM_LABELS[ticket.exam_type]}
        </div>

        {showActions && (
          <div className="flex gap-2 pt-1">
            <Button
              size="sm"
              variant="primary"
              loading={review.isPending || saveToList.isPending}
              onClick={() => handleApprove(ticket as TicketRow)}
              className="gap-1"
            >
              <CheckCircle className="h-3.5 w-3.5" /> Approve & Add to List
            </Button>
            <Button
              size="sm"
              variant="danger"
              loading={review.isPending}
              onClick={() => handleReject(ticket as TicketRow)}
              className="gap-1"
            >
              <XCircle className="h-3.5 w-3.5" /> Reject
            </Button>
          </div>
        )}
      </CardBody>
    </Card>
  );

  return (
    <div className="space-y-4">
      {pending.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-[13px] font-semibold text-warning">
            {pending.length} Pending Review
          </h3>
          {pending.map((t) => renderCard(t as TicketRow, true))}
        </div>
      )}

      {reviewed.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-[13px] font-semibold text-fgmuted">Previously Reviewed</h3>
          {reviewed.map((t) => renderCard(t as TicketRow, false))}
        </div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function AdminCentres() {
  useTitle('Centre Breakdown — Admin');
  const { data: scaler = [] } = useAdminAllScalerStudents();
  const { data: suggestions = [] } = useAdminSuggestedCentres();
  const [pageTab, setPageTab] = useState<'breakdown' | 'suggested' | 'manage'>('breakdown');
  const [examTab, setExamTab] = useState<ExamType>('quiz1');

  const pendingCount = suggestions.filter((s) => s.suggested_status === 'pending').length;

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-5">
      <div className="flex items-center gap-2">
        <MapPin className="h-5 w-5 text-accent" />
        <h1 className="text-lg font-bold tracking-tightest">Centres</h1>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Scaler Verified', value: scaler.length },
          { label: 'Pending Suggestions', value: pendingCount },
          { label: 'Centre List', value: 'Managed' },
          { label: 'Live Updates', value: 'Active' },
        ].map(({ label, value }) => (
          <Card key={label}>
            <CardBody className="text-center py-3">
              <div className="text-2xl font-bold text-fg">{value}</div>
              <div className="text-[11px] text-fgmuted mt-0.5">{label}</div>
            </CardBody>
          </Card>
        ))}
      </div>

      <Tabs value={pageTab} onValueChange={(v) => setPageTab(v as typeof pageTab)}>
        <TabsList>
          <TabsTrigger value="breakdown">Centre Breakdown</TabsTrigger>
          <TabsTrigger value="suggested" className="relative">
            Suggestions
            {pendingCount > 0 && (
              <span className="ml-1.5 inline-flex h-4 w-4 items-center justify-center rounded-full bg-warning text-[10px] font-bold text-black">
                {pendingCount}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="manage">Manage Centre List</TabsTrigger>
        </TabsList>

        <TabsContent value="breakdown">
          <Tabs value={examTab} onValueChange={(v) => setExamTab(v as ExamType)}>
            <TabsList>
              {EXAM_TYPES.map((type) => (
                <TabsTrigger key={type} value={type}>{EXAM_LABELS[type]}</TabsTrigger>
              ))}
            </TabsList>
            {EXAM_TYPES.map((type) => (
              <TabsContent key={type} value={type}>
                <CentreBreakdown examType={type} />
              </TabsContent>
            ))}
          </Tabs>
        </TabsContent>

        <TabsContent value="suggested">
          <SuggestedCentresPanel />
        </TabsContent>

        <TabsContent value="manage">
          <AdminCentreList />
        </TabsContent>
      </Tabs>
    </div>
  );
}
