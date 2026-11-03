-- EverLoyal waitlist: record the device and how long the form took.
-- Run once in Supabase → SQL Editor, BEFORE restarting/deploying the function. Safe to re-run.
-- Both values come from the browser itself (no third-party service, no permission prompt).

begin;

alter table public.waitlist_signups
  add column if not exists device_name  text,
  add column if not exists form_seconds numeric(7, 1);

comment on column public.waitlist_signups.device_name is
  'Device as reported by the browser, e.g. "SM-A525F (Android 14, Chrome)" or "iPhone (iOS 17.4, Safari)".';
comment on column public.waitlist_signups.form_seconds is
  'Seconds from first touching a form field to tapping Join.';

alter table public.waitlist_signups drop constraint if exists waitlist_signups_device_name_check;
alter table public.waitlist_signups
  add constraint waitlist_signups_device_name_check check (char_length(device_name) <= 120);
alter table public.waitlist_signups drop constraint if exists waitlist_signups_form_seconds_check;
alter table public.waitlist_signups
  add constraint waitlist_signups_form_seconds_check check (form_seconds between 0 and 86400);

-- Replace join_waitlist() with a version that also takes the two new values.
-- They default to null, so the function code already deployed keeps working.
drop function if exists public.join_waitlist(text, text, text, text, text, text[], text, text, text, timestamptz);

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
      referral_code, referred_by, client_created_at, device_name, form_seconds
    ) values (
      btrim(p_name), v_email, p_mobile_number, btrim(p_pet_name), nullif(btrim(p_city), ''),
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

    -- Conflict: same email (return the original) or an invite-code clash (try again).
    select * into v_row from public.waitlist_signups where email = v_email;
    if found then
      return jsonb_build_object('pet_id', v_row.pet_id, 'referral_code', v_row.referral_code, 'duplicate', true);
    end if;
  end loop;

  raise exception 'join_waitlist: could not allocate a unique invite code';
end;
$$;

revoke all on function public.join_waitlist(text, text, text, text, text, text[], text, text, text, timestamptz, text, numeric)
  from public, anon, authenticated;
grant execute on function public.join_waitlist(text, text, text, text, text, text[], text, text, text, timestamptz, text, numeric)
  to service_role;

-- Tell the API layer about the new function signature right away.
notify pgrst, 'reload schema';

commit;
