import { useRef, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/stores/auth';
import { CheckSquare, BarChart2, BookOpen, Bell, Linkedin, Eye, EyeOff, Mail, ArrowLeft, RotateCcw } from 'lucide-react';

// ─── Static data ──────────────────────────────────────────────────────────────

const features = [
  {
    icon: CheckSquare,
    title: 'Assignment tracking',
    desc: "Keep track of weekly assignments, quizzes, and exams across all your subjects. Mark completions and never lose sight of what's pending.",
  },
  {
    icon: BarChart2,
    title: 'Grade monitoring',
    desc: 'See your component-wise scores — GAA, quizzes, OPPE, BPT, end-term — for every enrolled course in one clean view.',
  },
  {
    icon: BookOpen,
    title: 'Progress overview',
    desc: "Understand how you're performing across foundation and diploma courses with clear visual summaries of academic progress.",
  },
  {
    icon: Bell,
    title: 'Deadline reminders',
    desc: 'Get push notifications before assignment deadlines and exams. Configure what matters to you and stay ahead of the schedule.',
  },
];

// ─── Google logo SVG ──────────────────────────────────────────────────────────

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-[18px] w-[18px] shrink-0" aria-hidden>
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  );
}

// ─── Shared banners ───────────────────────────────────────────────────────────

function ErrorBanner({ msg }: { msg: string }) {
  return (
    <div className="flex items-start gap-2.5 rounded-lg border border-red-200 bg-red-50 px-3.5 py-3 text-[13px] text-red-700">
      <svg className="mt-0.5 h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg>
      <span>{msg}</span>
    </div>
  );
}

function InfoBanner({ msg }: { msg: string }) {
  return (
    <div className="flex items-start gap-2.5 rounded-lg border border-blue-200 bg-blue-50 px-3.5 py-3 text-[13px] text-blue-700">
      <svg className="mt-0.5 h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>
      <span>{msg}</span>
    </div>
  );
}

// ─── Auth card ────────────────────────────────────────────────────────────────

type AuthTab = 'google' | 'email';
type EmailMode = 'signin' | 'signup';
type EmailStep = 'form' | 'otp';

function AuthCard() {
  const {
    signInWithGoogle,
    signInWithEmail,
    signUpWithEmail,
    verifyEmailOtp,
    resendEmailOtp,
    domainBlocked,
  } = useAuth();

  const [tab, setTab] = useState<AuthTab>('google');
  const [mode, setMode] = useState<EmailMode>('signin');
  const [step, setStep] = useState<EmailStep>('form');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [pendingEmail, setPendingEmail] = useState('');

  const [otpDigits, setOtpDigits] = useState(['', '', '', '', '', '']);
  const otpRefs = useRef<(HTMLInputElement | null)[]>([null, null, null, null, null, null]);

  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(false);

  const clearMessages = () => { setError(null); setInfo(null); };

  const switchTab = (t: AuthTab) => { setTab(t); clearMessages(); };
  const switchMode = (m: EmailMode) => { setMode(m); clearMessages(); setShowPw(false); setPassword(''); setConfirmPw(''); };

  // ── Google ──
  const handleGoogleSignIn = () => { clearMessages(); signInWithGoogle(); };

  // ── Email form submit ──
  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearMessages();

    const trimmedEmail = email.trim().toLowerCase();

    if (mode === 'signup') {
      if (password.length < 8) {
        setError('Password must be at least 8 characters.');
        return;
      }
      if (password !== confirmPw) {
        setError("Passwords don't match.");
        return;
      }
      setLoading(true);
      const err = await signUpWithEmail(trimmedEmail, password);
      setLoading(false);
      if (err) { setError(err); return; }
      setPendingEmail(trimmedEmail);
      setOtpDigits(['', '', '', '', '', '']);
      setStep('otp');
      setInfo('A 6-digit verification code has been sent to your inbox.');
      return;
    }

    // sign in
    setLoading(true);
    const err = await signInWithEmail(trimmedEmail, password);
    setLoading(false);
    if (!err) return;

    if (err === 'EMAIL_NOT_CONFIRMED') {
      setPendingEmail(trimmedEmail);
      setOtpDigits(['', '', '', '', '', '']);
      setStep('otp');
      setInfo('Your email is not confirmed yet. Enter the code we sent you, or resend a new one.');
      return;
    }
    setError(err);
  };

  // ── OTP input ──
  const handleOtpChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    const digit = value.slice(-1);
    const next = [...otpDigits];
    next[index] = digit;
    setOtpDigits(next);
    if (digit && index < 5) {
      otpRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otpDigits[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
    if (e.key === 'ArrowLeft' && index > 0) otpRefs.current[index - 1]?.focus();
    if (e.key === 'ArrowRight' && index < 5) otpRefs.current[index + 1]?.focus();
  };

  const handleOtpPaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!pasted) return;
    const next = ['', '', '', '', '', ''];
    for (let i = 0; i < pasted.length; i++) next[i] = pasted[i];
    setOtpDigits(next);
    const focusIdx = Math.min(pasted.length, 5);
    otpRefs.current[focusIdx]?.focus();
  };

  const handleVerifyOtp = async () => {
    const token = otpDigits.join('');
    if (token.length !== 6) { setError('Please enter all 6 digits.'); return; }
    clearMessages();
    setLoading(true);
    const err = await verifyEmailOtp(pendingEmail, token);
    setLoading(false);
    if (err) setError(err);
  };

  const handleResend = async () => {
    if (resendCooldown) return;
    clearMessages();
    const err = await resendEmailOtp(pendingEmail);
    if (err) { setError(err); return; }
    setInfo('A new code has been sent to your inbox.');
    setResendCooldown(true);
    setTimeout(() => setResendCooldown(false), 30_000);
  };

  return (
    <div className="w-full max-w-[360px] mx-auto">

      {/* ── Main auth card ── */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-[0_2px_12px_rgba(0,0,0,0.06)] overflow-hidden">

        {/* Tab bar */}
        <div className="flex border-b border-gray-100 bg-gray-50/60">
          {(['google', 'email'] as AuthTab[]).map(t => (
            <button
              key={t}
              onClick={() => switchTab(t)}
              className={`flex-1 py-3 text-[13px] font-medium transition-all ${
                tab === t
                  ? 'bg-white text-gray-900 border-b-2 border-[#7a1422] shadow-sm'
                  : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              {t === 'google' ? 'IITM Google' : 'Email & Password'}
            </button>
          ))}
        </div>

        <div className="p-5 space-y-4">

          {/* ══ Google tab ══ */}
          {tab === 'google' && (
            <>
              <button
                onClick={handleGoogleSignIn}
                className="w-full flex items-center justify-center gap-3 h-11 rounded-lg border border-gray-200 bg-white text-[13.5px] font-medium text-gray-700 hover:bg-gray-50 hover:border-gray-300 transition-all shadow-sm"
              >
                <GoogleIcon />
                Sign in with college account
              </button>

              <p className="text-center text-[11.5px] text-gray-400 leading-relaxed">
                Use your{' '}
                <span className="font-mono text-gray-500 text-[11px]">@ds.study.iitm.ac.in</span>{' '}
                Google account — no separate password needed.
              </p>

              {domainBlocked && (
                <ErrorBanner msg="Access denied. Only @ds.study.iitm.ac.in accounts can sign in. Please use your official IITM college Google account." />
              )}
            </>
          )}

          {/* ══ Email tab — form step ══ */}
          {tab === 'email' && step === 'form' && (
            <>
              {/* Sign in / Sign up toggle */}
              <div className="flex bg-gray-100 rounded-lg p-0.5 gap-0.5">
                {(['signin', 'signup'] as EmailMode[]).map(m => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => switchMode(m)}
                    className={`flex-1 py-[7px] rounded-md text-[12.5px] font-medium transition-all ${
                      mode === m
                        ? 'bg-white text-gray-900 shadow-sm'
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    {m === 'signin' ? 'Sign In' : 'Create Account'}
                  </button>
                ))}
              </div>

              <form onSubmit={handleEmailSubmit} className="space-y-3" noValidate>
                {/* Email */}
                <div>
                  <label className="block text-[12px] font-semibold text-gray-600 mb-1.5 tracking-wide uppercase">
                    Email address
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="yourname@ds.study.iitm.ac.in"
                    required
                    autoComplete="email"
                    className="w-full h-10 px-3 rounded-lg border border-gray-200 text-[13.5px] text-gray-900 placeholder-gray-300 bg-white focus:outline-none focus:ring-2 focus:ring-[#7a1422]/25 focus:border-[#7a1422] transition-all"
                  />
                </div>

                {/* Password */}
                <div>
                  <label className="block text-[12px] font-semibold text-gray-600 mb-1.5 tracking-wide uppercase">
                    Password
                  </label>
                  <div className="relative">
                    <input
                      type={showPw ? 'text' : 'password'}
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder={mode === 'signup' ? 'At least 8 characters' : '••••••••'}
                      required
                      autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                      className="w-full h-10 px-3 pr-10 rounded-lg border border-gray-200 text-[13.5px] text-gray-900 placeholder-gray-300 bg-white focus:outline-none focus:ring-2 focus:ring-[#7a1422]/25 focus:border-[#7a1422] transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPw(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                      tabIndex={-1}
                    >
                      {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                {/* Confirm password (signup only) */}
                {mode === 'signup' && (
                  <div>
                    <label className="block text-[12px] font-semibold text-gray-600 mb-1.5 tracking-wide uppercase">
                      Confirm password
                    </label>
                    <input
                      type={showPw ? 'text' : 'password'}
                      value={confirmPw}
                      onChange={e => setConfirmPw(e.target.value)}
                      placeholder="Re-enter your password"
                      required
                      autoComplete="new-password"
                      className="w-full h-10 px-3 rounded-lg border border-gray-200 text-[13.5px] text-gray-900 placeholder-gray-300 bg-white focus:outline-none focus:ring-2 focus:ring-[#7a1422]/25 focus:border-[#7a1422] transition-all"
                    />
                  </div>
                )}

                {error && <ErrorBanner msg={error} />}
                {info && <InfoBanner msg={info} />}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full h-10 rounded-lg text-[13.5px] font-semibold text-white transition-all disabled:opacity-60"
                  style={{ backgroundColor: '#7a1422' }}
                >
                  {loading
                    ? 'Please wait…'
                    : mode === 'signup'
                      ? 'Create account & send code'
                      : 'Sign in'}
                </button>

                {mode === 'signup' && (
                  <p className="text-center text-[11px] text-gray-400">
                    Only <span className="font-mono">@ds.study.iitm.ac.in</span> emails are accepted.
                    A 6-digit code will be emailed to you.
                  </p>
                )}
              </form>
            </>
          )}

          {/* ══ Email tab — OTP step ══ */}
          {tab === 'email' && step === 'otp' && (
            <div className="space-y-4">
              {/* Back button */}
              <button
                onClick={() => { setStep('form'); clearMessages(); setOtpDigits(['','','','','','']); }}
                className="flex items-center gap-1.5 text-[12px] text-gray-400 hover:text-gray-700 transition-colors"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Back
              </button>

              {/* Header */}
              <div className="text-center">
                <div className="mx-auto mb-3 h-10 w-10 rounded-xl bg-[#7a1422]/10 grid place-items-center">
                  <Mail className="h-5 w-5" style={{ color: '#7a1422' }} />
                </div>
                <p className="text-[13.5px] font-semibold text-gray-900">Check your inbox</p>
                <p className="mt-1 text-[12px] text-gray-500 leading-relaxed">
                  We sent a 6-digit code to{' '}
                  <span className="font-medium text-gray-700 break-all">{pendingEmail}</span>
                </p>
              </div>

              {/* OTP boxes */}
              <div className="flex gap-2 justify-center" onPaste={handleOtpPaste}>
                {otpDigits.map((digit, i) => (
                  <input
                    key={i}
                    ref={el => { otpRefs.current[i] = el; }}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={e => handleOtpChange(i, e.target.value)}
                    onKeyDown={e => handleOtpKeyDown(i, e)}
                    className={`h-12 w-11 text-center text-xl font-bold rounded-lg border transition-all focus:outline-none focus:ring-2 focus:ring-[#7a1422]/25 focus:border-[#7a1422] ${
                      digit ? 'border-[#7a1422] bg-[#7a1422]/5 text-[#7a1422]' : 'border-gray-200 bg-white text-gray-900'
                    }`}
                    autoFocus={i === 0}
                  />
                ))}
              </div>

              {error && <ErrorBanner msg={error} />}
              {info && <InfoBanner msg={info} />}

              <button
                onClick={handleVerifyOtp}
                disabled={loading || otpDigits.join('').length !== 6}
                className="w-full h-10 rounded-lg text-[13.5px] font-semibold text-white transition-all disabled:opacity-50"
                style={{ backgroundColor: '#7a1422' }}
              >
                {loading ? 'Verifying…' : 'Verify & sign in'}
              </button>

              {/* Resend */}
              <div className="text-center">
                <button
                  onClick={handleResend}
                  disabled={resendCooldown}
                  className="inline-flex items-center gap-1.5 text-[12px] text-gray-400 hover:text-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <RotateCcw className="h-3 w-3" />
                  {resendCooldown ? 'Code sent — try again in 30 s' : 'Resend code'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

    </div>
  );
}

// ─── Main page ─────────────────────────────────────────────────────────────────

export default function LandingPage() {
  const { session, signInWithGoogle } = useAuth();

  if (session) return <Navigate to="/dashboard" replace />;

  return (
    <div className="min-h-screen bg-white text-gray-900 font-sans antialiased">

      {/* ── Nav ── */}
      <header className="sticky top-0 z-30 bg-white/90 backdrop-blur border-b border-gray-100">
        <div className="max-w-5xl mx-auto px-5 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <img src="/logo.svg" alt="IITM BS GradeTrack" className="h-8 w-8 object-contain" />
            <span className="font-bold text-[15px] tracking-tight text-gray-900">GradeTrack</span>
          </div>
          <button
            onClick={signInWithGoogle}
            className="h-8 px-4 text-[12.5px] font-semibold rounded-md text-white transition-colors"
            style={{ backgroundColor: '#7a1422' }}
          >
            Sign in with Google
          </button>
        </div>
      </header>

      {/* ── Hero ── */}
      <section className="max-w-5xl mx-auto px-5 pt-16 pb-20">
        <div className="flex flex-col lg:flex-row items-center gap-12 lg:gap-16">

          {/* Left: branding */}
          <div className="flex-1 text-center lg:text-left">
            <img
              src="/logo.svg"
              alt="GradeTrack"
              className="mx-auto lg:mx-0 mb-6 h-16 w-16 object-contain"
            />
            <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-gray-900 leading-tight">
              Your IITM BS grades,
              <br />
              <span style={{ color: '#7a1422' }}>finally organised.</span>
            </h1>
            <p className="mt-5 text-[16px] text-gray-500 max-w-md mx-auto lg:mx-0 leading-relaxed">
              GradeTrack helps IITM BS students stay on top of assignments, monitor scores, and track
              academic progress — from foundation to diploma.
            </p>
            <div className="mt-6 flex flex-wrap gap-4 justify-center lg:justify-start text-[13px] text-gray-400">
              {['Free forever', 'No ads', 'Open source', '100% private'].map(t => (
                <span key={t} className="flex items-center gap-1.5">
                  <svg className="h-3.5 w-3.5 text-green-500" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  {t}
                </span>
              ))}
            </div>
          </div>

          {/* Right: auth card */}
          <div className="w-full lg:w-auto lg:min-w-[360px]">
            <AuthCard />
          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <section className="bg-gray-50 border-t border-b border-gray-100 py-16">
        <div className="max-w-5xl mx-auto px-5">
          <h2 className="text-2xl font-bold tracking-tight text-gray-900 text-center mb-2">
            What it does
          </h2>
          <p className="text-center text-gray-500 text-sm mb-10">
            Built specifically for the IITM BS programme structure.
          </p>
          <div className="grid sm:grid-cols-2 gap-5">
            {features.map(({ icon: Icon, title, desc }) => (
              <div
                key={title}
                className="bg-white rounded-xl p-6 border border-gray-100 shadow-sm"
              >
                <div
                  className="inline-flex h-10 w-10 items-center justify-center rounded-lg mb-4"
                  style={{ backgroundColor: '#7a142215' }}
                >
                  <Icon className="h-5 w-5" style={{ color: '#7a1422' }} />
                </div>
                <h3 className="font-semibold text-gray-900 mb-1.5">{title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ── */}
      <section className="py-16 max-w-5xl mx-auto px-5">
        <div className="grid md:grid-cols-3 gap-8 text-center">
          {[
            {
              step: '01',
              title: 'Sign in securely',
              desc: 'Use your @ds.study.iitm.ac.in Google account for one-click sign-in, or create an account with email and password — both require your IITM student email.',
            },
            {
              step: '02',
              title: 'Select your level and courses',
              desc: "Choose foundation or diploma, then pick the subjects you're enrolled in this term.",
            },
            {
              step: '03',
              title: 'Track and stay ahead',
              desc: 'Log assignment completions, view your grades, and get notified before deadlines.',
            },
          ].map(({ step, title, desc }) => (
            <div key={step}>
              <div className="text-4xl font-bold mb-3" style={{ color: '#C4920E' }}>
                {step}
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">{title}</h3>
              <p className="text-sm text-gray-500 leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Open source banner ── */}
      <section className="py-12 border-t border-gray-100" style={{ backgroundColor: '#7a14220a' }}>
        <div className="max-w-5xl mx-auto px-5 text-center">
          <div
            className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-medium border mb-4"
            style={{ borderColor: '#7a142230', color: '#7a1422', backgroundColor: '#7a142210' }}
          >
            Open Source
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-gray-900 mb-3">
            Free for every IITM BS student. Always.
          </h2>
          <p className="text-gray-500 text-sm max-w-lg mx-auto leading-relaxed">
            GradeTrack is completely free to use — no subscriptions, no ads, no data sold.
            The source code is open, which means anyone can review it, contribute, or build on top of it.
          </p>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-gray-100 py-10">
        <div className="max-w-5xl mx-auto px-5">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2.5">
              <img src="/logo.svg" alt="" className="h-7 w-7 object-contain" />
              <span className="font-semibold text-sm text-gray-700">IITM BS GradeTrack</span>
            </div>
            <div className="text-center">
              <p className="text-sm text-gray-500">
                An initiative by{' '}
                <span className="font-semibold text-gray-700">Akasha A Prasad</span>
                {' '}— first-year student, IITM BS Programme
              </p>
            </div>
            <a
              href="https://www.linkedin.com/in/akasha-a-prasad-639547344/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-sm font-medium text-[#0077b5] hover:text-[#005885] transition-colors"
            >
              <Linkedin className="h-4 w-4" />
              Connect on LinkedIn
            </a>
          </div>
          <div className="mt-6 pt-6 border-t border-gray-100 text-center text-xs text-gray-400">
            Built for students, by a student. Open source and free forever.
          </div>
        </div>
      </footer>
    </div>
  );
}
