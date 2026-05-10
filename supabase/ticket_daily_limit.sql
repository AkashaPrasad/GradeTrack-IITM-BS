create index if not exists tickets_user_created_at_idx on public.tickets (user_id, created_at desc);

create or replace function public.enforce_daily_ticket_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  ist_day_start timestamptz := (date_trunc('day', now() at time zone 'Asia/Kolkata') at time zone 'Asia/Kolkata');
  ist_next_day_start timestamptz := ((date_trunc('day', now() at time zone 'Asia/Kolkata') + interval '1 day') at time zone 'Asia/Kolkata');
begin
  if new.user_id is null then
    return new;
  end if;

  if (
    select count(*)
    from public.tickets
    where user_id = new.user_id
      and created_at >= ist_day_start
      and created_at < ist_next_day_start
  ) >= 2 then
    raise exception 'You can submit only 2 tickets per day.';
  end if;

  return new;
end $$;

drop trigger if exists trg_tickets_daily_limit on public.tickets;
create trigger trg_tickets_daily_limit before insert on public.tickets
for each row execute function public.enforce_daily_ticket_limit();
