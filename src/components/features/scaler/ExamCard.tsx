import { useState } from 'react';
import { motion } from 'framer-motion';
import { Upload, CheckCircle, Lock, Calendar } from 'lucide-react';
import { Card, CardBody } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Skeleton } from '@/components/ui/Skeleton';
import { HallTicketUpload } from './HallTicketUpload';
import type { ExamType, HallTicket } from '@/lib/database.types';
import { formatDate, daysUntil } from '@/lib/utils';

interface ExamCardProps {
  examType: ExamType;
  examDate: string | null;
  hallTicket: HallTicket | null | undefined;
  isLoading: boolean;
}

const EXAM_LABELS: Record<ExamType, string> = {
  quiz1: 'Quiz 1',
  quiz2: 'Quiz 2',
  endterm: 'End Term',
};

export function ExamCard({ examType, examDate, hallTicket, isLoading }: ExamCardProps) {
  const [uploadOpen, setUploadOpen] = useState(false);

  if (isLoading) {
    return (
      <Card>
        <CardBody className="space-y-3">
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-3 w-1/2" />
          <Skeleton className="h-8 w-28" />
        </CardBody>
      </Card>
    );
  }

  const isExpired = hallTicket && new Date(hallTicket.expires_at) < new Date();
  const days = examDate ? daysUntil(examDate) : null;

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
      >
        <Card className={isExpired ? 'opacity-60' : ''}>
          <CardBody className="space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="font-semibold text-[15px]">{EXAM_LABELS[examType]}</div>
                {examDate ? (
                  <div className="text-[12px] text-fgmuted mt-0.5 flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {formatDate(examDate)}
                    {days !== null && days >= 0 && (
                      <span className="text-fgsubtle">· {days === 0 ? 'Today' : `${days}d away`}</span>
                    )}
                  </div>
                ) : (
                  <div className="text-[12px] text-fgsubtle mt-0.5">Date not set</div>
                )}
              </div>
              {isExpired ? (
                <Badge variant="muted">
                  <Lock className="h-3 w-3" /> Closed
                </Badge>
              ) : hallTicket ? (
                <Badge variant="success">
                  <CheckCircle className="h-3 w-3" /> Uploaded
                </Badge>
              ) : (
                <Badge variant="muted">Not uploaded</Badge>
              )}
            </div>

            {hallTicket && !isExpired && (
              <div className="text-[12px] text-fgmuted bg-surface2 rounded-md px-3 py-2 space-y-0.5">
                <div><span className="text-fgsubtle">Centre: </span>{hallTicket.centre_name}</div>
                <div><span className="text-fgsubtle">Timing: </span>{hallTicket.exam_timing}</div>
              </div>
            )}

            {isExpired ? (
              <p className="text-[12px] text-fgsubtle">
                Section closed — exam period ended
              </p>
            ) : (
              <Button
                variant={hallTicket ? 'secondary' : 'primary'}
                size="sm"
                onClick={() => setUploadOpen(true)}
                className="gap-1.5"
              >
                <Upload className="h-3.5 w-3.5" />
                {hallTicket ? 'Re-upload' : 'Upload Hall Ticket'}
              </Button>
            )}
          </CardBody>
        </Card>
      </motion.div>

      <HallTicketUpload
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        examType={examType}
        defaultExamDate={examDate ?? undefined}
      />
    </>
  );
}
