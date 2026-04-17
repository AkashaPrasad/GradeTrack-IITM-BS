import { useEffect, useRef, useState } from 'react';

export function useTitle(title: string) {
  useEffect(() => {
    const prev = document.title;
    document.title = title ? `${title} · GradeTrack` : 'GradeTrack';
    return () => { document.title = prev; };
  }, [title]);
}

export function useDebouncedCallback<T extends (...args: any[]) => void>(cb: T, delayMs: number) {
  const ref = useRef(cb);
  ref.current = cb;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  return ((...args: any[]) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => ref.current(...args), delayMs);
  }) as T;
}

export function useMediaQuery(query: string): boolean {
  const [match, setMatch] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia(query).matches : false
  );
  useEffect(() => {
    const mql = window.matchMedia(query);
    const handler = () => setMatch(mql.matches);
    handler();
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, [query]);
  return match;
}

export function useIsOnline(): boolean {
  const [online, setOnline] = useState(() => navigator.onLine);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);
  return online;
}
