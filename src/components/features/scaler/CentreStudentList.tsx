import { motion } from 'framer-motion';
import { Users } from 'lucide-react';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Skeleton } from '@/components/ui/Skeleton';
import { WhatsAppButton } from '@/components/ui/WhatsAppButton';
import { LiveIndicator } from '@/components/ui/LiveIndicator';
import { ScalerBadge } from '@/components/ui/ScalerBadge';
import { useCentreStudents } from '@/hooks/useCentreStudents';
import type { ExamType, HallTicket } from '@/lib/database.types';
import { useAuth } from '@/stores/auth';
import { relativeTime } from '@/lib/utils';

interface CentreStudentListProps {
  centreName: string | null;
  examType: ExamType | null;
}

const stagger = { hidden: {}, visible: { transition: { staggerChildren: 0.05 } } };
const fadeUp = { hidden: { opacity: 0, y: 6 }, visible: { opacity: 1, y: 0 } };

function StudentCard({ ticket, isMe }: { ticket: HallTicket; isMe: boolean }) {
  return (
    <motion.div
      variants={fadeUp}
      className="flex items-center justify-between gap-3 py-2.5 px-3 rounded-lg bg-surface2/50 hover:bg-surface2 transition-colors"
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <div className="h-8 w-8 rounded-full bg-accent/15 text-accent grid place-items-center text-[13px] font-semibold shrink-0">
          {ticket.student_name.charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0">
          <div className="text-[13px] font-medium truncate">
            {ticket.student_name} {isMe && <span className="text-[11px] text-fgsubtle">(you)</span>}
          </div>
          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
            {ticket.hostel && (
              <Badge variant="muted" className="text-[10px]">{ticket.hostel}</Badge>
            )}
            <ScalerBadge size="sm" />
          </div>
        </div>
      </div>
      {ticket.whatsapp_number && !isMe && (
        <WhatsAppButton number={ticket.whatsapp_number} size="sm" className="shrink-0" />
      )}
    </motion.div>
  );
}

export function CentreStudentList({ centreName, examType }: CentreStudentListProps) {
  const { user } = useAuth();
  const { data: students, isLoading, lastRefreshed } = useCentreStudents(centreName, examType);

  if (!centreName || !examType) {
    return (
      <Card>
        <CardBody>
          <div className="text-center py-6 text-[13px] text-fgmuted">
            Upload your hall ticket to see who else is at your centre.
          </div>
        </CardBody>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CardTitle>Students at {centreName}</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            <LiveIndicator />
            <span className="text-[11px] text-fgsubtle">{relativeTime(lastRefreshed)}</span>
          </div>
        </div>
      </CardHeader>
      <CardBody>
        {isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-12 rounded-lg" />)}
          </div>
        ) : !students || students.length === 0 ? (
          <div className="text-center py-6 space-y-2">
            <Users className="h-8 w-8 text-fgsubtle mx-auto" />
            <p className="text-[13px] text-fgmuted">No other students from your centre yet.</p>
            <p className="text-[12px] text-fgsubtle">Share GradeTrack with your classmates!</p>
          </div>
        ) : (
          <motion.div
            initial="hidden"
            animate="visible"
            variants={stagger}
            className="space-y-1.5"
          >
            <p className="text-[12px] text-fgmuted mb-2">
              {students.length} student{students.length !== 1 ? 's' : ''} found at this centre
            </p>
            {students.map((s) => (
              <StudentCard key={s.id} ticket={s} isMe={s.user_id === user?.id} />
            ))}
          </motion.div>
        )}
      </CardBody>
    </Card>
  );
}
