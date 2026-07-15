-- Image rows can already be deleted by an artwork's authorized manager.
-- Allow the same manager to remove the corresponding object from storage.

drop policy if exists "artwork_images_delete" on storage.objects;
create policy "artwork_images_delete" on storage.objects
  for delete
  using (
    bucket_id = 'artwork-images'
    and exists (
      select 1
      from public.artworks a
      where a.id::text = split_part(name, '/', 1)
        and public.auth_controls_or_created_unclaimed(a.root_artist_id)
    )
  );
