-- EverLoyal waitlist: recognise returning pawrents by PHONE first, then email.
-- Run once in Supabase → SQL Editor. Safe to re-run. No rows are changed or deleted.
--
-- In India one person often has several emails but one mobile number, so the number is
-- the better identity (and the WhatsApp/call channel). A sign-up whose number OR email is
-- already on the list gets the original pet ID and invite code back (duplicate = true).
--
-- A returning pawrent also gets their saved first name ("Welcome back, Giri.") but only when
-- BOTH the number and the email match. Neither is verified, so a number or an email alone
-- must never reveal whose it is.
--
-- Rows that already share a number stay as they are; the earliest one is treated as the
-- pawrent. New duplicates can't appear: join_waitlist holds a per-number lock while it
-- checks and inserts, so two taps or two devices with one number can't both get in.

begin;

create index if not exists waitlist_signups_mobile_number_idx
  on public.waitlist_signups (mobile_number, created_at);

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
  p_client_created_at timestamptz default null,
  p_device_name       text        default null,
  p_form_seconds      numeric     default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email  text := lower(btrim(p_email));
  v_mobile text := btrim(p_mobile_number);
  v_code   text := upper(btrim(coalesce(p_referral_code, '')));
  v_row    public.waitlist_signups%rowtype;
begin
  -- Serialise sign-ups for the same number until this transaction ends.
  perform pg_advisory_xact_lock(hashtextextended('everloyal.waitlist.mobile:' || v_mobile, 0));

  -- Returning pawrent: same number first, then same email. The earliest sign-up wins.
  select * into v_row from public.waitlist_signups
   where mobile_number = v_mobile
   order by created_at, pet_id
   limit 1;
  if not found then
    select * into v_row from public.waitlist_signups where email = v_email;
  end if;
  if found then
    return jsonb_build_object(
      'pet_id', v_row.pet_id, 'referral_code', v_row.referral_code, 'duplicate', true,
      'first_name', case when v_row.mobile_number = v_mobile and v_row.email = v_email
                         then split_part(btrim(v_row.name), ' ', 1) end);
  end if;

  for attempt in 1..5 loop
    -- Missing or already-taken invite code: make a fresh one from the dog's name.
    if attempt > 1 or v_code !~ '^[A-Z0-9]{1,8}-[A-Z0-9]{1,8}$' then
      v_code := coalesce(nullif(left(upper(regexp_replace(p_pet_name, '[^a-zA-Z]', '', 'g')), 4), ''), 'PAWS')
                || '-' || upper(substr(md5(gen_random_uuid()::text), 1, 6));
    end if;

    insert into public.waitlist_signups (
      name, email, mobile_number, pet_name, city, dog_concerns, concern_details,
      referral_code, referred_by, client_created_at, device_name, form_seconds
    ) values (
      btrim(p_name), v_email, v_mobile, btrim(p_pet_name), nullif(btrim(p_city), ''),
      coalesce(p_dog_concerns, '{}'), nullif(btrim(p_concern_details), ''),
      v_code, nullif(upper(btrim(p_referred_by)), ''), p_client_created_at,
      -- analytics extras: out-of-range values are dropped, never a reason to fail a sign-up
      nullif(left(btrim(p_device_name), 120), ''),
      case when p_form_seconds between 0 and 86400 then round(p_form_seconds, 1) end
    )
    on conflict do nothing
    returning * into v_row;

    if found then
      return jsonb_build_object('pet_id', v_row.pet_id, 'referral_code', v_row.referral_code, 'duplicate', false);
    end if;

    -- Conflict: same email from another number signing up this instant (return that row),
    -- or an invite-code clash (try again with a new code).
    select * into v_row from public.waitlist_signups where email = v_email;
    if found then
      return jsonb_build_object(
      'pet_id', v_row.pet_id, 'referral_code', v_row.referral_code, 'duplicate', true,
      'first_name', case when v_row.mobile_number = v_mobile and v_row.email = v_email
                         then split_part(btrim(v_row.name), ' ', 1) end);
    end if;
  end loop;

  raise exception 'join_waitlist: could not allocate a unique invite code';
end;
$$;

revoke all on function public.join_waitlist(text, text, text, text, text, text[], text, text, text, timestamptz, text, numeric)
  from public, anon, authenticated;
grant execute on function public.join_waitlist(text, text, text, text, text, text[], text, text, text, timestamptz, text, numeric)
  to service_role;

notify pgrst, 'reload schema';

commit;
