-- STEP 1 ─ Add subject_ids column to student_terms
ALTER TABLE public.student_terms
  ADD COLUMN IF NOT EXISTS subject_ids UUID[] DEFAULT '{}';

-- STEP 2 ─ Backfill subject_ids for existing student_terms
UPDATE public.student_terms st
SET subject_ids = (
  SELECT COALESCE(array_agg(DISTINCT e.subject_id ORDER BY e.subject_id), '{}')
  FROM public.enrolments e
  JOIN public.subjects s ON s.id = e.subject_id
  WHERE e.user_id = st.user_id
    AND s.level::TEXT = st.level
    AND (
      (st.term_id IS NOT NULL AND s.term_id = st.term_id)
      OR
      (st.term_id IS NULL)
    )
)
WHERE st.subject_ids IS NULL OR st.subject_ids = '{}';

-- STEP 3 ─ Tag global terms by name
UPDATE public.terms SET term_type = 'jan'
  WHERE term_type IS NULL AND (name ILIKE '%jan%' OR name ILIKE '%january%');
UPDATE public.terms SET term_type = 'may'
  WHERE term_type IS NULL AND (name ILIKE '%may%');
UPDATE public.terms SET term_type = 'sep'
  WHERE term_type IS NULL AND (name ILIKE '%sep%' OR name ILIKE '%september%');

-- STEP 4 ─ Tag active term as 'may' if still untagged
UPDATE public.terms SET term_type = 'may'
WHERE is_active = true AND term_type IS NULL;

-- STEP 5 ─ Link student_terms with term_id = NULL to the active global term
UPDATE public.student_terms st
SET term_id = (
  SELECT t.id FROM public.terms t
  WHERE t.is_active = true
  ORDER BY t.start_date DESC LIMIT 1
)
WHERE st.term_id IS NULL;

-- STEP 6 ─ Verify
SELECT
  COUNT(*) FILTER (WHERE subject_ids IS NULL OR subject_ids = '{}') AS missing_subject_ids,
  COUNT(*) FILTER (WHERE term_id IS NULL) AS missing_term_id,
  COUNT(*) AS total
FROM public.student_terms;
