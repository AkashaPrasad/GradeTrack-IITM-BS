import { Navigate, useLocation } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuth } from '@/stores/auth';
import { useEffect, useRef } from 'react';

export function ScalerGuard({ children }: { children: React.ReactNode }) {
  const { profile, profileResolved } = useAuth();
  const loc = useLocation();
  const toasted = useRef(false);

  const isVerified = !!profile?.is_scaler_verified;

  useEffect(() => {
    if (profileResolved && !isVerified && !toasted.current) {
      toasted.current = true;
      toast.error('Verify your Scaler identity to access this feature.', { duration: 4000 });
    }
  }, [profileResolved, isVerified]);

  if (!profileResolved) return null;

  if (!isVerified) {
    return <Navigate to="/profile" replace state={{ from: loc.pathname }} />;
  }

  return <>{children}</>;
}
