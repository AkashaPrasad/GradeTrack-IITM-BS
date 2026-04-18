-- =============================================================================
-- GradeTrack — Notifications migration
-- Run this in the Supabase SQL editor ONCE.
-- Safe to run multiple times (all statements are idempotent).
-- =============================================================================

-- Notifications (admin announcements + reminders visible in-app)
create table if not exists public.notifications (
  id         uuid primary key default gen_random_uuid(),
  title      text not null,
  body       text,
  kind       text not null default 'announcement',  -- announcement | reminder | alert
  target_level course_level,                         -- null = all users; 'foundation'/'diploma' = level-specific
  created_by uuid references auth.users on delete set null,
  created_at timestamptz default now()
);

create index if not exists notifications_created_idx on public.notifications (created_at desc);
create index if not exists notifications_level_idx   on public.notifications (target_level);

-- Per-user read receipts
create table if not exists public.notification_reads (
  user_id         uuid not null references auth.users on delete cascade,
  notification_id uuid not null references public.notifications on delete cascade,
  primary key (user_id, notification_id),
  read_at timestamptz default now()
);

create index if not exists notification_reads_user_idx on public.notification_reads (user_id);

-- RLS
alter table public.notifications      enable row level security;
alter table public.notification_reads enable row level security;

-- Users can read notifications that target their level (or all levels)
drop policy if exists "notifications read"         on public.notifications;
drop policy if exists "notifications admin write"  on public.notifications;

create policy "notifications read" on public.notifications
  for select using (
    auth.role() = 'authenticated'
    and (
      target_level is null
      or target_level = (
        select level from public.profiles where id = auth.uid()
      )
    )
  );

create policy "notifications admin write" on public.notifications
  for all using (public.is_admin()) with check (public.is_admin());

-- Users manage only their own read receipts
drop policy if exists "notification_reads self" on public.notification_reads;

create policy "notification_reads self" on public.notification_reads
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
