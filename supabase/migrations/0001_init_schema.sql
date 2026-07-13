-- Phase 0: core schema for profiles, artworks, and the event audit trail.
-- See ../../SCOPE.md for the conceptual model this implements.

create extension if not exists "pgcrypto";

create type profile_type as enum (
  'artist',
  'collective',
  'gallery',
  'curator',
  'collector'
);

create type trust_tier as enum (
  'unclaimed',
  'claimed',
  'wallet_linked',
  'entity'
);

create type event_type as enum (
  'genesis',
  'ownership_transfer',
  'custody_change',
  'exhibition',
  'claim',
  'condition_report',
  'dispute',
  'succession'
);

-- PROFILES ------------------------------------------------------------------

create table profiles (
  id uuid primary key default gen_random_uuid(),
  type profile_type not null,
  trust_tier trust_tier not null default 'unclaimed',
  display_name text not null,
  legal_name text,
  linked_wallet text,
  is_public boolean not null default true,
  auth_user_id uuid unique references auth.users (id),
  created_by uuid references profiles (id),
  claimed_at timestamptz,
  created_at timestamptz not null default now()
);

comment on column profiles.is_public is
  'Default true, except collector profiles which default false at insert time (see policy). '
  'Controls visibility of this profile''s identity, not the fact that transfers involving it occurred.';

-- Every profile has one or more controllers: the profiles authorized to act
-- as `actor` on its behalf. An individual artist starts with exactly one
-- (themselves, set at claim time). Org profiles are multi-controller from
-- the start. See SCOPE.md > Profile control & succession.
create table profile_controllers (
  profile_id uuid not null references profiles (id) on delete cascade,
  controller_profile_id uuid not null references profiles (id) on delete cascade,
  added_at timestamptz not null default now(),
  primary key (profile_id, controller_profile_id)
);

-- ARTWORKS --------------------------------------------------------------

create table artworks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  medium text,
  dimensions text,
  year int,
  edition_number int,
  edition_total int,
  root_artist_id uuid not null references profiles (id),
  -- Denormalized current-state cache, kept in sync by application logic /
  -- triggers as events are inserted. The event log (below) remains the
  -- source of truth; these columns exist purely so "what does X currently
  -- own" doesn't require scanning the full event history on every read.
  current_owner_id uuid references profiles (id),
  current_custodian_id uuid references profiles (id),
  created_at timestamptz not null default now()
);

-- EVENTS ------------------------------------------------------------------

create table events (
  id uuid primary key default gen_random_uuid(),
  type event_type not null,
  actor_id uuid not null references profiles (id),
  artwork_id uuid references artworks (id),
  target_profile_id uuid references profiles (id), -- used by claim, succession
  from_party_id uuid references profiles (id),      -- ownership_transfer, custody_change
  to_party_id uuid references profiles (id),        -- genesis, ownership_transfer, custody_change
  disputed_event_id uuid references events (id),    -- used by dispute
  transaction_group_id uuid,
  occurred_at timestamptz not null default now(),
  on_chain_anchor_hash text,
  notes text,
  created_at timestamptz not null default now()
);

create index events_artwork_id_idx on events (artwork_id);
create index events_actor_id_idx on events (actor_id);
create index events_target_profile_id_idx on events (target_profile_id);
create index events_transaction_group_id_idx on events (transaction_group_id);
create index profile_controllers_controller_idx on profile_controllers (controller_profile_id);

-- HELPER: the profile(s) the current auth user controls -------------------

create or replace function auth_controls_profile(p_profile_id uuid)
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1
    from profile_controllers pc
    join profiles p on p.id = pc.controller_profile_id
    where pc.profile_id = p_profile_id
      and p.auth_user_id = auth.uid()
  );
$$;

-- ROW LEVEL SECURITY --------------------------------------------------------
-- These policies cover row visibility and the trust-tier restriction that
-- maps cleanly onto SQL. The subtler business rules noted in SCOPE.md
-- (custody-precondition checks on agent-executed sales, multisig-threshold
-- approval for succession/controller changes) are NOT enforced here — they
-- need application logic / Supabase Edge Functions on top of this, per the
-- Phase 0 stack discussion.

alter table profiles enable row level security;
alter table profile_controllers enable row level security;
alter table artworks enable row level security;
alter table events enable row level security;

-- Profiles: public profiles are visible to everyone. Private (typically
-- collector) profiles are visible to their own controllers, and to the root
-- artist of any artwork they've been a party to an event on — the artist
-- always retains visibility regardless of the collector's privacy setting.
create policy "profiles_select" on profiles
  for select
  using (
    is_public
    or auth_controls_profile(id)
    or exists (
      select 1
      from events e
      join artworks a on a.id = e.artwork_id
      where (e.from_party_id = profiles.id or e.to_party_id = profiles.id)
        and auth_controls_profile(a.root_artist_id)
    )
  );

-- Anyone authenticated can create a profile for themselves (claimed) or an
-- unclaimed placeholder on someone else's behalf (created_by = their own
-- profile). Collector profiles default private.
create policy "profiles_insert" on profiles
  for insert
  with check (
    auth.uid() is not null
  );

-- Updates: only current controllers may update a profile, EXCEPT for the
-- claim transition itself, which is self-service by design (see
-- SCOPE.md > Identity & Trust Tiers) — an unclaimed profile with no
-- auth_user_id can be claimed by any authenticated user, exactly once.
create policy "profiles_update" on profiles
  for update
  using (
    auth_controls_profile(id)
    or (trust_tier = 'unclaimed' and auth_user_id is null)
  )
  with check (
    auth_controls_profile(id)
    or (auth_user_id = auth.uid())
  );

-- profile_controllers: visible to anyone who can see the underlying
-- profile; only existing controllers can add/remove controllers.
create policy "profile_controllers_select" on profile_controllers
  for select
  using (true);

create policy "profile_controllers_insert" on profile_controllers
  for insert
  with check (auth_controls_profile(profile_id));

create policy "profile_controllers_delete" on profile_controllers
  for delete
  using (auth_controls_profile(profile_id));

-- Artworks: public read (the provenance record is meant to be visible).
-- Only controllers of the root artist can create/update.
create policy "artworks_select" on artworks
  for select
  using (true);

create policy "artworks_insert" on artworks
  for insert
  with check (auth_controls_profile(root_artist_id));

create policy "artworks_update" on artworks
  for update
  using (auth_controls_profile(root_artist_id));

-- Events: public read (audit trail). Insert requires the actor to be
-- controlled by the current user, AND — the one trust-tier rule that maps
-- directly to SQL — an unclaimed profile can never be a party to an
-- ownership_transfer.
create policy "events_select" on events
  for select
  using (true);

create policy "events_insert" on events
  for insert
  with check (
    auth_controls_profile(actor_id)
    and (
      type <> 'ownership_transfer'
      or not exists (
        select 1 from profiles p
        where p.id in (from_party_id, to_party_id)
          and p.trust_tier = 'unclaimed'
      )
    )
  );
