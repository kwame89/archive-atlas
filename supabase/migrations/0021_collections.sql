-- Ordered bodies of work managed by an artist profile.
--
-- Collections are an Archive Atlas organizational record available to every
-- artist. Publishing to JGA Studio remains a separate, server-allowlisted
-- integration controlled by profile_integrations.

begin;

create table if not exists public.collections (
  id uuid primary key default gen_random_uuid(),
  artist_id uuid not null references public.profiles (id) on delete cascade,
  title text not null,
  description text,
  start_year int,
  end_year int,
  cover_artwork_id uuid references public.artworks (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint collections_title_not_blank
    check (length(trim(title)) > 0),
  constraint collections_year_order
    check (start_year is null or end_year is null or start_year <= end_year)
);

create index if not exists collections_artist_id_idx
  on public.collections (artist_id, updated_at desc);

create table if not exists public.collection_artworks (
  collection_id uuid not null references public.collections (id) on delete cascade,
  artwork_id uuid not null references public.artworks (id) on delete cascade,
  sort_order int not null default 0,
  added_at timestamptz not null default now(),
  primary key (collection_id, artwork_id),
  constraint collection_artworks_sort_order_nonnegative
    check (sort_order >= 0)
);

create index if not exists collection_artworks_order_idx
  on public.collection_artworks (collection_id, sort_order, added_at);

alter table public.collections enable row level security;
alter table public.collection_artworks enable row level security;

revoke all on table public.collections
  from public, anon, authenticated;
revoke all on table public.collection_artworks
  from public, anon, authenticated;
grant select, insert, update, delete on table public.collections
  to authenticated, service_role;
grant select on table public.collection_artworks
  to authenticated;
grant select, insert, update, delete on table public.collection_artworks
  to service_role;

drop policy if exists collections_select_controlled
  on public.collections;
create policy collections_select_controlled
  on public.collections
  for select
  to authenticated
  using (public.auth_controls_profile(artist_id));

drop policy if exists collections_insert_controlled
  on public.collections;
create policy collections_insert_controlled
  on public.collections
  for insert
  to authenticated
  with check (public.auth_controls_profile(artist_id));

drop policy if exists collections_update_controlled
  on public.collections;
create policy collections_update_controlled
  on public.collections
  for update
  to authenticated
  using (public.auth_controls_profile(artist_id))
  with check (public.auth_controls_profile(artist_id));

drop policy if exists collections_delete_controlled
  on public.collections;
create policy collections_delete_controlled
  on public.collections
  for delete
  to authenticated
  using (public.auth_controls_profile(artist_id));

drop policy if exists collection_artworks_select_controlled
  on public.collection_artworks;
create policy collection_artworks_select_controlled
  on public.collection_artworks
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.collections collection
      where collection.id = collection_artworks.collection_id
        and public.auth_controls_profile(collection.artist_id)
    )
  );

-- Membership replacement is performed through the function below so order
-- changes are atomic and every artwork is verified against the collection's
-- artist profile.

create or replace function public.replace_collection_artworks(
  p_collection_id uuid,
  p_artwork_ids uuid[]
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  collection_artist_id uuid;
  normalized_artwork_ids uuid[] := coalesce(p_artwork_ids, array[]::uuid[]);
begin
  select artist_id
  into collection_artist_id
  from public.collections
  where id = p_collection_id
  for update;

  if collection_artist_id is null then
    raise exception 'Collection not found';
  end if;

  if not public.auth_controls_profile(collection_artist_id) then
    raise exception 'You do not control this collection';
  end if;

  if cardinality(normalized_artwork_ids) > 100 then
    raise exception 'A collection may contain at most 100 artworks';
  end if;

  if (
    select count(*) <> count(distinct artwork_id)
    from unnest(normalized_artwork_ids) artwork_id
  ) then
    raise exception 'A collection cannot contain the same artwork twice';
  end if;

  if exists (
    select 1
    from unnest(normalized_artwork_ids) requested_artwork_id
    left join public.artworks artwork
      on artwork.id = requested_artwork_id
    where artwork.id is null
      or artwork.root_artist_id <> collection_artist_id
  ) then
    raise exception 'Every collection artwork must belong to the collection artist';
  end if;

  delete from public.collection_artworks
  where collection_id = p_collection_id;

  insert into public.collection_artworks (collection_id, artwork_id, sort_order)
  select p_collection_id, artwork_id, ordinality::int - 1
  from unnest(normalized_artwork_ids) with ordinality ordered(artwork_id, ordinality);

  update public.collections
  set cover_artwork_id =
        case
          when cover_artwork_id = any(normalized_artwork_ids)
            then cover_artwork_id
          else normalized_artwork_ids[1]
        end,
      updated_at = now()
  where id = p_collection_id;
end;
$$;

revoke all on function public.replace_collection_artworks(uuid, uuid[])
  from public, anon;
grant execute on function public.replace_collection_artworks(uuid, uuid[])
  to authenticated, service_role;

create or replace function public.validate_collection_cover()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.cover_artwork_id is not null
    and not exists (
      select 1
      from public.collection_artworks membership
      where membership.collection_id = new.id
        and membership.artwork_id = new.cover_artwork_id
    )
  then
    raise exception 'The collection cover must be one of its artworks';
  end if;

  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists collections_validate_cover
  on public.collections;
create trigger collections_validate_cover
before insert or update on public.collections
for each row
execute function public.validate_collection_cover();

commit;
