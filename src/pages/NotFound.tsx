import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { useTitle } from '@/lib/hooks';

export default function NotFound() {
  useTitle('Not found');
  return (
    <div className="min-h-screen grid place-items-center p-6">
      <div className="max-w-xs text-center">
        <div className="text-6xl font-bold tracking-tightest text-fgsubtle">404</div>
        <p className="mt-2 text-sm text-fgmuted">This page doesn't exist.</p>
        <Link to="/dashboard">
          <Button variant="secondary" className="mt-5">Go to Dashboard</Button>
        </Link>
      </div>
    </div>
  );
}
