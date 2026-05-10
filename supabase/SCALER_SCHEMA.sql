-- ============================================================
-- SCALER FEATURES SCHEMA
-- Paste this entire file into the Supabase SQL Editor and run it.
-- Safe to run multiple times (uses IF NOT EXISTS and idempotent backfills).
-- ============================================================

-- 1. Extend profiles table
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_scaler_verified BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS scaler_email TEXT,
  ADD COLUMN IF NOT EXISTS scaler_verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS whatsapp_number TEXT,
  ADD COLUMN IF NOT EXISTS hostel TEXT CHECK (hostel IN ('Uniworld 1', 'Uniworld 2', NULL)),
  ADD COLUMN IF NOT EXISTS scaler_id TEXT;

-- Clean up legacy duplicate Scaler emails before creating the unique index.
-- Keep the earliest verified/created row for each email and reset the rest.
WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY lower(scaler_email)
      ORDER BY
        CASE WHEN is_scaler_verified THEN 0 ELSE 1 END,
        scaler_verified_at NULLS LAST,
        created_at,
        id
    ) AS rn
  FROM public.profiles
  WHERE scaler_email IS NOT NULL
),
duplicates AS (
  SELECT id
  FROM ranked
  WHERE rn > 1
)
UPDATE public.profiles p
SET
  is_scaler_verified = FALSE,
  scaler_email = NULL,
  scaler_verified_at = NULL
FROM duplicates d
WHERE p.id = d.id;

CREATE UNIQUE INDEX IF NOT EXISTS profiles_scaler_email_unique_idx
  ON public.profiles (lower(scaler_email))
  WHERE scaler_email IS NOT NULL;

-- 2. Exam schedule (admin-managed, fixed per academic year)
CREATE TABLE IF NOT EXISTS public.exam_schedule (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_type TEXT NOT NULL CHECK (exam_type IN ('quiz1', 'quiz2', 'endterm')),
  exam_date DATE NOT NULL,
  academic_year TEXT NOT NULL DEFAULT '2025-26',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(exam_type, academic_year)
);

-- 3. Hall ticket submissions
CREATE TABLE IF NOT EXISTS public.hall_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  exam_type TEXT NOT NULL CHECK (exam_type IN ('quiz1', 'quiz2', 'endterm')),
  student_name TEXT NOT NULL,
  scaler_id TEXT NOT NULL,
  centre_name TEXT NOT NULL,
  centre_address TEXT,
  exam_date DATE NOT NULL,
  reporting_time TEXT,
  exam_timing TEXT NOT NULL,
  shift TEXT,
  whatsapp_number TEXT,
  hostel TEXT CHECK (hostel IN ('Uniworld 1', 'Uniworld 2')),
  pdf_storage_path TEXT,
  uploaded_via TEXT DEFAULT 'pdf' CHECK (uploaded_via IN ('pdf', 'manual')),
  uploaded_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  UNIQUE(user_id, exam_type)
);

ALTER TABLE public.hall_tickets
  ADD COLUMN IF NOT EXISTS centre_address TEXT,
  ADD COLUMN IF NOT EXISTS reporting_time TEXT,
  ADD COLUMN IF NOT EXISTS shift TEXT,
  ADD COLUMN IF NOT EXISTS uploaded_via TEXT DEFAULT 'pdf'
    CHECK (uploaded_via IN ('pdf', 'manual'));

CREATE INDEX IF NOT EXISTS idx_hall_tickets_centre ON public.hall_tickets(centre_name, is_active);
CREATE INDEX IF NOT EXISTS idx_hall_tickets_exam_type ON public.hall_tickets(exam_type, is_active);
CREATE INDEX IF NOT EXISTS idx_hall_tickets_user ON public.hall_tickets(user_id);

-- 4. Bus form config (admin-controlled)
CREATE TABLE IF NOT EXISTS public.bus_form_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_type TEXT NOT NULL CHECK (exam_type IN ('quiz1', 'quiz2', 'endterm')),
  is_open BOOLEAN DEFAULT FALSE,
  open_at TIMESTAMPTZ,
  close_at TIMESTAMPTZ,
  eligible_centres TEXT[] DEFAULT '{}',
  max_seats INTEGER DEFAULT 50,
  current_seats_taken INTEGER DEFAULT 0,
  bus_departure_time TEXT,
  bus_pickup_location TEXT DEFAULT 'Hostel Gate',
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by UUID REFERENCES public.profiles(id),
  UNIQUE(exam_type)
);

-- 5. Bus form submissions
CREATE TABLE IF NOT EXISTS public.bus_registrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  exam_type TEXT NOT NULL CHECK (exam_type IN ('quiz1', 'quiz2', 'endterm')),
  student_name TEXT NOT NULL,
  scaler_id TEXT NOT NULL,
  centre_name TEXT NOT NULL,
  whatsapp_number TEXT,
  hostel TEXT,
  seat_confirmed BOOLEAN DEFAULT FALSE,
  confirmed_by UUID REFERENCES public.profiles(id),
  confirmed_at TIMESTAMPTZ,
  submitted_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, exam_type)
);

CREATE INDEX IF NOT EXISTS idx_bus_reg_exam_type ON public.bus_registrations(exam_type);
CREATE INDEX IF NOT EXISTS idx_bus_reg_seat ON public.bus_registrations(seat_confirmed, exam_type);

-- 6. Admin-managed list of exam centres
CREATE TABLE IF NOT EXISTS public.exam_centres (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  address TEXT NOT NULL,
  city TEXT NOT NULL,
  pincode TEXT,
  maps_url TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(name)
);

ALTER TABLE public.exam_centres
  ADD COLUMN IF NOT EXISTS name TEXT,
  ADD COLUMN IF NOT EXISTS address TEXT,
  ADD COLUMN IF NOT EXISTS city TEXT,
  ADD COLUMN IF NOT EXISTS pincode TEXT,
  ADD COLUMN IF NOT EXISTS maps_url TEXT,
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS display_order INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

-- 7. Pending OTPs for Scaler email verification
CREATE TABLE IF NOT EXISTS public.scaler_verification_otps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  scaler_email TEXT NOT NULL,
  code_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  attempts INTEGER DEFAULT 0,
  send_count INTEGER DEFAULT 1,
  last_sent_at TIMESTAMPTZ DEFAULT NOW(),
  consumed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

ALTER TABLE public.scaler_verification_otps
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS scaler_email TEXT,
  ADD COLUMN IF NOT EXISTS code_hash TEXT,
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS attempts INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS send_count INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS last_sent_at TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS consumed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

CREATE INDEX IF NOT EXISTS scaler_verification_otps_email_idx
  ON public.scaler_verification_otps (lower(scaler_email));
CREATE INDEX IF NOT EXISTS scaler_verification_otps_expires_idx
  ON public.scaler_verification_otps (expires_at);

-- ============================================================
-- RLS POLICIES
-- ============================================================

-- hall_tickets RLS
ALTER TABLE public.hall_tickets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own hall ticket" ON public.hall_tickets;
CREATE POLICY "Users manage own hall ticket"
  ON public.hall_tickets FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Scaler users can view same-centre tickets" ON public.hall_tickets;
CREATE POLICY "Scaler users can view same-centre tickets"
  ON public.hall_tickets FOR SELECT
  USING (
    is_active = TRUE
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND is_scaler_verified = TRUE
    )
    AND EXISTS (
      SELECT 1 FROM public.hall_tickets mine
      WHERE mine.user_id = auth.uid()
        AND mine.exam_type = hall_tickets.exam_type
        AND mine.is_active = TRUE
        AND lower(mine.centre_name) = lower(hall_tickets.centre_name)
    )
  );

-- bus_registrations RLS
ALTER TABLE public.bus_registrations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own bus registration" ON public.bus_registrations;
CREATE POLICY "Users manage own bus registration"
  ON public.bus_registrations FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Scaler users can view bus registrations" ON public.bus_registrations;
CREATE POLICY "Scaler users can view bus registrations"
  ON public.bus_registrations FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND is_scaler_verified = TRUE
    )
  );

-- exam_centres RLS
ALTER TABLE public.exam_centres ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users read centres" ON public.exam_centres;
CREATE POLICY "Authenticated users read centres"
  ON public.exam_centres FOR SELECT
  USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Admins manage centres" ON public.exam_centres;
CREATE POLICY "Admins manage centres"
  ON public.exam_centres FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- scaler_verification_otps RLS
ALTER TABLE public.scaler_verification_otps ENABLE ROW LEVEL SECURITY;

-- bus_form_config RLS
ALTER TABLE public.bus_form_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users read bus config" ON public.bus_form_config;
CREATE POLICY "Authenticated users read bus config"
  ON public.bus_form_config FOR SELECT
  USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Admins manage bus config" ON public.bus_form_config;
CREATE POLICY "Admins manage bus config"
  ON public.bus_form_config FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- exam_schedule RLS
ALTER TABLE public.exam_schedule ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "All authenticated users can read exam schedule" ON public.exam_schedule;
CREATE POLICY "All authenticated users can read exam schedule"
  ON public.exam_schedule FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Admins manage exam schedule" ON public.exam_schedule;
CREATE POLICY "Admins manage exam schedule"
  ON public.exam_schedule FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ============================================================
-- SEED DATA
-- ============================================================
INSERT INTO public.bus_form_config (exam_type, is_open, eligible_centres, max_seats)
SELECT exam_type, is_open, eligible_centres, max_seats
FROM (
  VALUES
    ('quiz1'::TEXT, FALSE, '{}'::TEXT[], 50),
    ('quiz2'::TEXT, FALSE, '{}'::TEXT[], 50),
    ('endterm'::TEXT, FALSE, '{}'::TEXT[], 50)
) AS seed(exam_type, is_open, eligible_centres, max_seats)
WHERE NOT EXISTS (
  SELECT 1
  FROM public.bus_form_config existing
  WHERE existing.exam_type = seed.exam_type
);

INSERT INTO public.exam_centres (name, address, city, pincode, display_order)
SELECT
  'Reverend Technologies',
  'No.16, 2nd Main Rd, JC Jayachamarajendra Industrial Area, Yelachenahalli, Kanankapura Main Road',
  'Bengaluru',
  '560078',
  1
WHERE NOT EXISTS (
  SELECT 1
  FROM public.exam_centres
  WHERE lower(name) = lower('Reverend Technologies')
);

-- ============================================================
-- HELPER FUNCTIONS
-- ============================================================

CREATE OR REPLACE FUNCTION public.expire_hall_tickets()
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  UPDATE public.hall_tickets
  SET is_active = FALSE
  WHERE is_active = TRUE AND expires_at < NOW();
END;
$$;

CREATE OR REPLACE FUNCTION public.increment_bus_seats(exam_type_param TEXT)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  UPDATE public.bus_form_config
  SET current_seats_taken = current_seats_taken + 1
  WHERE exam_type = exam_type_param
    AND current_seats_taken < max_seats;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'No seats available';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.decrement_bus_seats(exam_type_param TEXT)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  UPDATE public.bus_form_config
  SET current_seats_taken = GREATEST(0, current_seats_taken - 1)
  WHERE exam_type = exam_type_param;
END;
$$;

CREATE OR REPLACE FUNCTION public.guard_scaler_verification_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.role() <> 'service_role' AND NOT public.is_admin() AND auth.uid() = OLD.id THEN
    IF NEW.is_scaler_verified IS DISTINCT FROM OLD.is_scaler_verified
      OR NEW.scaler_email IS DISTINCT FROM OLD.scaler_email
      OR NEW.scaler_verified_at IS DISTINCT FROM OLD.scaler_verified_at THEN
      RAISE EXCEPTION 'Use the Scaler OTP verification flow to update these fields.';
    END IF;
  END IF;

  IF OLD.is_scaler_verified = TRUE
    AND OLD.scaler_email IS NOT NULL
    AND (
      NEW.is_scaler_verified IS DISTINCT FROM OLD.is_scaler_verified
      OR NEW.scaler_email IS DISTINCT FROM OLD.scaler_email
      OR NEW.scaler_verified_at IS DISTINCT FROM OLD.scaler_verified_at
    )
    AND auth.role() <> 'service_role'
    AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Scaler verification is permanent once completed.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_scaler_verification_fields ON public.profiles;
CREATE TRIGGER trg_guard_scaler_verification_fields
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_scaler_verification_fields();

-- ============================================================
-- EXTENDED SCHEMA ADDITIONS (May 2026)
-- ============================================================

-- Add term_type to global terms (admin tags each term as jan / may / sep)
ALTER TABLE public.terms
  ADD COLUMN IF NOT EXISTS term_type TEXT
  CHECK (term_type IN ('jan', 'may', 'sep'));

-- Add suggested-centre columns to hall_tickets
ALTER TABLE public.hall_tickets
  ADD COLUMN IF NOT EXISTS is_suggested BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS suggested_status TEXT DEFAULT 'pending'
    CHECK (suggested_status IN ('pending', 'approved', 'rejected'));

-- Add capacity auto-close flag to bus_form_config
ALTER TABLE public.bus_form_config
  ADD COLUMN IF NOT EXISTS close_on_capacity BOOLEAN DEFAULT TRUE;

-- Add manual open/close override for centre registration per exam
ALTER TABLE public.exam_schedule
  ADD COLUMN IF NOT EXISTS centre_reg_open BOOLEAN DEFAULT NULL;

-- Soft-drop city requirement from exam_centres
ALTER TABLE public.exam_centres
  ALTER COLUMN city SET DEFAULT '';
UPDATE public.exam_centres SET city = '' WHERE city IS NULL;

-- ── Student Terms System ─────────────────────────────────────────────────────
-- Each student tracks their own term history independently of the global active term.
-- term_id is NULLABLE — links to the admin's global term for assignments/deadlines
-- but students can create terms without any admin global term existing.
-- term_type ('jan'|'may'|'sep') and level ('foundation'|'diploma') are first-class
-- columns so the system works with zero admin setup required.

-- Fresh install: create the table with the full schema.
-- If the table already exists this is a no-op; the DO block below handles patching.
CREATE TABLE IF NOT EXISTS public.student_terms (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES public.profiles(id)  ON DELETE CASCADE,
  term_id     UUID        REFERENCES public.terms(id)              ON DELETE SET NULL,
  term_type   TEXT        NOT NULL CHECK (term_type IN ('jan', 'may', 'sep')),
  level       TEXT        NOT NULL CHECK (level IN ('foundation', 'diploma')),
  custom_name TEXT        NOT NULL DEFAULT '',
  is_current  BOOLEAN     NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Patch existing table (runs safely whether columns already exist or not).
-- Uses EXCEPTION handlers instead of IF NOT EXISTS to avoid PostgreSQL quirks.
DO $$
DECLARE
  r RECORD;
BEGIN
  -- 1. Make term_id nullable (old schema had it NOT NULL)
  BEGIN
    ALTER TABLE public.student_terms ALTER COLUMN term_id DROP NOT NULL;
  EXCEPTION WHEN OTHERS THEN NULL; END;

  -- 2. Drop old unique constraint on (user_id, term_id) — any name variant
  FOR r IN (
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'public.student_terms'::regclass AND contype = 'u'
  ) LOOP
    EXECUTE format('ALTER TABLE public.student_terms DROP CONSTRAINT IF EXISTS %I', r.conname);
  END LOOP;

  -- 3. Add term_type column (nullable — backfilled below, then set NOT NULL)
  BEGIN
    ALTER TABLE public.student_terms ADD COLUMN term_type TEXT;
  EXCEPTION WHEN duplicate_column THEN NULL; END;

  -- 4. Add level column (nullable — backfilled below, then set NOT NULL)
  BEGIN
    ALTER TABLE public.student_terms ADD COLUMN level TEXT;
  EXCEPTION WHEN duplicate_column THEN NULL; END;
END $$;

-- Backfill term_type and level for any rows that already exist
UPDATE public.student_terms st
SET
  term_type = COALESCE(
    st.term_type,
    (SELECT t.term_type FROM public.terms t WHERE t.id = st.term_id),
    CASE
      WHEN (SELECT t2.name FROM public.terms t2 WHERE t2.id = st.term_id) ILIKE '%jan%' THEN 'jan'
      WHEN (SELECT t2.name FROM public.terms t2 WHERE t2.id = st.term_id) ILIKE '%may%' THEN 'may'
      WHEN (SELECT t2.name FROM public.terms t2 WHERE t2.id = st.term_id) ILIKE '%sep%' THEN 'sep'
      ELSE 'may'
    END
  ),
  level = COALESCE(
    st.level,
    (SELECT p.level::TEXT FROM public.profiles p WHERE p.id = st.user_id),
    'foundation'
  )
WHERE st.term_type IS NULL OR st.level IS NULL;

-- Now add NOT NULL + CHECK constraints (safe because all rows are backfilled)
DO $$
BEGIN
  BEGIN ALTER TABLE public.student_terms ALTER COLUMN term_type SET NOT NULL;
  EXCEPTION WHEN OTHERS THEN NULL; END;

  BEGIN ALTER TABLE public.student_terms ALTER COLUMN level SET NOT NULL;
  EXCEPTION WHEN OTHERS THEN NULL; END;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'student_terms_term_type_check'
      AND conrelid = 'public.student_terms'::regclass) THEN
    ALTER TABLE public.student_terms ADD CONSTRAINT student_terms_term_type_check
      CHECK (term_type IN ('jan', 'may', 'sep'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'student_terms_level_check'
      AND conrelid = 'public.student_terms'::regclass) THEN
    ALTER TABLE public.student_terms ADD CONSTRAINT student_terms_level_check
      CHECK (level IN ('foundation', 'diploma'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_student_terms_user_created_at
  ON public.student_terms (user_id, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_student_terms_one_current_per_user
  ON public.student_terms (user_id) WHERE is_current = TRUE;

ALTER TABLE public.student_terms ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own student_terms" ON public.student_terms;
CREATE POLICY "Users manage own student_terms"
  ON public.student_terms FOR ALL
  USING  (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Admins read all student_terms" ON public.student_terms;
CREATE POLICY "Admins read all student_terms"
  ON public.student_terms FOR SELECT
  USING (is_admin());

-- Auto-tag existing global terms by name (only sets term_type if not already set)
UPDATE public.terms SET term_type = 'jan'
  WHERE term_type IS NULL AND (name ILIKE '%jan%' OR name ILIKE '%january%');
UPDATE public.terms SET term_type = 'may'
  WHERE term_type IS NULL AND (name ILIKE '%may%');
UPDATE public.terms SET term_type = 'sep'
  WHERE term_type IS NULL AND (name ILIKE '%sep%' OR name ILIKE '%september%');

-- Migrate existing enrolments → student_terms (all marked past so students create a fresh current term)
-- level is inferred from the subjects the student is enrolled in (most common level wins per user)
WITH user_levels AS (
  SELECT
    e.user_id,
    CASE
      WHEN SUM(CASE WHEN s.level = 'diploma' THEN 1 ELSE 0 END) >
           SUM(CASE WHEN s.level = 'foundation' THEN 1 ELSE 0 END)
      THEN 'diploma'
      ELSE 'foundation'
    END AS inferred_level
  FROM public.enrolments e
  JOIN public.subjects s ON s.id = e.subject_id
  GROUP BY e.user_id
)
INSERT INTO public.student_terms (user_id, term_id, term_type, level, custom_name, is_current)
SELECT DISTINCT ON (e.user_id, s.term_id)
  e.user_id,
  s.term_id,
  COALESCE(t.term_type,
    CASE
      WHEN t.name ILIKE '%jan%' OR t.name ILIKE '%january%' THEN 'jan'
      WHEN t.name ILIKE '%may%' THEN 'may'
      WHEN t.name ILIKE '%sep%' OR t.name ILIKE '%september%' THEN 'sep'
      ELSE 'may'  -- fallback
    END
  ),
  COALESCE(ul.inferred_level, 'foundation'),
  t.name,
  false
FROM public.enrolments e
JOIN public.subjects s ON s.id = e.subject_id
JOIN public.terms t    ON t.id = s.term_id
LEFT JOIN user_levels ul ON ul.user_id = e.user_id
WHERE NOT EXISTS (
  SELECT 1
  FROM public.student_terms st
  WHERE st.user_id = e.user_id
    AND st.term_id = s.term_id
);

-- ============================================================
-- STORAGE BUCKET (run separately in Storage section or via SQL)
-- ============================================================
-- In Supabase Dashboard > Storage, create bucket "hall-tickets":
--   Public: false, File size limit: 10MB, MIME: application/pdf
--
-- Then add this storage policy:
--
-- CREATE POLICY "Users manage own hall ticket PDFs"
-- ON storage.objects FOR ALL
-- USING (
--   bucket_id = 'hall-tickets' AND
--   (storage.foldername(name))[1] = auth.uid()::text
-- )
-- WITH CHECK (
--   bucket_id = 'hall-tickets' AND
--   (storage.foldername(name))[1] = auth.uid()::text
-- );
-- ============================================================
