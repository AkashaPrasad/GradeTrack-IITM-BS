import { useState } from 'react';
import { motion } from 'framer-motion';
import { CheckCircle, Clock, Bus } from 'lucide-react';
import { Card, CardBody } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Dialog, DialogContent, DialogTitle, DialogDescription, DialogClose } from '@/components/ui/Dialog';
import { useCancelBusRegistration } from '@/hooks/useBusRegistration';
import type { BusRegistration, ExamType } from '@/lib/database.types';
import { formatDate } from '@/lib/utils';

interface BusStatusCardProps {
  registration: BusRegistration;
  examType: ExamType;
}

export function BusStatusCard({ registration, examType }: BusStatusCardProps) {
  const [cancelOpen, setCancelOpen] = useState(false);
  const cancel = useCancelBusRegistration();

  return (
    <>
      <Card>
        <CardBody className="space-y-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="h-9 w-9 rounded-lg bg-accent/15 grid place-items-center">
                <Bus className="h-4 w-4 text-accent" />
              </div>
              <div>
                <div className="font-semibold text-[14px]">Bus Registration</div>
                <div className="text-[12px] text-fgmuted">
                  Submitted {formatDate(registration.submitted_at)}
                </div>
              </div>
            </div>
            {registration.seat_confirmed ? (
              <Badge variant="success">
                <CheckCircle className="h-3 w-3" /> Confirmed
              </Badge>
            ) : (
              <Badge variant="warning">
                <Clock className="h-3 w-3" /> Pending
              </Badge>
            )}
          </div>

          <div className="text-[12px] text-fgmuted bg-surface2 rounded-md px-3 py-2 space-y-0.5">
            <div><span className="text-fgsubtle">Centre: </span>{registration.centre_name}</div>
            {registration.hostel && (
              <div><span className="text-fgsubtle">Hostel: </span>{registration.hostel}</div>
            )}
          </div>

          {registration.seat_confirmed ? (
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="flex items-center gap-2 text-[13px] text-success bg-success/10 rounded-md px-3 py-2"
            >
              <CheckCircle className="h-4 w-4 shrink-0" />
              Your bus seat is confirmed! See you on exam day.
            </motion.div>
          ) : (
            <p className="text-[12px] text-fgmuted">
              Your registration is pending. Admin will confirm your seat soon.
            </p>
          )}

          <button
            onClick={() => setCancelOpen(true)}
            className="text-[12px] text-danger hover:underline"
          >
            Cancel registration
          </button>
        </CardBody>
      </Card>

      <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <DialogContent>
          <DialogTitle>Cancel bus registration?</DialogTitle>
          <DialogDescription>
            Your seat will be released and others may take it. This cannot be undone.
          </DialogDescription>
          <div className="flex justify-end gap-2 mt-5">
            <DialogClose asChild>
              <Button variant="ghost" size="sm">Keep it</Button>
            </DialogClose>
            <Button
              variant="danger"
              size="sm"
              loading={cancel.isPending}
              onClick={async () => {
                await cancel.mutateAsync({ id: registration.id, examType });
                setCancelOpen(false);
              }}
            >
              Cancel registration
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
