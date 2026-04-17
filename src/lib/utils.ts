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

export function initialOf(name?: string | null): string {
  if (!name) return '·';
  return name.trim().charAt(0).toUpperCase();
}
