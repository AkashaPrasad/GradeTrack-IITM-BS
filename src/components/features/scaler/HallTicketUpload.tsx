import { useCallback, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Upload, FileText, AlertCircle } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { Input, Label } from '@/components/ui/Input';
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '@/components/ui/Select';
import { useUploadHallTicket } from '@/hooks/useHallTicket';
import { useAuth } from '@/stores/auth';
import { extractHallTicketData } from '@/lib/hallTicketParser';
import type { ExamType } from '@/lib/database.types';

const schema = z.object({
  studentName: z.string().min(2, 'Required'),
  scalerId: z.string().min(2, 'Required'),
  centreName: z.string().min(2, 'Required'),
  examDate: z.string().min(1, 'Required'),
  examTiming: z.string().min(1, 'Required'),
  whatsappNumber: z.string().min(10, 'Enter a valid number'),
  hostel: z.enum(['Uniworld 1', 'Uniworld 2'], { required_error: 'Select your hostel' }),
  examType: z.enum(['quiz1', 'quiz2', 'endterm']),
});

type FormValues = z.infer<typeof schema>;

interface HallTicketUploadProps {
  open: boolean;
  onClose: () => void;
  examType: ExamType;
  defaultExamDate?: string;
}

export function HallTicketUpload({ open, onClose, examType, defaultExamDate }: HallTicketUploadProps) {
  const { profile } = useAuth();
  const upload = useUploadHallTicket();
  const fileRef = useRef<HTMLInputElement>(null);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [extractError, setExtractError] = useState<string | null>(null);

  const { register, handleSubmit, setValue, watch, reset, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      examType,
      examDate: defaultExamDate ?? '',
      whatsappNumber: profile?.whatsapp_number ?? '',
      hostel: (profile?.hostel as 'Uniworld 1' | 'Uniworld 2' | undefined) ?? undefined,
    },
  });

  const handleFile = useCallback(async (file: File) => {
    if (file.size > 10 * 1024 * 1024) {
      setExtractError('File too large (max 10 MB)');
      return;
    }
    setPdfFile(file);
    setExtracting(true);
    setExtractError(null);
    try {
      const parsed = await extractHallTicketData(file);
      if (parsed.studentName) setValue('studentName', parsed.studentName);
      if (parsed.scalerId) setValue('scalerId', parsed.scalerId);
      if (parsed.centreName) setValue('centreName', parsed.centreName);
      if (parsed.examDate) setValue('examDate', parsed.examDate);
      if (parsed.examTiming) setValue('examTiming', parsed.examTiming);
      if (parsed.examType) setValue('examType', parsed.examType);
    } catch {
      setExtractError("We couldn't extract details automatically. Please fill in the form manually.");
    } finally {
      setExtracting(false);
    }
  }, [setValue]);

  const onSubmit = async (data: FormValues) => {
    await upload.mutateAsync({
      examType: data.examType,
      studentName: data.studentName,
      scalerId: data.scalerId,
      centreName: data.centreName,
      examDate: data.examDate,
      examTiming: data.examTiming,
      whatsappNumber: data.whatsappNumber,
      hostel: data.hostel,
      pdfFile: pdfFile ?? undefined,
    });
    reset();
    setPdfFile(null);
    onClose();
  };

  const hostelValue = watch('hostel');
  const examTypeValue = watch('examType');

  const EXAM_LABELS: Record<ExamType, string> = { quiz1: 'Quiz 1', quiz2: 'Quiz 2', endterm: 'End Term' };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogTitle>Upload Hall Ticket</DialogTitle>
        <DialogDescription>
          Upload your PDF and we'll extract details automatically. You can edit anything before saving.
        </DialogDescription>

        {/* PDF Drop Zone */}
        <div
          className="mt-4 border-2 border-dashed border-border rounded-lg p-5 text-center cursor-pointer hover:border-accent/50 transition-colors"
          onClick={() => fileRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            const f = e.dataTransfer.files[0];
            if (f?.type === 'application/pdf') void handleFile(f);
          }}
        >
          <input
            ref={fileRef}
            type="file"
            accept="application/pdf"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void handleFile(f);
            }}
          />
          {pdfFile ? (
            <div className="flex items-center justify-center gap-2 text-sm">
              <FileText className="h-5 w-5 text-accent" />
              <span className="text-fg font-medium">{pdfFile.name}</span>
            </div>
          ) : (
            <div className="space-y-1">
              <Upload className="h-8 w-8 text-fgsubtle mx-auto" />
              <p className="text-sm text-fgmuted">
                {extracting ? 'Extracting details…' : 'Click or drag PDF here'}
              </p>
              <p className="text-[11px] text-fgsubtle">PDF only, max 10 MB</p>
            </div>
          )}
        </div>

        {extracting && (
          <div className="flex items-center gap-2 text-sm text-fgmuted">
            <span className="h-2 w-2 rounded-full bg-accent animate-pulse" />
            Extracting details from your hall ticket…
          </div>
        )}

        {extractError && (
          <div className="flex items-start gap-2 text-[12px] text-warning bg-warning/10 rounded-md p-3">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            {extractError}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit(onSubmit)} className="mt-4 space-y-3">
          <div>
            <Label>Exam</Label>
            <Select value={examTypeValue} onValueChange={(v) => setValue('examType', v as ExamType)}>
              <SelectTrigger className="mt-1 w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                {(['quiz1', 'quiz2', 'endterm'] as ExamType[]).map(t => (
                  <SelectItem key={t} value={t}>{EXAM_LABELS[t]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="studentName">Student Name</Label>
            <Input id="studentName" className="mt-1" {...register('studentName')} />
            {errors.studentName && <p className="text-[11px] text-danger mt-1">{errors.studentName.message}</p>}
          </div>

          <div>
            <Label htmlFor="scalerId">Scaler ID / Roll No</Label>
            <Input id="scalerId" className="mt-1" {...register('scalerId')} />
            {errors.scalerId && <p className="text-[11px] text-danger mt-1">{errors.scalerId.message}</p>}
          </div>

          <div>
            <Label htmlFor="centreName">Exam Centre</Label>
            <Input id="centreName" className="mt-1" {...register('centreName')} />
            {errors.centreName && <p className="text-[11px] text-danger mt-1">{errors.centreName.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="examDate">Exam Date</Label>
              <Input id="examDate" type="date" className="mt-1" {...register('examDate')} />
              {errors.examDate && <p className="text-[11px] text-danger mt-1">{errors.examDate.message}</p>}
            </div>
            <div>
              <Label htmlFor="examTiming">Timing / Slot</Label>
              <Input id="examTiming" placeholder="e.g. 10:00 AM" className="mt-1" {...register('examTiming')} />
              {errors.examTiming && <p className="text-[11px] text-danger mt-1">{errors.examTiming.message}</p>}
            </div>
          </div>

          <div>
            <Label htmlFor="whatsappNumber">WhatsApp Number</Label>
            <div className="flex mt-1">
              <span className="inline-flex items-center px-3 rounded-l-md border border-r-0 border-border bg-surface2 text-fgmuted text-sm">+91</span>
              <Input
                id="whatsappNumber"
                placeholder="9876543210"
                className="rounded-l-none"
                {...register('whatsappNumber')}
              />
            </div>
            {errors.whatsappNumber && <p className="text-[11px] text-danger mt-1">{errors.whatsappNumber.message}</p>}
          </div>

          <div>
            <Label>Hostel</Label>
            <Select value={hostelValue ?? ''} onValueChange={(v) => setValue('hostel', v as 'Uniworld 1' | 'Uniworld 2')}>
              <SelectTrigger className="mt-1 w-full"><SelectValue placeholder="Select hostel" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Uniworld 1">Uniworld 1</SelectItem>
                <SelectItem value="Uniworld 2">Uniworld 2</SelectItem>
              </SelectContent>
            </Select>
            {errors.hostel && <p className="text-[11px] text-danger mt-1">{errors.hostel.message}</p>}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
            <Button type="submit" size="sm" loading={upload.isPending}>
              Save Hall Ticket
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
