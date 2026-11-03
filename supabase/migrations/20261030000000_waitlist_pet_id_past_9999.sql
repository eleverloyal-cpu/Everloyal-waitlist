-- EverLoyal waitlist: keep pet IDs working past PET-9999.
-- Run once in Supabase → SQL Editor. Safe to re-run. Existing IDs don't change.
--
-- The old default was 'PET-' || lpad(n, 4, '0'). Postgres lpad also CUTS longer text, so
-- sign-up 10,000 became PET-1000 again, clashed with the real PET-1000, and from then on
-- every new sign-up failed. Now numbers pad to at least 4 digits and are never cut:
-- PET-0007, PET-9999, PET-10000, PET-123456.

begin;

create or replace function public.waitlist_next_pet_id()
returns text
language sql
volatile
set search_path = ''
as $$
  select 'PET-' || lpad(n::text, greatest(4, length(n::text)), '0')
  from (select nextval('public.waitlist_pet_seq') as n) as next_number;
$$;

revoke all on function public.waitlist_next_pet_id() from public, anon, authenticated;

alter table public.waitlist_signups
  alter column pet_id set default public.waitlist_next_pet_id();

-- Close gaps left by test sign-ups: the next pawrent gets the number after the highest pet ID
-- still in the table. Always safe, since that number can't already be taken.
select setval('public.waitlist_pet_seq', greatest(n, 1), n > 0)
from (
  select coalesce(max(substring(pet_id from 5)::bigint), 0) as n
  from public.waitlist_signups
  where pet_id ~ '^PET-[0-9]+$'
) as highest;

commit;
