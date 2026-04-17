import { Navigate } from 'react-router-dom';
import { useAuth } from '@/stores/auth';
import { CheckSquare, BarChart2, BookOpen, Bell, Github, Linkedin, ExternalLink } from 'lucide-react';

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

export default function LandingPage() {
  const { session, signInWithGoogle, domainBlocked } = useAuth();

  if (session) return <Navigate to="/dashboard" replace />;

  return (
    <div className="min-h-screen bg-white text-gray-900 font-sans antialiased">
      {/* Nav */}
      <header className="sticky top-0 z-30 bg-white/90 backdrop-blur border-b border-gray-100">
        <div className="max-w-5xl mx-auto px-5 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <img src="/logo.svg" alt="IITM BS GradeTrack" className="h-8 w-8 object-contain" />
            <span className="font-bold text-[15px] tracking-tight text-gray-900">GradeTrack</span>
          </div>
          <button
            onClick={signInWithGoogle}
            className="h-8 px-4 text-[13px] font-medium rounded-md bg-[#7a1422] text-white hover:bg-[#6a1020] transition-colors"
          >
            Sign in
          </button>
        </div>
      </header>

      {/* Hero */}
      <section className="max-w-5xl mx-auto px-5 pt-20 pb-16 text-center">
        <img
          src="/logo.svg"
          alt="IITM BS GradeTrack logo"
          className="mx-auto mb-8 h-40 w-40 object-contain"
        />
        <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-gray-900 leading-tight">
          Your IITM BS grades,
          <br />
          <span style={{ color: '#7a1422' }}>finally organised.</span>
        </h1>
        <p className="mt-5 text-lg text-gray-500 max-w-xl mx-auto leading-relaxed">
          GradeTrack helps IITM BS students stay on top of assignments, monitor component-wise scores,
          and track academic progress — from foundation to diploma.
        </p>

        {domainBlocked && (
          <div className="mt-6 mx-auto max-w-sm rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            Only <span className="font-medium">@ds.study.iitm.ac.in</span> emails are allowed.
            Please sign in with your official college account.
          </div>
        )}

        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
          <button
            onClick={signInWithGoogle}
            className="inline-flex items-center gap-3 h-12 px-6 rounded-lg border border-gray-200 bg-white text-gray-800 text-sm font-medium hover:bg-gray-50 transition-colors shadow-sm"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden>
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
            Continue with college Google account
          </button>
        </div>
        <p className="mt-3 text-xs text-gray-400">
          Only @ds.study.iitm.ac.in emails are accepted.
        </p>
      </section>

      {/* Features */}
      <section className="bg-gray-50 border-t border-gray-100 py-16">
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

      {/* How it works */}
      <section className="py-16 max-w-5xl mx-auto px-5">
        <div className="grid md:grid-cols-3 gap-8 text-center">
          {[
            { step: '01', title: 'Sign in with college email', desc: 'Use your @ds.study.iitm.ac.in Google account — no separate registration needed.' },
            { step: '02', title: 'Select your level and courses', desc: "Choose foundation or diploma, then pick the subjects you're enrolled in this term." },
            { step: '03', title: 'Track and stay ahead', desc: 'Log assignment completions, view your grades, and get notified before deadlines.' },
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

      {/* Open source banner */}
      <section className="py-12 border-t border-gray-100" style={{ backgroundColor: '#7a14220a' }}>
        <div className="max-w-5xl mx-auto px-5 text-center">
          <div className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-medium border mb-4"
            style={{ borderColor: '#7a142230', color: '#7a1422', backgroundColor: '#7a142210' }}>
            Open Source
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-gray-900 mb-3">
            Free for every IITM BS student. Always.
          </h2>
          <p className="text-gray-500 text-sm max-w-lg mx-auto leading-relaxed mb-6">
            GradeTrack is completely free to use — no subscriptions, no ads, no data sold.
            The source code is open, which means anyone can review it, contribute to it, or build on top of it.
          </p>
          <a
            href="https://github.com"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 h-9 px-5 rounded-lg border border-gray-200 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <Github className="h-4 w-4" />
            View source on GitHub
            <ExternalLink className="h-3 w-3 text-gray-400" />
          </a>
        </div>
      </section>

      {/* Sign in CTA */}
      <section className="py-16 text-center">
        <div className="max-w-lg mx-auto px-5">
          <img src="/logo.svg" alt="" className="mx-auto mb-5 h-16 w-16 object-contain" />
          <h2 className="text-2xl font-bold tracking-tight text-gray-900 mb-3">
            Ready to get started?
          </h2>
          <p className="text-gray-500 text-sm mb-6">
            Sign in with your IITM college Google account and set up in under a minute.
          </p>
          <button
            onClick={signInWithGoogle}
            className="inline-flex items-center gap-3 h-11 px-6 rounded-lg text-sm font-medium text-white transition-colors"
            style={{ backgroundColor: '#7a1422' }}
            onMouseOver={e => (e.currentTarget.style.backgroundColor = '#6a1020')}
            onMouseOut={e => (e.currentTarget.style.backgroundColor = '#7a1422')}
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
              <path fill="white" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" opacity="0.9"/>
              <path fill="white" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" opacity="0.85"/>
              <path fill="white" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" opacity="0.8"/>
              <path fill="white" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" opacity="0.85"/>
            </svg>
            Sign in with Google
          </button>
        </div>
      </section>

      {/* Footer */}
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
