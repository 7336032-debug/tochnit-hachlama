-- Secures sync_state: removes the open "anon read/write" RLS policy (which
-- let anyone holding the public anon key read/write ANY household's data,
-- not just their own) and replaces direct table access with SECURITY
-- DEFINER functions gated by the household PIN. The app now talks to the
-- table only through these functions - never directly.
--
-- Run this once in the Supabase SQL Editor. Table is empty at the time this
-- was written, so no data migration is needed.

drop policy if exists "anon read/write" on public.sync_state;

create extension if not exists pgcrypto;

alter table public.sync_state
  add column if not exists pin_hash text;

-- id is a deterministic hash of the pin (not the pin itself), so a row can
-- be found again on reconnect without ever storing the plaintext pin.
-- pin_hash is a separate bcrypt hash checked before any read or write, so
-- even a leaked/guessed id alone isn't enough to access the row.

create or replace function public.household_connect(p_pin text, p_initial_data jsonb default '{}'::jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id text := encode(digest(p_pin, 'sha256'), 'hex');
  v_row public.sync_state;
begin
  select * into v_row from public.sync_state where id = v_id;
  if not found then
    insert into public.sync_state (id, pin_hash, data, updated_at)
    values (v_id, crypt(p_pin, gen_salt('bf')), p_initial_data, now());
    return p_initial_data;
  end if;
  if v_row.pin_hash is null or v_row.pin_hash <> crypt(p_pin, v_row.pin_hash) then
    raise exception 'קוד לא תקין';
  end if;
  return v_row.data;
end;
$$;

create or replace function public.household_fetch(p_pin text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id text := encode(digest(p_pin, 'sha256'), 'hex');
  v_row public.sync_state;
begin
  select * into v_row from public.sync_state where id = v_id;
  if not found or v_row.pin_hash is null or v_row.pin_hash <> crypt(p_pin, v_row.pin_hash) then
    raise exception 'קוד לא תקין';
  end if;
  return v_row.data;
end;
$$;

create or replace function public.household_upsert(p_pin text, p_data jsonb)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id text := encode(digest(p_pin, 'sha256'), 'hex');
  v_row public.sync_state;
begin
  select * into v_row from public.sync_state where id = v_id;
  if not found or v_row.pin_hash is null or v_row.pin_hash <> crypt(p_pin, v_row.pin_hash) then
    raise exception 'קוד לא תקין';
  end if;
  update public.sync_state set data = p_data, updated_at = now() where id = v_id;
end;
$$;

-- no direct table access for the app's role - only through the functions above
revoke all on public.sync_state from anon, authenticated;
grant execute on function public.household_connect(text, jsonb) to anon;
grant execute on function public.household_fetch(text) to anon;
grant execute on function public.household_upsert(text, jsonb) to anon;
