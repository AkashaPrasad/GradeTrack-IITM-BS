import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, MapPin, Pencil, Search, Sparkles } from 'lucide-react';
import { Input, Label } from '@/components/ui/Input';
import type { ExamCentre } from '@/lib/database.types';
import { cn } from '@/lib/utils';

interface CentreSelection {
  name: string;
  address: string;
  city?: string | null;
  mapsUrl?: string | null;
}

interface CentreSelectProps {
  centres: ExamCentre[];
  value: string;
  /** Called when user selects a centre from the dropdown */
  onSelect: (value: CentreSelection) => void;
  /** Called when user types in the input (no address change) */
  onTyping?: (name: string) => void;
  disabled?: boolean;
  /** Show a green "Auto-filled from PDF" badge on the label */
  autoFilled?: boolean;
}

export function CentreSelect({ centres, value, onSelect, onTyping, disabled, autoFilled }: CentreSelectProps) {
  const [open, setOpen] = useState(false);

  const filtered = useMemo(() => {
    const query = value.trim().toLowerCase();
    if (!query) return centres;
    return centres.filter((centre) =>
      [centre.name, centre.city, centre.address]
        .filter(Boolean)
        .some((part) => part.toLowerCase().includes(query)),
    );
  }, [centres, value]);

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Label htmlFor="centre-search">Test Centre Name</Label>
        {autoFilled && (
          <span className="inline-flex items-center gap-1 text-[11px] text-success">
            <Sparkles className="h-3 w-3" />
            Auto-filled from PDF
          </span>
        )}
        {!autoFilled && (
          <span className="inline-flex items-center gap-1 text-[11px] text-fgsubtle">
            <Pencil className="h-3 w-3" />
            editable
          </span>
        )}
      </div>
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-fgmuted pointer-events-none" />
        <Input
          id="centre-search"
          value={value}
          disabled={disabled}
          onChange={(e) => {
            onTyping?.(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          placeholder="Search or type your centre name"
          className="pl-8"
        />
      </div>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="max-h-60 overflow-y-auto rounded-lg border border-border bg-surface shadow-sm"
          >
            {filtered.length > 0 ? (
              filtered.map((centre) => {
                const selected = value.trim().toLowerCase() === centre.name.trim().toLowerCase();
                return (
                  <button
                    key={centre.id}
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      onSelect({
                        name: centre.name,
                        address: centre.address,
                        city: centre.city,
                        mapsUrl: centre.maps_url,
                      });
                      setOpen(false);
                    }}
                    className={cn(
                      'flex w-full items-start gap-3 border-l-2 px-3 py-3 text-left transition-colors hover:bg-surface2',
                      selected ? 'border-accent bg-surface2/60' : 'border-transparent',
                    )}
                  >
                    <div className="mt-0.5 text-accent">
                      {selected ? <Check className="h-4 w-4" /> : <MapPin className="h-4 w-4" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <div className="truncate text-[13px] font-medium">{centre.name}</div>
                        <div className="shrink-0 text-[11px] text-fgmuted">{centre.city}</div>
                      </div>
                      <div className="mt-1 truncate text-[11px] text-fgmuted">
                        {centre.address}
                        {centre.pincode ? ` ${centre.pincode}` : ''}
                      </div>
                    </div>
                  </button>
                );
              })
            ) : (
              <div className="px-3 py-3 text-[12px] text-fgmuted">
                Centre not in list — keep typing to use a custom name.
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
