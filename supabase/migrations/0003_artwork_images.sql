-- Adds image support to artworks: a storage bucket plus the column that
-- points to an uploaded image's public URL.

alter table artworks add column if not exists image_url text;

insert into storage.buckets (id, name, public)
values ('artwork-images', 'artwork-images', true)
on conflict (id) do nothing;

-- Public bucket reads bypass RLS via the public URL, but uploads always need
-- an explicit policy. Kept simple for Phase 0: any authenticated user can
-- upload — the app only exposes this from the artwork-creation form for the
-- artist's own work, but this doesn't yet enforce that at the storage layer
-- itself (matching the same pragmatic deferral as other business-logic
-- checks noted elsewhere in this project, e.g. the custody-precondition
-- check on agent-executed sales).
create policy "artwork_images_insert" on storage.objects
  for insert
  with check (
    bucket_id = 'artwork-images'
    and auth.uid() is not null
  );

create policy "artwork_images_select" on storage.objects
  for select
  using (bucket_id = 'artwork-images');
