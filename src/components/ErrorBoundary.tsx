import React from 'react';
import { Button } from './ui/Button';
import { logEvent } from '@/lib/supabase';

interface S { error: Error | null }

export class ErrorBoundary extends React.Component<{ children: React.ReactNode; fallback?: React.ReactNode }, S> {
  state: S = { error: null };

  static getDerivedStateFromError(error: Error) { return { error }; }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    logEvent('error.render', { message: error.message, stack: error.stack, info: info.componentStack }, 'error');
    // eslint-disable-next-line no-console
    console.error('[ErrorBoundary]', error, info);
  }

  reset = () => this.setState({ error: null });

  render() {
    if (!this.state.error) return this.props.children;
    if (this.props.fallback) return this.props.fallback;
    return (
      <div className="min-h-[240px] grid place-items-center p-6">
        <div className="max-w-md text-center">
          <div className="mx-auto mb-4 h-10 w-10 rounded-lg bg-danger/15 grid place-items-center text-danger">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 9v4M12 17h.01" /><circle cx="12" cy="12" r="10" /></svg>
          </div>
          <h2 className="text-base font-semibold tracking-tighter">Something went wrong</h2>
          <p className="mt-1 text-sm text-fgmuted">{this.state.error.message}</p>
          <Button onClick={this.reset} className="mt-4" variant="secondary" size="sm">Try again</Button>
        </div>
      </div>
    );
  }
}
