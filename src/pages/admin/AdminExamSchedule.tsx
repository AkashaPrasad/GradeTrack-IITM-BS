import { useState } from 'react';
import { Calendar, ToggleLeft, ToggleRight } from 'lucide-react';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input, Label } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { useTitle } from '@/lib/hooks';
import { useAdminExamSchedule, useUpsertExamSchedule } from '@/hooks/useAdminBusConfig';
import type { ExamType } from '@/lib/database.types';
import { formatDate } from '@/lib/utils';

const EXAMS: { type: ExamType; label: string }[] = [
  { type: 'quiz1', label: 'Quiz 1' },
  { type: 'quiz2', label: 'Quiz 2' },
  { type: 'endterm', label: 'End Term' },
];

function ExamRow({
  examType, label, currentDate, currentCentreRegOpen,
}: {
  examType: ExamType; label: string; currentDate?: string; currentCentreRegOpen?: boolean | null;
}) {
  const [date, setDate]         = useState(currentDate ?? '');
  const [regOpen, setRegOpen]   = useState<boolean | null>(currentCentreRegOpen ?? null);
  const upsert = useUpsertExamSchedule();

  const cycleRegOpen = () => {
    // cycle: null (auto) → true (force open) → false (force closed) → null
    setRegOpen((v) => v === null ? true : v === true ? false : null);
  };

  const regLabel = regOpen === true ? 'Force Open' : regOpen === false ? 'Force Closed' : 'Auto (7 days before)';
  const regVariant = regOpen === true ? 'success' : regOpen === false ? 'danger' : 'muted';

  return (
    <div className="space-y-3 py-4 border-b border-border last:border-0">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="font-medium text-[14px]">{label}</div>
        {currentDate && (
          <div className="text-[12px] text-fgmuted">Exam: {formatDate(currentDate)}</div>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Exam date */}
        <div>
          <Label htmlFor={`date-${examType}`}>Exam Date</Label>
          <Input
            id={`date-${examType}`}
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="mt-1"
          />
        </div>

        {/* Centre registration toggle */}
        <div>
          <Label>Centre Registration</Label>
          <div className="mt-1 flex items-center gap-2">
            <button
              type="button"
              onClick={cycleRegOpen}
              className="flex items-center gap-2 h-9 px-3 rounded-md border border-border text-[13px] hover:bg-surface2 transition-colors"
            >
              {regOpen === true ? (
                <ToggleRight className="h-4 w-4 text-success" />
              ) : regOpen === false ? (
                <ToggleLeft className="h-4 w-4 text-danger" />
              ) : (
                <Calendar className="h-4 w-4 text-fgmuted" />
              )}
              <Badge variant={regVariant} className="text-[11px]">{regLabel}</Badge>
            </button>
          </div>
          <p className="text-[11px] text-fgsubtle mt-1">
            Auto = opens automatically 7 days before exam
          </p>
        </div>
      </div>

      <div className="flex justify-end">
        <Button
          size="sm"
          onClick={() => upsert.mutate({ exam_type: examType, exam_date: date, centre_reg_open: regOpen })}
          loading={upsert.isPending}
          disabled={!date}
        >
          Save
        </Button>
      </div>
    </div>
  );
}

export default function AdminExamSchedule() {
  useTitle('Exam Schedule — Admin');
  const { data: schedule = [], isLoading } = useAdminExamSchedule();

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto space-y-5">
      <div className="flex items-center gap-2">
        <Calendar className="h-5 w-5 text-accent" />
        <h1 className="text-lg font-bold tracking-tightest">Exam Schedule</h1>
      </div>
      <p className="text-[13px] text-fgmuted">
        Set exam dates for the current academic year. These dates are used to calculate hall ticket expiry
        (exam date + 10 days) and displayed to students.
      </p>

      <Card>
        <CardHeader><CardTitle>Academic Year 2025-26</CardTitle></CardHeader>
        <CardBody>
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-12 shimmer rounded-md" />
              ))}
            </div>
          ) : (
            EXAMS.map(({ type, label }) => {
              const entry = schedule.find((s: any) => s.exam_type === type);
              return (
                <ExamRow
                  key={type}
                  examType={type}
                  label={label}
                  currentDate={entry?.exam_date}
                  currentCentreRegOpen={entry?.centre_reg_open ?? null}
                />
              );
            })
          )}
        </CardBody>
      </Card>
    </div>
  );
}
