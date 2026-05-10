import { useCallback, useState } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/stores/auth';
import { toUserMessage } from '@/lib/utils';

const SCALER_DOMAIN =
  (import.meta.env.VITE_SCALER_EMAIL_DOMAIN as string | undefined) ?? '@sst.scaler.com';

export function isScalerEmail(email: string): boolean {
  return email.trim().toLowerCase().endsWith(SCALER_DOMAIN.toLowerCase());
}

export function useScalerVerification() {
  const { profile, refreshProfile } = useAuth();
  const [sendingOtp, setSendingOtp] = useState(false);
  const [verifyingOtp, setVerifyingOtp] = useState(false);
  const [otpSentTo, setOtpSentTo] = useState<string | null>(null);
  // Only populated when the edge function is running in dev mode (SCALER_OTP_DEV_MODE=true)
  const [devCode, setDevCode] = useState<string | null>(null);

  const resetOtpRequest = useCallback(() => {
    setOtpSentTo(null);
    setDevCode(null);
  }, []);

  const requestOtp = useCallback(async (scalerEmail: string): Promise<boolean> => {
    if (!isScalerEmail(scalerEmail)) {
      toast.error(
        `Please enter a valid Scaler student email (must end in ${SCALER_DOMAIN}).`
      );
      return false;
    }

    setSendingOtp(true);
    try {
      const normalized = scalerEmail.trim().toLowerCase();
      const { data, error } = await supabase.functions.invoke('send-scaler-otp', {
        body: { scalerEmail: normalized },
      });

      if (error) throw error;
      if (!data?.ok) throw new Error(data?.error ?? 'Failed to send verification code.');

      setOtpSentTo(normalized);

      if (data.devMode && data.devCode) {
        // Dev mode: code was not emailed, it's in the response for local testing
        setDevCode(String(data.devCode));
        toast.success(`Dev mode — OTP: ${data.devCode} (auto-filled below)`);
      } else {
        setDevCode(null);
        toast.success('Verification code sent to your Scaler inbox.');
      }

      return true;
    } catch (err: unknown) {
      toast.error(toUserMessage(err, 'Failed to send verification code. Please try again.'));
      return false;
    } finally {
      setSendingOtp(false);
    }
  }, []);

  const verifyOtp = useCallback(async (scalerEmail: string, code: string): Promise<boolean> => {
    if (!isScalerEmail(scalerEmail)) {
      toast.error(
        `Please enter a valid Scaler student email (must end in ${SCALER_DOMAIN}).`
      );
      return false;
    }

    const normalized = scalerEmail.trim().toLowerCase();
    const otp = code.trim();
    if (!/^\d{6}$/.test(otp)) {
      toast.error('Enter the 6-digit verification code.');
      return false;
    }

    setVerifyingOtp(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-scaler-otp', {
        body: {
          action: 'verify',
          scalerEmail: normalized,
          code: otp,
        },
      });

      if (error) throw error;
      if (!data?.ok) throw new Error(data?.error ?? 'Verification failed.');

      await refreshProfile();
      setOtpSentTo(null);
      setDevCode(null);
      toast.success('Scaler email verified. Exam Travel features unlocked.');
      return true;
    } catch (err: unknown) {
      toast.error(toUserMessage(err, 'Verification failed. Please try again.'));
      return false;
    } finally {
      setVerifyingOtp(false);
    }
  }, [refreshProfile]);

  return {
    isVerified: !!profile?.is_scaler_verified,
    scalerEmail: profile?.scaler_email ?? null,
    verifiedAt: profile?.scaler_verified_at ?? null,
    requestOtp,
    verifyOtp,
    sendingOtp,
    verifyingOtp,
    otpSentTo,
    devCode,
    resetOtpRequest,
  };
}
