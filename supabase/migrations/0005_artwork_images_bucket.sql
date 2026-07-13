-- Migration 0003 defined this storage bucket, but 0003 itself was never
-- actually applied before 0004 superseded its image_url column — this
-- migration exists standalone so the bucket and its policies exist
-- regardless of 0003's history.

insert into storage.buckets (id, name, public)
values ('artwork-images', 'artwork-images', true)
on conflict (id) do nothing;

drop policy if exists "artwork_images_insert" on storage.objects;
create policy "artwork_images_insert" on storage.objects
  for insert
  with check (
    bucket_id = 'artwork-images'
    and auth.uid() is not null
  );

drop policy if exists "artwork_images_select" on storage.objects;
create policy "artwork_images_select" on storage.objects
  for select
  using (bucket_id = 'artwork-images');
