-- 0025 — Artwork classification (unique vs. editioned)
--
-- artworks recorded only edition_number/edition_total, so a work with both
-- blank was indistinguishable from a work whose edition was simply never
-- recorded. That ambiguity is the worst kind for a provenance registry: it
-- reaches collectors on the artwork page and gets embedded verbatim in the
-- authenticity certificate snapshot.
--
-- classification makes the distinction explicit, following the taxonomy the
-- wider market already uses (Artsy et al.).

alter table public.artworks
  add column if not exists classification text;

comment on column public.artworks.classification is
  'unique | limited_edition | open_edition | unknown_edition. Null means not '
  'yet recorded — deliberately distinct from ''unique'', which is a positive '
  'claim that the work is one of a kind.';

-- Backfill only what the existing data actually proves: a recorded edition
-- total means the run ended at a known size. Everything else stays null for
-- the artist to set, because defaulting to 'unique' would write an
-- unverified provenance claim into every future certificate.
update public.artworks
set classification = 'limited_edition'
where classification is null
  and edition_total is not null;

-- Values, and the edition fields each one permits. Null classification is
-- always allowed so pre-existing rows stay valid until reviewed.
alter table public.artworks
  drop constraint if exists artworks_classification_valid;

alter table public.artworks
  add constraint artworks_classification_valid check (
    classification is null
    or (classification = 'unique'
        and edition_number is null and edition_total is null)
    or (classification = 'limited_edition'
        and edition_total is not null)
    or (classification = 'open_edition'
        and edition_total is null)
    or (classification = 'unknown_edition'
        and edition_number is null and edition_total is null)
  );

-- Certificate snapshots gain the field, so schema_version goes to 2.
-- Certificates already issued keep their stored v1 snapshot and hash and
-- continue to verify unchanged.

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
    'schema_version', 2,
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
    'classification', v_artwork.classification,
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
