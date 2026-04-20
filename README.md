# GradeTrack — IITM BS Programme Grade Tracker

A full-stack Progressive Web App for students of the **IIT Madras BS Programme** to track grades, assignments, and academic progress across Foundation and Diploma levels.

---

## Demo / Test Account

A pre-configured account is available for previewing the app without a real student email:

| Field    | Value                         |
|----------|-------------------------------|
| Email    | `demo@ds.study.iitm.ac.in`   |
| Password | `Demo@IITM2026`               |

Sign in via the **Email & Password** tab on the landing page. The account is pre-enrolled in foundation subjects and lands directly on the dashboard (onboarding already completed).

---

## Authentication

Two sign-in methods are supported:

- **Google OAuth** — One-click sign-in with your `@ds.study.iitm.ac.in` Google account.
- **Email & Password** — Create an account with your `@ds.study.iitm.ac.in` email; a 6-digit OTP is sent to verify ownership before the account is activated.

Only `@ds.study.iitm.ac.in` addresses are accepted, enforced in both the frontend and a Postgres trigger on `auth.users`.

---

## Features

- **Grade Dashboard** — Live GPA, letter grades, and per-subject score breakdown
- **Assignment Tracker** — Due dates, categories (weekly, quiz, end-term, OPPE, project, ROE, BPT, KA), and completion status
- **Progress Visualisation** — Charts for weekly scores, term-over-term trends, and eligibility status
- **Admin Panel** — Manage terms, subjects, grading formulas, students, support tickets, and push notifications
- **PWA / Offline Support** — Installable on mobile/desktop; works offline via service worker caching
- **Push Notifications** — Deadline reminders at 7 days and 1 day via Supabase Edge Functions
- **Dark / Light Mode** — System-aware with user override

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + TypeScript, Vite 5 |
| Routing | React Router DOM 6 |
| State | Zustand 5, TanStack React Query 5 |
| Styling | Tailwind CSS 3, Radix UI primitives |
| Charts | Recharts 2, Framer Motion 11 |
| Backend | Supabase (PostgreSQL + Auth + Edge Functions) |
| PWA | Vite PWA plugin, Workbox |
| Monitoring | Sentry |

---

## Getting Started

### Prerequisites

- Node.js 18+
- A [Supabase](https://supabase.com) project

### 1. Clone & Install

```bash
git clone https://github.com/<your-username>/gradetrack.git
cd gradetrack
npm install
```

### 2. Configure Environment

Copy `.env.example` to `.env` and fill in your values:

```bash
cp .env.example .env
```

```env
VITE_SUPABASE_URL=https://<your-project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<your-anon-key>
VITE_ALLOWED_EMAIL_DOMAIN=ds.study.iitm.ac.in
VITE_COLLEGE_NAME=IITM BS Programme
VITE_SENTRY_DSN=                          # optional
```

### 3. Set Up the Database

Run the schema against your Supabase project:

```bash
# Using the Supabase CLI
supabase db push

# Or paste supabase/schema.sql directly into the Supabase SQL editor
```

Optionally seed sample data:

```bash
# Paste supabase/seed.sql into the SQL editor
```

### 4. Run Locally

```bash
npm run dev
```

App will be available at `http://localhost:5173`.

---

## Project Structure

```
├── src/
│   ├── components/
│   │   ├── auth/          # Auth guards
│   │   ├── layout/        # AppShell, Sidebar, MobileTabs
│   │   └── ui/            # Reusable Radix-based components
│   ├── pages/
│   │   ├── admin/         # Role-gated admin views
│   │   └── ...            # Dashboard, Grades, Assignments, Progress, Profile
│   ├── lib/
│   │   ├── grading/       # Safe formula parser & grade calculator
│   │   └── supabase.ts    # Supabase client
│   ├── hooks/             # React Query data hooks
│   └── stores/            # Zustand auth & theme stores
├── supabase/
│   ├── schema.sql         # Full database schema
│   ├── seed.sql           # Sample term data
│   └── functions/         # Edge Functions (deadline reminders)
└── public/                # Static assets & PWA icons
```

---

## Database Schema

The Supabase PostgreSQL schema includes the following tables:

| Table | Description |
|---|---|
| `profiles` | User profiles, roles, notification preferences |
| `terms` | Academic terms (name, dates, active flag) |
| `subjects` | Courses per term with JSON grading config |
| `enrolments` | Student ↔ subject many-to-many |
| `grades` | Per-student scores (quizzes, OPPE, final, weekly) |
| `assignments` | Admin-created tasks with per-level deadlines |
| `assignment_completions` | Per-user completion tracking |
| `tickets` | In-app support tickets |
| `app_logs` | Activity & error logging |

Full schema: [`supabase/schema.sql`](supabase/schema.sql)

---

## Available Scripts

```bash
npm run dev        # Start development server
npm run build      # Production build
npm run preview    # Preview production build locally
npm run lint       # ESLint
```

---

## Deployment

The app is a static SPA and can be deployed to any static host:

- **Vercel** — Connect repo, set environment variables, deploy
- **Netlify** — Same as above; ensure redirects to `index.html` for SPA routing
- **Supabase Hosting** — Upload the `dist/` folder

Ensure all `VITE_*` environment variables are set in the hosting platform's dashboard before deploying.

---

## Environment Variables Reference

| Variable | Required | Description |
|---|---|---|
| `VITE_SUPABASE_URL` | Yes | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Yes | Supabase anon/public key |
| `VITE_ALLOWED_EMAIL_DOMAIN` | No | Restrict sign-up to this domain (default: `ds.study.iitm.ac.in`) |
| `VITE_COLLEGE_NAME` | No | Display name shown in the UI (default: `IITM BS Programme`) |
| `VITE_SENTRY_DSN` | No | Sentry DSN for error tracking |

---

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/your-feature`
3. Commit your changes: `git commit -m "feat: add your feature"`
4. Push to the branch: `git push origin feature/your-feature`
5. Open a Pull Request

---

## License

MIT
