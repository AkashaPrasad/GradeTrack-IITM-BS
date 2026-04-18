-- Fix legacy subject-less OPPE rows and restore the subject-scoped OPPE rows
-- used by the Jan 2026 seeded term.

delete from public.assignments
where term_id = '00000000-0000-0000-0000-00000000e001'
  and category = 'oppe';

insert into public.assignments (term_id, subject_id, level, title, category, release_date, exam_date, comments, is_published)
select
  '00000000-0000-0000-0000-00000000e001',
  s.id,
  s.level,
  t.title,
  'oppe',
  null,
  t.exam_date,
  t.comments,
  true
from (values
  ('PY',   'OPPE 1 — Day 1/2', '2026-04-04 03:30:00+00'::timestamptz, 'Foundation Python OPPE slot (allocated on Day 1 or Day 2).'),
  ('PY',   'OPPE 2 — Day 4', '2026-05-03 03:30:00+00'::timestamptz, 'Foundation Python OPPE re-attempt slot.'),
  ('MLP',  'OPPE 1 — Day 1/2', '2026-04-04 03:30:00+00'::timestamptz, 'Machine Learning Practice OPPE 1 slot.'),
  ('MLP',  'OPPE 2 — Day 2', '2026-04-26 03:30:00+00'::timestamptz, 'Machine Learning Practice OPPE slot.'),
  ('JAVA', 'OPPE 1 — Day 1/2', '2026-04-05 03:30:00+00'::timestamptz, 'Programming Concepts Using Java OPPE 1 slot.'),
  ('JAVA', 'OPPE 2 — Day 2', '2026-04-26 03:30:00+00'::timestamptz, 'Programming Concepts Using Java OPPE slot.'),
  ('JAVA', 'OPPE 2 — Day 4', '2026-05-03 03:30:00+00'::timestamptz, 'Programming Concepts Using Java exception/re-attempt slot.'),
  ('SC',   'OPPE 2 — Day 1', '2026-04-25 03:30:00+00'::timestamptz, 'System Commands OPPE slot.'),
  ('SC',   'OPPE 2 — Day 3', '2026-05-02 03:30:00+00'::timestamptz, 'System Commands re-OPPE slot.'),
  ('DBMS', 'OPPE 2 — Day 2', '2026-04-26 03:30:00+00'::timestamptz, 'Database Management Systems OPPE slot.'),
  ('DBMS', 'OPPE 2 — Day 4', '2026-05-03 03:30:00+00'::timestamptz, 'Database Management Systems exception/re-attempt slot.'),
  ('PDSA', 'OPPE 2 — Day 2', '2026-04-26 03:30:00+00'::timestamptz, 'Programming, Data Structures & Algorithms OPPE slot.'),
  ('PDSA', 'OPPE 2 — Day 4', '2026-05-03 03:30:00+00'::timestamptz, 'Programming, Data Structures & Algorithms exception/re-attempt slot.')
) as t(subject_code, title, exam_date, comments)
join public.subjects s
  on s.code = t.subject_code
 and s.term_id = '00000000-0000-0000-0000-00000000e001'
on conflict (term_id, subject_id, title, category) where subject_id is not null and category != 'weekly'
do update set
  exam_date = excluded.exam_date,
  comments = excluded.comments,
  is_published = excluded.is_published;

do $$ begin
  alter table public.assignments
    add constraint assignments_oppe_requires_subject
    check (category <> 'oppe' or subject_id is not null);
exception when duplicate_object then null; end $$;
