import { useCallback, useState } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/stores/auth';

const SCALER_DOMAIN =
  (import.meta.env.VITE_SCALER_EMAIL_DOMAIN as string | undefined) ?? '@sst.scaler.com';

function isScalerEmail(email: string): boolean {
  return email.toLowerCase().endsWith(SCALER_DOMAIN.toLowerCase());
}

export function useScalerVerification() {
  const { profile, refreshProfile } = useAuth();
  const [verifying, setVerifying] = useState(false);
  const [removing, setRemoving] = useState(false);

  const verify = useCallback(async () => {
    setVerifying(true);
    try {
      const { error } = await supabase.auth.linkIdentity({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback?scaler_verify=1`,
          queryParams: { prompt: 'select_account' },
        },
      });
      if (error) throw error;
      // Redirect happens — no further code runs here
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Verification failed';
      toast.error(msg);
      setVerifying(false);
    }
  }, []);

  // Called from AuthCallback when scaler_verify=1 is in the URL
  const handleVerifyCallback = useCallback(async () => {
    const { data } = await supabase.auth.getUser();
    const identities = data?.user?.identities ?? [];
    const googleIdentity = identities
      .filter(i => i.provider === 'google')
      .sort((a, b) => new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime())[0];

    const email = googleIdentity?.identity_data?.email as string | undefined;
    if (!email) {
      toast.error('Could not read linked account email. Please try again.');
      return false;
    }

    if (!isScalerEmail(email)) {
      toast.error(
        `This doesn't appear to be a Scaler student email (${email}). Please use your official Scaler Google account.`
      );
      // Unlink the identity again
      if (googleIdentity?.id) {
        await supabase.auth.unlinkIdentity(googleIdentity as Parameters<typeof supabase.auth.unlinkIdentity>[0]);
      }
      return false;
    }

    const { error } = await supabase
      .from('profiles')
      .update({
        is_scaler_verified: true,
        scaler_email: email,
        scaler_verified_at: new Date().toISOString(),
      })
      .eq('id', data.user!.id);

    if (error) {
      toast.error('Verification failed. Please try again.');
      return false;
    }

    await refreshProfile();
    toast.success('Scaler identity verified! New features unlocked.');
    return true;
  }, [refreshProfile]);

  const removeVerification = useCallback(async () => {
    setRemoving(true);
    try {
      const { data } = await supabase.auth.getUser();
      if (!data.user) throw new Error('Not logged in');

      await supabase
        .from('profiles')
        .update({
          is_scaler_verified: false,
          scaler_email: null,
          scaler_verified_at: null,
        })
        .eq('id', data.user.id);

      await refreshProfile();
      toast.success('Scaler verification removed.');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to remove verification');
    } finally {
      setRemoving(false);
    }
  }, [refreshProfile]);

  return {
    isVerified: !!profile?.is_scaler_verified,
    scalerEmail: profile?.scaler_email ?? null,
    verifiedAt: profile?.scaler_verified_at ?? null,
    verify,
    verifying,
    removeVerification,
    removing,
    handleVerifyCallback,
  };
}
