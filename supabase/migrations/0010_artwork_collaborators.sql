-- Supports collaborative artworks: additional co-creators beyond
-- artworks.root_artist_id, which stays the primary/root creator (matches
-- SCOPE.md's "artist is the root of the record"). Attribution-only for
-- now — collaborators are publicly credited but management rights (images,
-- description, transfers) stay with the root artist's controllers, not
-- extended to collaborators. Revisit if shared management turns out to
-- matter in practice.

create table artwork_collaborators (
  artwork_id uuid not null references artworks (id) on delete cascade,
  profile_id uuid not null references profiles (id),
  role text,
  added_at timestamptz not null default now(),
  primary key (artwork_id, profile_id)
);

alter table artwork_collaborators enable row level security;

create policy "artwork_collaborators_select" on artwork_collaborators
  for select
  using (true);

create policy "artwork_collaborators_insert" on artwork_collaborators
  for insert
  with check (
    exists (
      select 1 from artworks a
      where a.id = artwork_id and auth_controls_profile(a.root_artist_id)
    )
  );

create policy "artwork_collaborators_delete" on artwork_collaborators
  for delete
  using (
    exists (
      select 1 from artworks a
      where a.id = artwork_id and auth_controls_profile(a.root_artist_id)
    )
  );
