-- Supports the collective/studio dashboard: creating unclaimed profiles and
-- logging historical work on their behalf (SCOPE.md's cold-start story).
--
-- Problem: an unclaimed profile has no controller (nobody has claimed it
-- yet), so every policy that gated artwork management on
-- auth_controls_profile(root_artist_id) would reject the very collective
-- that created the placeholder. This adds a helper that also allows the
-- creator of an unclaimed profile to act for it, and swaps it into every
-- policy that previously only checked auth_controls_profile(root_artist_id).

create or replace function auth_controls_or_created_unclaimed(p_profile_id uuid)
returns boolean
language sql
security definer
stable
as $$
  select
    auth_controls_profile(p_profile_id)
    or exists (
      select 1 from profiles p
      where p.id = p_profile_id
        and p.trust_tier = 'unclaimed'
        and auth_controls_profile(p.created_by)
    );
$$;

drop policy if exists "artworks_insert" on artworks;
create policy "artworks_insert" on artworks
  for insert
  with check (auth_controls_or_created_unclaimed(root_artist_id));

drop policy if exists "artworks_update" on artworks;
create policy "artworks_update" on artworks
  for update
  using (
    auth_controls_or_created_unclaimed(root_artist_id)
    or auth_controls_profile(current_owner_id)
    or auth_controls_profile(current_custodian_id)
  );

drop policy if exists "artwork_images_table_insert" on artwork_images;
create policy "artwork_images_table_insert" on artwork_images
  for insert
  with check (
    exists (
      select 1 from artworks a
      where a.id = artwork_id and auth_controls_or_created_unclaimed(a.root_artist_id)
    )
  );

drop policy if exists "artwork_images_table_update" on artwork_images;
create policy "artwork_images_table_update" on artwork_images
  for update
  using (
    exists (
      select 1 from artworks a
      where a.id = artwork_id and auth_controls_or_created_unclaimed(a.root_artist_id)
    )
  );

drop policy if exists "artwork_images_table_delete" on artwork_images;
create policy "artwork_images_table_delete" on artwork_images
  for delete
  using (
    exists (
      select 1 from artworks a
      where a.id = artwork_id and auth_controls_or_created_unclaimed(a.root_artist_id)
    )
  );

drop policy if exists "artwork_private_notes_select" on artwork_private_notes;
create policy "artwork_private_notes_select" on artwork_private_notes
  for select
  using (
    exists (
      select 1 from artworks a
      where a.id = artwork_id and auth_controls_or_created_unclaimed(a.root_artist_id)
    )
  );

drop policy if exists "artwork_private_notes_insert" on artwork_private_notes;
create policy "artwork_private_notes_insert" on artwork_private_notes
  for insert
  with check (
    exists (
      select 1 from artworks a
      where a.id = artwork_id and auth_controls_or_created_unclaimed(a.root_artist_id)
    )
  );

drop policy if exists "artwork_private_notes_update" on artwork_private_notes;
create policy "artwork_private_notes_update" on artwork_private_notes
  for update
  using (
    exists (
      select 1 from artworks a
      where a.id = artwork_id and auth_controls_or_created_unclaimed(a.root_artist_id)
    )
  );

drop policy if exists "artwork_collaborators_insert" on artwork_collaborators;
create policy "artwork_collaborators_insert" on artwork_collaborators
  for insert
  with check (
    exists (
      select 1 from artworks a
      where a.id = artwork_id and auth_controls_or_created_unclaimed(a.root_artist_id)
    )
  );

drop policy if exists "artwork_collaborators_delete" on artwork_collaborators;
create policy "artwork_collaborators_delete" on artwork_collaborators
  for delete
  using (
    exists (
      select 1 from artworks a
      where a.id = artwork_id and auth_controls_or_created_unclaimed(a.root_artist_id)
    )
  );
