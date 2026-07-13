-- Replaces the single artworks.image_url column with a proper one-to-many
-- artwork_images table, so an artwork can have multiple images with one
-- marked primary.

create table artwork_images (
  id uuid primary key default gen_random_uuid(),
  artwork_id uuid not null references artworks (id) on delete cascade,
  url text not null,
  is_primary boolean not null default false,
  created_at timestamptz not null default now()
);

-- At most one primary image per artwork.
create unique index artwork_images_one_primary_per_artwork
  on artwork_images (artwork_id)
  where is_primary;

-- Carry over any existing single image_url values as each artwork's
-- primary image before dropping the column.
insert into artwork_images (artwork_id, url, is_primary)
select id, image_url, true from artworks where image_url is not null;

alter table artworks drop column image_url;

alter table artwork_images enable row level security;

create policy "artwork_images_table_select" on artwork_images
  for select
  using (true);

create policy "artwork_images_table_insert" on artwork_images
  for insert
  with check (
    exists (
      select 1 from artworks a
      where a.id = artwork_id and auth_controls_profile(a.root_artist_id)
    )
  );

create policy "artwork_images_table_update" on artwork_images
  for update
  using (
    exists (
      select 1 from artworks a
      where a.id = artwork_id and auth_controls_profile(a.root_artist_id)
    )
  );

create policy "artwork_images_table_delete" on artwork_images
  for delete
  using (
    exists (
      select 1 from artworks a
      where a.id = artwork_id and auth_controls_profile(a.root_artist_id)
    )
  );
