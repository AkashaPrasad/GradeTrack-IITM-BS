import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Bus, XCircle } from 'lucide-react';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input, Label } from '@/components/ui/Input';
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '@/components/ui/Select';
import { BusCountdown } from './BusCountdown';
import { BusStatusCard } from './BusStatusCard';
import { Skeleton } from '@/components/ui/Skeleton';
import { useRegisterBus, useBusFormConfig, useMyBusRegistration } from '@/hooks/useBusRegistration';
import { useAuth } from '@/stores/auth';
import { getBusFormState, seatsRemaining } from '@/lib/busFormLogic';
import type { ExamType, HallTicket } from '@/lib/database.types';

const schema = z.object({
  studentName: z.string().min(2, 'Required'),
  scalerId: z.string().min(2, 'Required'),
  centreName: z.string().min(2, 'Required'),
  whatsappNumber: z.string().min(10, 'Enter a valid number'),
  hostel: z.string().min(1, 'Select your hostel'),
});

type FormValues = z.infer<typeof schema>;

const EXAM_LABELS: Record<ExamType, string> = {
  quiz1: 'Quiz 1',
  quiz2: 'Quiz 2',
  endterm: 'End Term',
};

interface BusRegistrationFormProps {
  examType: ExamType;
  hallTicket: HallTicket | null | undefined;
}

export function BusRegistrationForm({ examType, hallTicket }: BusRegistrationFormProps) {
  const { profile } = useAuth();
  const { data: config, isLoading: configLoading, refetch } = useBusFormConfig(examType);
  const { data: myReg, isLoading: regLoading } = useMyBusRegistration(examType);
  const registerBus = useRegisterBus();
  const [, forceUpdate] = useState(0);

  const userCentre = hallTicket?.centre_name ?? null;
  const state = getBusFormState(config, userCentre, !!myReg, !!hallTicket);

  const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      studentName: hallTicket?.student_name ?? profile?.full_name ?? '',
      scalerId: hallTicket?.scaler_id ?? profile?.scaler_id ?? '',
      centreName: hallTicket?.centre_name ?? '',
      whatsappNumber: hallTicket?.whatsapp_number ?? profile?.whatsapp_number ?? '',
      hostel: hallTicket?.hostel ?? profile?.hostel ?? '',
    },
  });

  useEffect(() => {
    if (hallTicket) {
      setValue('studentName', hallTicket.student_name);
      setValue('scalerId', hallTicket.scaler_id);
      setValue('centreName', hallTicket.centre_name);
      if (hallTicket.whatsapp_number) setValue('whatsappNumber', hallTicket.whatsapp_number);
      if (hallTicket.hostel) setValue('hostel', hallTicket.hostel);
    }
  }, [hallTicket, setValue]);

  const hostelValue = watch('hostel');

  if (configLoading || regLoading) {
    return <Skeleton className="h-32 rounded-lg" />;
  }

  if (state === 'not_configured') {
    return (
      <Card>
        <CardBody>
          <p className="text-[13px] text-fgmuted text-center py-4">
            Bus registration details for {EXAM_LABELS[examType]} will be announced soon.
          </p>
        </CardBody>
      </Card>
    );
  }

  if (state === 'countdown' && config?.open_at) {
    return <BusCountdown openAt={config.open_at} onExpire={() => { void refetch(); forceUpdate(n => n + 1); }} />;
  }

  if (state === 'closed') {
    return (
      <Card>
        <CardBody>
          <p className="text-[13px] text-fgmuted text-center py-4">
            Bus registration for {EXAM_LABELS[examType]} is now closed.
          </p>
        </CardBody>
      </Card>
    );
  }

  if (state === 'ineligible' && userCentre) {
    const eligible = config?.eligible_centres ?? [];
    return (
      <Card>
        <CardBody className="space-y-2">
          <div className="flex items-center gap-2">
            <XCircle className="h-5 w-5 text-fgmuted shrink-0" />
            <div>
              <div className="text-[13px] font-medium">Bus not available for your centre</div>
              <div className="text-[12px] text-fgmuted mt-0.5">
                The bus to <strong>{userCentre}</strong> is not running for this exam.
                {eligible.length > 0 && ` It serves: ${eligible.join(', ')}.`}
              </div>
            </div>
          </div>
        </CardBody>
      </Card>
    );
  }

  if (state === 'registered' && myReg) {
    return <BusStatusCard registration={myReg} examType={examType} />;
  }

  if (state === 'full') {
    return (
      <Card>
        <CardBody>
          <p className="text-[13px] text-fgmuted text-center py-4">
            Bus registration is full. No seats remaining for {EXAM_LABELS[examType]}.
          </p>
        </CardBody>
      </Card>
    );
  }

  // state === 'open'
  const seats = config ? seatsRemaining(config) : null;

  const onSubmit = async (data: FormValues) => {
    await registerBus.mutateAsync({
      examType,
      studentName: data.studentName,
      scalerId: data.scalerId,
      centreName: data.centreName,
      whatsappNumber: data.whatsappNumber,
      hostel: data.hostel,
    });
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Bus className="h-4 w-4 text-accent" />
            Bus Registration — {EXAM_LABELS[examType]}
          </CardTitle>
          {seats !== null && (
            <span className="text-[12px] text-fgmuted">
              <span className={seats < 10 ? 'text-warning font-medium' : 'text-fg'}>{seats}</span> seats left
            </span>
          )}
        </div>
        {config?.bus_departure_time && (
          <p className="text-[12px] text-fgmuted mt-1">
            Departure: {config.bus_departure_time} · Pickup: {config.bus_pickup_location ?? 'Hostel Gate'}
          </p>
        )}
      </CardHeader>
      <CardBody>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label>Full Name</Label>
              <Input className="mt-1" {...register('studentName')} />
              {errors.studentName && <p className="text-[11px] text-danger mt-1">{errors.studentName.message}</p>}
            </div>
            <div>
              <Label>Scaler ID</Label>
              <Input className="mt-1" {...register('scalerId')} />
              {errors.scalerId && <p className="text-[11px] text-danger mt-1">{errors.scalerId.message}</p>}
            </div>
          </div>

          <div>
            <Label>Exam Centre</Label>
            <Input className="mt-1" {...register('centreName')} />
            {errors.centreName && <p className="text-[11px] text-danger mt-1">{errors.centreName.message}</p>}
          </div>

          <div>
            <Label>WhatsApp Number</Label>
            <div className="flex mt-1">
              <span className="inline-flex items-center px-3 rounded-l-md border border-r-0 border-border bg-surface2 text-fgmuted text-sm">+91</span>
              <Input className="rounded-l-none" {...register('whatsappNumber')} />
            </div>
            {errors.whatsappNumber && <p className="text-[11px] text-danger mt-1">{errors.whatsappNumber.message}</p>}
          </div>

          <div>
            <Label>Hostel</Label>
            <Select value={hostelValue} onValueChange={(v) => setValue('hostel', v)}>
              <SelectTrigger className="mt-1 w-full"><SelectValue placeholder="Select hostel" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Uniworld 1">Uniworld 1</SelectItem>
                <SelectItem value="Uniworld 2">Uniworld 2</SelectItem>
              </SelectContent>
            </Select>
            {errors.hostel && <p className="text-[11px] text-danger mt-1">{errors.hostel.message}</p>}
          </div>

          <Button type="submit" className="w-full" loading={registerBus.isPending}>
            Register for Bus
          </Button>
        </form>
      </CardBody>
    </Card>
  );
}
