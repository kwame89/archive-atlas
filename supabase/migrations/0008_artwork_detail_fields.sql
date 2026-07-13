-- Richer artwork detail fields, informed by comparing against Artwork
-- Archive's actual piece record: a public description distinct from
-- always-private notes, structured dimensions with a free-text override,
-- tags/categorization, signature, a current condition snapshot, and
-- circa/imprecise-date display support.

alter table artworks add column if not exists description text;
alter table artworks add column if not exists height numeric;
alter table artworks add column if not exists width numeric;
alter table artworks add column if not exists depth numeric;
alter table artworks add column if not exists tags text[];
alter table artworks add column if not exists subject_matter text;
alter table artworks add column if not exists art_type text;
alter table artworks add column if not exists is_signed boolean not null default false;
alter table artworks add column if not exists signature_notes text;
alter table artworks add column if not exists condition text;
alter table artworks add column if not exists is_circa boolean not null default false;
alter table artworks add column if not exists date_display_override text;

-- Kept as its own table (not a column on artworks) so "always private" is a
-- real RLS guarantee, not just something the UI chooses not to show —
-- artworks.* is fully public-readable via a plain `select *`.
create table artwork_private_notes (
  artwork_id uuid primary key references artworks (id) on delete cascade,
  notes text not null default '',
  updated_at timestamptz not null default now()
);

alter table artwork_private_notes enable row level security;

create policy "artwork_private_notes_select" on artwork_private_notes
  for select
  using (
    exists (
      select 1 from artworks a
      where a.id = artwork_id and auth_controls_profile(a.root_artist_id)
    )
  );

create policy "artwork_private_notes_insert" on artwork_private_notes
  for insert
  with check (
    exists (
      select 1 from artworks a
      where a.id = artwork_id and auth_controls_profile(a.root_artist_id)
    )
  );

create policy "artwork_private_notes_update" on artwork_private_notes
  for update
  using (
    exists (
      select 1 from artworks a
      where a.id = artwork_id and auth_controls_profile(a.root_artist_id)
    )
  );
