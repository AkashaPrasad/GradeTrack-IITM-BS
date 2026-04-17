import { useEffect } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { AuthGuard, AdminGuard } from '@/components/auth/AuthGuard';
import { AppShell } from '@/components/layout/AppShell';
import { useAuth } from '@/stores/auth';
import { useTheme } from '@/stores/theme';
import LandingPage from '@/pages/LandingPage';
import AuthCallback from '@/pages/AuthCallback';
import Dashboard from '@/pages/Dashboard';
import Grades from '@/pages/Grades';
import Assignments from '@/pages/Assignments';
import Progress from '@/pages/Progress';
import Profile from '@/pages/Profile';
import Onboarding from '@/pages/Onboarding';
import NotFound from '@/pages/NotFound';
import Support from '@/pages/Support';
import AdminShell from '@/pages/admin/AdminShell';
import AdminOverview from '@/pages/admin/AdminOverview';
import AdminTerms from '@/pages/admin/AdminTerms';
import AdminAssignments from '@/pages/admin/AdminAssignments';
import AdminStudents from '@/pages/admin/AdminStudents';
import AdminLogs from '@/pages/admin/AdminLogs';
import AdminTickets from '@/pages/admin/AdminTickets';
import AdminFormulas from '@/pages/admin/AdminFormulas';
import AdminPush from '@/pages/admin/AdminPush';

function IndexRedirect() {
  const session = useAuth(s => s.session);
  if (session) return <Navigate to="/dashboard" replace />;
  return <LandingPage />;
}

function Boot() {
  const initAuth = useAuth(s => s.init);
  const profileTheme = useAuth(s => s.profile?.theme_preference ?? null);
  const initTheme = useTheme(s => s.init);
  const theme = useTheme(s => s.theme);
  const setTheme = useTheme(s => s.setTheme);

  useEffect(() => {
    void initAuth();
    initTheme();
  }, [initAuth, initTheme]);

  useEffect(() => {
    if (profileTheme && profileTheme !== theme) {
      void setTheme(profileTheme, false);
    }
  }, [profileTheme, setTheme, theme]);

  return null;
}

export default function App() {
  return (
    <>
      <Boot />
      <Routes>
        <Route path="/" element={<IndexRedirect />} />
        <Route path="/login" element={<IndexRedirect />} />
        <Route path="/auth/callback" element={<AuthCallback />} />

        <Route
          path="/onboarding"
          element={
            <AuthGuard>
              <Onboarding />
            </AuthGuard>
          }
        />

        <Route
          element={
            <AuthGuard>
              <AppShell />
            </AuthGuard>
          }
        >
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/grades" element={<Grades />} />
          <Route path="/assignments" element={<Assignments />} />
          <Route path="/progress" element={<Progress />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/support" element={<Support />} />
        </Route>

        <Route
          path="/admin"
          element={
            <AuthGuard>
              <AdminGuard>
                <AdminShell />
              </AdminGuard>
            </AuthGuard>
          }
        >
          <Route index element={<AdminOverview />} />
          <Route path="terms" element={<AdminTerms />} />
          <Route path="assignments" element={<AdminAssignments />} />
          <Route path="students" element={<AdminStudents />} />
          <Route path="logs" element={<AdminLogs />} />
          <Route path="tickets" element={<AdminTickets />} />
          <Route path="formulas" element={<AdminFormulas />} />
          <Route path="push" element={<AdminPush />} />
        </Route>

        <Route path="*" element={<NotFound />} />
      </Routes>
    </>
  );
}
