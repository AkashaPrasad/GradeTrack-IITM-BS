import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(d: string | Date | null | undefined, opts?: Intl.DateTimeFormatOptions) {
  if (!d) return '—';
  const date = typeof d === 'string' ? new Date(d) : d;
  if (isNaN(date.getTime())) return '—';
  return date.toLocaleDateString(undefined, opts ?? { month: 'short', day: 'numeric', year: 'numeric' });
}

export function formatDateTime(d: string | Date | null | undefined) {
  if (!d) return '—';
  const date = typeof d === 'string' ? new Date(d) : d;
  if (isNaN(date.getTime())) return '—';
  return date.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
}

export function daysUntil(d: string | Date | null | undefined): number | null {
  if (!d) return null;
  const date = typeof d === 'string' ? new Date(d) : d;
  if (isNaN(date.getTime())) return null;
  const now = new Date();
  const ms = date.getTime() - now.getTime();
  return Math.ceil(ms / (1000 * 60 * 60 * 24));
}

export function pluralize(n: number, s: string, p?: string) {
  return `${n} ${n === 1 ? s : (p ?? s + 's')}`;
}

export function percentage(a: number, b: number): number {
  if (b === 0) return 0;
  return Math.round((a / b) * 100);
}

export function relativeTime(d: string | Date | null | undefined): string {
  if (!d) return '';
  const then = typeof d === 'string' ? new Date(d).getTime() : d.getTime();
  if (Number.isNaN(then)) return '';
  const diffMs = Date.now() - then;
  const sec = Math.floor(diffMs / 1000);
  const min = Math.floor(sec / 60);
  const hr = Math.floor(min / 60);
  const day = Math.floor(hr / 24);
  if (sec < 60) return 'just now';
  if (min < 60) return `${min}m ago`;
  if (hr < 24) return `${hr}h ago`;
  if (day === 1) return 'yesterday';
  if (day < 7) return `${day}d ago`;
  return formatDate(d);
}

export function initialOf(name?: string | null): string {
  if (!name) return '·';
  return name.trim().charAt(0).toUpperCase();
}

// Pattern list of substrings that indicate raw DB/infra errors leaking schema details.
const INTERNAL_ERROR_PATTERNS = [
  'duplicate key', 'violates', 'constraint', 'syntax error', 'relation "',
  'column "', 'operator does not exist', 'invalid input syntax', 'foreign key',
  'pg_', 'supabase', 'postgrest', 'undefined', 'PGRST',
];

/**
 * Convert any thrown value into a user-safe message.
 * DB constraint errors, PostgREST codes, and stack traces are replaced with a
 * generic fallback so internal schema details are never shown in the UI.
 */
export function toUserMessage(err: unknown, fallback = 'Something went wrong. Please try again.'): string {
  let msg: string;
  if (err instanceof Error) {
    msg = err.message;
  } else if (typeof err === 'object' && err !== null && 'message' in err) {
    msg = String((err as { message: unknown }).message);
  } else {
    msg = String(err);
  }
  const lower = msg.toLowerCase();
  const looksInternal = INTERNAL_ERROR_PATTERNS.some(p => lower.includes(p.toLowerCase())) || msg.length > 300;
  return looksInternal ? fallback : msg;
}
