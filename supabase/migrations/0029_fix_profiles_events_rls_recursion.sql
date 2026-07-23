-- 0029 — Break the profiles ⇄ events RLS recursion
--
-- Creating an artwork inserts a genesis event and fails with
--   infinite recursion detected in policy for relation "events"
--
-- The cycle (both halves date from 0001):
--
--   insert into events
--     -> events_insert WITH CHECK contains `select 1 from profiles ...`
--     -> reading profiles applies profiles_select
--     -> profiles_select contains `select 1 from events e join artworks a ...`
--     -> reading events re-enters RLS for events  => recursion
--
-- Why it appeared only now, after artwork creation had worked for months:
-- until 0026 the third step was harmless, because events_select was a bare
-- `using (true)` — the planner satisfies that without a real policy
-- expansion, so the loop closed on nothing. 0026 (exhibition corrections)
-- legitimately rewrote events_select to hide withdrawn events, making it a
-- substantive policy. Re-entering it is now a real expansion, and Postgres
-- reports the recursion that had been latent since 0001.
--
-- 0026 is therefore the trigger, not the defect. Hiding withdrawn events is
-- correct and stays. The defect is that profiles_select reads a table
-- directly from inside a policy.
--
-- Fix: the schema already has the right tool for this. auth_controls_profile
-- is SECURITY DEFINER precisely so a policy can consult another table without
-- re-entering RLS. profiles_select's events lookup is the one place that
-- reads a table directly instead, so it gets the same treatment.
--
-- Semantics are unchanged: an artist still sees any profile that has been a
-- party to an event on one of their artworks, regardless of that profile's
-- privacy setting.

create or replace function auth_artist_sees_profile(p_profile_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from events e
    join artworks a on a.id = e.artwork_id
    where (e.from_party_id = p_profile_id or e.to_party_id = p_profile_id)
      and auth_controls_profile(a.root_artist_id)
  );
$$;

comment on function auth_artist_sees_profile(uuid) is
  'Artist-retains-visibility leg of profiles_select. SECURITY DEFINER so the '
  'events lookup does not re-enter RLS — see 0029. Returns only a boolean, '
  'and only about the caller (via auth_controls_profile), so it exposes '
  'nothing the policy did not already grant.';

drop policy if exists "profiles_select" on profiles;

create policy "profiles_select" on profiles
  for select
  using (
    is_public
    or auth_controls_profile(id)
    or auth_artist_sees_profile(id)
  );
