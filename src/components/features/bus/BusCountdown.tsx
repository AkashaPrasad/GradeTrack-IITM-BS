import { Clock } from 'lucide-react';
import { Card, CardBody } from '@/components/ui/Card';
import { CountdownTimer } from '@/components/ui/CountdownTimer';
import { formatBusOpenTime } from '@/lib/busFormLogic';

interface BusCountdownProps {
  openAt: string | null;
  onExpire: () => void;
}

export function BusCountdown({ openAt, onExpire }: BusCountdownProps) {
  return (
    <Card>
      <CardBody className="space-y-3">
        <div className="flex items-center gap-2">
          <div className="h-9 w-9 rounded-lg bg-info/15 grid place-items-center">
            <Clock className="h-4 w-4 text-info" />
          </div>
          <div>
            <div className="font-semibold text-[14px]">Bus Registration</div>
            <div className="text-[12px] text-fgmuted">
              {openAt ? `Opens ${formatBusOpenTime(openAt)}` : 'Details coming soon'}
            </div>
          </div>
        </div>
        {openAt && (
          <div className="bg-surface2 rounded-lg px-4 py-3">
            <p className="text-[11px] text-fgmuted mb-1.5">Form opens in</p>
            <CountdownTimer targetDate={openAt} onExpire={onExpire} />
          </div>
        )}
      </CardBody>
    </Card>
  );
}
