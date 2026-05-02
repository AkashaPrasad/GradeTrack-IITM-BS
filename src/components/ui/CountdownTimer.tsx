import { useEffect, useState } from 'react';

interface CountdownTimerProps {
  targetDate: string | Date;
  onExpire?: () => void;
}

interface TimeLeft {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

function getTimeLeft(target: Date): TimeLeft | null {
  const diff = target.getTime() - Date.now();
  if (diff <= 0) return null;
  return {
    days: Math.floor(diff / (1000 * 60 * 60 * 24)),
    hours: Math.floor((diff / (1000 * 60 * 60)) % 24),
    minutes: Math.floor((diff / (1000 * 60)) % 60),
    seconds: Math.floor((diff / 1000) % 60),
  };
}

export function CountdownTimer({ targetDate, onExpire }: CountdownTimerProps) {
  const target = typeof targetDate === 'string' ? new Date(targetDate) : targetDate;
  const [timeLeft, setTimeLeft] = useState<TimeLeft | null>(() => getTimeLeft(target));

  useEffect(() => {
    const tick = () => {
      const tl = getTimeLeft(target);
      setTimeLeft(tl);
      if (!tl) onExpire?.();
    };
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [target, onExpire]);

  if (!timeLeft) return <span className="text-success text-sm font-medium">Open now!</span>;

  const pad = (n: number) => String(n).padStart(2, '0');

  return (
    <div className="flex items-center gap-2 text-sm font-mono">
      {timeLeft.days > 0 && (
        <span className="tabular-nums">
          <span className="text-fg font-semibold">{timeLeft.days}</span>
          <span className="text-fgmuted text-[11px] ml-0.5">d</span>
        </span>
      )}
      <span className="tabular-nums">
        <span className="text-fg font-semibold">{pad(timeLeft.hours)}</span>
        <span className="text-fgmuted text-[11px] ml-0.5">h</span>
      </span>
      <span className="tabular-nums">
        <span className="text-fg font-semibold">{pad(timeLeft.minutes)}</span>
        <span className="text-fgmuted text-[11px] ml-0.5">m</span>
      </span>
      <span className="tabular-nums">
        <span className="text-fg font-semibold">{pad(timeLeft.seconds)}</span>
        <span className="text-fgmuted text-[11px] ml-0.5">s</span>
      </span>
    </div>
  );
}
