-- Certificates of Authenticity are immutable snapshots of the canonical
-- artwork record. They verify authorship and object identity; they are not
-- proof of ownership, title, or monetary appraisal.

create table if not exists public.authenticity_certificates (
  id uuid primary key default gen_random_uuid(),
  artwork_id uuid not null references public.artworks (id) on delete cascade,
  root_artist_id uuid not null references public.profiles (id),
  issued_by uuid not null references public.profiles (id),
  certificate_number text not null unique,
  verification_code uuid not null default gen_random_uuid() unique,
  version integer not null check (version > 0),
  artwork_snapshot jsonb not null,
  certificate_hash text not null,
  issued_at timestamptz not null default now(),
  revoked_at timestamptz,
  revoked_by uuid references public.profiles (id),
  revocation_reason text,
  created_at timestamptz not null default now(),
  unique (artwork_id, version),
  check (jsonb_typeof(artwork_snapshot) = 'object'),
  check (
    (revoked_at is null and revoked_by is null)
    or (revoked_at is not null and revoked_by is not null)
  )
);

create index if not exists authenticity_certificates_artwork_idx
  on public.authenticity_certificates (artwork_id, version desc);

create unique index if not exists authenticity_certificates_one_active_idx
  on public.authenticity_certificates (artwork_id)
  where revoked_at is null;

alter table public.authenticity_certificates enable row level security;

drop policy if exists "authenticity_certificates_controller_select" on public.authenticity_certificates;
create policy "authenticity_certificates_controller_select"
  on public.authenticity_certificates
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.profile_controllers pc
      join public.profiles controller on controller.id = pc.controller_profile_id
      where pc.profile_id = authenticity_certificates.root_artist_id
        and controller.auth_user_id = auth.uid()
    )
  );

create or replace function public.get_authenticity_certificate(p_verification_code uuid)
returns public.authenticity_certificates
language sql
stable
security definer
set search_path = public
as $$
  select certificate
  from public.authenticity_certificates certificate
  where certificate.verification_code = p_verification_code;
$$;

create or replace function public.issue_authenticity_certificate(p_artwork_id uuid)
returns public.authenticity_certificates
language plpgsql
security definer
set search_path = public
as $$
declare
  v_artwork public.artworks%rowtype;
  v_artist public.profiles%rowtype;
  v_issuer_id uuid;
  v_issuer_name text;
  v_primary_image_url text;
  v_primary_image_storage_path text;
  v_certificate_id uuid := gen_random_uuid();
  v_verification_code uuid := gen_random_uuid();
  v_issued_at timestamptz := now();
  v_version integer;
  v_certificate_number text;
  v_snapshot jsonb;
  v_hash text;
  v_result public.authenticity_certificates%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  select * into v_artwork
  from public.artworks
  where id = p_artwork_id;

  if not found then
    raise exception 'Artwork not found';
  end if;

  select pc.controller_profile_id, controller.display_name
    into v_issuer_id, v_issuer_name
  from public.profile_controllers pc
  join public.profiles controller on controller.id = pc.controller_profile_id
  where pc.profile_id = v_artwork.root_artist_id
    and controller.auth_user_id = auth.uid()
  order by (pc.controller_profile_id = v_artwork.root_artist_id) desc
  limit 1;

  if v_issuer_id is null then
    raise exception 'You do not control the root artist profile';
  end if;

  select * into v_artist
  from public.profiles
  where id = v_artwork.root_artist_id;

  if v_artist.trust_tier = 'unclaimed' then
    raise exception 'The root artist profile must be claimed before issuing a certificate';
  end if;

  select ai.url into v_primary_image_url
  from public.artwork_images ai
  where ai.artwork_id = v_artwork.id
  order by ai.is_primary desc, ai.created_at asc
  limit 1;

  v_primary_image_storage_path := replace(
    split_part(
      split_part(
        coalesce(v_primary_image_url, ''),
        '/storage/v1/object/public/artwork-images/',
        2
      ),
      '?',
      1
    ),
    '%20',
    ' '
  );

  perform pg_advisory_xact_lock(hashtextextended(p_artwork_id::text, 0));

  select coalesce(max(version), 0) + 1 into v_version
  from public.authenticity_certificates
  where artwork_id = p_artwork_id;

  v_certificate_number :=
    'AA-COA-' || to_char(v_issued_at, 'YYYY') || '-' ||
    upper(substr(replace(v_certificate_id::text, '-', ''), 1, 10));

  v_snapshot := jsonb_build_object(
    'schema_version', 1,
    'artwork_id', v_artwork.id,
    'title', v_artwork.title,
    'artist_profile_id', v_artist.id,
    'artist_name', v_artist.display_name,
    'artist_trust_tier', v_artist.trust_tier::text,
    'artist_linked_wallet', v_artist.linked_wallet,
    'issued_by_name', v_issuer_name,
    'medium', v_artwork.medium,
    'dimensions', v_artwork.dimensions,
    'height', v_artwork.height,
    'width', v_artwork.width,
    'depth', v_artwork.depth,
    'year', v_artwork.year,
    'is_circa', v_artwork.is_circa,
    'date_display_override', v_artwork.date_display_override,
    'edition_number', v_artwork.edition_number,
    'edition_total', v_artwork.edition_total,
    'is_signed', v_artwork.is_signed,
    'signature_notes', v_artwork.signature_notes,
    'primary_image_url', v_primary_image_url,
    'primary_image_storage_path', nullif(v_primary_image_storage_path, '')
  );

  v_hash := encode(
    digest(
      v_snapshot::text || '|' || v_certificate_number || '|' || v_issued_at::text,
      'sha256'
    ),
    'hex'
  );

  update public.authenticity_certificates
  set revoked_at = v_issued_at,
      revoked_by = v_issuer_id,
      revocation_reason = 'Superseded by ' || v_certificate_number
  where artwork_id = p_artwork_id
    and revoked_at is null;

  insert into public.authenticity_certificates (
    id,
    artwork_id,
    root_artist_id,
    issued_by,
    certificate_number,
    verification_code,
    version,
    artwork_snapshot,
    certificate_hash,
    issued_at
  ) values (
    v_certificate_id,
    v_artwork.id,
    v_artwork.root_artist_id,
    v_issuer_id,
    v_certificate_number,
    v_verification_code,
    v_version,
    v_snapshot,
    v_hash,
    v_issued_at
  ) returning * into v_result;

  return v_result;
end;
$$;

create or replace function public.revoke_authenticity_certificate(
  p_certificate_id uuid,
  p_reason text
)
returns public.authenticity_certificates
language plpgsql
security definer
set search_path = public
as $$
declare
  v_certificate public.authenticity_certificates%rowtype;
  v_issuer_id uuid;
  v_result public.authenticity_certificates%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  select * into v_certificate
  from public.authenticity_certificates
  where id = p_certificate_id;

  if not found then
    raise exception 'Certificate not found';
  end if;

  select pc.controller_profile_id into v_issuer_id
  from public.profile_controllers pc
  join public.profiles controller on controller.id = pc.controller_profile_id
  where pc.profile_id = v_certificate.root_artist_id
    and controller.auth_user_id = auth.uid()
  order by (pc.controller_profile_id = v_certificate.root_artist_id) desc
  limit 1;

  if v_issuer_id is null then
    raise exception 'You do not control the root artist profile';
  end if;

  if v_certificate.revoked_at is not null then
    return v_certificate;
  end if;

  update public.authenticity_certificates
  set revoked_at = now(),
      revoked_by = v_issuer_id,
      revocation_reason = left(coalesce(nullif(trim(p_reason), ''), 'Revoked by issuer'), 500)
  where id = p_certificate_id
  returning * into v_result;

  return v_result;
end;
$$;

revoke all on public.authenticity_certificates from anon, authenticated;
grant select on public.authenticity_certificates to authenticated;

revoke all on function public.get_authenticity_certificate(uuid) from public;
revoke all on function public.issue_authenticity_certificate(uuid) from public;
revoke all on function public.revoke_authenticity_certificate(uuid, text) from public;
grant execute on function public.get_authenticity_certificate(uuid) to anon, authenticated;
grant execute on function public.issue_authenticity_certificate(uuid) to authenticated;
grant execute on function public.revoke_authenticity_certificate(uuid, text) to authenticated;

-- Keep an image object if any issued certificate captured that exact storage
-- path. The live artwork image row can still be replaced or removed.
drop policy if exists "artwork_images_delete" on storage.objects;
create policy "artwork_images_delete" on storage.objects
  for delete
  using (
    bucket_id = 'artwork-images'
    and exists (
      select 1
      from public.artworks artwork
      where artwork.id::text = split_part(name, '/', 1)
        and public.auth_controls_or_created_unclaimed(artwork.root_artist_id)
    )
    and not exists (
      select 1
      from public.authenticity_certificates certificate
      where certificate.artwork_snapshot ->> 'primary_image_storage_path' = name
    )
  );

comment on table public.authenticity_certificates is
  'Immutable, publicly verifiable COA snapshots issued by controllers of the root artist.';

comment on column public.authenticity_certificates.certificate_hash is
  'SHA-256 digest of the certificate snapshot, number, and issue timestamp.';
