import { useState } from 'react';
import { PlusCircle, CheckCircle2, BookOpen } from 'lucide-react';
import {
  Dialog, DialogContent, DialogTitle, DialogDescription, DialogClose,
} from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { Input, Label } from '@/components/ui/Input';
import { Skeleton } from '@/components/ui/Skeleton';
import { useSubjectsForNewTerm, useCreateStudentTerm } from '@/hooks/useData';
import { cn } from '@/lib/utils';
import type { TermType } from '@/lib/database.types';

const TERM_TYPES: { type: TermType; label: string; months: string; color: string }[] = [
  { type: 'jan', label: 'January',   months: 'Jan – Apr', color: 'border-blue-400/60 bg-blue-50/50 dark:bg-blue-950/30'   },
  { type: 'may', label: 'May',       months: 'May – Aug', color: 'border-green-400/60 bg-green-50/50 dark:bg-green-950/30' },
  { type: 'sep', label: 'September', months: 'Sep – Dec', color: 'border-orange-400/60 bg-orange-50/50 dark:bg-orange-950/30' },
];

const LEVELS = [
  { id: 'foundation', label: 'Foundation', desc: 'Years 1 & 2',  color: 'border-violet-400/60 bg-violet-50/50 dark:bg-violet-950/30' },
  { id: 'diploma',    label: 'Diploma',    desc: 'Years 3 & 4',  color: 'border-teal-400/60 bg-teal-50/50 dark:bg-teal-950/30'      },
];

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated?: () => void;
  existingCount?: number;
}

export function CreateTermModal({ open, onOpenChange, onCreated, existingCount = 0 }: Props) {
  const create = useCreateStudentTerm();

  const [step, setStep]                   = useState<1 | 2 | 3 | 4>(1);
  const [selectedType, setSelectedType]   = useState<TermType | null>(null);
  const [selectedLevel, setSelectedLevel] = useState<string>('');
  const [selectedIds, setSelectedIds]     = useState<Set<string>>(new Set());
  const [customName, setCustomName]       = useState('');

  const { data: subjects = [], isLoading: subjectsLoading } = useSubjectsForNewTerm(selectedType, selectedLevel);

  const autoName = selectedType && selectedLevel
    ? `${selectedLevel.charAt(0).toUpperCase() + selectedLevel.slice(1)} ${selectedType.charAt(0).toUpperCase() + selectedType.slice(1)} ${new Date().getFullYear()}`
    : `Term ${existingCount + 1}`;

  const toggleSubject = (id: string) =>
    setSelectedIds(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });

  const handleCreate = async () => {
    if (!selectedType || !selectedLevel) return;
    await create.mutateAsync({
      termType: selectedType,
      level: selectedLevel,
      customName: customName.trim() || autoName,
      subjectIds: [...selectedIds],
    });
    onCreated?.();
    onOpenChange(false);
    reset();
  };

  const reset = () => {
    setStep(1); setSelectedType(null); setSelectedLevel('');
    setSelectedIds(new Set()); setCustomName('');
  };

  const handleOpenChange = (v: boolean) => { if (!v) reset(); onOpenChange(v); };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">

        {/* Step indicator */}
        <div className="flex items-center gap-1.5 mb-1">
          {([1, 2, 3, 4] as const).map(n => (
            <div key={n} className={cn(
              'h-1.5 flex-1 rounded-full transition-colors',
              n <= step ? 'bg-accent' : 'bg-border'
            )} />
          ))}
        </div>

        {/* ── Step 1: Semester ── */}
        {step === 1 && (
          <>
            <DialogTitle>Which semester?</DialogTitle>
            <DialogDescription>Select the semester you are enrolling in.</DialogDescription>
            <div className="mt-4 grid grid-cols-3 gap-3">
              {TERM_TYPES.map(({ type, label, months, color }) => (
                <button key={type} type="button"
                  onClick={() => { setSelectedType(type); setStep(2); }}
                  className={cn('flex flex-col items-center gap-1.5 rounded-xl border-2 px-3 py-4 text-center transition-all hover:scale-[1.02]', color)}
                >
                  <span className="text-[14px] font-semibold">{label}</span>
                  <span className="text-[11px] text-fgmuted">{months}</span>
                </button>
              ))}
            </div>
          </>
        )}

        {/* ── Step 2: Level ── */}
        {step === 2 && (
          <>
            <DialogTitle>Your programme level</DialogTitle>
            <DialogDescription>
              {TERM_TYPES.find(t => t.type === selectedType)?.label} semester — which level are you in?
            </DialogDescription>
            <div className="mt-4 grid grid-cols-2 gap-3">
              {LEVELS.map(({ id, label, desc, color }) => (
                <button key={id} type="button"
                  onClick={() => { setSelectedLevel(id); setStep(3); }}
                  className={cn('flex flex-col items-start gap-0.5 rounded-xl border-2 px-4 py-4 text-left transition-all hover:scale-[1.01]', color)}
                >
                  <span className="text-[15px] font-semibold">{label}</span>
                  <span className="text-[11px] text-fgmuted">{desc}</span>
                </button>
              ))}
            </div>
            <Button variant="ghost" size="sm" className="mt-3" onClick={() => setStep(1)}>← Back</Button>
          </>
        )}

        {/* ── Step 3: Course selection ── */}
        {step === 3 && (
          <>
            <DialogTitle>Select your courses</DialogTitle>
            <DialogDescription>
              Choose the courses you are taking this semester. You can only view grades for selected courses.
            </DialogDescription>
            <div className="mt-4 space-y-2 max-h-64 overflow-y-auto pr-1">
              {subjectsLoading && (
                <><Skeleton className="h-12" /><Skeleton className="h-12" /><Skeleton className="h-12" /></>
              )}
              {!subjectsLoading && subjects.length === 0 && (
                <div className="rounded-lg border border-border bg-surface2 px-4 py-3 text-[13px] text-fgmuted">
                  No courses found for this level. You can still create the term — ask your admin to add courses.
                </div>
              )}
              {subjects.map(s => {
                const selected = selectedIds.has(s.id);
                return (
                  <button key={s.id} type="button" onClick={() => toggleSubject(s.id)}
                    className={cn(
                      'w-full flex items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors',
                      selected ? 'border-accent bg-accent/5' : 'border-border hover:bg-surface2'
                    )}
                  >
                    <div className={cn(
                      'h-5 w-5 rounded-full border-2 grid place-items-center shrink-0 transition-colors',
                      selected ? 'border-accent bg-accent' : 'border-border'
                    )}>
                      {selected && <CheckCircle2 className="h-3 w-3 text-white" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-[13px] font-medium">{s.name}</div>
                      <div className="text-[11px] text-fgmuted">{s.code} · {s.credits} cr</div>
                    </div>
                  </button>
                );
              })}
            </div>
            <div className="flex items-center justify-between mt-3 pt-2 border-t border-border">
              <Button variant="ghost" size="sm" onClick={() => setStep(2)}>← Back</Button>
              <div className="flex items-center gap-2">
                <span className="text-[12px] text-fgmuted">{selectedIds.size} selected</span>
                <Button size="sm" onClick={() => setStep(4)}>
                  Continue →
                </Button>
              </div>
            </div>
          </>
        )}

        {/* ── Step 4: Name + Submit ── */}
        {step === 4 && (
          <>
            <DialogTitle>Name this term</DialogTitle>
            <DialogDescription>
              {selectedIds.size > 0
                ? `${selectedIds.size} course${selectedIds.size !== 1 ? 's' : ''} selected for this term.`
                : 'No courses selected — you can add them from the Grades page later.'}
            </DialogDescription>
            <div className="mt-4 space-y-4">
              <div>
                <Label>Term name</Label>
                <Input
                  className="mt-1"
                  placeholder={autoName}
                  value={customName}
                  onChange={e => setCustomName(e.target.value)}
                />
                <p className="text-[11px] text-fgmuted mt-1">
                  e.g. "Foundation Year 1", "Diploma Sem 2". Leave blank to use "{autoName}".
                </p>
              </div>

              {/* Summary */}
              <div className="rounded-lg bg-surface2 px-3 py-2.5 text-[12px] space-y-1">
                <div className="flex justify-between">
                  <span className="text-fgmuted">Semester</span>
                  <span className="font-medium">{TERM_TYPES.find(t => t.type === selectedType)?.label}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-fgmuted">Level</span>
                  <span className="font-medium capitalize">{selectedLevel}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-fgmuted">Courses</span>
                  <span className="font-medium">{selectedIds.size}</span>
                </div>
              </div>

              <div className="flex justify-between gap-3 pt-1">
                <Button variant="ghost" size="sm" onClick={() => setStep(3)}>← Back</Button>
                <div className="flex gap-2">
                  <DialogClose asChild>
                    <Button variant="ghost" size="sm">Cancel</Button>
                  </DialogClose>
                  <Button
                    size="sm" className="gap-1.5"
                    disabled={!selectedType || !selectedLevel || create.isPending}
                    loading={create.isPending}
                    onClick={handleCreate}
                  >
                    <PlusCircle className="h-3.5 w-3.5" />
                    Create term
                  </Button>
                </div>
              </div>
            </div>
          </>
        )}

      </DialogContent>
    </Dialog>
  );
}
