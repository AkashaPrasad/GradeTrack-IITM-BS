-- ============================================================
-- STUDENT TERMS PATCH — run once in Supabase SQL editor
-- Safe for live production. Idempotent (safe to re-run).
-- ============================================================

-- Step 1: Patch the table structure
DO $$
DECLARE
  r RECORD;
BEGIN
  BEGIN
    ALTER TABLE public.student_terms ALTER COLUMN term_id DROP NOT NULL;
  EXCEPTION WHEN OTHERS THEN NULL; END;

  FOR r IN (
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'public.student_terms'::regclass AND contype = 'u'
  ) LOOP
    EXECUTE format('ALTER TABLE public.student_terms DROP CONSTRAINT IF EXISTS %I', r.conname);
  END LOOP;

  BEGIN
    ALTER TABLE public.student_terms ADD COLUMN term_type TEXT;
  EXCEPTION WHEN duplicate_column THEN NULL; END;

  BEGIN
    ALTER TABLE public.student_terms ADD COLUMN level TEXT;
  EXCEPTION WHEN duplicate_column THEN NULL; END;
END $$;

-- Step 2: Auto-tag global terms by name
UPDATE public.terms SET term_type = 'jan'
  WHERE term_type IS NULL AND (name ILIKE '%jan%' OR name ILIKE '%january%');
UPDATE public.terms SET term_type = 'may'
  WHERE term_type IS NULL AND (name ILIKE '%may%');
UPDATE public.terms SET term_type = 'sep'
  WHERE term_type IS NULL AND (name ILIKE '%sep%' OR name ILIKE '%september%');

-- Step 3: Backfill existing rows (note ::TEXT cast on profiles.level — it's an enum)
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

-- Step 4: Set NOT NULL + CHECK constraints
DO $$
BEGIN
  BEGIN ALTER TABLE public.student_terms ALTER COLUMN term_type SET NOT NULL;
  EXCEPTION WHEN OTHERS THEN NULL; END;

  BEGIN ALTER TABLE public.student_terms ALTER COLUMN level SET NOT NULL;
  EXCEPTION WHEN OTHERS THEN NULL; END;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint
      WHERE conname = 'student_terms_term_type_check'
      AND conrelid = 'public.student_terms'::regclass) THEN
    ALTER TABLE public.student_terms
      ADD CONSTRAINT student_terms_term_type_check
      CHECK (term_type IN ('jan', 'may', 'sep'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint
      WHERE conname = 'student_terms_level_check'
      AND conrelid = 'public.student_terms'::regclass) THEN
    ALTER TABLE public.student_terms
      ADD CONSTRAINT student_terms_level_check
      CHECK (level IN ('foundation', 'diploma'));
  END IF;
END $$;

-- Step 5: Indexes
CREATE INDEX IF NOT EXISTS idx_student_terms_user_created_at
  ON public.student_terms (user_id, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_student_terms_one_current_per_user
  ON public.student_terms (user_id) WHERE is_current = TRUE;

-- Step 6: RLS
ALTER TABLE public.student_terms ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own student_terms" ON public.student_terms;
CREATE POLICY "Users manage own student_terms"
  ON public.student_terms FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Admins read all student_terms" ON public.student_terms;
CREATE POLICY "Admins read all student_terms"
  ON public.student_terms FOR SELECT
  USING (is_admin());

-- Step 7: Migrate enrolments → student_terms (all past, skips existing rows)
WITH user_levels AS (
  SELECT
    e.user_id,
    CASE
      WHEN SUM(CASE WHEN s.level::TEXT = 'diploma' THEN 1 ELSE 0 END) >
           SUM(CASE WHEN s.level::TEXT = 'foundation' THEN 1 ELSE 0 END)
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
  false
FROM public.enrolments e
JOIN public.subjects s ON s.id = e.subject_id
JOIN public.terms t    ON t.id = s.term_id
LEFT JOIN user_levels ul ON ul.user_id = e.user_id
WHERE NOT EXISTS (
  SELECT 1 FROM public.student_terms existing
  WHERE existing.user_id = e.user_id AND existing.term_id = s.term_id
);
