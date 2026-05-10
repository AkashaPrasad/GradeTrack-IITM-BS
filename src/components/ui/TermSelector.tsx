import { ChevronDown } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/Select';
import { Badge } from '@/components/ui/Badge';
import { useAllTerms } from '@/hooks/useData';
import type { Term } from '@/lib/database.types';
import { formatDate } from '@/lib/utils';

interface TermSelectorProps {
  value:    string | null;
  onChange: (termId: string) => void;
  /** Override the term list — if provided, the internal useAllTerms call is ignored */
  terms?:   Term[];
}

export function TermSelector({ value, onChange, terms: termsProp }: TermSelectorProps) {
  const { data: allTerms = [], isLoading } = useAllTerms();
  const terms = termsProp ?? allTerms;
  const loading = termsProp !== undefined ? false : isLoading;

  if (loading) {
    return <div className="h-9 w-44 shimmer rounded-md" />;
  }

  if (terms.length === 0) return null;

  const selected = terms.find((t) => t.id === value);

  return (
    <div className="flex items-center gap-2">
      <Select value={value ?? ''} onValueChange={onChange}>
        <SelectTrigger className="h-8 text-[13px] w-auto min-w-[160px] gap-1 pr-2">
          <SelectValue>
            <span>{selected?.name ?? 'Select term'}</span>
          </SelectValue>
          <ChevronDown className="h-3.5 w-3.5 text-fgmuted" />
        </SelectTrigger>
        <SelectContent>
          {terms.map((term) => (
            <SelectItem key={term.id} value={term.id}>
              <div className="flex items-center gap-2">
                <span>{term.name}</span>
                {term.is_active && (
                  <Badge variant="success" className="text-[10px] py-0">Active</Badge>
                )}
              </div>
              <div className="text-[11px] text-fgmuted">
                {formatDate(term.start_date)} – {formatDate(term.end_date)}
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

/** Returns the best default term ID: active term if it exists, otherwise the most recent term */
export function useDefaultTermId(terms: Term[]): string | null {
  if (terms.length === 0) return null;
  const active = terms.find((t) => t.is_active);
  return active?.id ?? terms[0]?.id ?? null;
}
