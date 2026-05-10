import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown, ChevronUp, ExternalLink, MapPin } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ExpandableAddressProps {
  centreName: string;
  address: string;
  city?: string | null;
  mapsUrl?: string | null;
  defaultExpanded?: boolean;
  showInCard?: boolean;
}

export function ExpandableAddress({
  centreName,
  address,
  city,
  mapsUrl,
  defaultExpanded = false,
  showInCard = false,
}: ExpandableAddressProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const summary = city ? `${centreName}, ${city}` : centreName;

  return (
    <div className={cn('rounded-md', showInCard && 'bg-surface2/50 px-3 py-2')}>
      <button
        type="button"
        onClick={() => setExpanded((value) => !value)}
        className="flex w-full items-center justify-between gap-3 text-left"
      >
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 text-[13px] font-medium">
            <MapPin className="h-3.5 w-3.5 text-accent shrink-0" />
            <span className="truncate">{summary}</span>
          </div>
        </div>
        {expanded ? (
          <ChevronUp className="h-4 w-4 text-fgmuted shrink-0" />
        ) : (
          <ChevronDown className="h-4 w-4 text-fgmuted shrink-0" />
        )}
      </button>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="overflow-hidden"
          >
            <div className="pt-2 text-[12px] text-fgmuted space-y-2">
              <p className="whitespace-pre-line leading-relaxed">{address}</p>
              {mapsUrl && (
                <a
                  href={mapsUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-accent hover:underline"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  Open in Maps
                </a>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
