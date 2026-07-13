-- Supports ownership_transfer/custody_change logging: broadens
-- artworks_update so the current owner's or custodian's controllers can
-- update the denormalized current_owner_id/current_custodian_id cache when
-- a transfer happens — previously only the root artist could update an
-- artwork row at all, which breaks the moment a piece leaves the artist's
-- hands (a collector reselling to another collector couldn't update it).

drop policy if exists "artworks_update" on artworks;

create policy "artworks_update" on artworks
  for update
  using (
    auth_controls_profile(root_artist_id)
    or auth_controls_profile(current_owner_id)
    or auth_controls_profile(current_custodian_id)
  );
