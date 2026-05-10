import { useCallback, useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { AlertCircle, CheckCircle2, MapPin, Search, PenLine } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { Input, Label, Textarea } from '@/components/ui/Input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/Select';
import { useUploadHallTicket } from '@/hooks/useHallTicket';
import { useExamCentres } from '@/hooks/useExamCentres';
import { useAuth } from '@/stores/auth';
import type { ExamCentre, ExamType } from '@/lib/database.types';

const schema = z.object({
  studentName:    z.string().min(2, 'Name is required'),
  scalerId:       z.string().min(2, 'Roll number is required'),
  whatsappNumber: z.string().min(10, 'Enter a valid WhatsApp number'),
  hostel:         z.enum(['Uniworld 1', 'Uniworld 2'], { required_error: 'Select your hostel' }),
  centreMode:     z.enum(['list', 'custom']),
  centreName:     z.string().min(2, 'Centre name is required'),
  centreAddress:  z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

const EXAM_LABELS: Record<ExamType, string> = {
  quiz1:   'Quiz 1',
  quiz2:   'Quiz 2',
  endterm: 'End Term',
};

interface HallTicketUploadProps {
  open:           boolean;
  onClose:        () => void;
  examType:       ExamType;
  defaultExamDate?: string;
}

function CentreOption({
  centre,
  selected,
  onSelect,
}: {
  centre: ExamCentre;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full text-left px-3 py-2.5 rounded-lg border transition-colors ${
        selected
          ? 'border-accent bg-accent/10 text-fg'
          : 'border-border bg-surface hover:border-accent/40 hover:bg-surface2'
      }`}
    >
      <div className="flex items-start gap-2">
        <MapPin className={`h-3.5 w-3.5 mt-0.5 shrink-0 ${selected ? 'text-accent' : 'text-fgmuted'}`} />
        <div className="min-w-0">
          <div className="text-[13px] font-medium truncate">{centre.name}</div>
          <div className="text-[11px] text-fgmuted truncate">{centre.city} · {centre.address}</div>
        </div>
        {selected && <CheckCircle2 className="h-4 w-4 text-accent ml-auto shrink-0" />}
      </div>
    </button>
  );
}

export function HallTicketUpload({ open, onClose, examType, defaultExamDate }: HallTicketUploadProps) {
  const { profile }              = useAuth();
  const upload                   = useUploadHallTicket();
  const { data: centres = [] }   = useExamCentres();
  const [centreSearch, setCentreSearch] = useState('');
  const [selectedCentre, setSelectedCentre] = useState<ExamCentre | null>(null);

  const defaults = useMemo(() => ({
    studentName:    profile?.full_name ?? '',
    scalerId:       profile?.scaler_id ?? '',
    whatsappNumber: profile?.whatsapp_number ?? '',
    hostel:         (profile?.hostel as 'Uniworld 1' | 'Uniworld 2' | undefined) ?? undefined,
    centreMode:     'list' as const,
    centreName:     '',
    centreAddress:  '',
  }), [profile]);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: defaults,
  });

  const resetDialog = useCallback(() => {
    reset(defaults);
    setSelectedCentre(null);
    setCentreSearch('');
  }, [defaults, reset]);

  useEffect(() => {
    if (open) resetDialog();
  }, [open, resetDialog]);

  const centreMode    = watch('centreMode');
  const hostelValue   = watch('hostel');
  const centreNameVal = watch('centreName');

  const filteredCentres = useMemo(() => {
    const q = centreSearch.trim().toLowerCase();
    if (!q) return centres;
    return centres.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.city.toLowerCase().includes(q) ||
        c.address.toLowerCase().includes(q),
    );
  }, [centres, centreSearch]);

  const handleSelectCentre = (centre: ExamCentre) => {
    setSelectedCentre(centre);
    setValue('centreName', centre.name);
    setValue('centreAddress', centre.address);
  };

  const handleSwitchToCustom = () => {
    setValue('centreMode', 'custom');
    setValue('centreName', '');
    setValue('centreAddress', '');
    setSelectedCentre(null);
  };

  const handleSwitchToList = () => {
    setValue('centreMode', 'list');
    setValue('centreName', '');
    setValue('centreAddress', '');
    setSelectedCentre(null);
  };

  const onSubmit = async (data: FormValues) => {
    await upload.mutateAsync({
      examType,
      studentName:    data.studentName,
      scalerId:       data.scalerId,
      centreName:     data.centreName,
      centreAddress:  data.centreAddress ?? '',
      whatsappNumber: data.whatsappNumber,
      hostel:         data.hostel,
      examDate:       defaultExamDate ?? null,
      isSuggested:    data.centreMode === 'custom',
    });
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-h-[90vh] overflow-y-auto max-w-lg">
        <DialogTitle>Register Exam Centre — {EXAM_LABELS[examType]}</DialogTitle>
        <DialogDescription>
          Select your exam centre from the list or suggest your own if it&apos;s not listed.
        </DialogDescription>

        <form onSubmit={handleSubmit(onSubmit)} className="mt-4 space-y-4">
          {/* Personal details */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label>Full Name</Label>
              <Input className="mt-1" {...register('studentName')} />
              {errors.studentName && (
                <p className="mt-1 text-[11px] text-danger">{errors.studentName.message}</p>
              )}
            </div>
            <div>
              <Label>Roll Number</Label>
              <Input className="mt-1" placeholder="DSxxBSxxxxxxx" {...register('scalerId')} />
              {errors.scalerId && (
                <p className="mt-1 text-[11px] text-danger">{errors.scalerId.message}</p>
              )}
            </div>
          </div>

          <div>
            <Label>WhatsApp Number</Label>
            <div className="mt-1 flex">
              <span className="inline-flex items-center px-3 rounded-l-md border border-r-0 border-border bg-surface2 text-fgmuted text-sm">
                +91
              </span>
              <Input className="rounded-l-none" placeholder="9876543210" {...register('whatsappNumber')} />
            </div>
            {errors.whatsappNumber && (
              <p className="mt-1 text-[11px] text-danger">{errors.whatsappNumber.message}</p>
            )}
          </div>

          <div>
            <Label>Hostel</Label>
            <Select value={hostelValue ?? ''} onValueChange={(v) => setValue('hostel', v as 'Uniworld 1' | 'Uniworld 2')}>
              <SelectTrigger className="mt-1 w-full">
                <SelectValue placeholder="Select hostel" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Uniworld 1">Uniworld 1</SelectItem>
                <SelectItem value="Uniworld 2">Uniworld 2</SelectItem>
              </SelectContent>
            </Select>
            {errors.hostel && (
              <p className="mt-1 text-[11px] text-danger">{errors.hostel.message}</p>
            )}
          </div>

          {/* Centre selection */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Label>Exam Centre</Label>
              {centreMode === 'list' ? (
                <button
                  type="button"
                  onClick={handleSwitchToCustom}
                  className="ml-auto text-[11px] text-accent hover:underline flex items-center gap-1"
                >
                  <PenLine className="h-3 w-3" />
                  My centre is not in the list
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleSwitchToList}
                  className="ml-auto text-[11px] text-accent hover:underline"
                >
                  Pick from list instead
                </button>
              )}
            </div>

            {centreMode === 'list' ? (
              <div className="space-y-2">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-fgmuted pointer-events-none" />
                  <Input
                    value={centreSearch}
                    onChange={(e) => setCentreSearch(e.target.value)}
                    placeholder="Search centres..."
                    className="pl-8"
                  />
                </div>
                <div className="max-h-52 overflow-y-auto space-y-1.5 rounded-lg border border-border bg-surface p-1.5">
                  {filteredCentres.length === 0 ? (
                    <p className="py-6 text-center text-[12px] text-fgmuted">
                      No centres found. Try a different search or suggest your centre below.
                    </p>
                  ) : (
                    filteredCentres.map((c) => (
                      <CentreOption
                        key={c.id}
                        centre={c}
                        selected={selectedCentre?.id === c.id}
                        onSelect={() => handleSelectCentre(c)}
                      />
                    ))
                  )}
                </div>
                {errors.centreName && !selectedCentre && (
                  <p className="text-[11px] text-danger">{errors.centreName.message}</p>
                )}
              </div>
            ) : (
              <div className="space-y-3 rounded-lg border border-warning/30 bg-warning/5 p-3">
                <div className="flex items-start gap-2 text-[12px] text-warning">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>
                    Your suggested centre will be visible to classmates right away. Admin will review
                    and may add it to the official list.
                  </span>
                </div>
                <div>
                  <Label>Centre Name</Label>
                  <Input
                    className="mt-1"
                    placeholder="Exact name from your hall ticket"
                    value={centreNameVal}
                    {...register('centreName')}
                    onChange={(e) => setValue('centreName', e.target.value)}
                  />
                  {errors.centreName && (
                    <p className="mt-1 text-[11px] text-danger">{errors.centreName.message}</p>
                  )}
                </div>
                <div>
                  <Label>Centre Address</Label>
                  <Textarea
                    className="mt-1"
                    rows={3}
                    placeholder="Copy the full address from your hall ticket"
                    {...register('centreAddress')}
                  />
                  <p className="mt-1 text-[11px] text-fgsubtle">
                    Paste the exact address so classmates can search the right location.
                  </p>
                </div>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="ghost" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              loading={upload.isPending}
              disabled={centreMode === 'list' && !selectedCentre}
            >
              Save Centre
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
