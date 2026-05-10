import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { CheckCircle, GraduationCap, KeyRound, Lock, Mail, MapPin, Bus, ShieldOff } from 'lucide-react';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Input, Label } from '@/components/ui/Input';
import { ScalerBadge } from '@/components/ui/ScalerBadge';
import { useScalerVerification } from '@/hooks/useScalerVerification';
import { useResetScalerVerification } from '@/hooks/useAdminBusConfig';
import { useAuth } from '@/stores/auth';
import { formatDateTime } from '@/lib/utils';

const SCALER_DOMAIN =
  (import.meta.env.VITE_SCALER_EMAIL_DOMAIN as string | undefined) ?? '@sst.scaler.com';

const fadeUp = { hidden: { opacity: 0, y: 8 }, visible: { opacity: 1, y: 0 } };

export function ScalerVerification() {
  const {
    isVerified,
    scalerEmail,
    verifiedAt,
    requestOtp,
    verifyOtp,
    sendingOtp,
    verifyingOtp,
    otpSentTo,
    devCode,
    resetOtpRequest,
  } = useScalerVerification();
  const { profile } = useAuth();
  const isAdmin = profile?.role === 'admin';
  const resetVerification = useResetScalerVerification();

  const [email, setEmail] = useState(scalerEmail ?? '');
  const [code, setCode] = useState('');

  // Auto-fill the OTP field when running in dev mode
  useEffect(() => {
    if (devCode) setCode(devCode);
  }, [devCode]);

  const activeEmail = useMemo(() => otpSentTo ?? email.trim().toLowerCase(), [email, otpSentTo]);

  if (isVerified) {
    return (
      <motion.div variants={fadeUp}>
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <CardTitle>Scaler School of Technology</CardTitle>
              <ScalerBadge />
            </div>
          </CardHeader>
          <CardBody className="space-y-4">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 h-9 w-9 rounded-full bg-emerald-500/15 grid place-items-center shrink-0">
                <CheckCircle className="h-5 w-5 text-emerald-500" />
              </div>
              <div className="min-w-0">
                <div className="text-sm font-medium text-success">Scaler email verified</div>
                <div className="text-[12px] text-fgmuted mt-0.5 break-all">{scalerEmail}</div>
                {verifiedAt && (
                  <div className="text-[11px] text-fgsubtle mt-0.5">
                    Verified on {formatDateTime(verifiedAt)}
                  </div>
                )}
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Badge variant="success">
                <MapPin className="h-3 w-3" /> Centre Coordination
              </Badge>
              <Badge variant="success">
                <Bus className="h-3 w-3" /> Bus Registration
              </Badge>
              <Badge variant="muted">
                <Lock className="h-3 w-3" /> Locked after verification
              </Badge>
            </div>

            <p className="text-[12px] text-fgmuted">
              This Scaler email is permanently linked to your GradeTrack account. It cannot be changed from the profile page.
            </p>

            {isAdmin && (
              <div className="pt-1 border-t border-border">
                <p className="text-[11px] text-fgmuted mb-2">Admin tools — testing only</p>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-warning gap-1.5"
                  loading={resetVerification.isPending}
                  onClick={() => {
                    if (window.confirm('Reset your own Scaler verification? You will need to re-verify via OTP.')) {
                      if (profile?.id) resetVerification.mutate(profile.id);
                    }
                  }}
                >
                  <ShieldOff className="h-3.5 w-3.5" /> Reset my verification (admin only)
                </Button>
              </div>
            )}
          </CardBody>
        </Card>
      </motion.div>
    );
  }

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const ok = await requestOtp(email);
    if (ok) setCode('');
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const ok = await verifyOtp(activeEmail, code);
    if (ok) setCode('');
  };

  return (
    <motion.div variants={fadeUp}>
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-emerald-500/15 grid place-items-center">
              <GraduationCap className="h-4 w-4 text-emerald-500" />
            </div>
            <div>
              <CardTitle>Scaler School of Technology</CardTitle>
              <p className="text-[12px] text-fgmuted mt-0.5">
                Verify your Scaler email once with OTP to unlock exclusive features permanently.
              </p>
            </div>
          </div>
        </CardHeader>
        <CardBody className="space-y-4">
          <div className="flex flex-wrap gap-3 text-[12px] text-fgmuted">
            <span className="flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5 text-accent" />
              See classmates at your exam centre
            </span>
            <span className="flex items-center gap-1.5">
              <Bus className="h-3.5 w-3.5 text-accent" />
              Register for hostel bus
            </span>
          </div>

          <form onSubmit={handleSendOtp} className="space-y-3">
            <div>
              <Label htmlFor="scaler-email">Your Scaler student email</Label>
              <div className="relative mt-1">
                <Mail className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-fgmuted pointer-events-none" />
                <Input
                  id="scaler-email"
                  type="email"
                  placeholder={`yourname${SCALER_DOMAIN}`}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-8"
                  required
                  disabled={sendingOtp || verifyingOtp}
                />
              </div>
              <p className="text-[11px] text-fgsubtle mt-1">
                Must end in <span className="font-mono">{SCALER_DOMAIN}</span>
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button type="submit" loading={sendingOtp} disabled={!email.trim()}>
                Send OTP
              </Button>
              {otpSentTo && (
                <Button type="button" variant="ghost" onClick={resetOtpRequest}>
                  Use different email
                </Button>
              )}
            </div>
          </form>

          {otpSentTo && (
            <form onSubmit={handleVerifyOtp} className="space-y-3 rounded-lg border border-border bg-surface2/40 p-4">
              {devCode ? (
                <div className="flex items-center gap-2 rounded-md bg-warning/10 px-3 py-2 text-[12px] text-warning">
                  <KeyRound className="h-3.5 w-3.5 shrink-0" />
                  <span>Dev mode — code auto-filled: <span className="font-mono font-semibold">{devCode}</span></span>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-[12px] text-fgmuted">
                  <KeyRound className="h-4 w-4 text-accent" />
                  Enter the 6-digit code sent to <span className="font-medium text-fg">{otpSentTo}</span>
                </div>
              )}

              <div>
                <Label htmlFor="scaler-otp">Verification code</Label>
                <Input
                  id="scaler-otp"
                  inputMode="numeric"
                  pattern="\d{6}"
                  maxLength={6}
                  placeholder="123456"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  className="mt-1 text-center tracking-[0.4em] font-semibold"
                  required
                />
              </div>

              <div className="flex flex-wrap gap-2">
                <Button type="submit" loading={verifyingOtp} disabled={code.length !== 6}>
                  Verify OTP
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setCode('');
                    setEmail(otpSentTo);
                  }}
                >
                  Keep this email
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setCode('');
                    setEmail(otpSentTo);
                    void requestOtp(otpSentTo);
                  }}
                  disabled={sendingOtp}
                >
                  Resend code
                </Button>
              </div>
            </form>
          )}
        </CardBody>
      </Card>
    </motion.div>
  );
}
