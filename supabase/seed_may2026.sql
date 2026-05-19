-- ============================================================
-- SEED: May–Sep 2026 Term
-- Run in Supabase SQL Editor.
-- SAFE: Uses ON CONFLICT DO UPDATE everywhere. No existing
--       student data (grades, enrolments, student_terms) is
--       deleted or modified. Defensive DDL handles databases
--       that may not have had UPDATE_SCHEMA_2026.sql run yet.
-- ============================================================

BEGIN;

-- ────────────────────────────────────────────────────────────
-- 0. Defensive schema additions (safe to re-run if already done)
-- ────────────────────────────────────────────────────────────

-- Ensure term_type exists on terms table
ALTER TABLE public.terms
  ADD COLUMN IF NOT EXISTS term_type TEXT
  CHECK (term_type IN ('jan', 'may', 'sep'));

-- Ensure subject_ids exists on student_terms table
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_schema = 'public' AND table_name = 'student_terms') THEN
    ALTER TABLE public.student_terms
      ADD COLUMN IF NOT EXISTS subject_ids UUID[] DEFAULT '{}';
  END IF;
END $$;

-- ────────────────────────────────────────────────────────────
-- 1. Create (or update) the May 2026 global term
-- ────────────────────────────────────────────────────────────
INSERT INTO public.terms (id, name, start_date, end_date, is_active, term_type)
VALUES (
  '00000000-0000-0000-0000-00000000e002',
  'May–Sep 2026',
  '2026-05-26',
  '2026-09-14',
  TRUE,
  'may'
) ON CONFLICT (id) DO UPDATE SET
  name       = EXCLUDED.name,
  start_date = EXCLUDED.start_date,
  end_date   = EXCLUDED.end_date,
  is_active  = EXCLUDED.is_active,
  term_type  = EXCLUDED.term_type;

-- Mark Jan 2026 as inactive now that May 2026 is live.
UPDATE public.terms
SET is_active = FALSE
WHERE id = '00000000-0000-0000-0000-00000000e001';

-- ────────────────────────────────────────────────────────────
-- 2. Foundation Courses
-- Same grading formulae as Jan 2026; deadlines/exams differ.
-- ────────────────────────────────────────────────────────────
INSERT INTO public.subjects (term_id, level, code, name, credits, has_bonus, bonus_max, grading_config) VALUES
('00000000-0000-0000-0000-00000000e002','foundation','MA1','Mathematics for Data Science 1',4,false,0,
 jsonb_build_object(
   'formula','max(0.6*F + 0.3*max(Qz1,Qz2), 0.45*F + 0.25*Qz1 + 0.3*Qz2)',
   'variables', jsonb_build_array('Qz1','Qz2','F'),
   'bonusFormula', null, 'bonusCap', 0, 'capTotalAt', 100,
   'eligibility', jsonb_build_object(
     'endterm', jsonb_build_object('bestNof7Threshold',40,'requireQuizAttendance',true),
     'finalGrade', jsonb_build_object('requireEndterm',true)
   ),
   'hasOppe', false, 'oppeCount', 0,
   'notes','W11/W12 content included in final exam.'
 )),
('00000000-0000-0000-0000-00000000e002','foundation','ENG1','English 1',4,false,0,
 jsonb_build_object(
   'formula','max(0.6*F + 0.3*max(Qz1,Qz2), 0.45*F + 0.25*Qz1 + 0.3*Qz2)',
   'variables', jsonb_build_array('Qz1','Qz2','F'),
   'eligibility', jsonb_build_object('endterm', jsonb_build_object('bestNof7Threshold',40,'requireQuizAttendance',true), 'finalGrade', jsonb_build_object('requireEndterm',true)),
   'hasOppe', false, 'oppeCount', 0
 )),
('00000000-0000-0000-0000-00000000e002','foundation','CT','Computational Thinking',4,false,0,
 jsonb_build_object(
   'formula','max(0.6*F + 0.3*max(Qz1,Qz2), 0.45*F + 0.25*Qz1 + 0.3*Qz2)',
   'variables', jsonb_build_array('Qz1','Qz2','F'),
   'eligibility', jsonb_build_object('endterm', jsonb_build_object('bestNof7Threshold',40,'requireQuizAttendance',true), 'finalGrade', jsonb_build_object('requireEndterm',true)),
   'hasOppe', false, 'oppeCount', 0
 )),
('00000000-0000-0000-0000-00000000e002','foundation','ST1','Statistics for Data Science 1',4,true,5,
 jsonb_build_object(
   'formula','max(0.6*F + 0.3*max(Qz1,Qz2), 0.45*F + 0.25*Qz1 + 0.3*Qz2)',
   'variables', jsonb_build_array('Qz1','Qz2','F'),
   'bonusFormula','B','bonusCap',5,'capTotalAt',100,
   'eligibility', jsonb_build_object('endterm', jsonb_build_object('bestNof7Threshold',40,'requireQuizAttendance',true), 'finalGrade', jsonb_build_object('requireEndterm',true)),
   'notes','Bonus: 5 marks total (3.75 weekly extra activity + 1.25 discretionary).'
 )),
('00000000-0000-0000-0000-00000000e002','foundation','MA2','Mathematics for Data Science 2',4,true,6,
 jsonb_build_object(
   'formula','max(0.6*F + 0.3*max(Qz1,Qz2), 0.45*F + 0.25*Qz1 + 0.3*Qz2)',
   'variables', jsonb_build_array('Qz1','Qz2','F'),
   'bonusFormula','B','bonusCap',6,'capTotalAt',100,
   'eligibility', jsonb_build_object('endterm', jsonb_build_object('bestNof7Threshold',40,'requireQuizAttendance',true), 'finalGrade', jsonb_build_object('requireEndterm',true)),
   'notes','Bonus: 6 marks across 3 extra assignments (2 marks each).'
 )),
('00000000-0000-0000-0000-00000000e002','foundation','ENG2','English 2',4,false,0,
 jsonb_build_object(
   'formula','max(0.6*F + 0.3*max(Qz1,Qz2), 0.45*F + 0.25*Qz1 + 0.3*Qz2)',
   'variables', jsonb_build_array('Qz1','Qz2','F'),
   'eligibility', jsonb_build_object('endterm', jsonb_build_object('bestNof7Threshold',40,'requireQuizAttendance',true), 'finalGrade', jsonb_build_object('requireEndterm',true))
 )),
('00000000-0000-0000-0000-00000000e002','foundation','PY','Introduction to Python Programming',4,false,0,
 jsonb_build_object(
   'formula','0.15*Qz1 + 0.4*F + 0.25*max(PE1,PE2) + 0.2*min(PE1,PE2)',
   'variables', jsonb_build_array('Qz1','PE1','PE2','F'),
   'eligibility', jsonb_build_object(
     'endterm', jsonb_build_object('bestNof7Threshold',40,'requireOppeEligible',true),
     'oppe1', jsonb_build_object('requireSCT',true,'weeklyGrpaThreshold',40,'weeks', jsonb_build_array(1,2,3,4)),
     'oppe2', jsonb_build_object('requireSCT',true,'weeklyGrpaThreshold',40,'weeks', jsonb_build_array(5,6,7,8),'bestNof7Threshold',40),
     'finalGrade', jsonb_build_object('requireEndterm',true,'minOppeBest',40)
   ),
   'hasOppe', true, 'oppeCount', 2,
   'notes','OPPE 1: Aug 1. OPPE 2: Sep 3.'
 )),
('00000000-0000-0000-0000-00000000e002','foundation','ST2','Statistics for Data Science 2',4,true,5,
 jsonb_build_object(
   'formula','max(0.6*F + 0.3*max(Qz1,Qz2), 0.45*F + 0.25*Qz1 + 0.3*Qz2)',
   'variables', jsonb_build_array('Qz1','Qz2','F'),
   'bonusFormula','B','bonusCap',5,'capTotalAt',100,
   'eligibility', jsonb_build_object('endterm', jsonb_build_object('bestNof7Threshold',40,'requireQuizAttendance',true), 'finalGrade', jsonb_build_object('requireEndterm',true)),
   'notes','Bonus: 5 marks (3.75 weekly extra activity + 1.25 discretionary).'
 ))
ON CONFLICT (term_id, code) DO UPDATE SET
  name = EXCLUDED.name, credits = EXCLUDED.credits, has_bonus = EXCLUDED.has_bonus,
  bonus_max = EXCLUDED.bonus_max, grading_config = EXCLUDED.grading_config;

-- ────────────────────────────────────────────────────────────
-- 3. Diploma Courses
-- ────────────────────────────────────────────────────────────
INSERT INTO public.subjects (term_id, level, code, name, credits, has_bonus, bonus_max, grading_config) VALUES
('00000000-0000-0000-0000-00000000e002','diploma','MLF','Machine Learning Foundations',4,false,0,
 jsonb_build_object(
   'formula','0.05*GAA + max(0.6*F + 0.25*max(Qz1,Qz2), 0.4*F + 0.25*Qz1 + 0.3*Qz2)',
   'variables', jsonb_build_array('Qz1','Qz2','F','GAA'),
   'gaaSource','weeklyAvgFirst10',
   'eligibility', jsonb_build_object('endterm', jsonb_build_object('bestNof7Threshold',40,'requireQuizAttendance',true), 'finalGrade', jsonb_build_object('requireEndterm',true))
 )),
('00000000-0000-0000-0000-00000000e002','diploma','MLT','Machine Learning Techniques',4,true,3,
 jsonb_build_object(
   'formula','0.05*GAA + max(0.6*F + 0.25*max(Qz1,Qz2), 0.4*F + 0.25*Qz1 + 0.3*Qz2)',
   'variables', jsonb_build_array('Qz1','Qz2','F','GAA'),
   'gaaSource','weeklyAvgFirst10',
   'bonusFormula','B','bonusCap',3,'capTotalAt',100,
   'eligibility', jsonb_build_object('endterm', jsonb_build_object('bestNof7Threshold',40,'requireQuizAttendance',true), 'finalGrade', jsonb_build_object('requireEndterm',true)),
   'notes','Bonus 3 marks awarded for programming assignment submission IF average of ALL assignments >= 40.'
 )),
('00000000-0000-0000-0000-00000000e002','diploma','MLP','Machine Learning Practice',4,false,0,
 jsonb_build_object(
   'formula','0.1*GAA + 0.30*F + 0.20*OPPE1 + 0.20*OPPE2 + 0.20*KA',
   'variables', jsonb_build_array('GAA','F','OPPE1','OPPE2','KA'),
   'gaaSource','weeklyAvgFirst10',
   'eligibility', jsonb_build_object('endterm', jsonb_build_object('bestNof7Threshold',40), 'finalGrade', jsonb_build_object('requireEndterm',true,'minOppeBest',40)),
   'hasOppe', true, 'oppeCount', 2,
   'notes','No Qz1/Qz2. KA = avg of 3 Kaggle assignments. Must complete SCT.'
 )),
('00000000-0000-0000-0000-00000000e002','diploma','BDM','Business Data Management',4,false,0,
 jsonb_build_object(
   'formula','GA + Qz1 + Qz2 + F',
   'variables', jsonb_build_array('GA','Qz1','Qz2','F'),
   'scoring', jsonb_build_object('GA', jsonb_build_object('bestOf','extras.BDM_GA','take',3,'maxEach',10), 'Qz1max',20,'Qz2max',20,'Fmax',50),
   'eligibility', jsonb_build_object(
     'endterm', jsonb_build_object('customBDM', true, 'bestOfFirst3GA', 40, 'minGAsSubmitted', 1),
     'finalGrade', jsonb_build_object('requireEndterm',true,'bestOf4GAThreshold',40)
   ),
   'notes','GA = best 3 of 4 (10 marks each). Qz1 & Qz2 are 20 marks each. F = 50 marks.'
 )),
('00000000-0000-0000-0000-00000000e002','diploma','BA','Business Analytics',4,false,0,
 jsonb_build_object(
   'formula','(2*(0.7*max(Qz1,Qz2) + 0.3*min(Qz1,Qz2))) + A + F',
   'variables', jsonb_build_array('Qz1','Qz2','A','F'),
   'scoring', jsonb_build_object('A', jsonb_build_object('bestOf','extras.BA_A','take',2,'maxEach',10), 'Qzmax',40,'Amax',20,'Fmax',40),
   'eligibility', jsonb_build_object(
     'endterm', jsonb_build_object('customBA', true, 'minAssignmentsSubmitted',1,'requireQuizAttendance',true),
     'finalGrade', jsonb_build_object('requireEndterm',true,'minFinalExam',10,'minTotal',40)
   ),
   'notes','No regular weekly GAs. F capped at 40. Must score >=10/40 in F AND T>=40.'
 )),
('00000000-0000-0000-0000-00000000e002','diploma','TDS','Tools in Data Science',4,false,0,
 jsonb_build_object(
   'formula','0.2*GAA + 0.2*ROE + 0.2*P1 + 0.2*P2 + 0.2*F',
   'variables', jsonb_build_array('GAA','ROE','P1','P2','F'),
   'gaaSource','weeklyBest5of8',
   'eligibility', jsonb_build_object('endterm', jsonb_build_object('best4of5GAThreshold',40), 'finalGrade', jsonb_build_object('requireEndterm',true)),
   'notes','Co-requisite: MLP. No in-centre quizzes. ROE on Aug 2.'
 )),
('00000000-0000-0000-0000-00000000e002','diploma','PDSA','Programming, Data Structures & Algorithms',4,false,0,
 jsonb_build_object(
   'formula','0.05*GAA + 0.2*OP + 0.45*F + max(0.2*max(Qz1,Qz2), 0.10*Qz1 + 0.20*Qz2)',
   'variables', jsonb_build_array('Qz1','Qz2','F','GAA','OP'),
   'gaaSource','weeklyAvgFirst10',
   'eligibility', jsonb_build_object(
     'endterm', jsonb_build_object('bestNof7Threshold',40,'requireQuizAttendance',true),
     'oppe', jsonb_build_object('requireSCT',true,'weeklyGrpaThreshold',40,'weeks', jsonb_build_array(2,3,4,5,6,7,8)),
     'finalGrade', jsonb_build_object('requireEndterm',true)
   ),
   'hasOppe', true, 'oppeCount', 1,
   'notes','OPPE on Sep 3 or Sep 6.'
 )),
('00000000-0000-0000-0000-00000000e002','diploma','DBMS','Database Management Systems',4,false,0,
 jsonb_build_object(
   'formula','0.03*GAA2 + 0.02*GAA3 + 0.2*OP + 0.45*F + max(0.2*max(Qz1,Qz2), 0.10*Qz1 + 0.20*Qz2)',
   'variables', jsonb_build_array('Qz1','Qz2','F','GAA2','GAA3','OP'),
   'gaaSource','custom',
   'eligibility', jsonb_build_object(
     'endterm', jsonb_build_object('bestNof7Threshold',40,'requireQuizAttendance',true),
     'finalGrade', jsonb_build_object('requireEndterm',true,'minOppe',35,'customDBMS',true)
   ),
   'hasOppe', true, 'oppeCount', 1,
   'notes','GAA2=avg of week 2 & 3 SQL assignments. GAA3=week 7 programming assignment. OPPE Sep 3 (first), Sep 6 (reattempt).'
 )),
('00000000-0000-0000-0000-00000000e002','diploma','AD1','Application Development 1',4,false,0,
 jsonb_build_object(
   'formula','0.05*GLA + max(0.6*F + 0.25*max(Qz1,Qz2), 0.4*F + 0.25*Qz1 + 0.3*Qz2)',
   'variables', jsonb_build_array('Qz1','Qz2','F','GLA'),
   'gaaSource','customGLA',
   'eligibility', jsonb_build_object('endterm', jsonb_build_object('bestNof7Threshold',40,'requireQuizAttendance',true), 'finalGrade', jsonb_build_object('requireEndterm',true)),
   'notes','GLA = 70% of best 2 of first 5 lab assignments (W2..W6) + 30% of W7 lab.'
 )),
('00000000-0000-0000-0000-00000000e002','diploma','JAVA','Programming Concepts Using Java',4,true,0,
 jsonb_build_object(
   'formula','0.05*GAA + 0.2*max(PE1,PE2) + 0.45*F + max(0.2*max(Qz1,Qz2), 0.10*Qz1 + 0.20*Qz2) + 0.10*min(PE1,PE2)',
   'variables', jsonb_build_array('Qz1','Qz2','F','GAA','PE1','PE2'),
   'gaaSource','best6of7Programming',
   'eligibility', jsonb_build_object(
     'endterm', jsonb_build_object('bestNof7Threshold',40,'requireQuizAttendance',true),
     'oppe1', jsonb_build_object('requireSCT',true,'weeklyGrpaThreshold',40,'weeks', jsonb_build_array(2,3,4)),
     'oppe2', jsonb_build_object('requireSCT',true,'weeklyGrpaThreshold',40,'weeks', jsonb_build_array(5,6,7,8),'bestNof7Threshold',40),
     'finalGrade', jsonb_build_object('requireEndterm',true,'minOppeBest',30)
   ),
   'hasOppe', true, 'oppeCount', 2,
   'notes','OPPE 1: Aug 2. OPPE 2: Sep 3 (first), Sep 6 (re-attempt).'
 )),
('00000000-0000-0000-0000-00000000e002','diploma','SC','System Commands',4,false,0,
 jsonb_build_object(
   'formula','0.05*GAA + 0.25*Qz1 + 0.3*OPPE + 0.3*F + 0.1*BPTA',
   'variables', jsonb_build_array('Qz1','F','GAA','OPPE','BPTA'),
   'gaaSource','best9of10',
   'eligibility', jsonb_build_object(
     'endterm', jsonb_build_object('bestNof7Threshold',40),
     'oppe', jsonb_build_object('bptAvgFirst3',40),
     'finalGrade', jsonb_build_object('requireEndterm',true,'minOppe',40)
   ),
   'hasOppe', true, 'oppeCount', 1,
   'notes','No Qz2. BPTA = avg of 4 BPTs. OPPE Sep 5, ReOPPE Sep 6.'
 )),
('00000000-0000-0000-0000-00000000e002','diploma','AD2','Application Development 2',4,false,0,
 jsonb_build_object(
   'formula','0.05*GAA + max(0.6*F + 0.25*max(Qz1,Qz2), 0.4*F + 0.25*Qz1 + 0.3*Qz2)',
   'variables', jsonb_build_array('Qz1','Qz2','F','GAA'),
   'gaaSource','weeks1and2Programming',
   'eligibility', jsonb_build_object('endterm', jsonb_build_object('bestNof7Threshold',40,'requireQuizAttendance',true), 'finalGrade', jsonb_build_object('requireEndterm',true)),
   'notes','GAA = avg of weeks 1 and 2 programming assignments.'
 )),
('00000000-0000-0000-0000-00000000e002','diploma','DL','Introduction to Deep Learning & Generative AI',4,false,0,
 jsonb_build_object(
   'formula','0.1*GAA + 0.2*Qz1 + 0.2*Qz2 + 0.25*F + 0.1*NPPE1 + 0.15*NPPE2',
   'variables', jsonb_build_array('Qz1','Qz2','F','GAA','NPPE1','NPPE2'),
   'gaaSource','weeklyAvgFirst9',
   'eligibility', jsonb_build_object(
     'endterm', jsonb_build_object('firstNWeeksAvgThreshold', jsonb_build_object('n',5,'threshold',40),'requireQuizAttendance',true),
     'finalGrade', jsonb_build_object('requireEndterm',true)
   )
 ))
ON CONFLICT (term_id, code) DO UPDATE SET
  name = EXCLUDED.name, credits = EXCLUDED.credits, has_bonus = EXCLUDED.has_bonus,
  bonus_max = EXCLUDED.bonus_max, grading_config = EXCLUDED.grading_config;

-- ────────────────────────────────────────────────────────────
-- 4. Weekly Assignment Deadlines (W1–W12)
--
-- Foundation : W1=Jun24, W2=Jul1,  W3=Jul8,  W4=Jul15,
--              W5=Jul22, W6=Jul29, W7=Aug5,  W8=Aug12,
--              W9=Aug19, W10=Aug26,W11=Sep2, W12=Sep2
-- Diploma    : W1=Jun21, W2=Jun28, W3=Jul5,  W4=Jul12,
--              W5=Jul22, W6=Jul26, W7=Aug2,  W8=Aug9,
--              W9=Aug19, W10=Aug23,W11=Aug30,W12=Aug30
-- ────────────────────────────────────────────────────────────
INSERT INTO public.assignments (
  term_id, subject_id, level, title, week_number, category,
  release_date, foundation_deadline, degree_diploma_deadline,
  comments, is_published
)
SELECT
  '00000000-0000-0000-0000-00000000e002',
  s.id,
  s.level,
  'Week ' || t.week_number,
  t.week_number,
  'weekly',
  t.release_date,
  t.foundation_deadline,
  t.degree_diploma_deadline,
  t.comments,
  true
FROM (VALUES
  (1,  '2026-06-09 00:00:00+00'::timestamptz, '2026-06-24 23:59:00+05:30'::timestamptz, '2026-06-21 23:59:00+05:30'::timestamptz, NULL::text),
  (2,  '2026-06-16 00:00:00+00'::timestamptz, '2026-07-01 23:59:00+05:30'::timestamptz, '2026-06-28 23:59:00+05:30'::timestamptz, NULL::text),
  (3,  '2026-06-23 00:00:00+00'::timestamptz, '2026-07-08 23:59:00+05:30'::timestamptz, '2026-07-05 23:59:00+05:30'::timestamptz, NULL::text),
  (4,  '2026-06-30 00:00:00+00'::timestamptz, '2026-07-15 23:59:00+05:30'::timestamptz, '2026-07-12 23:59:00+05:30'::timestamptz, 'OPPE 1 eligibility closes.'),
  (5,  '2026-07-08 00:00:00+00'::timestamptz, '2026-07-22 23:59:00+05:30'::timestamptz, '2026-07-22 23:59:00+05:30'::timestamptz, NULL::text),
  (6,  '2026-07-14 00:00:00+00'::timestamptz, '2026-07-29 23:59:00+05:30'::timestamptz, '2026-07-26 23:59:00+05:30'::timestamptz, NULL::text),
  (7,  '2026-07-21 00:00:00+00'::timestamptz, '2026-08-05 23:59:00+05:30'::timestamptz, '2026-08-02 23:59:00+05:30'::timestamptz, 'End term eligibility closes.'),
  (8,  '2026-07-28 00:00:00+00'::timestamptz, '2026-08-12 23:59:00+05:30'::timestamptz, '2026-08-09 23:59:00+05:30'::timestamptz, 'OPPE 2 eligibility closes.'),
  (9,  '2026-08-05 00:00:00+00'::timestamptz, '2026-08-19 23:59:00+05:30'::timestamptz, '2026-08-19 23:59:00+05:30'::timestamptz, NULL::text),
  (10, '2026-08-11 00:00:00+00'::timestamptz, '2026-08-26 23:59:00+05:30'::timestamptz, '2026-08-23 23:59:00+05:30'::timestamptz, 'GAA calculation closes.'),
  (11, '2026-08-18 00:00:00+00'::timestamptz, '2026-09-02 23:59:00+05:30'::timestamptz, '2026-08-30 23:59:00+05:30'::timestamptz, NULL::text),
  (12, '2026-08-18 00:00:00+00'::timestamptz, '2026-09-02 23:59:00+05:30'::timestamptz, '2026-08-30 23:59:00+05:30'::timestamptz, NULL::text)
) AS t(week_number, release_date, foundation_deadline, degree_diploma_deadline, comments)
CROSS JOIN public.subjects s
WHERE s.term_id = '00000000-0000-0000-0000-00000000e002'
ON CONFLICT (term_id, subject_id, week_number)
  WHERE category = 'weekly' AND subject_id IS NOT NULL AND week_number IS NOT NULL
DO UPDATE SET
  level                   = EXCLUDED.level,
  title                   = EXCLUDED.title,
  release_date            = EXCLUDED.release_date,
  foundation_deadline     = EXCLUDED.foundation_deadline,
  degree_diploma_deadline = EXCLUDED.degree_diploma_deadline,
  comments                = EXCLUDED.comments,
  is_published            = EXCLUDED.is_published;

-- ────────────────────────────────────────────────────────────
-- 5. Shared Exams (Quiz 1, Quiz 2, End Term)
--    subject_id = NULL → visible to all enrolled students in this term
-- ────────────────────────────────────────────────────────────
INSERT INTO public.assignments (term_id, subject_id, level, title, category, release_date, exam_date, comments, is_published)
VALUES
  ('00000000-0000-0000-0000-00000000e002', NULL, NULL,
   'Quiz 1 (In-centre)', 'quiz', NULL,
   '2026-07-19 08:30:00+00',
   'Sunday, July 19 2026. 2pm–6pm. In-person at TCS centres.', TRUE),
  ('00000000-0000-0000-0000-00000000e002', NULL, NULL,
   'Quiz 2 (In-centre)', 'quiz', NULL,
   '2026-08-16 08:30:00+00',
   'Sunday, August 16 2026. 2pm–6pm. In-person at TCS centres.', TRUE),
  ('00000000-0000-0000-0000-00000000e002', NULL, NULL,
   'End Term Exam', 'endterm', NULL,
   '2026-09-13 03:30:00+00',
   'Sunday, September 13 2026. 9am–12pm / 2pm–5pm. In-person at TCS centres.', TRUE)
ON CONFLICT (term_id, title, category) WHERE subject_id IS NULL
DO UPDATE SET
  exam_date    = EXCLUDED.exam_date,
  comments     = EXCLUDED.comments,
  is_published = EXCLUDED.is_published;

-- ────────────────────────────────────────────────────────────
-- 6. OPPE Assignments (subject-scoped)
--    OPPE 1 window : Aug 1–2 2026
--    OPPE 2 window : Aug 29–Sep 6 2026
--    NOTE: Verify exact per-course slots against the official
--    May 2026 schedule if they differ from the dates below.
-- ────────────────────────────────────────────────────────────
INSERT INTO public.assignments (term_id, subject_id, level, title, category, release_date, exam_date, comments, is_published)
SELECT
  '00000000-0000-0000-0000-00000000e002',
  s.id,
  s.level,
  t.title,
  'oppe',
  NULL,
  t.exam_date,
  t.comments,
  TRUE
FROM (VALUES
  ('PY',   'OPPE 1 — Day 1',      '2026-08-01 03:30:00+00'::timestamptz, 'Foundation Python OPPE 1 slot.'),
  ('PY',   'OPPE 2 — Day 1',      '2026-08-29 03:30:00+00'::timestamptz, 'Foundation Python OPPE 2 slot.'),
  ('MLP',  'OPPE 1 — Day 1',      '2026-08-01 03:30:00+00'::timestamptz, 'Machine Learning Practice OPPE 1 slot.'),
  ('MLP',  'OPPE 2 — Day 5',      '2026-09-03 03:30:00+00'::timestamptz, 'Machine Learning Practice OPPE 2 slot.'),
  ('JAVA', 'OPPE 1 — Day 2',      '2026-08-02 03:30:00+00'::timestamptz, 'Programming Concepts Using Java OPPE 1 slot.'),
  ('JAVA', 'OPPE 2 — Day 5',      '2026-09-03 03:30:00+00'::timestamptz, 'Programming Concepts Using Java OPPE 2 slot.'),
  ('JAVA', 'OPPE 2 — Day 9',      '2026-09-06 03:30:00+00'::timestamptz, 'Programming Concepts Using Java OPPE 2 re-attempt slot.'),
  ('SC',   'OPPE — Day 8',        '2026-09-05 03:30:00+00'::timestamptz, 'System Commands OPPE slot.'),
  ('SC',   'OPPE — Re-OPPE Day 9','2026-09-06 03:30:00+00'::timestamptz, 'System Commands Re-OPPE slot.'),
  ('DBMS', 'OPPE — Day 5',        '2026-09-03 03:30:00+00'::timestamptz, 'Database Management Systems OPPE slot.'),
  ('DBMS', 'OPPE — Day 9',        '2026-09-06 03:30:00+00'::timestamptz, 'Database Management Systems OPPE re-attempt slot.'),
  ('PDSA', 'OPPE — Day 5',        '2026-09-03 03:30:00+00'::timestamptz, 'Programming, Data Structures & Algorithms OPPE slot.'),
  ('PDSA', 'OPPE — Day 9',        '2026-09-06 03:30:00+00'::timestamptz, 'Programming, Data Structures & Algorithms OPPE re-attempt slot.')
) AS t(subject_code, title, exam_date, comments)
JOIN public.subjects s
  ON s.code     = t.subject_code
 AND s.term_id  = '00000000-0000-0000-0000-00000000e002'
ON CONFLICT (term_id, subject_id, title, category)
  WHERE subject_id IS NOT NULL AND category != 'weekly'
DO UPDATE SET
  exam_date    = EXCLUDED.exam_date,
  comments     = EXCLUDED.comments,
  is_published = EXCLUDED.is_published;

-- ────────────────────────────────────────────────────────────
-- 7. TDS ROE (Remote Online Exam) — subject-scoped to TDS only
-- ────────────────────────────────────────────────────────────
INSERT INTO public.assignments (term_id, subject_id, level, title, category, release_date, exam_date, comments, is_published)
SELECT
  '00000000-0000-0000-0000-00000000e002', s.id, 'diploma',
  'TDS ROE (Remote Online Exam)', 'roe', NULL,
  '2026-08-02 03:30:00+00',
  'Non-proctored, open-internet objective exam for TDS only. Sunday Aug 2 2026.', TRUE
FROM public.subjects s
WHERE s.code = 'TDS' AND s.term_id = '00000000-0000-0000-0000-00000000e002'
ON CONFLICT (term_id, subject_id, title, category)
  WHERE subject_id IS NOT NULL AND category != 'weekly'
DO UPDATE SET
  exam_date    = EXCLUDED.exam_date,
  comments     = EXCLUDED.comments,
  is_published = EXCLUDED.is_published;

-- ────────────────────────────────────────────────────────────
-- 8. TDS Project deadlines
-- ────────────────────────────────────────────────────────────
INSERT INTO public.assignments (term_id, subject_id, level, title, category, release_date, degree_diploma_deadline, comments, is_published)
SELECT
  '00000000-0000-0000-0000-00000000e002', s.id, 'diploma',
  title, 'project', release_date, deadline, comments, TRUE
FROM (VALUES
  ('TDS — Project 1 (Take-home)', '2026-06-09 00:00:00+00'::timestamptz, '2026-07-26 23:59:00+05:30'::timestamptz, 'Open-internet.'),
  ('TDS — Project 2 (Take-home)', '2026-07-08 00:00:00+00'::timestamptz, '2026-08-09 23:59:00+05:30'::timestamptz, 'Open-internet.')
) AS t(title, release_date, deadline, comments)
CROSS JOIN public.subjects s
WHERE s.code = 'TDS' AND s.term_id = '00000000-0000-0000-0000-00000000e002'
ON CONFLICT (term_id, subject_id, title, category)
  WHERE subject_id IS NOT NULL AND category != 'weekly'
DO UPDATE SET
  release_date            = EXCLUDED.release_date,
  degree_diploma_deadline = EXCLUDED.degree_diploma_deadline,
  comments                = EXCLUDED.comments;

-- ────────────────────────────────────────────────────────────
-- 9. MLP Kaggle Assignment deadlines
-- ────────────────────────────────────────────────────────────
INSERT INTO public.assignments (term_id, subject_id, level, title, category, release_date, degree_diploma_deadline, comments, is_published)
SELECT
  '00000000-0000-0000-0000-00000000e002', s.id, 'diploma',
  title, 'ka', release_date, deadline, comments, TRUE
FROM (VALUES
  ('MLP — Kaggle Assignment 1 (KA1)', '2026-07-08 00:00:00+00'::timestamptz, '2026-07-22 23:59:00+05:30'::timestamptz, 'Peer review: Jul 22.'),
  ('MLP — Kaggle Assignment 2 (KA2)', '2026-07-21 00:00:00+00'::timestamptz, '2026-08-02 23:59:00+05:30'::timestamptz, 'Peer review: Aug 2.'),
  ('MLP — Kaggle Assignment 3 (KA3)', '2026-08-05 00:00:00+00'::timestamptz, '2026-08-19 23:59:00+05:30'::timestamptz, 'Peer review: Aug 19.')
) AS t(title, release_date, deadline, comments)
CROSS JOIN public.subjects s
WHERE s.code = 'MLP' AND s.term_id = '00000000-0000-0000-0000-00000000e002'
ON CONFLICT (term_id, subject_id, title, category)
  WHERE subject_id IS NOT NULL AND category != 'weekly'
DO UPDATE SET
  release_date            = EXCLUDED.release_date,
  degree_diploma_deadline = EXCLUDED.degree_diploma_deadline,
  comments                = EXCLUDED.comments;

-- ────────────────────────────────────────────────────────────
-- 10. System Commands BPT deadlines
-- ────────────────────────────────────────────────────────────
INSERT INTO public.assignments (term_id, subject_id, level, title, category, release_date, degree_diploma_deadline, comments, is_published)
SELECT
  '00000000-0000-0000-0000-00000000e002', s.id, 'diploma',
  title, 'bpt', release_date, NULL, comments, TRUE
FROM (VALUES
  ('SC — BPT 1', '2026-06-23 00:00:00+00'::timestamptz, 'Biweekly programming test.'),
  ('SC — BPT 2', '2026-07-08 00:00:00+00'::timestamptz, 'Biweekly programming test.'),
  ('SC — BPT 3', '2026-07-21 00:00:00+00'::timestamptz, 'Biweekly programming test.'),
  ('SC — BPT 4', '2026-08-11 00:00:00+00'::timestamptz, 'Biweekly programming test.')
) AS t(title, release_date, comments)
CROSS JOIN public.subjects s
WHERE s.code = 'SC' AND s.term_id = '00000000-0000-0000-0000-00000000e002'
ON CONFLICT (term_id, subject_id, title, category)
  WHERE subject_id IS NOT NULL AND category != 'weekly'
DO UPDATE SET
  release_date = EXCLUDED.release_date,
  comments     = EXCLUDED.comments;

-- ────────────────────────────────────────────────────────────
-- 11. BA Assignment deadlines
-- ────────────────────────────────────────────────────────────
INSERT INTO public.assignments (term_id, subject_id, level, title, week_number, category, release_date, degree_diploma_deadline, comments, is_published)
SELECT
  '00000000-0000-0000-0000-00000000e002', s.id, 'diploma',
  title, wk, 'extra', release_date, deadline, comments, TRUE
FROM (VALUES
  ('BA — Assignment 1', 5, '2026-07-08 00:00:00+00'::timestamptz, '2026-07-22 23:59:00+05:30'::timestamptz, '10 marks.'),
  ('BA — Assignment 2', 6, '2026-07-14 00:00:00+00'::timestamptz, '2026-07-26 23:59:00+05:30'::timestamptz, '10 marks.'),
  ('BA — Assignment 3', 9, '2026-08-05 00:00:00+00'::timestamptz, '2026-08-19 23:59:00+05:30'::timestamptz, '10 marks.')
) AS t(title, wk, release_date, deadline, comments)
CROSS JOIN public.subjects s
WHERE s.code = 'BA' AND s.term_id = '00000000-0000-0000-0000-00000000e002'
ON CONFLICT (term_id, subject_id, title, category)
  WHERE subject_id IS NOT NULL AND category != 'weekly'
DO UPDATE SET
  release_date            = EXCLUDED.release_date,
  degree_diploma_deadline = EXCLUDED.degree_diploma_deadline,
  comments                = EXCLUDED.comments;

-- ────────────────────────────────────────────────────────────
-- 12. Auto-migrate existing student_terms
--
-- Students who created a "May" term while Jan 2026 was still
-- the only active global term had their term_id set to Jan 2026
-- and subject_ids containing Jan 2026 subject UUIDs.
-- Re-link everything to the new May 2026 term.
-- ────────────────────────────────────────────────────────────

-- Step A: re-link terms that have subjects selected — remap subject_ids to May 2026 UUIDs
WITH remap AS (
  SELECT
    st.id                                    AS st_id,
    array_agg(new_s.id ORDER BY new_s.code)  AS new_sids
  FROM public.student_terms st
  CROSS JOIN LATERAL unnest(st.subject_ids) AS t(old_sid)
  JOIN public.subjects old_s ON old_s.id = t.old_sid
  JOIN public.subjects new_s
    ON  new_s.code     = old_s.code
    AND new_s.level    = old_s.level
    AND new_s.term_id  = '00000000-0000-0000-0000-00000000e002'
  WHERE st.term_type = 'may'
    AND (st.term_id = '00000000-0000-0000-0000-00000000e001' OR st.term_id IS NULL)
    AND array_length(st.subject_ids, 1) > 0
  GROUP BY st.id
)
UPDATE public.student_terms st
SET
  term_id     = '00000000-0000-0000-0000-00000000e002',
  subject_ids = remap.new_sids
FROM remap
WHERE st.id = remap.st_id;

-- Step B: also re-link 'may' terms that had no subjects (empty or null)
UPDATE public.student_terms
SET term_id = '00000000-0000-0000-0000-00000000e002'
WHERE term_type = 'may'
  AND (term_id = '00000000-0000-0000-0000-00000000e001' OR term_id IS NULL)
  AND (subject_ids IS NULL OR subject_ids = '{}' OR array_length(subject_ids, 1) = 0);

-- Step C: add May 2026 enrolments so the enrolled-subjects filter works
-- (existing Jan 2026 enrolments are kept — both terms remain accessible)
INSERT INTO public.enrolments (user_id, subject_id)
SELECT DISTINCT st.user_id, t.sid
FROM public.student_terms st
CROSS JOIN LATERAL unnest(st.subject_ids) AS t(sid)
WHERE st.term_type = 'may'
  AND st.term_id = '00000000-0000-0000-0000-00000000e002'
  AND array_length(st.subject_ids, 1) > 0
ON CONFLICT (user_id, subject_id) DO NOTHING;

-- ────────────────────────────────────────────────────────────
-- Verification query — run this to confirm what was inserted
-- ────────────────────────────────────────────────────────────
SELECT
  t.name                    AS term,
  COUNT(DISTINCT s.id)      AS subjects,
  COUNT(a.id)               AS assignments,
  SUM(CASE WHEN a.category = 'weekly'  THEN 1 ELSE 0 END) AS weekly,
  SUM(CASE WHEN a.category = 'quiz'    THEN 1 ELSE 0 END) AS quizzes,
  SUM(CASE WHEN a.category = 'endterm' THEN 1 ELSE 0 END) AS endterms,
  SUM(CASE WHEN a.category = 'oppe'    THEN 1 ELSE 0 END) AS oppes
FROM public.terms t
LEFT JOIN public.subjects s ON s.term_id = t.id
LEFT JOIN public.assignments a ON a.term_id = t.id
WHERE t.id = '00000000-0000-0000-0000-00000000e002'
GROUP BY t.name;

COMMIT;
