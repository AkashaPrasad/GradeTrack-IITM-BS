-- ============================================================
-- SCHEMA UPDATE 2026
-- Run in Supabase SQL Editor.  Safe to run multiple times.
-- ============================================================

-- ============================================================
-- 1. is_admin() helper (used by triggers and policies)
-- ============================================================
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'
  );
$$;

-- ============================================================
-- 2. Hall tickets: relax NOT NULL constraints; add suggested-centre columns
-- ============================================================

ALTER TABLE public.hall_tickets
  ALTER COLUMN exam_date  DROP NOT NULL;

ALTER TABLE public.hall_tickets
  ALTER COLUMN exam_timing DROP NOT NULL;

ALTER TABLE public.hall_tickets
  ADD COLUMN IF NOT EXISTS is_suggested      BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS suggested_status  TEXT    DEFAULT 'pending'
    CHECK (suggested_status IN ('pending', 'approved', 'rejected'));

CREATE INDEX IF NOT EXISTS idx_hall_tickets_suggested
  ON public.hall_tickets (is_suggested, suggested_status)
  WHERE is_suggested = TRUE;

-- ============================================================
-- 3. Bus form: close-on-capacity flag
-- ============================================================

ALTER TABLE public.bus_form_config
  ADD COLUMN IF NOT EXISTS close_on_capacity BOOLEAN DEFAULT TRUE;

-- ============================================================
-- 4. Trigger: auto-close bus form when all seats are taken
-- ============================================================

CREATE OR REPLACE FUNCTION public.auto_close_bus_on_capacity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.bus_form_config
  SET is_open     = FALSE,
      updated_at  = NOW()
  WHERE exam_type        = NEW.exam_type
    AND close_on_capacity = TRUE
    AND current_seats_taken >= max_seats;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_close_bus_on_capacity ON public.bus_registrations;
CREATE TRIGGER trg_auto_close_bus_on_capacity
  AFTER INSERT ON public.bus_registrations
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_close_bus_on_capacity();

-- ============================================================
-- 5. Admin RLS: hall_tickets — admins can see and manage ALL rows
-- ============================================================

DROP POLICY IF EXISTS "Admins manage all hall tickets" ON public.hall_tickets;
CREATE POLICY "Admins manage all hall tickets"
  ON public.hall_tickets FOR ALL
  USING   (public.is_admin())
  WITH CHECK (public.is_admin());

-- ============================================================
-- 6. Admin RLS: scaler_verification_otps — admins can read & delete
-- ============================================================

DROP POLICY IF EXISTS "Admins manage OTPs" ON public.scaler_verification_otps;
CREATE POLICY "Admins manage OTPs"
  ON public.scaler_verification_otps FOR ALL
  USING   (public.is_admin())
  WITH CHECK (public.is_admin());

-- Allow admins to read their own OTP record too (send-scaler-otp edge fn inserts one)
DROP POLICY IF EXISTS "Users read own OTP" ON public.scaler_verification_otps;
CREATE POLICY "Users read own OTP"
  ON public.scaler_verification_otps FOR SELECT
  USING (user_id = auth.uid());

-- ============================================================
-- 7. Admin RLS: profiles — admins can UPDATE any profile
--    (needed to reset Scaler verification fields)
-- ============================================================

-- First, ensure a base self-update policy exists (may already be there)
DROP POLICY IF EXISTS "Users update own profile" ON public.profiles;
CREATE POLICY "Users update own profile"
  ON public.profiles FOR UPDATE
  USING   (id = auth.uid())
  WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS "Admins update any profile" ON public.profiles;
CREATE POLICY "Admins update any profile"
  ON public.profiles FOR UPDATE
  USING   (public.is_admin())
  WITH CHECK (public.is_admin());

-- Admins can read all profiles
DROP POLICY IF EXISTS "Admins read all profiles" ON public.profiles;
CREATE POLICY "Admins read all profiles"
  ON public.profiles FOR SELECT
  USING (public.is_admin() OR id = auth.uid());

-- ============================================================
-- 8. Update guard_scaler_verification_fields to also allow admins
--    to RESET a verified student (already handled in existing trigger,
--    but ensure the is_admin() call works)
-- ============================================================

CREATE OR REPLACE FUNCTION public.guard_scaler_verification_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- Non-admins cannot touch their own verification fields via direct update
  IF auth.role() <> 'service_role' AND NOT public.is_admin() AND auth.uid() = OLD.id THEN
    IF NEW.is_scaler_verified   IS DISTINCT FROM OLD.is_scaler_verified
    OR NEW.scaler_email         IS DISTINCT FROM OLD.scaler_email
    OR NEW.scaler_verified_at   IS DISTINCT FROM OLD.scaler_verified_at THEN
      RAISE EXCEPTION 'Use the Scaler OTP verification flow to update these fields.';
    END IF;
  END IF;

  -- Permanent verification guard for non-admins/non-service
  IF OLD.is_scaler_verified = TRUE
     AND OLD.scaler_email IS NOT NULL
     AND (
       NEW.is_scaler_verified   IS DISTINCT FROM OLD.is_scaler_verified
    OR NEW.scaler_email         IS DISTINCT FROM OLD.scaler_email
    OR NEW.scaler_verified_at   IS DISTINCT FROM OLD.scaler_verified_at
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
-- 9. Admin RLS: bus_registrations — admins can manage all rows
-- ============================================================

DROP POLICY IF EXISTS "Admins manage all bus registrations" ON public.bus_registrations;
CREATE POLICY "Admins manage all bus registrations"
  ON public.bus_registrations FOR ALL
  USING   (public.is_admin())
  WITH CHECK (public.is_admin());

-- ============================================================
-- 10. Terms: allow authenticated users to read all terms
--     (so students can see past/upcoming terms in the UI)
-- ============================================================

ALTER TABLE public.terms ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read all terms" ON public.terms;
CREATE POLICY "Users read all terms"
  ON public.terms FOR SELECT
  USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Admins manage terms" ON public.terms;
CREATE POLICY "Admins manage terms"
  ON public.terms FOR ALL
  USING   (public.is_admin())
  WITH CHECK (public.is_admin());

-- ============================================================
-- 11. Enrolments: students can manage their own; admins can manage all
-- ============================================================

ALTER TABLE public.enrolments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own enrolments" ON public.enrolments;
CREATE POLICY "Users manage own enrolments"
  ON public.enrolments FOR ALL
  USING   (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Admins manage all enrolments" ON public.enrolments;
CREATE POLICY "Admins manage all enrolments"
  ON public.enrolments FOR ALL
  USING   (public.is_admin())
  WITH CHECK (public.is_admin());

-- ============================================================
-- 12. Subjects: all authenticated users can read
-- ============================================================

ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "All users read subjects" ON public.subjects;
CREATE POLICY "All users read subjects"
  ON public.subjects FOR SELECT
  USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Admins manage subjects" ON public.subjects;
CREATE POLICY "Admins manage subjects"
  ON public.subjects FOR ALL
  USING   (public.is_admin())
  WITH CHECK (public.is_admin());

-- ============================================================
-- 13. Exam schedule: centre_reg_open column
--     NULL = auto (opens 7 days before exam date)
--     TRUE = force open
--     FALSE = force closed
-- ============================================================

ALTER TABLE public.exam_schedule
  ADD COLUMN IF NOT EXISTS centre_reg_open BOOLEAN DEFAULT NULL;

-- ============================================================
-- 14. Exam centres: make city nullable (we no longer require it)
-- ============================================================

ALTER TABLE public.exam_centres
  ALTER COLUMN city SET DEFAULT '';

UPDATE public.exam_centres SET city = '' WHERE city IS NULL;

-- ============================================================
-- 15. Student terms migration
--     Safe for partially-created production tables.
-- ============================================================

ALTER TABLE public.terms
  ADD COLUMN IF NOT EXISTS term_type TEXT
  CHECK (term_type IN ('jan', 'may', 'sep'));

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

ALTER TABLE public.student_terms
  ALTER COLUMN term_id DROP NOT NULL;

ALTER TABLE public.student_terms
  DROP CONSTRAINT IF EXISTS student_terms_user_id_term_id_key;

ALTER TABLE public.student_terms
  ADD COLUMN IF NOT EXISTS term_type TEXT;

ALTER TABLE public.student_terms
  ADD COLUMN IF NOT EXISTS level TEXT;

UPDATE public.terms SET term_type = 'jan'
WHERE term_type IS NULL AND (name ILIKE '%jan%' OR name ILIKE '%january%');

UPDATE public.terms SET term_type = 'may'
WHERE term_type IS NULL AND name ILIKE '%may%';

UPDATE public.terms SET term_type = 'sep'
WHERE term_type IS NULL AND (name ILIKE '%sep%' OR name ILIKE '%september%');

WITH inferred_user_levels AS (
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
UPDATE public.student_terms st
SET
  term_type = COALESCE(
    st.term_type,
    (
      SELECT t.term_type
      FROM public.terms t
      WHERE t.id = st.term_id
    ),
    (
      SELECT CASE
        WHEN t.name ILIKE '%jan%' OR t.name ILIKE '%january%' THEN 'jan'
        WHEN t.name ILIKE '%may%' THEN 'may'
        WHEN t.name ILIKE '%sep%' OR t.name ILIKE '%september%' THEN 'sep'
        ELSE 'may'
      END
      FROM public.terms t
      WHERE t.id = st.term_id
    ),
    'may'
  ),
  level = COALESCE(
    st.level,
    inferred_user_levels.inferred_level,
    p.level,
    'foundation'
  ),
  is_current = FALSE
FROM public.profiles p
LEFT JOIN inferred_user_levels ON inferred_user_levels.user_id = p.id
WHERE p.id = st.user_id
  AND (
    st.term_type IS NULL
    OR st.level IS NULL
    OR st.is_current IS DISTINCT FROM FALSE
  );

UPDATE public.student_terms
SET
  term_type = COALESCE(term_type, 'may'),
  level = COALESCE(level, 'foundation'),
  is_current = FALSE
WHERE term_type IS NULL
   OR level IS NULL
   OR is_current IS DISTINCT FROM FALSE;

ALTER TABLE public.student_terms
  ALTER COLUMN term_type SET NOT NULL;

ALTER TABLE public.student_terms
  ALTER COLUMN level SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'student_terms_term_type_check'
      AND conrelid = 'public.student_terms'::regclass
  ) THEN
    ALTER TABLE public.student_terms
      ADD CONSTRAINT student_terms_term_type_check
      CHECK (term_type IN ('jan', 'may', 'sep'));
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'student_terms_level_check'
      AND conrelid = 'public.student_terms'::regclass
  ) THEN
    ALTER TABLE public.student_terms
      ADD CONSTRAINT student_terms_level_check
      CHECK (level IN ('foundation', 'diploma'));
  END IF;
END $$;

ALTER TABLE public.student_terms ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own student_terms" ON public.student_terms;
CREATE POLICY "Users manage own student_terms"
  ON public.student_terms FOR ALL
  USING   (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Admins read all student_terms" ON public.student_terms;
CREATE POLICY "Admins read all student_terms"
  ON public.student_terms FOR SELECT
  USING (public.is_admin());

CREATE INDEX IF NOT EXISTS idx_student_terms_user_created_at
  ON public.student_terms (user_id, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_student_terms_one_current_per_user
  ON public.student_terms (user_id)
  WHERE is_current = TRUE;

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
  COALESCE(
    t.term_type,
    CASE
      WHEN t.name ILIKE '%jan%' OR t.name ILIKE '%january%' THEN 'jan'
      WHEN t.name ILIKE '%may%' THEN 'may'
      WHEN t.name ILIKE '%sep%' OR t.name ILIKE '%september%' THEN 'sep'
      ELSE 'may'
    END
  ),
  COALESCE(ul.inferred_level, 'foundation'),
  t.name,
  FALSE
FROM public.enrolments e
JOIN public.subjects s ON s.id = e.subject_id
JOIN public.terms t ON t.id = s.term_id
LEFT JOIN user_levels ul ON ul.user_id = e.user_id
WHERE NOT EXISTS (
  SELECT 1
  FROM public.student_terms st
  WHERE st.user_id = e.user_id
    AND st.term_id = s.term_id
);

-- ============================================================
-- DONE
-- ============================================================
