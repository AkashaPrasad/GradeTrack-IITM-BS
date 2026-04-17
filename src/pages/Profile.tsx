import { motion } from 'framer-motion';
import { useTitle } from '@/lib/hooks';
import { useAuth } from '@/stores/auth';
import { useMyEnrolments } from '@/hooks/useData';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/Card';
import { Label } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { ThemeToggle } from '@/components/layout/ThemeToggle';
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '@/components/ui/Select';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { LogOut } from 'lucide-react';
import { initialOf } from '@/lib/utils';

const stagger = { hidden: {}, visible: { transition: { staggerChildren: 0.04 } } };
const fadeUp = { hidden: { opacity: 0, y: 8 }, visible: { opacity: 1, y: 0 } };

export default function Profile() {
  useTitle('Profile');
  const { profile, updateProfile, signOut } = useAuth();
  const { data: enrolments = [] } = useMyEnrolments();
  const nav = useNavigate();

  const changeLevel = async (val: string) => {
    try {
      await updateProfile({ level: val as any });
      toast.success('Level updated. Re-select your courses.');
      nav('/onboarding');
    } catch {
      toast.error('Failed to update level');
    }
  };

  return (
    <motion.div initial="hidden" animate="visible" variants={stagger} className="p-4 md:p-6 max-w-2xl mx-auto space-y-5">
      <motion.div variants={fadeUp}>
        <h1 className="text-lg font-bold tracking-tightest">Profile</h1>
      </motion.div>

      {/* User info */}
      <motion.div variants={fadeUp}>
        <Card>
          <CardBody className="flex items-center gap-4">
            {profile?.avatar_url ? (
              <img src={profile.avatar_url} alt="" className="h-14 w-14 rounded-full" />
            ) : (
              <div className="h-14 w-14 rounded-full bg-surface2 text-fgmuted grid place-items-center text-xl font-medium">
                {initialOf(profile?.full_name)}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="text-[15px] font-semibold">{profile?.full_name ?? '—'}</div>
              <div className="text-sm text-fgmuted truncate">{profile?.email}</div>
              <div className="flex gap-2 mt-1">
                <Badge variant="accent">{profile?.level ?? '—'}</Badge>
                {profile?.role === 'admin' && <Badge variant="warning">Admin</Badge>}
                {profile?.roll_number && <Badge variant="muted">{profile.roll_number}</Badge>}
              </div>
            </div>
          </CardBody>
        </Card>
      </motion.div>

      {/* Level + courses */}
      <motion.div variants={fadeUp}>
        <Card>
          <CardHeader><CardTitle>Level & Courses</CardTitle></CardHeader>
          <CardBody className="space-y-4">
            <div>
              <Label>Current level</Label>
              <Select value={profile?.level ?? 'foundation'} onValueChange={changeLevel}>
                <SelectTrigger className="mt-1 w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="foundation">Foundation</SelectItem>
                  <SelectItem value="diploma">Diploma</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-[11px] text-fgsubtle mt-1">Changing level resets your course enrolment.</p>
            </div>
            <div>
              <Label>Enrolled courses ({enrolments.length})</Label>
              <div className="flex flex-wrap gap-1.5 mt-1.5">
                {enrolments.map(e => (
                  <Badge key={e.id} variant="muted">{e.subject.code}</Badge>
                ))}
              </div>
              <Button variant="ghost" size="sm" className="mt-2" onClick={() => nav('/onboarding')}>
                Change courses
              </Button>
            </div>
          </CardBody>
        </Card>
      </motion.div>

      {/* Theme */}
      <motion.div variants={fadeUp}>
        <Card>
          <CardHeader><CardTitle>Appearance</CardTitle></CardHeader>
          <CardBody><ThemeToggle /></CardBody>
        </Card>
      </motion.div>

      {/* Sign out */}
      <motion.div variants={fadeUp}>
        <Button variant="ghost" className="text-danger w-full justify-start gap-2" onClick={signOut}>
          <LogOut className="h-4 w-4" /> Sign out
        </Button>
      </motion.div>
    </motion.div>
  );
}

