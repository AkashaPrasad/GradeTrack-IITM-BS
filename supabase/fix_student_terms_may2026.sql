-- ============================================================
-- FIX: Student Terms + Term Tagging — May 2026
-- Run this in Supabase SQL Editor.
-- Safe to run on live production; all operations are idempotent.
-- ============================================================

-- STEP 1 ─ Tag global terms by name pattern (only if not already tagged)
UPDATE public.terms SET term_type = 'jan'
  WHERE term_type IS NULL AND (name ILIKE '%jan%' OR name ILIKE '%january%');
UPDATE public.terms SET term_type = 'may'
  WHERE term_type IS NULL AND (name ILIKE '%may%');
UPDATE public.terms SET term_type = 'sep'
  WHERE term_type IS NULL AND (name ILIKE '%sep%' OR name ILIKE '%september%');

-- STEP 2 ─ If admin's terms have generic names (e.g. "Term 1"), tag the active term as 'may'.
-- The current active term in May 2026 should be the May term.
UPDATE public.terms
SET term_type = 'may'
WHERE is_active = true
  AND term_type IS NULL;

-- STEP 3 ─ Fix any student_terms that have term_id = NULL.
-- These were created when no type-tagged global term existed yet.
-- Link them to the currently active global term so assignments load.
UPDATE public.student_terms st
SET term_id = (
  SELECT t.id
  FROM public.terms t
  WHERE t.is_active = true
  ORDER BY t.start_date DESC
  LIMIT 1
)
WHERE st.term_id IS NULL;

-- STEP 4 ─ Also backfill term_type/level on any student_terms where they're missing
-- (defensive — handles partial-schema records)
UPDATE public.student_terms st
SET
  term_type = COALESCE(
    st.term_type,
    (SELECT t.term_type FROM public.terms t WHERE t.id = st.term_id),
    'may'
  ),
  level = COALESCE(
    st.level,
    (SELECT p.level::TEXT FROM public.profiles p WHERE p.id = st.user_id),
    'foundation'
  )
WHERE st.term_type IS NULL OR st.level IS NULL;

-- STEP 5 ─ Verify state (review output before confirming)
SELECT
  t.name            AS global_term_name,
  t.term_type       AS global_term_type,
  t.is_active,
  COUNT(st.id)      AS student_term_count,
  SUM(CASE WHEN st.is_current THEN 1 ELSE 0 END) AS current_count,
  SUM(CASE WHEN st.term_id IS NULL THEN 1 ELSE 0 END) AS null_term_id_count
FROM public.terms t
LEFT JOIN public.student_terms st ON st.term_id = t.id
GROUP BY t.id, t.name, t.term_type, t.is_active
ORDER BY t.start_date DESC;
