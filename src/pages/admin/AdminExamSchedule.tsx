import { useState } from 'react';
import { Calendar } from 'lucide-react';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input, Label } from '@/components/ui/Input';
import { useTitle } from '@/lib/hooks';
import { useAdminExamSchedule, useUpsertExamSchedule } from '@/hooks/useAdminBusConfig';
import type { ExamType } from '@/lib/database.types';
import { formatDate } from '@/lib/utils';

const EXAMS: { type: ExamType; label: string }[] = [
  { type: 'quiz1', label: 'Quiz 1' },
  { type: 'quiz2', label: 'Quiz 2' },
  { type: 'endterm', label: 'End Term' },
];

function ExamRow({ examType, label, currentDate }: { examType: ExamType; label: string; currentDate?: string }) {
  const [date, setDate] = useState(currentDate ?? '');
  const upsert = useUpsertExamSchedule();

  return (
    <div className="flex items-end gap-3 py-4 border-b border-border last:border-0">
      <div className="flex-1 min-w-0">
        <div className="font-medium text-[14px]">{label}</div>
        {currentDate && (
          <div className="text-[12px] text-fgmuted mt-0.5">
            Currently: {formatDate(currentDate)}
          </div>
        )}
      </div>
      <div className="flex items-end gap-2">
        <div>
          <Label htmlFor={`date-${examType}`}>Date</Label>
          <Input
            id={`date-${examType}`}
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="mt-1 w-40"
          />
        </div>
        <Button
          size="sm"
          onClick={() => upsert.mutate({ exam_type: examType, exam_date: date })}
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
  const dateMap = Object.fromEntries(
    schedule.map((s: { exam_type: string; exam_date: string }) => [s.exam_type, s.exam_date])
  );

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
            EXAMS.map(({ type, label }) => (
              <ExamRow
                key={type}
                examType={type}
                label={label}
                currentDate={dateMap[type] as string | undefined}
              />
            ))
          )}
        </CardBody>
      </Card>
    </div>
  );
}
