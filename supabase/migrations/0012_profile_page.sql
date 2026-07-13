-- Profile page support: avatar, bio, website, CV attachment, plus a
-- storage bucket for profile media (avatars and CV files).

alter table profiles add column if not exists avatar_url text;
alter table profiles add column if not exists bio text;
alter table profiles add column if not exists website_url text;
alter table profiles add column if not exists cv_url text;

insert into storage.buckets (id, name, public)
values ('profile-media', 'profile-media', true)
on conflict (id) do nothing;

drop policy if exists "profile_media_insert" on storage.objects;
create policy "profile_media_insert" on storage.objects
  for insert
  with check (
    bucket_id = 'profile-media'
    and auth.uid() is not null
  );

drop policy if exists "profile_media_select" on storage.objects;
create policy "profile_media_select" on storage.objects
  for select
  using (bucket_id = 'profile-media');
