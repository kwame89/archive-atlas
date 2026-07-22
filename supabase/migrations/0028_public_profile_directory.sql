-- Public profile discovery for artists, curators, galleries, collectives,
-- collectors who opt in, and cultural institutions.

alter type public.profile_type add value if not exists 'institution';

alter table public.profiles
  add column if not exists headline text,
  add column if not exists location text,
  add column if not exists specialties text[] not null default '{}'::text[],
  add column if not exists public_email text;

comment on column public.profiles.headline is
  'Short public-facing description shown in the profile directory and profile header.';

comment on column public.profiles.location is
  'Optional public city, region, or country used for discovery.';

comment on column public.profiles.specialties is
  'Optional public practice areas, roles, media, or institutional focuses.';

comment on column public.profiles.public_email is
  'Optional contact address intentionally published by the profile controller.';

create table if not exists public.profile_follows (
  follower_profile_id uuid not null references public.profiles (id) on delete cascade,
  followed_profile_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_profile_id, followed_profile_id),
  constraint profile_follows_not_self check (follower_profile_id <> followed_profile_id)
);

create index if not exists profile_follows_followed_idx
  on public.profile_follows (followed_profile_id, created_at desc);

alter table public.profile_follows enable row level security;

drop policy if exists "profile_follows_select" on public.profile_follows;
create policy "profile_follows_select" on public.profile_follows
  for select
  using (
    public.auth_controls_profile(follower_profile_id)
    or exists (
      select 1
      from public.profiles follower
      where follower.id = follower_profile_id
        and follower.is_public
    )
  );

drop policy if exists "profile_follows_insert" on public.profile_follows;
create policy "profile_follows_insert" on public.profile_follows
  for insert
  with check (
    public.auth_controls_profile(follower_profile_id)
    and exists (
      select 1
      from public.profiles followed
      where followed.id = followed_profile_id
        and followed.is_public
    )
  );

drop policy if exists "profile_follows_delete" on public.profile_follows;
create policy "profile_follows_delete" on public.profile_follows
  for delete
  using (public.auth_controls_profile(follower_profile_id));

grant select, insert, delete on table public.profile_follows
  to authenticated, service_role;
