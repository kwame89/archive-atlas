-- Server-controlled profile integrations.
--
-- JGA Studio is Jay Golding's private storefront integration, not a general
-- Archive Atlas feature. Browser clients may read enabled integrations so
-- they can hide unavailable controls, but only service-role processes may
-- add, change, or remove integration access.

begin;

create table if not exists public.profile_integrations (
  profile_id uuid not null references public.profiles (id) on delete cascade,
  integration_key text not null,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (profile_id, integration_key),
  constraint profile_integrations_key_format
    check (integration_key ~ '^[a-z0-9_]+$')
);

comment on table public.profile_integrations is
  'Server-managed allowlist for private profile-specific integrations.';

alter table public.profile_integrations enable row level security;

drop policy if exists profile_integrations_authenticated_read
  on public.profile_integrations;
create policy profile_integrations_authenticated_read
  on public.profile_integrations
  for select
  to authenticated
  using (enabled);

revoke all on table public.profile_integrations from public, anon, authenticated;
grant select on table public.profile_integrations to authenticated;
grant select, insert, update, delete on table public.profile_integrations to service_role;

-- Jay Golding's root artist profile is the only Archive Atlas profile allowed
-- to send artwork records to JGA Studio.
insert into public.profile_integrations (profile_id, integration_key, enabled)
values (
  '2cbf67cc-f5da-4bda-b09a-90a6c719b604',
  'jga_studio',
  true
)
on conflict (profile_id, integration_key) do update
set enabled = excluded.enabled,
    updated_at = now();

commit;
