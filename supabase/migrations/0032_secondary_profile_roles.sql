-- 0032 — Secondary profile roles (the Artist / Curator hybrid)
--
-- profiles.type is single-valued, so someone who both makes and curates work
-- had to pick one. In practice that is common: an artist who curates group
-- shows, a gallery that also collects.
--
-- Nothing functional was ever gated on type — it drives the directory filter
-- and the printed label, and record_artwork_sale reads it to record
-- seller_type. Curator actions were already open to every type (see the note
-- on getExhibitionsLoggedBy). So this is a discovery and presentation
-- problem, and the fix is additive:
--
--   type            stays the canonical, primary role — unchanged, so
--                   seller_type, certificates and every existing label keep
--                   working with no downstream edits
--   secondary_roles adds the others, for the label and the directory filter
--
-- Chosen over a hybrid enum value ('artist_curator'), which would need a new
-- value for every future pairing, and over replacing type with a roles table,
-- which would touch seller_type derivation, certificates and every label for
-- no functional gain.

alter table public.profiles
  add column if not exists secondary_roles profile_type[] not null default '{}';

comment on column public.profiles.secondary_roles is
  'Additional roles beyond profiles.type, e.g. an artist who also curates. '
  'type remains the primary role and the one recorded as seller_type on a '
  'sale. Never contains type itself, and never duplicates — see the '
  'profiles_secondary_roles_valid constraint.';

-- Keep the set clean: the primary role must not be repeated as a secondary,
-- and the array must not contain duplicates. Both would otherwise render as
-- "Artist · Artist" and double-count a profile in directory filters.
alter table public.profiles
  drop constraint if exists profiles_secondary_roles_valid;

-- The duplicate test needs unnest(), and a CHECK constraint cannot contain a
-- subquery (0A000). An IMMUTABLE function can be called from one, so the
-- logic moves here.
create or replace function public.profile_roles_are_distinct(p_roles profile_type[])
returns boolean
language sql
immutable
as $$
  select p_roles is null
      or cardinality(p_roles) = (select count(distinct r) from unnest(p_roles) as r);
$$;

comment on function public.profile_roles_are_distinct(profile_type[]) is
  'True when the array holds no repeated role. Exists because CHECK '
  'constraints cannot contain subqueries — see 0032.';

alter table public.profiles
  add constraint profiles_secondary_roles_valid check (
    not (type = any (secondary_roles))
    and public.profile_roles_are_distinct(secondary_roles)
  );

-- The directory filters on roles, so it reads this on every profile listing.
create index if not exists profiles_secondary_roles_idx
  on public.profiles using gin (secondary_roles);
