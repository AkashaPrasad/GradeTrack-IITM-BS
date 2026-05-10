import { useState } from 'react';
import { motion } from 'framer-motion';
import { CheckCircle, Lock, Calendar, MapPin, AlertCircle, PenLine } from 'lucide-react';
import { Card, CardBody } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Skeleton } from '@/components/ui/Skeleton';
import { ExpandableAddress } from '@/components/ui/ExpandableAddress';
import { HallTicketUpload } from './HallTicketUpload';
import { useDeleteHallTicket } from '@/hooks/useHallTicket';
import type { ExamType, HallTicket } from '@/lib/database.types';
import { formatDate, daysUntil } from '@/lib/utils';

interface ExamCardProps {
  examType:       ExamType;
  examDate:       string | null;
  hallTicket:     HallTicket | null | undefined;
  isLoading:      boolean;
  centreRegOpen?: boolean | null;  // null = auto (7 days before exam), true = force open, false = force closed
}

const EXAM_LABELS: Record<ExamType, string> = {
  quiz1:   'Quiz 1',
  quiz2:   'Quiz 2',
  endterm: 'End Term',
};

function isCentreRegistrationOpen(examDate: string | null, centreRegOpen: boolean | null | undefined): boolean {
  if (centreRegOpen === true) return true;
  if (centreRegOpen === false) return false;
  // Auto mode: open if exam is within 7 days (or already passed) and date is set
  if (!examDate) return false;
  const days = daysUntil(examDate);
  return days !== null && days <= 7;
}

function daysUntilOpen(examDate: string | null): number | null {
  if (!examDate) return null;
  const days = daysUntil(examDate);
  if (days === null) return null;
  return Math.max(0, days - 7);
}

export function ExamCard({ examType, examDate, hallTicket, isLoading, centreRegOpen }: ExamCardProps) {
  const [formOpen, setFormOpen] = useState(false);
  const deleteTicket = useDeleteHallTicket();

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

  const isExpired      = hallTicket && new Date(hallTicket.expires_at) < new Date();
  const days           = examDate ? daysUntil(examDate) : null;
  const isPending      = hallTicket?.is_suggested && hallTicket.suggested_status === 'pending';
  const regOpen        = isCentreRegistrationOpen(examDate, centreRegOpen);
  const daysToOpen     = !regOpen ? daysUntilOpen(examDate) : null;

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
                      <span className="text-fgsubtle">
                        · {days === 0 ? 'Today' : `${days}d away`}
                      </span>
                    )}
                  </div>
                ) : (
                  <div className="text-[12px] text-fgsubtle mt-0.5">Date not announced yet</div>
                )}
              </div>

              {isExpired ? (
                <Badge variant="muted">
                  <Lock className="h-3 w-3" /> Closed
                </Badge>
              ) : hallTicket ? (
                isPending ? (
                  <Badge variant="warning">
                    <AlertCircle className="h-3 w-3" /> Pending Review
                  </Badge>
                ) : (
                  <Badge variant="success">
                    <CheckCircle className="h-3 w-3" /> Registered
                  </Badge>
                )
              ) : (
                <Badge variant="muted">Not Registered</Badge>
              )}
            </div>

            {hallTicket && !isExpired && (
              <div className="text-[12px] bg-surface2 rounded-md px-3 py-2.5 space-y-1.5">
                {hallTicket.centre_address ? (
                  <ExpandableAddress
                    centreName={hallTicket.centre_name}
                    address={hallTicket.centre_address}
                  />
                ) : (
                  <div className="flex items-center gap-1.5 text-fgmuted">
                    <MapPin className="h-3.5 w-3.5 text-accent shrink-0" />
                    <span className="font-medium truncate">{hallTicket.centre_name}</span>
                  </div>
                )}
                {isPending && (
                  <p className="text-[11px] text-warning flex items-center gap-1">
                    <AlertCircle className="h-3 w-3 shrink-0" />
                    Your suggested centre is awaiting admin review.
                  </p>
                )}
              </div>
            )}

            {isExpired ? (
              <p className="text-[12px] text-fgsubtle">Exam period ended.</p>
            ) : !regOpen && !hallTicket ? (
              <p className="text-[12px] text-fgmuted flex items-center gap-1.5">
                <Lock className="h-3.5 w-3.5 shrink-0" />
                {daysToOpen !== null && daysToOpen > 0
                  ? `Registration opens in ${daysToOpen} day${daysToOpen !== 1 ? 's' : ''}`
                  : examDate
                  ? 'Registration opens 7 days before the exam'
                  : 'Registration opens once exam date is announced'}
              </p>
            ) : (
              <div className="flex items-center gap-2 flex-wrap">
                <Button
                  variant={hallTicket ? 'secondary' : 'primary'}
                  size="sm"
                  onClick={() => setFormOpen(true)}
                  className="gap-1.5"
                >
                  <PenLine className="h-3.5 w-3.5" />
                  {hallTicket ? 'Update Centre' : 'Register Centre'}
                </Button>
                {hallTicket && (
                  <button
                    type="button"
                    onClick={() => {
                      if (window.confirm('Remove your exam centre registration?')) {
                        void deleteTicket.mutate(hallTicket.id);
                      }
                    }}
                    className="text-[12px] text-danger hover:underline"
                  >
                    Remove
                  </button>
                )}
              </div>
            )}
          </CardBody>
        </Card>
      </motion.div>

      <HallTicketUpload
        open={formOpen}
        onClose={() => setFormOpen(false)}
        examType={examType}
        defaultExamDate={examDate ?? undefined}
      />
    </>
  );
}
