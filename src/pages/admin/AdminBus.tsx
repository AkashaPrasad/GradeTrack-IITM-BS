import { useState, useMemo } from 'react';
import { Bus, Download, CheckCircle, Clock, Settings } from 'lucide-react';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input, Label } from '@/components/ui/Input';
import { Switch } from '@/components/ui/Switch';
import { Badge } from '@/components/ui/Badge';
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '@/components/ui/Select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/Tabs';
import { useTitle } from '@/lib/hooks';
import { useBusFormConfig } from '@/hooks/useBusRegistration';
import { useAdminBusRegistrations, useUpdateBusConfig, useConfirmBusSeat, useAdminAllHallTickets } from '@/hooks/useAdminBusConfig';
import type { BusFormConfig, BusRegistrationWithProfile, ExamType } from '@/lib/database.types';
import { formatDate, formatDateTime } from '@/lib/utils';

const EXAM_TYPES: ExamType[] = ['quiz1', 'quiz2', 'endterm'];
const EXAM_LABELS: Record<ExamType, string> = { quiz1: 'Quiz 1', quiz2: 'Quiz 2', endterm: 'End Term' };

function exportCSV(data: Record<string, unknown>[], filename: string) {
  if (!data.length) return;
  const keys = Object.keys(data[0]);
  const rows = [keys.join(','), ...data.map(row =>
    keys.map(k => `"${String(row[k] ?? '').replace(/"/g, '""')}"`).join(',')
  )];
  const blob = new Blob([rows.join('\n')], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

function ConfigPanel({ examType, config }: { examType: ExamType; config: BusFormConfig | null | undefined }) {
  const [form, setForm] = useState({
    is_open: config?.is_open ?? false,
    open_at: config?.open_at ? new Date(config.open_at).toISOString().slice(0, 16) : '',
    close_at: config?.close_at ? new Date(config.close_at).toISOString().slice(0, 16) : '',
    max_seats: config?.max_seats ?? 50,
    bus_departure_time: config?.bus_departure_time ?? '',
    bus_pickup_location: config?.bus_pickup_location ?? 'Hostel Gate',
    eligible_centres: config?.eligible_centres ?? [],
  });

  const update = useUpdateBusConfig();
  const { data: tickets = [] } = useAdminAllHallTickets(examType);

  const distinctCentres = useMemo(() => {
    const seen = new Set<string>();
    for (const t of tickets) {
      if ((t as { centre_name?: string }).centre_name) seen.add((t as { centre_name: string }).centre_name);
    }
    return Array.from(seen).sort();
  }, [tickets]);

  const toggleCentre = (centre: string) => {
    setForm(f => ({
      ...f,
      eligible_centres: f.eligible_centres.includes(centre)
        ? f.eligible_centres.filter(c => c !== centre)
        : [...f.eligible_centres, centre],
    }));
  };

  const save = () => {
    update.mutate({
      exam_type: examType,
      is_open: form.is_open,
      open_at: form.open_at ? new Date(form.open_at).toISOString() : null,
      close_at: form.close_at ? new Date(form.close_at).toISOString() : null,
      max_seats: form.max_seats,
      bus_departure_time: form.bus_departure_time || null,
      bus_pickup_location: form.bus_pickup_location || null,
      eligible_centres: form.eligible_centres,
    });
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Settings className="h-4 w-4 text-accent" />
          <CardTitle>Bus Configuration — {EXAM_LABELS[examType]}</CardTitle>
        </div>
      </CardHeader>
      <CardBody className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-medium">Form Status</div>
            <div className="text-[12px] text-fgmuted">Manual override (auto-opens at scheduled time)</div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[12px] text-fgmuted">{form.is_open ? 'Open' : 'Closed'}</span>
            <Switch
              checked={form.is_open}
              onCheckedChange={(v) => setForm(f => ({ ...f, is_open: v }))}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <Label>Form Opens At</Label>
            <Input
              type="datetime-local"
              className="mt-1"
              value={form.open_at}
              onChange={e => setForm(f => ({ ...f, open_at: e.target.value }))}
            />
          </div>
          <div>
            <Label>Form Closes At</Label>
            <Input
              type="datetime-local"
              className="mt-1"
              value={form.close_at}
              onChange={e => setForm(f => ({ ...f, close_at: e.target.value }))}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <Label>Total Seats</Label>
            <Input
              type="number"
              min={1}
              className="mt-1"
              value={form.max_seats}
              onChange={e => setForm(f => ({ ...f, max_seats: Number(e.target.value) }))}
            />
          </div>
          <div>
            <Label>Bus Departure Time</Label>
            <Input
              placeholder="e.g. 6:00 AM"
              className="mt-1"
              value={form.bus_departure_time}
              onChange={e => setForm(f => ({ ...f, bus_departure_time: e.target.value }))}
            />
          </div>
        </div>

        <div>
          <Label>Pickup Location</Label>
          <Input
            className="mt-1"
            value={form.bus_pickup_location}
            onChange={e => setForm(f => ({ ...f, bus_pickup_location: e.target.value }))}
          />
        </div>

        <div>
          <Label>Eligible Centres (select which centres get bus access)</Label>
          {form.eligible_centres.length > 2 && (
            <p className="text-[11px] text-warning mt-1">Warning: more than 2 centres selected.</p>
          )}
          <div className="mt-2 flex flex-wrap gap-2">
            {distinctCentres.length === 0 && (
              <span className="text-[12px] text-fgsubtle">No hall tickets uploaded yet — centres will appear here.</span>
            )}
            {distinctCentres.map(c => (
              <button
                key={c}
                type="button"
                onClick={() => toggleCentre(c)}
                className={`px-2.5 py-1 rounded-md text-[12px] font-medium border transition-colors ${
                  form.eligible_centres.includes(c)
                    ? 'bg-accent/15 text-accent border-accent/30'
                    : 'bg-surface text-fgmuted border-border hover:border-accent/30'
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        <Button onClick={save} loading={update.isPending}>Save Configuration</Button>
      </CardBody>
    </Card>
  );
}

function RegistrationsTable({ examType }: { examType: ExamType }) {
  const { data: registrations = [], isLoading } = useAdminBusRegistrations(examType);
  const confirm = useConfirmBusSeat();
  const { data: config } = useBusFormConfig(examType);

  const confirmed = registrations.filter(r => r.seat_confirmed).length;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Registrations — {EXAM_LABELS[examType]}</CardTitle>
          <div className="flex items-center gap-2">
            <span className="text-[12px] text-fgmuted">
              {confirmed}/{registrations.length} confirmed
              {config && ` · ${config.max_seats} seats`}
            </span>
            <button
              onClick={() => exportCSV(
                registrations.map(r => ({
                  Name: r.student_name,
                  'Scaler ID': r.scaler_id,
                  Centre: r.centre_name,
                  Hostel: r.hostel ?? '',
                  WhatsApp: r.whatsapp_number ?? '',
                  'Submitted At': formatDateTime(r.submitted_at),
                  Confirmed: r.seat_confirmed ? 'Yes' : 'No',
                })),
                `bus_${examType}.csv`
              )}
              className="flex items-center gap-1 h-7 px-2 rounded-md text-[12px] border border-border hover:bg-surface2"
            >
              <Download className="h-3 w-3" /> CSV
            </button>
          </div>
        </div>
      </CardHeader>
      <CardBody>
        {isLoading ? (
          <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-10 shimmer rounded" />)}</div>
        ) : registrations.length === 0 ? (
          <p className="text-[13px] text-fgmuted text-center py-6">No registrations yet.</p>
        ) : (
          <div className="overflow-x-auto -mx-4 md:-mx-5">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="px-4 pb-2 font-medium text-fgmuted">Name</th>
                  <th className="px-4 pb-2 font-medium text-fgmuted hidden sm:table-cell">Scaler ID</th>
                  <th className="px-4 pb-2 font-medium text-fgmuted">Centre</th>
                  <th className="px-4 pb-2 font-medium text-fgmuted hidden md:table-cell">Hostel</th>
                  <th className="px-4 pb-2 font-medium text-fgmuted hidden lg:table-cell">Submitted</th>
                  <th className="px-4 pb-2 font-medium text-fgmuted">Confirmed</th>
                </tr>
              </thead>
              <tbody>
                {registrations.map((r: BusRegistrationWithProfile) => (
                  <tr key={r.id} className="border-b border-border/50 hover:bg-surface2/30">
                    <td className="px-4 py-2.5">
                      <div className="font-medium">{r.student_name}</div>
                      {r.whatsapp_number && (
                        <div className="text-[11px] text-fgmuted">{r.whatsapp_number}</div>
                      )}
                    </td>
                    <td className="px-4 py-2.5 hidden sm:table-cell font-mono text-[12px]">{r.scaler_id}</td>
                    <td className="px-4 py-2.5">{r.centre_name}</td>
                    <td className="px-4 py-2.5 hidden md:table-cell">{r.hostel ?? '—'}</td>
                    <td className="px-4 py-2.5 hidden lg:table-cell text-fgmuted">{formatDate(r.submitted_at)}</td>
                    <td className="px-4 py-2.5">
                      <button
                        onClick={() => confirm.mutate({ id: r.id, examType, confirm: !r.seat_confirmed })}
                        className={`flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium transition-colors ${
                          r.seat_confirmed
                            ? 'bg-success/15 text-success hover:bg-success/25'
                            : 'bg-surface2 text-fgmuted hover:bg-surface2/80'
                        }`}
                      >
                        {r.seat_confirmed
                          ? <><CheckCircle className="h-3 w-3" /> Yes</>
                          : <><Clock className="h-3 w-3" /> No</>
                        }
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardBody>
    </Card>
  );
}

function ExamBusPanel({ examType }: { examType: ExamType }) {
  const { data: config } = useBusFormConfig(examType);
  return (
    <div className="space-y-4">
      <ConfigPanel examType={examType} config={config} />
      <RegistrationsTable examType={examType} />
    </div>
  );
}

export default function AdminBus() {
  useTitle('Bus Management — Admin');
  const [activeExam, setActiveExam] = useState<ExamType>('quiz1');

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-5">
      <div className="flex items-center gap-2">
        <Bus className="h-5 w-5 text-accent" />
        <h1 className="text-lg font-bold tracking-tightest">Bus Management</h1>
      </div>

      <Tabs value={activeExam} onValueChange={(v) => setActiveExam(v as ExamType)}>
        <TabsList>
          {EXAM_TYPES.map(et => (
            <TabsTrigger key={et} value={et}>{EXAM_LABELS[et]}</TabsTrigger>
          ))}
        </TabsList>
        {EXAM_TYPES.map(et => (
          <TabsContent key={et} value={et} className="mt-4">
            <ExamBusPanel examType={et} />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
