import { useState } from 'react';
import { motion } from 'framer-motion';
import { CheckCircle, GraduationCap, MapPin, Bus, Trash2 } from 'lucide-react';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Dialog, DialogContent, DialogTitle, DialogDescription, DialogClose } from '@/components/ui/Dialog';
import { ScalerBadge } from '@/components/ui/ScalerBadge';
import { useScalerVerification } from '@/hooks/useScalerVerification';
import { formatDate } from '@/lib/utils';

const fadeUp = { hidden: { opacity: 0, y: 8 }, visible: { opacity: 1, y: 0 } };

export function ScalerVerification() {
  const { isVerified, scalerEmail, verifiedAt, verify, verifying, removeVerification, removing } =
    useScalerVerification();
  const [removeOpen, setRemoveOpen] = useState(false);

  if (isVerified) {
    return (
      <motion.div variants={fadeUp}>
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Scaler School of Technology</CardTitle>
              <ScalerBadge />
            </div>
          </CardHeader>
          <CardBody className="space-y-3">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 h-9 w-9 rounded-full bg-emerald-500/15 grid place-items-center shrink-0">
                <CheckCircle className="h-5 w-5 text-emerald-500" />
              </div>
              <div>
                <div className="text-sm font-medium text-success">Identity Verified</div>
                <div className="text-[12px] text-fgmuted mt-0.5">{scalerEmail}</div>
                {verifiedAt && (
                  <div className="text-[11px] text-fgsubtle mt-0.5">
                    Verified on {formatDate(verifiedAt)}
                  </div>
                )}
              </div>
            </div>
            <div className="flex flex-wrap gap-2 pt-1">
              <Badge variant="success">
                <MapPin className="h-3 w-3" /> Centre Coordination
              </Badge>
              <Badge variant="success">
                <Bus className="h-3 w-3" /> Bus Registration
              </Badge>
            </div>
            <button
              onClick={() => setRemoveOpen(true)}
              className="text-[12px] text-danger hover:underline mt-1"
            >
              Remove verification
            </button>
          </CardBody>
        </Card>

        <Dialog open={removeOpen} onOpenChange={setRemoveOpen}>
          <DialogContent>
            <DialogTitle>Remove Scaler verification?</DialogTitle>
            <DialogDescription>
              You will lose access to Exam Travel features until you verify again. This action cannot be
              undone automatically.
            </DialogDescription>
            <div className="flex justify-end gap-2 mt-5">
              <DialogClose asChild>
                <Button variant="ghost" size="sm">Cancel</Button>
              </DialogClose>
              <Button
                variant="danger"
                size="sm"
                loading={removing}
                onClick={async () => {
                  await removeVerification();
                  setRemoveOpen(false);
                }}
              >
                Remove
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </motion.div>
    );
  }

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
                Verify your Scaler student identity to unlock exclusive features
              </p>
            </div>
          </div>
        </CardHeader>
        <CardBody className="space-y-4">
          <div className="space-y-2">
            <p className="text-[13px] text-fgmuted font-medium">Unlocks:</p>
            <div className="flex flex-wrap gap-2">
              <div className="flex items-center gap-1.5 text-[12px] text-fgmuted">
                <MapPin className="h-3.5 w-3.5 text-accent" />
                See which classmates are at your exam centre
              </div>
              <div className="flex items-center gap-1.5 text-[12px] text-fgmuted">
                <Bus className="h-3.5 w-3.5 text-accent" />
                Register for the hostel bus to your exam centre
              </div>
            </div>
          </div>
          <Button onClick={verify} loading={verifying} className="w-full sm:w-auto gap-2">
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
            </svg>
            Verify with Scaler Google Account
          </Button>
          <p className="text-[11px] text-fgsubtle">
            You'll be asked to sign in with your @sst.scaler.com Google account. We'll link it to your
            existing GradeTrack account — you won't need to sign out.
          </p>
        </CardBody>
      </Card>
    </motion.div>
  );
}
