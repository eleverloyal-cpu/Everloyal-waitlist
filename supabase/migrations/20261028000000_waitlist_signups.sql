-- EverLoyal waitlist: sign-ups table + join_waitlist RPC.
-- Run once in Supabase → SQL Editor. Safe to re-run.
--
-- Security model: the table is closed to the browser (RLS on, no policies, no grants).
-- Only the DigitalOcean function, using the project's secret key, can call
-- join_waitlist(). Keep the CHECK limits in step with packages/shared/src/waitlist.ts.

create sequence if not exists public.waitlist_pet_seq;

create table if not exists public.waitlist_signups (
  id                uuid primary key default gen_random_uuid(),
  pet_id            text not null unique
                      default ('PET-' || lpad(nextval('public.waitlist_pet_seq')::text, 4, '0')),
  name              text not null check (char_length(name) between 2 and 60),
  email             text not null unique
                      check (email = lower(email) and char_length(email) <= 254
                             and email ~ '^[^\s@]+@[^\s@]+\.[^\s@]{2,}$'),
  mobile_number     text not null check (mobile_number ~ '^[6-9][0-9]{9}$'),
  pet_name          text not null check (char_length(pet_name) between 1 and 40),
  city              text check (char_length(city) <= 80),
  dog_concerns      text[] not null default '{}' check (cardinality(dog_concerns) <= 10),
  concern_details   text check (char_length(concern_details) <= 280),
  referral_code     text not null unique check (referral_code ~ '^[A-Z0-9]{1,8}-[A-Z0-9]{1,8}$'),
  referred_by       text,
  client_created_at timestamptz,
  created_at        timestamptz not null default now()
);

alter sequence public.waitlist_pet_seq owned by public.waitlist_signups.pet_id;

comment on table public.waitlist_signups is 'EverLoyal waitlist sign-ups. Written only via join_waitlist().';
comment on column public.waitlist_signups.referred_by is 'Invite code of the pawrent who shared the link (?ref=).';

create index if not exists waitlist_signups_referred_by_idx
  on public.waitlist_signups (referred_by) where referred_by is not null;
create index if not exists waitlist_signups_created_at_idx
  on public.waitlist_signups (created_at desc);

-- Closed to the public API: no direct reads or writes from anon/authenticated users.
alter table public.waitlist_signups enable row level security;
revoke all on table public.waitlist_signups from anon, authenticated;
revoke all on sequence public.waitlist_pet_seq from anon, authenticated;

-- Saves a sign-up in one round trip. Idempotent per email: a retry, double tap or
-- returning pawrent gets their original pet ID and invite code back (duplicate = true).
create or replace function public.join_waitlist(
  p_name              text,
  p_email             text,
  p_pet_name          text,
  p_mobile_number     text,
  p_city              text        default null,
  p_dog_concerns      text[]      default '{}',
  p_concern_details   text        default null,
  p_referral_code     text        default null,
  p_referred_by       text        default null,
  p_client_created_at timestamptz default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text := lower(btrim(p_email));
  v_code  text := upper(btrim(coalesce(p_referral_code, '')));
  v_row   public.waitlist_signups%rowtype;
begin
  -- Fast path for retries and returning pawrents (also avoids burning a pet ID number).
  select * into v_row from public.waitlist_signups where email = v_email;
  if found then
    return jsonb_build_object('pet_id', v_row.pet_id, 'referral_code', v_row.referral_code, 'duplicate', true);
  end if;

  for attempt in 1..5 loop
    -- Missing or already-taken invite code: make a fresh one from the dog's name.
    if attempt > 1 or v_code !~ '^[A-Z0-9]{1,8}-[A-Z0-9]{1,8}$' then
      v_code := coalesce(nullif(left(upper(regexp_replace(p_pet_name, '[^a-zA-Z]', '', 'g')), 4), ''), 'PAWS')
                || '-' || upper(substr(md5(gen_random_uuid()::text), 1, 6));
    end if;

    insert into public.waitlist_signups (
      name, email, mobile_number, pet_name, city, dog_concerns, concern_details,
      referral_code, referred_by, client_created_at
    ) values (
      btrim(p_name), v_email, p_mobile_number, btrim(p_pet_name), nullif(btrim(p_city), ''),
      coalesce(p_dog_concerns, '{}'), nullif(btrim(p_concern_details), ''),
      v_code, nullif(upper(btrim(p_referred_by)), ''), p_client_created_at
    )
    on conflict do nothing
    returning * into v_row;

    if found then
      return jsonb_build_object('pet_id', v_row.pet_id, 'referral_code', v_row.referral_code, 'duplicate', false);
    end if;

    -- Conflict: same email (return the original) or an invite-code clash (try again).
    select * into v_row from public.waitlist_signups where email = v_email;
    if found then
      return jsonb_build_object('pet_id', v_row.pet_id, 'referral_code', v_row.referral_code, 'duplicate', true);
    end if;
  end loop;

  raise exception 'join_waitlist: could not allocate a unique invite code';
end;
$$;

revoke all on function public.join_waitlist(text, text, text, text, text, text[], text, text, text, timestamptz)
  from public, anon, authenticated;
grant execute on function public.join_waitlist(text, text, text, text, text, text[], text, text, text, timestamptz)
  to service_role;
